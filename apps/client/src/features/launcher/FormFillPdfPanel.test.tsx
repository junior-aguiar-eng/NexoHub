import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormFieldDescriptor } from "@/platform/pdf-form";
import { FormFillPdfPanel } from "./FormFillPdfPanel";

describe("FormFillPdfPanel", () => {
  const sampleFields: FormFieldDescriptor[] = [
    {
      name: "nomeCompleto",
      type: "text",
      currentValue: "Carlos Alberto",
      isReadOnly: false,
    },
    {
      name: "aceite",
      type: "checkbox",
      currentValue: true,
      isReadOnly: false,
    },
    {
      name: "pais",
      type: "dropdown",
      currentValue: "Brasil",
      options: ["Brasil", "Portugal", "Espanha"],
      isReadOnly: false,
    },
    {
      name: "plano",
      type: "radio",
      currentValue: "Pro",
      options: ["Basico", "Pro"],
      isReadOnly: false,
    },
  ];

  it("mostra seleções originais, permite multiseleção e preserva readonly ao limpar", () => {
    const onValuesChange = vi.fn();
    const fields: FormFieldDescriptor[] = [
      { name: "fixo", type: "text", currentValue: "Original", isReadOnly: true },
      {
        name: "idiomas",
        type: "option-list",
        currentValue: ["PT", "EN"],
        options: ["PT", "EN", "ES"],
        multiSelect: true,
        isReadOnly: false,
      },
    ];
    render(
      <FormFillPdfPanel
        fileName="form.pdf"
        fileSizeBytes={100}
        totalPages={1}
        fields={fields}
        values={{}}
        onValuesChange={onValuesChange}
        flatten={false}
        onFlattenChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Original")).toBeDisabled();
    const select = screen.getByLabelText("idiomas") as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    expect(Array.from(select.selectedOptions, (option) => option.value)).toEqual(["PT", "EN"]);
    select.options[0].selected = false;
    select.options[2].selected = true;
    fireEvent.change(select);
    expect(onValuesChange).toHaveBeenLastCalledWith({ fixo: "Original", idiomas: ["EN", "ES"] });
    fireEvent.click(screen.getByText("Limpar campos"));
    expect(onValuesChange).toHaveBeenLastCalledWith({ fixo: "Original", idiomas: [] });
  });

  it("renderiza o estado vazio quando o PDF não contém campos de formulário", () => {
    const onGoToSign = vi.fn();
    render(
      <FormFillPdfPanel
        fileName="sem_formulario.pdf"
        fileSizeBytes={1024 * 50}
        totalPages={1}
        fields={[]}
        values={{}}
        onValuesChange={vi.fn()}
        flatten={false}
        onFlattenChange={vi.fn()}
        onGoToSign={onGoToSign}
      />,
    );

    expect(screen.getByText("Nenhum campo interativo encontrado")).toBeDefined();
    const btn = screen.getByText("Abrir no Assinador de PDF");
    fireEvent.click(btn);
    expect(onGoToSign).toHaveBeenCalledOnce();
  });

  it("renderiza todos os campos de formulário e dispara alterações nos inputs", () => {
    const onValuesChange = vi.fn();
    const onFlattenChange = vi.fn();

    render(
      <FormFillPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={1024 * 120}
        totalPages={2}
        fields={sampleFields}
        values={{
          nomeCompleto: "Carlos Alberto",
          aceite: true,
          pais: "Brasil",
          plano: "Pro",
        }}
        onValuesChange={onValuesChange}
        flatten={false}
        onFlattenChange={onFlattenChange}
      />,
    );

    // Header & Meta
    expect(screen.getByText("contrato.pdf")).toBeDefined();
    expect(screen.getByText("nomeCompleto")).toBeDefined();
    expect(screen.getByText("aceite")).toBeDefined();
    expect(screen.getByText("pais")).toBeDefined();
    expect(screen.getByText("plano")).toBeDefined();

    // Input de texto
    const textInput = screen.getByDisplayValue("Carlos Alberto");
    fireEvent.change(textInput, { target: { value: "Carlos Silva" } });
    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nomeCompleto: "Carlos Silva",
      }),
    );

    // Toggle de Flatten
    const flattenCheckbox = screen.getByRole("checkbox", {
      name: /Achatar formulário/i,
    });
    fireEvent.click(flattenCheckbox);
    expect(onFlattenChange).toHaveBeenCalledWith(true);

    // Limpar campos
    const clearBtn = screen.getByText("Limpar campos");
    fireEvent.click(clearBtn);
    expect(onValuesChange).toHaveBeenCalledWith({
      nomeCompleto: "",
      aceite: false,
      pais: "",
      plano: "",
    });
  });
});

it("navega do campo para o widget e mantém foco no controle editado", () => {
  const onPreviewPageChange = vi.fn();
  render(
    <FormFillPdfPanel
      fileName="duas.pdf"
      fileSizeBytes={500}
      totalPages={2}
      fields={[{ name: "nome", type: "text", currentValue: "", isReadOnly: false, pages: [2] }]}
      values={{}}
      onValuesChange={vi.fn()}
      flatten={false}
      onFlattenChange={vi.fn()}
      onPreviewPageChange={onPreviewPageChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Ir para nome na página 2" }));
  expect(screen.getByRole("spinbutton", { name: "Página da prévia" })).toHaveValue(2);
  const field = screen.getByLabelText("nome");
  field.focus();
  expect(field).toHaveFocus();
  expect(onPreviewPageChange).toHaveBeenLastCalledWith(2);
});

it("não exibe a imagem original como revisão atual durante erro ou atualização", () => {
  const props = {
    fileName: "form.pdf",
    fileSizeBytes: 500,
    totalPages: 1,
    fields: samplePreviewFields(),
    values: {},
    onValuesChange: vi.fn(),
    flatten: false,
    onFlattenChange: vi.fn(),
    thumbnailUrl: "original.png",
  };
  const view = render(<FormFillPdfPanel {...props} revisionPreview={{ pending: true }} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Estado da prévia do formulário" })).toHaveTextContent(
    "Atualizando",
  );
  const retry = vi.fn();
  view.rerender(
    <FormFillPdfPanel
      {...props}
      revisionPreview={{ pending: false, error: "Falha de prévia" }}
      onRetryPreview={retry}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Falha de prévia");
  fireEvent.click(screen.getByRole("button", { name: "Tentar atualizar prévia" }));
  expect(retry).toHaveBeenCalledOnce();
});
function samplePreviewFields(): FormFieldDescriptor[] {
  return [{ name: "nome", type: "text", currentValue: "", isReadOnly: false, pages: [1] }];
}

it("não anuncia revisão pronta quando o documento não possui campos", () => {
  render(
    <FormFillPdfPanel
      fileName="sem-campos.pdf"
      fileSizeBytes={100}
      totalPages={1}
      fields={[]}
      values={{}}
      onValuesChange={vi.fn()}
      flatten={false}
      onFlattenChange={vi.fn()}
      revisionPreview={{ pending: false }}
    />,
  );
  expect(
    screen.getByRole("status", { name: "Estado da prévia do formulário" }),
  ).not.toHaveTextContent("Prévia atualizada");
});
