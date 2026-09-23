import asyncio
import json
from pathlib import Path
from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from app.celery_app import celery_app
from app.config import TMP_DIR

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

@router.get("/{task_id}/status")
async def get_task_status(task_id: str):
    res = AsyncResult(task_id, app=celery_app)
    if res.state == "PENDING":
        return {"status": "PENDING", "percent": 0, "message": "Aguardando worker..."}
    elif res.state == "PROGRESS":
        return {
            "status": "PROGRESS",
            "percent": res.info.get("percent", 50) if isinstance(res.info, dict) else 50,
            "message": res.info.get("status", "Processando...") if isinstance(res.info, dict) else "Processando..."
        }
    elif res.state == "SUCCESS":
        return {
            "status": "SUCCESS",
            "percent": 100,
            "result": res.result,
            "message": "Processamento concluído!"
        }
    elif res.state == "FAILURE":
        return {
            "status": "FAILURE",
            "percent": 100,
            "error": str(res.info),
            "message": "Falha no processamento."
        }
    return {"status": res.state, "info": str(res.info)}

@router.get("/{task_id}/stream")
async def stream_task_progress(task_id: str):
    """Transmite eventos SSE em tempo real do progresso da tarefa."""
    async def event_generator():
        last_percent = -1
        while True:
            res = AsyncResult(task_id, app=celery_app)
            state = res.state

            if state == "SUCCESS":
                data = {
                    "status": "SUCCESS",
                    "percent": 100,
                    "result": res.result,
                    "message": "Concluído com sucesso!"
                }
                yield f"data: {json.dumps(data)}\n\n"
                break
            elif state == "FAILURE":
                data = {
                    "status": "FAILURE",
                    "percent": 100,
                    "error": str(res.info),
                    "message": "Ocorreu um erro no processamento."
                }
                yield f"data: {json.dumps(data)}\n\n"
                break
            elif state == "PROGRESS":
                info = res.info if isinstance(res.info, dict) else {}
                percent = info.get("percent", 50)
                status_msg = info.get("status", "Processando no servidor...")
                if percent != last_percent:
                    last_percent = percent
                    data = {
                        "status": "PROGRESS",
                        "percent": percent,
                        "message": status_msg
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            else:
                data = {
                    "status": state,
                    "percent": 5,
                    "message": "Na fila do servidor..."
                }
                yield f"data: {json.dumps(data)}\n\n"

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/{task_id}/thumbnails/{filename}")
async def get_task_thumbnail(task_id: str, filename: str):
    thumb_path = TMP_DIR / task_id / "thumbnails" / filename
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Miniatura não encontrada.")
    return FileResponse(thumb_path, media_type="image/png")

@router.get("/{task_id}/download")
async def download_task_output(task_id: str):
    output_dir = TMP_DIR / task_id / "output"
    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="Diretório de saída não encontrado ou expirado.")

    files = list(output_dir.iterdir())
    if not files:
        raise HTTPException(status_code=404, detail="Arquivo resultante não encontrado.")

    output_file = files[0]
    return FileResponse(
        path=output_file,
        filename=output_file.name,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{output_file.name}"'}
    )
