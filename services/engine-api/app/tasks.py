from pathlib import Path
from typing import Any

from app.celery_app import celery_app
from app.engines import (
    compress_pdf,
    convert_office_document,
    images_to_pdf,
    merge_pdfs,
    perform_pdf_ocr,
    protect_pdf,
    rotate_pdf,
    split_pdf,
)


@celery_app.task(bind=True)
def run_pdf_task(self, tool_id: str, task_dir_str: str, params: dict[str, Any]) -> dict[str, Any]:
    task_dir = Path(task_dir_str)
    output_dir = task_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    self.update_state(state="PROGRESS", meta={"percent": 10, "status": "Iniciando processamento..."})

    try:
        if tool_id == "pdf-merge" or tool_id == "juntar-pdf":
            file_names = params.get("files", [])
            input_paths = [task_dir / "input" / name for name in file_names]
            output_path = output_dir / "merged_document.pdf"
            self.update_state(state="PROGRESS", meta={"percent": 40, "status": "Mesclando arquivos com qpdf..."})
            merge_pdfs(input_paths, output_path)
            self.update_state(state="PROGRESS", meta={"percent": 90, "status": "Finalizando PDF mesclado..."})
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-split" or tool_id == "dividir-pdf":
            file_name = params.get("file")
            page_range = params.get("range", "1-z")
            input_path = task_dir / "input" / file_name
            output_path = output_dir / f"split_{file_name}"
            self.update_state(state="PROGRESS", meta={"percent": 50, "status": "Extraindo páginas com qpdf..."})
            split_pdf(input_path, page_range, output_path)
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-rotate" or tool_id == "rotacionar-pdf":
            file_name = params.get("file")
            angle = int(params.get("angle", 90))
            page_spec = params.get("pages", "1-z")
            input_path = task_dir / "input" / file_name
            output_path = output_dir / f"rotated_{file_name}"
            self.update_state(state="PROGRESS", meta={"percent": 50, "status": "Aplicando rotação com qpdf..."})
            rotate_pdf(input_path, angle, page_spec, output_path)
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-compress" or tool_id == "comprimir-pdf":
            file_name = params.get("file")
            preset = params.get("level", "ebook")
            input_path = task_dir / "input" / file_name
            output_path = output_dir / f"compressed_{file_name}"
            self.update_state(state="PROGRESS", meta={"percent": 30, "status": "Otimizando streams e downsampling de imagens..."})
            _, orig_size, comp_size = compress_pdf(input_path, output_path, preset=preset)
            saved_bytes = max(0, orig_size - comp_size)
            saved_percent = round((saved_bytes / orig_size) * 100) if orig_size > 0 else 0
            result = {
                "output_filename": output_path.name,
                "file_size": comp_size,
                "orig_size": orig_size,
                "saved_bytes": saved_bytes,
                "saved_percent": saved_percent,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-to-word" or tool_id == "pdf-para-word":
            file_name = params.get("file")
            input_path = task_dir / "input" / file_name
            self.update_state(state="PROGRESS", meta={"percent": 40, "status": "Convertendo PDF para DOCX editável..."})
            out_file = convert_office_document(input_path, "docx", output_dir, self.request.id)
            result = {
                "output_filename": out_file.name,
                "file_size": out_file.stat().st_size,
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }

        elif tool_id == "word-to-pdf" or tool_id == "word-para-pdf":
            file_name = params.get("file")
            input_path = task_dir / "input" / file_name
            self.update_state(state="PROGRESS", meta={"percent": 40, "status": "Convertendo DOCX para PDF..."})
            out_file = convert_office_document(input_path, "pdf", output_dir, self.request.id)
            result = {
                "output_filename": out_file.name,
                "file_size": out_file.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "images-to-pdf" or tool_id == "imagem-para-pdf":
            file_names = params.get("files", [])
            input_paths = [task_dir / "input" / name for name in file_names]
            output_path = output_dir / "images_converted.pdf"
            self.update_state(state="PROGRESS", meta={"percent": 50, "status": "Empacotando imagens em PDF sem perdas..."})
            images_to_pdf(input_paths, output_path)
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-ocr" or tool_id == "ocr-pdf":
            file_name = params.get("file")
            lang = params.get("language", "por+eng")
            input_path = task_dir / "input" / file_name
            output_path = output_dir / f"ocr_{file_name}"
            self.update_state(state="PROGRESS", meta={"percent": 40, "status": "Reconhecendo texto e gerando camada OCR..."})
            perform_pdf_ocr(input_path, output_path, language=lang)
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        elif tool_id == "pdf-protect" or tool_id == "proteger-pdf":
            file_name = params.get("file")
            password = params.get("password", "")
            input_path = task_dir / "input" / file_name
            output_path = output_dir / f"protected_{file_name}"
            self.update_state(state="PROGRESS", meta={"percent": 50, "status": "Criptografando com AES-256..."})
            protect_pdf(input_path, password, password, output_path)
            result = {
                "output_filename": output_path.name,
                "file_size": output_path.stat().st_size,
                "mime_type": "application/pdf"
            }

        else:
            raise ValueError(f"Ferramenta desconhecida: {tool_id}")

        self.update_state(state="PROGRESS", meta={"percent": 100, "status": "Concluído!"})
        result["status"] = "SUCCESS"
        return result

    except Exception as exc:
        self.update_state(state="FAILURE", meta={"error": str(exc)})
        raise
