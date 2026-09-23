from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import tasks, tools

app = FastAPI(
    title="NexoHub Document Engine API",
    version="1.0.0",
    description="Motor de processamento real de documentos e PDFs de alta performance"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools.router)
app.include_router(tasks.router)

@app.get("/healthz")
async def health_check():
    return {"status": "ok", "service": "nexohub-engine-api"}
