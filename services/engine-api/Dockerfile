FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TMP_DIR=/tmp/pdf_tasks

# Instalação dos pacotes essenciais do sistema para manipulação de PDFs e documentos
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf \
    poppler-utils \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    ocrmypdf \
    libreoffice --no-install-recommends \
    libmagic1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p ${TMP_DIR}

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
