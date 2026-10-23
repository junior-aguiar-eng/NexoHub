/**
 * Regrava o grafo de objetos decriptado pelo PDF.js, preservando referências,
 * filtros de compressão, formulários e catálogo. Nunca rasteriza páginas.
 * A ponte para o worker está limitada à versão homologada 6.3.289 no Vite.
 */
export interface PdfProtectionStatus {
  readonly isProtected: boolean;
  readonly needsPassword: boolean;
  readonly hasPermissionsRestriction: boolean;
}

export interface UnlockPdfOptions {
  readonly password?: string;
}

type Internals = typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-unlock-internals");
const loadInternals = () =>
  import("pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-unlock-internals");

function isPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === "PasswordException";
}

function managerFor(internals: Internals, bytes: Uint8Array, password: string) {
  return new internals.LocalPdfManager({
    // O parser só recebe sua própria cópia; o buffer importado é imutável.
    source: bytes.slice(),
    docId: "nexohub-unlock",
    password,
    evaluatorOptions: { isEvalSupported: false },
    handler: {
      send() {},
      async sendWithPromise() {
        throw new Error("PDF_UNLOCK_EXTERNAL_RESOURCE_UNAVAILABLE");
      },
    },
  });
}

/** Arquivos inválidos não são apresentados como documentos livres. */
export async function checkPdfProtection(bytes: Uint8Array): Promise<PdfProtectionStatus> {
  if (!bytes.byteLength) throw new Error("EMPTY_DOCUMENT");
  const internals = await loadInternals();
  const manager = managerFor(internals, bytes, "");
  let initialized = false;
  try {
    await manager.initDocument(false);
    initialized = true;
    const { xref } = manager.pdfDocument;
    const isProtected = xref.trailer.has("Encrypt");
    const encryption = xref.trailer.get("Encrypt");
    const permissions = encryption instanceof internals.Dict ? encryption.get("P") : undefined;
    return {
      isProtected,
      needsPassword: false,
      hasPermissionsRestriction:
        isProtected && typeof permissions === "number" && (permissions & 0xf3c) !== 0xf3c,
    };
  } catch (error) {
    if (isPasswordError(error)) {
      return { isProtected: true, needsPassword: true, hasPermissionsRestriction: true };
    }
    throw error;
  } finally {
    if (initialized) await manager.cleanup();
    manager.terminate();
  }
}

export async function unlockPdfDocument(
  bytes: Uint8Array,
  options: UnlockPdfOptions = {},
): Promise<Uint8Array> {
  if (!bytes.byteLength) throw new Error("EMPTY_DOCUMENT");
  const internals = await loadInternals();
  // Espaços são parte válida da senha; nunca usar trim().
  const password = options.password ?? "";
  const manager = managerFor(internals, bytes, password);
  let initialized = false;
  try {
    try {
      await manager.initDocument(false);
      initialized = true;
    } catch (error) {
      if (isPasswordError(error)) {
        throw new Error(password.length ? "SENHA_INCORRETA" : "SENHA_OBRIGATORIA");
      }
      throw error;
    }
    const { xref } = manager.pdfDocument;
    if (!xref.trailer.has("Encrypt")) return bytes.slice();

    const size = xref.trailer.get("Size");
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1) {
      throw new Error("PDF_UNLOCK_INVALID_XREF");
    }
    const encryptionRef = xref.trailer.getRaw("Encrypt");
    const encryption = xref.trailer.get("Encrypt");
    const metadataIsPlain =
      encryption instanceof internals.Dict && encryption.get("EncryptMetadata") === false;
    const changes = new internals.RefMap();
    changes.put(internals.Ref.get(0, 0xffff), { data: null });
    for (let number = 1; number < size; number++) {
      const entry = xref.getEntry(number);
      if (!entry) continue;
      const ref = internals.Ref.get(number, entry.uncompressed ? entry.gen : 0);
      if (encryptionRef instanceof internals.Ref && encryptionRef.num === number) continue;
      let data = xref.fetch(ref);
      if (data instanceof internals.BaseStream) {
        const type = data.dict.get("Type");
        // Contêineres de objetos e índices antigos são substituídos pelo novo xref.
        if (type instanceof internals.Name && ["XRef", "ObjStm"].includes(type.name)) continue;
        // EncryptMetadata=false mantém o XMP em claro no arquivo de entrada.
        if (type instanceof internals.Name && type.name === "Metadata" && metadataIsPlain) {
          data = xref.fetch(ref, true);
        }
      }
      const dict =
        data instanceof internals.BaseStream
          ? data.dict
          : data instanceof internals.Dict
            ? data
            : null;
      if (dict?.has("ByteRange")) throw new Error("PDF_ASSINADO_NAO_SUPORTADO");
      // Filtros Crypt explícitos precisam de normalização própria. Evitar qualquer
      // saída silenciosamente inválida até haver fixture real homologada.
      const filter = dict?.get("Filter");
      const filters = Array.isArray(filter) ? filter : [filter];
      if (filters.some((item) => item instanceof internals.Name && item.name === "Crypt")) {
        throw new Error("PDF_UNLOCK_CRYPT_FILTER_UNSUPPORTED");
      }
      changes.put(ref, { data });
    }
    return await internals.incrementalUpdate({
      originalData: new Uint8Array([
        ...new TextEncoder().encode(`%PDF-${manager.pdfDocument.version ?? "1.7"}\n`),
        37,
        250,
        222,
        250,
        206,
        10,
      ]),
      changes,
      xref: { encrypt: null },
      xrefInfo: {
        newRef: internals.Ref.get(size, 0),
        rootRef: xref.trailer.getRaw("Root"),
        infoRef: xref.trailer.getRaw("Info"),
        fileIds: xref.trailer.get("ID"),
        infoMap: new Map(),
      },
    });
  } finally {
    if (initialized) await manager.cleanup();
    manager.terminate();
  }
}
