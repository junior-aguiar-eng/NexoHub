import { useEffect, useMemo, useRef, useState } from "react";
import { translate } from "@/i18n";
import {
  extractPdfSpreadsheetData,
  type PdfSpreadsheetData,
  type PdfToExcelOptions,
  type SpreadsheetRegion,
  validateSpreadsheetSelection,
} from "@/platform/excel-converter";
import { parseSelectedPages } from "./tool-metadata-registry";

type UsePdfToExcelStateParams = {
  toolId: string;
  firstFile: File | undefined;
  pdfPageCount: number;
  onInvalidateOutput: () => void;
};

export function usePdfToExcelState({
  toolId,
  firstFile,
  pdfPageCount,
  onInvalidateOutput,
}: UsePdfToExcelStateParams) {
  const [excelOutputFormat, setExcelOutputFormat] = useState<"xlsx" | "csv">("xlsx");
  const [excelSheetMode, setExcelSheetMode] = useState<"per-page" | "single-sheet">("per-page");
  const [excelCsvDelimiter, setExcelCsvDelimiter] = useState<"," | ";" | "\t">(";");
  const [excelDetectTablesOnly, setExcelDetectTablesOnly] = useState<boolean>(false);
  const [excelPagesText, setExcelPagesText] = useState("");
  const [excelSeparatorsText, setExcelSeparatorsText] = useState("");
  const [excelRegion, setExcelRegion] = useState<SpreadsheetRegion>({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });
  const [excelPreserveText, setExcelPreserveText] = useState(true);
  const [excelPreviewPage, setExcelPreviewPage] = useState(1);
  const excelController = useRef<AbortController | null>(null);

  const excelSelection = useMemo<{ options?: PdfToExcelOptions; error?: string }>(() => {
    const selectedPages = excelPagesText.trim()
      ? parseSelectedPages(excelPagesText, pdfPageCount)
      : undefined;
    const columnSeparators = excelSeparatorsText.trim()
      ? excelSeparatorsText
          .split(";")
          .map((value) =>
            /^\d+(?:[.,]\d+)?$/.test(value.trim())
              ? Number(value.trim().replace(",", ".")) / 100
              : Number.NaN,
          )
      : undefined;
    const options: PdfToExcelOptions = {
      selectedPages,
      region: excelRegion,
      columnSeparators,
      detectTablesOnly: excelDetectTablesOnly,
      preserveText: excelPreserveText,
    };
    try {
      validateSpreadsheetSelection(options, pdfPageCount);
      return { options };
    } catch {
      return { error: translate("excel.invalidSelection") };
    }
  }, [
    excelPagesText,
    excelSeparatorsText,
    excelRegion,
    excelDetectTablesOnly,
    excelPreserveText,
    pdfPageCount,
  ]);

  const [excelPreview, setExcelPreview] = useState<{
    file: File;
    options: PdfToExcelOptions;
    data: PdfSpreadsheetData;
  }>();

  const excelPreviewReady =
    excelPreview?.file === firstFile &&
    excelPreview?.options === excelSelection.options &&
    Boolean(excelSelection.options);

  const excelPreviewRows = excelPreviewReady
    ? excelPreview?.data.sheets
        .find((sheet) => sheet.pageIndex === excelPreviewPage - 1)
        ?.rows.slice(0, 15)
    : undefined;

  const [excelPreviewError, setExcelPreviewError] = useState<string>();
  const [isAnalyzingExcel, setIsAnalyzingExcel] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: seleção revisada pertence ao arquivo e à ferramenta atuais.
  useEffect(() => {
    setExcelPagesText("");
    setExcelSeparatorsText("");
    setExcelRegion({ left: 0, top: 0, width: 1, height: 1 });
    setExcelPreviewPage(1);
  }, [firstFile, toolId]);

  useEffect(() => {
    const pages = excelSelection.options?.selectedPages;
    if (pages?.length && !pages.includes(excelPreviewPage)) setExcelPreviewPage(pages[0]);
  }, [excelSelection, excelPreviewPage]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: todas as opções e a entrada invalidam o resultado em andamento.
  useEffect(() => {
    if (toolId !== "pdf-to-excel") return;
    onInvalidateOutput();
    return () => {
      excelController.current?.abort();
      excelController.current = null;
    };
  }, [firstFile, toolId, excelSelection, excelOutputFormat, excelSheetMode, excelCsvDelimiter]);

  useEffect(() => {
    const controller = new AbortController();
    setExcelPreview(undefined);
    setExcelPreviewError(undefined);
    if (toolId !== "pdf-to-excel" || !firstFile || !excelSelection.options) {
      setIsAnalyzingExcel(false);
      if (toolId === "pdf-to-excel") setExcelPreviewError(excelSelection.error);
      return;
    }
    setIsAnalyzingExcel(true);
    void firstFile
      .arrayBuffer()
      .then((bytes) =>
        extractPdfSpreadsheetData(new Uint8Array(bytes), {
          ...excelSelection.options,
          signal: controller.signal,
        }),
      )
      .then((result) => {
        if (!controller.signal.aborted && excelSelection.options)
          setExcelPreview({ file: firstFile, options: excelSelection.options, data: result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const code = error instanceof Error ? error.message : "";
        setExcelPreviewError(
          translate(
            code === "PDF_SEM_TEXTO_SELECIONAVEL"
              ? "document.errorPdfNoText"
              : code === "PDF_REGIAO_CORTA_TEXTO"
                ? "excel.regionCutsText"
                : code === "PDF_SEPARADOR_CORTA_TEXTO"
                  ? "excel.separatorCutsText"
                  : code === "PDF_SEM_DADOS_SELECAO"
                    ? "excel.emptySelection"
                    : code === "OPCOES_PLANILHA_INVALIDAS"
                      ? "excel.invalidSelection"
                      : code === "PDF_SEM_TABELAS"
                        ? "excel.noTables"
                        : "excel.previewError",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAnalyzingExcel(false);
      });
    return () => {
      controller.abort();
    };
  }, [firstFile, toolId, excelSelection]);

  return {
    excelOutputFormat,
    setExcelOutputFormat,
    excelSheetMode,
    setExcelSheetMode,
    excelCsvDelimiter,
    setExcelCsvDelimiter,
    excelDetectTablesOnly,
    setExcelDetectTablesOnly,
    excelPagesText,
    setExcelPagesText,
    excelSeparatorsText,
    setExcelSeparatorsText,
    excelRegion,
    setExcelRegion,
    excelPreserveText,
    setExcelPreserveText,
    excelPreviewPage,
    setExcelPreviewPage,
    excelController,
    excelSelection,
    excelPreviewReady,
    excelPreviewRows,
    excelPreviewError,
    isAnalyzingExcel,
  };
}
