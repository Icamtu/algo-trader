FROM python:3.11-slim
WORKDIR /app
# Install system dependencies for scipy, numpy and postgres (psycopg2)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    gfortran \
    libopenblas-dev \
    python3-dev \
    wget \
    gnupg \
    unzip \
    ca-certificates \
    curl \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-u", "main.py"]
