import logging
import shutil
import time

from app.config import TASK_TTL_SECONDS, TMP_DIR

logger = logging.getLogger("nexohub.cleanup")

def purge_expired_tasks(ttl_seconds: int = TASK_TTL_SECONDS) -> int:
    """Remove pastas de tarefas temporárias que excederam o tempo de vida (TTL)."""
    if not TMP_DIR.exists():
        return 0

    now = time.time()
    purged_count = 0

    for item in TMP_DIR.iterdir():
        if item.is_dir():
            try:
                mtime = item.stat().st_mtime
                if now - mtime > ttl_seconds:
                    shutil.rmtree(item, ignore_errors=True)
                    purged_count += 1
                    logger.info(f"Purged expired task directory: {item.name}")
            except Exception as exc:  # noqa: BLE001
                logger.error(f"Error purging {item}: {exc}")

    return purged_count
