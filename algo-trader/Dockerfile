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
    ca-certificates \
    curl \
    chromium \
    chromium-driver \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
