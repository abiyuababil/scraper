FROM python:3.10-slim

# Install dependency sistem untuk OpenCV & EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements dan install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh file project
COPY . .

# Hugging Face Spaces port default = 7860
EXPOSE 7860

# Jalankan uvicorn server pada port 7860
CMD ["uvicorn", "web_app:app", "--host", "0.0.0.0", "--port", "7860"]
