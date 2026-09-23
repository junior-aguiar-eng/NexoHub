import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TMP_DIR = Path(os.getenv("TMP_DIR", "/tmp/pdf_tasks"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
TASK_TTL_SECONDS = int(os.getenv("TASK_TTL_SECONDS", "3600"))  # 60 minutos

TMP_DIR.mkdir(parents=True, exist_ok=True)
