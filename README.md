---
title: Kamisan IG Scraper & EasyOCR Tool
emoji: 📷
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Instagram Kamisan Post OCR & Scraper Web Application

Aplikasi Web modern berbasis Python, FastAPI, dan EasyOCR untuk mengekstraksi media (Selebaran & Foto Aksi), nomor aksi Kamisan, serta mengenali teks dari gambar selebaran Aksi Kamisan.

## 🚀 Fitur Utama
- **Auto-Extract Post Instagram:** Mengekstrak gambar selebaran & foto dokumentasi aksi dari URL Instagram.
- **Smart Public Fallback (Anti 403 / Anti Login Required):** Menggunakan API Public OEmbed jika GraphQL Instaloader dibatasi.
- **EasyOCR Engine:** Layout-aware text reconstruction (mempertahankan struktur baris & paragraf selebaran).
- **Side-by-Side Live Text Editor:** Editor 1 layar penuh (*Fullscreen Workspace*) untuk menyunting teks OCR berdampingan dengan gambar selebaran.
- **Dynamic File Export:** Export ke **Spreadsheet CSV** & **JSON** dengan penamaan file otomatis berdasarkan nomor aksi (contoh: `794-796.csv` / `794-796.json`).

## 🛠️ Instalasi Lokal
```bash
pip install -r requirements.txt
python web_app.py
```
Akses di browser: `http://localhost:8000`

## ☁️ Deployment ke Hugging Face Spaces
Space ini menggunakan `sdk: docker` dan berjalan pada port `7860`.
