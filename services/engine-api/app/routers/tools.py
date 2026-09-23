import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import TMP_DIR
from app.engines.thumbnails import generate_pdf_thumbnails
from app.tasks import run_pdf_task

router = APIRouter(prefix="/api/v1/tools", tags=["tools"])

class ProcessRequest(BaseModel):
    task_id: str
    params: dict[str, Any] = {}

@router.post("/{tool_id}/upload")
async def upload_files_for_tool(
    tool_id: str,
    files: list[UploadFile] = File(...),  # noqa: B008
):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    task_id = str(uuid.uuid4())
    task_dir = TMP_DIR / task_id
    input_dir = task_dir / "input"
    thumb_dir = task_dir / "thumbnails"
    input_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for file in files:
        safe_filename = Path(file.filename).name
        dest_path = input_dir / safe_filename
        with open(dest_path, "wb") as buffer:  # noqa: ASYNC230
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(safe_filename)

    # Gera thumbnails reais automaticamente se o primeiro arquivo for PDF
    thumbnails = []
    first_file = input_dir / saved_files[0]
    if first_file.suffix.lower() == ".pdf":
        try:
            thumb_paths = generate_pdf_thumbnails(first_file, thumb_dir, dpi=100, max_pages=30)
            thumbnails = [f"/api/v1/tasks/{task_id}/thumbnails/{p.name}" for p in thumb_paths]
        except Exception:  # noqa: BLE001
            thumbnails = []

    return {
        "task_id": task_id,
        "files": saved_files,
        "thumbnails": thumbnails,
        "tool_id": tool_id
    }

@router.post("/{tool_id}/process")
async def start_tool_processing(
    tool_id: str,
    body: ProcessRequest,
):
    task_id = body.task_id
    task_dir = TMP_DIR / task_id

    if not task_dir.exists():
        raise HTTPException(status_code=404, detail="Sessão de arquivo não encontrada ou expirada.")

    # Dispara a tarefa assíncrona no Celery
    run_pdf_task.apply_async(
        args=[tool_id, str(task_dir), body.params],
        task_id=task_id
    )

    return {
        "task_id": task_id,
        "status": "QUEUED",
        "message": "Processamento iniciado no servidor."
    }
