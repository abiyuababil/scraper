# Instagram Kamisan Scraper + OCR

Scraping postingan Kamisan dari Instagram, download gambar, OCR, dan format output.

## Struktur File

```
instagram_scraper/
├── main.py            # Entry point utama — jalankan ini
├── config.py          # ⚙️ Konfigurasi (edit ini dulu!)
├── scraper.py         # Logic Instaloader
├── ocr_engine.py      # EasyOCR + klasifikasi gambar
├── output_handler.py  # Simpan JSON / CSV / TXT
├── login_helper.py    # Helper login akun dummy (sekali saja)
├── requirements.txt
└── results/           # Output otomatis dibuat di sini
    ├── kamisan_data.json
    ├── kamisan_data.csv
    └── kamisan_formatted.txt
```

---

## Setup & Cara Pakai

### 1. Install Dependencies

```bash
cd instagram_scraper
pip install -r requirements.txt
```

> **Catatan:** EasyOCR akan download model ~100MB saat pertama kali dijalankan.

---

### 2. Edit `config.py`

Buka `config.py` dan ubah:

```python
TARGET_USERNAME = "akun_target_instagram"   # username target
SESSION_USERNAME = "username_dummy_kamu"    # username akun dummy
```

---

### 3. Login Akun Dummy (Sekali Saja)

```bash
python login_helper.py
```

Masukkan username & password akun dummy. Session tersimpan otomatis — tidak perlu login lagi.

---

### 4. Jalankan Scraper

```bash
python main.py
```

---

## Output Format

**`kamisan_formatted.txt`** (format utama):

```
Kamisan ke-754
Sumber: https://www.instagram.com/p/XXXXXXXXX/
Selebaran: https://instagram.fxxx.jpg
Foto: https://instagram.fxxx.jpg

============================================================

Kamisan ke-753
...
```

**`kamisan_data.csv`** — tabel dengan kolom:
`kamisan_number | post_url | date_utc | selebaran | foto | caption`

**`kamisan_data.json`** — data lengkap termasuk teks hasil OCR.

---

## Cara Kerja Klasifikasi Gambar

Post Kamisan biasanya **carousel** (beberapa gambar). Script:
1. Download semua gambar dari post
2. Jalankan OCR pada masing-masing
3. Gambar dengan **teks OCR terbanyak** → diklasifikasikan sebagai **Selebaran**
4. Gambar sisanya → diklasifikasikan sebagai **Foto Aksi**

Threshold dapat disesuaikan di `config.py`:
```python
SELEBARAN_TEXT_THRESHOLD = 20  # minimal 20 karakter
```

---

## Tips Anti-Ban

- Gunakan akun **dummy** (bukan akun utama)
- Delay antar post sudah diatur otomatis di `config.py` (4-9 detik)
- Jangan jalankan scraper terlalu sering dalam sehari
- Jika kena checkpoint Instagram, istirahat 24 jam
