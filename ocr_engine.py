# ============================================================
#  ocr_engine.py — OCR Engine & Image Classifier
# ============================================================

import requests
import easyocr
from PIL import Image
from io import BytesIO
from config import OCR_LANGUAGES, SELEBARAN_TEXT_THRESHOLD

# EasyOCR reader diinisialisasi sekali (download model ~100MB pertama kali)
print("[OCR] Memuat EasyOCR engine...")
_reader = easyocr.Reader(OCR_LANGUAGES, verbose=False)
print("[OCR] EasyOCR siap.")


def _download_image(url: str) -> Image.Image | None:
    """Download gambar dari URL ke objek PIL Image (tanpa simpan ke disk)."""
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return Image.open(BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        print(f"  [OCR] Gagal download gambar {url}: {e}")
        return None


def _preprocess_image(img: Image.Image) -> Image.Image:
    """Preprocessing sederhana untuk meningkatkan akurasi OCR."""
    from PIL import ImageEnhance, ImageFilter
    # Tingkatkan kontras dan sharpness
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Sharpness(img).enhance(2.0)
    return img


def _reconstruct_layout_text(raw_results: list) -> str:
    """
    Mengurutkan dan mengelompokkan teks OCR berdasarkan koordinat posisi bounding box (Y & X).
    Menghasilkan string dengan newline (\n) sesuai tata letak baris/paragraf pada selebaran asli.
    `raw_results` berupa list of [bbox, text, confidence] dari EasyOCR (detail=1).
    """
    if not raw_results:
        return ""

    items = []
    for item in raw_results:
        bbox, text, conf = item[0], item[1], item[2]
        if not text or not text.strip():
            continue
        # bbox format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        y_top = min(p[1] for p in bbox)
        y_bottom = max(p[1] for p in bbox)
        x_left = min(p[0] for p in bbox)
        y_center = (y_top + y_bottom) / 2
        height = max(y_bottom - y_top, 10)
        items.append({
            "text": text.strip(),
            "y_center": y_center,
            "x_left": x_left,
            "height": height
        })

    if not items:
        return ""

    # Urutkan berdasarkan Y (dari atas ke bawah)
    items.sort(key=lambda item: item["y_center"])

    # Kelompokkan ke dalam baris-baris berdasar kedekatan Y-center
    lines = []
    current_line = [items[0]]
    current_y = items[0]["y_center"]
    avg_height = items[0]["height"]

    for item in items[1:]:
        threshold = max(avg_height * 0.65, 12)
        if abs(item["y_center"] - current_y) <= threshold:
            current_line.append(item)
        else:
            # Urutkan dari kiri ke kanan dalam 1 baris
            current_line.sort(key=lambda it: it["x_left"])
            lines.append(" ".join(it["text"] for it in current_line))
            current_line = [item]
            current_y = item["y_center"]
            avg_height = item["height"]

    if current_line:
        current_line.sort(key=lambda it: it["x_left"])
        lines.append(" ".join(it["text"] for it in current_line))

    return "\n".join(lines)


def run_ocr_on_url(url: str) -> str:
    """
    Download gambar dari URL dan jalankan OCR.
    Kembalikan teks yang diekstrak berformat paragraf/baris sesuai layout selebaran.
    """
    img = _download_image(url)
    if img is None:
        return ""
    img = _preprocess_image(img)

    # Simpan ke BytesIO untuk dikirim ke EasyOCR
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    try:
        # detail=1 (default) mengembalikan tuple (bbox, text, prob)
        results = _reader.readtext(buf.read(), detail=1)
        formatted_text = _reconstruct_layout_text(results)
        return formatted_text
    except Exception as e:
        print(f"  [OCR] Error saat OCR: {e}")
        return ""


def classify_images(image_urls: list[str]) -> dict:
    """
    Ambil list URL gambar dari satu post (carousel/sidecar),
    jalankan OCR pada masing-masing, lalu klasifikasikan:
      - 'selebaran'  : gambar dengan jumlah teks OCR terbanyak (jika >= threshold)
      - 'foto'       : semua gambar lainnya

    Return:
    {
        "selebaran": str | None,   # URL gambar selebaran (atau None jika tidak ada)
        "foto": list[str],         # List URL gambar foto
        "ocr_texts": dict          # {url: ocr_text} untuk semua gambar
    }
    """
    if not image_urls:
        return {"selebaran": None, "foto": [], "ocr_texts": {}}

    ocr_results = {}
    for url in image_urls:
        print(f"  [OCR] Memproses gambar: {url[:60]}...")
        text = run_ocr_on_url(url)
        ocr_results[url] = text
        print(f"        → {len(text)} karakter teks ditemukan")

    # Cari gambar dengan teks terbanyak sebagai kandidat selebaran
    best_url = max(ocr_results, key=lambda u: len(ocr_results[u]))
    best_text_len = len(ocr_results[best_url])

    if best_text_len >= SELEBARAN_TEXT_THRESHOLD:
        selebaran_url = best_url
        foto_urls = [u for u in image_urls if u != selebaran_url]
    else:
        # Tidak ada gambar yang cukup teks → anggap semua foto
        selebaran_url = None
        foto_urls = image_urls

    return {
        "selebaran": selebaran_url,
        "foto": foto_urls,
        "ocr_texts": ocr_results,
    }
