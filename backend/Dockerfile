FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY master_agent/requirements.txt ./master_agent/requirements.txt
RUN pip install --no-cache-dir \
    -r requirements.txt \
    -r master_agent/requirements.txt

COPY . .

WORKDIR /app/master_agent

ENV TESSERACT_CMD=/usr/bin/tesseract
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
