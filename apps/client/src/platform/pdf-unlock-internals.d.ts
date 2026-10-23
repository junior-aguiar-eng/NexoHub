/** Ponte isolada para PDF.js 6.3.289; exports adicionados pelo plugin Vite. */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-unlock-internals" {
  export class Ref {
    readonly num: number;
    readonly gen: number;
    static get(num: number, gen: number): Ref;
  }
  export class Name {
    readonly name: string;
  }
  export class Dict {
    get(key: string): unknown;
    getRaw(key: string): unknown;
    has(key: string): boolean;
    getRawEntries(): Iterable<[string, unknown]>;
  }
  export class BaseStream {
    readonly dict: Dict;
  }
  export class RefMap {
    put(ref: Ref, value: { data: unknown }): void;
  }
  interface XRef {
    readonly trailer: Dict;
    readonly encrypt: { readonly encryptMetadata: boolean } | null;
    getEntry(num: number): { readonly uncompressed: boolean; readonly gen: number } | null;
    fetch(ref: Ref, suppressEncryption?: boolean): unknown;
  }
  export class LocalPdfManager {
    readonly pdfDocument: { readonly xref: XRef; readonly version: string | null };
    constructor(options: {
      source: Uint8Array;
      docId: string;
      password: string;
      evaluatorOptions: Record<string, unknown>;
      handler: { send(): void; sendWithPromise(): Promise<never> };
    });
    initDocument(recoveryMode: boolean): Promise<void>;
    cleanup(): Promise<void>;
    terminate(reason?: unknown): void;
  }
  export function incrementalUpdate(options: {
    originalData: Uint8Array;
    changes: RefMap;
    xref: { encrypt: null };
    xrefInfo: {
      newRef: Ref;
      rootRef: unknown;
      infoRef: unknown;
      fileIds: unknown;
      infoMap: Map<string, string>;
    };
  }): Promise<Uint8Array>;
}
