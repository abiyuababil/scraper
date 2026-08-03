# ============================================================
#  config.py — Konfigurasi Instagram Kamisan Scraper
# ============================================================
# Ganti nilai-nilai di bawah sesuai kebutuhan.

# Username Instagram yang ingin di-scrape
TARGET_USERNAME = "sumarsihmaria"  # <-- Ganti ini

# Frasa/Keyword spesifik yang ada di caption postingan Kamisan
# Menargetkan frasa khas seperti "Terima kasih atas kebersamaan", "AksiKamisan ke-", dsb.
CAPTION_KEYWORDS = [
    "terima kasih atas kebersamaan",
    "aksikamisan ke-",
    "aksikamisan ke",
    "sampai jumpa lagi pada hari kamis",
    "youtube @ylbhi",
]

# Mode pencarian:
# "ANY"  -> Jika SALAH SATU frasa di atas ada di caption, maka lolos filter (Rekomendasi)
# "ALL"  -> Harus SEMUA frasa di atas ada di caption
CAPTION_MATCH_MODE = "ANY"

# Batas maksimum post yang diproses (set None untuk semua post)
MAX_POSTS = None  # Contoh: 200 untuk batas 200 post

# Delay antar-fetch post (detik) — penting untuk menghindari rate limit
DELAY_MIN = 4.0   # minimum delay
DELAY_MAX = 9.0   # maximum delay

# Path session file Instaloader
# Setelah login via: instaloader --login=USERNAME_DUMMY
# Session file biasanya ada di: C:/Users/<User>/AppData/Local/instaloader/session-USERNAME
# Atau jalankan: python -c "import instaloader; L=instaloader.Instaloader(); L.interactive_login('USERNAME_DUMMY')"
SESSION_USERNAME = "huh.photos"  # <-- Ganti ini (username akun dummy)

# Folder output hasil scraping
OUTPUT_DIR = "results"

# Nama file output
OUTPUT_JSON = "kamisan_data.json"
OUTPUT_CSV  = "kamisan_data.csv"
OUTPUT_TXT  = "kamisan_formatted.txt"

# Bahasa OCR (EasyOCR language codes)
OCR_LANGUAGES = ["id", "en"]

# Minimum jumlah karakter teks OCR agar gambar diklasifikasikan sebagai "Selebaran"
# Gambar dengan OCR text >= threshold ini dianggap selebaran/flyer
SELEBARAN_TEXT_THRESHOLD = 20
