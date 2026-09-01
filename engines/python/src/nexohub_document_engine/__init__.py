"""NexoHub document engine package boundary."""

from .ocr import OcrResult, recognize_document

__all__ = ["OcrResult", "__version__", "recognize_document"]

__version__ = "0.0.0"
