# ============================================================
#  web_app.py — FastAPI Web Application Server
# ============================================================

import os
import re
import json
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from post_parser import fetch_post_details
from ocr_engine import classify_images

app = FastAPI(
    title="Instagram Kamisan Post Processor & OCR Tool",
    description="Web Tool untuk memproses URL post Instagram Kamisan, OCR gambar, dan mengklasifikasikan Selebaran vs Foto Aksi."
)

# Setup Static Files & Templates
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


class ProcessRequest(BaseModel):
    urls: list[str]


class FetchAccountRequest(BaseModel):
    username: str = "sumarsihmaria"
    limit: int = 50


from fastapi.responses import FileResponse

@app.get("/")
def read_root(request: Request):
    """Render antarmuka utama Web UI."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/archive")
def read_archive_viewer():
    """Render antarmuka Katalog Arsip Publik."""
    return FileResponse(os.path.join(BASE_DIR, "archive_viewer.html"))


@app.get("/archive.json")
def get_archive_json():
    """Endpoint untuk menyajikan file data archive.json."""
    archive_file = os.path.join(BASE_DIR, "archive.json")
    if os.path.exists(archive_file):
        return FileResponse(archive_file, media_type="application/json")
    return []


@app.post("/api/fetch-account-urls")
def fetch_urls_from_account(payload: FetchAccountRequest):
    """Endpoint API untuk memetik list URL post dari username target."""
    from get_profile_urls import fetch_profile_post_urls
    username = payload.username.strip().replace("@", "")
    if not username:
        raise HTTPException(status_code=400, detail="Username Instagram tidak boleh kosong")

    urls = fetch_profile_post_urls(username, max_count=payload.limit)
    return {
        "username": username,
        "total": len(urls),
        "urls": urls
    }


@app.post("/api/process")
def process_posts(payload: ProcessRequest):
    """
    Endpoint API untuk memproses list URL Instagram Post:
    1. Fetch metadata post & image URLs per post.
    2. Jalankan EasyOCR pada setiap gambar.
    3. Klasifikasikan Selebaran (gambar dengan teks terbanyak) vs Foto Aksi.
    4. Kembalikan data JSON terstruktur.
    """
    if not payload.urls:
        raise HTTPException(status_code=400, detail="List URL tidak boleh kosong")

    results = []
    errors = []

    for idx, url in enumerate(payload.urls, 1):
        url = url.strip()
        if not url:
            continue

        print(f"\n[WebAPI] ({idx}/{len(payload.urls)}) Memproses URL: {url}")
        
        # 1. Fetch detail post
        post_data = fetch_post_details(url)
        if not post_data["success"]:
            errors.append(post_data["error"])
            # Masukkan entri error fallback agar user tahu mana URL yang gagal
            results.append({
                "shortcode": post_data["shortcode"],
                "post_url": post_data["post_url"],
                "kamisan_number": "?",
                "selebaran": None,
                "foto": [],
                "error": post_data["error"],
                "caption": ""
            })
            continue

        image_urls = post_data.get("image_urls", [])

        # 2. Jalankan OCR & klasifikasi
        if image_urls:
            classified = classify_images(image_urls)
        else:
            classified = {"selebaran": None, "foto": [], "ocr_texts": {}}

        # Dapatkan teks OCR khusus untuk gambar selebaran jika ada
        selebaran_url = classified.get("selebaran")
        selebaran_ocr_text = classified.get("ocr_texts", {}).get(selebaran_url, "") if selebaran_url else ""

        results.append({
            "kamisan_number": post_data["kamisan_number"],
            "post_url": post_data["post_url"],
            "date_utc": post_data["date_utc"],
            "caption": post_data["caption"],
            "selebaran": selebaran_url,
            "selebaran_ocr_text": selebaran_ocr_text,
            "foto": classified.get("foto", []),
            "ocr_texts": classified.get("ocr_texts", {}),
            "error": None
        })

    return {
        "total_requested": len(payload.urls),
        "total_processed": len(results),
        "errors": errors,
        "results": results
    }


class RefineTextRequest(BaseModel):
    text: str


class ArchiveSaveRequest(BaseModel):
    items: list[dict]


@app.post("/api/refine-text")
def refine_ocr_text(payload: RefineTextRequest):
    """
    Auto-Refine / AI Formatter untuk merapikan teks hasil OCR:
    - Menyambungkan kata terputus karena baris baru / strip (hyphenation).
    - Merapikan spasi ganda, tanda baca, dan kapitalisasi awal kalimat.
    - Menyusun ulang paragraf agar alur kalimatnya koheren dan enak dibaca.
    """
    raw_text = payload.text or ""
    if not raw_text.strip():
        return {"refined_text": ""}

    # 1. Obati kata terputus oleh tanda hubung di akhir baris (e.g. "ke- \nadilan" -> "keadilan")
    text = re.sub(r'(\w+)\s*[\-–—]\s*\n\s*(\w+)', r'\1\2', raw_text)
    
    # 2. Obati baris terputus tengah kalimat (jika baris tidak diakhiri tanda titik/tanya/seru, gabungkan)
    lines = text.split("\n")
    paragraphs = []
    current_para = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_para:
                paragraphs.append(" ".join(current_para))
                current_para = []
            continue

        if current_para:
            prev_line = current_para[-1]
            # Jika baris sebelumnya tidak diakhiri titik/tanya/seru/titik koma/titik dua
            if not re.search(r'[.:!?;\-\"]$', prev_line):
                current_para[-1] = f"{prev_line} {stripped}"
            else:
                current_para.append(stripped)
        else:
            current_para.append(stripped)

    if current_para:
        paragraphs.append(" ".join(current_para))

    # 3. Rapikan spasi ganda
    refined_paragraphs = []
    for p in paragraphs:
        p_clean = re.sub(r'[ \t]+', ' ', p)
        # Rapikan spasi sebelum tanda baca (e.g. "kata , " -> "kata, ")
        p_clean = re.sub(r'\s+([,.:!?;])', r'\1', p_clean)
        refined_paragraphs.append(p_clean)

    refined_text = "\n\n".join(refined_paragraphs)
    return {"refined_text": refined_text}


@app.post("/api/archive/save")
def save_to_archive(payload: ArchiveSaveRequest):
    """Simpan atau perbarui data ke file archive.json permanen."""
    archive_file = os.path.join(BASE_DIR, "archive.json")
    
    existing_data = []
    if os.path.exists(archive_file):
        try:
            with open(archive_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = []

    # Map existing id/actNum
    existing_map = {str(item.get("actNum") or item.get("id")): idx for idx, item in enumerate(existing_data)}
    
    added_count = 0
    updated_count = 0

    for new_item in payload.items:
        act_num = str(new_item.get("actNum") or new_item.get("id") or "")
        if not act_num:
            continue

        if act_num in existing_map:
            idx = existing_map[act_num]
            existing_data[idx] = new_item
            updated_count += 1
        else:
            existing_data.append(new_item)
            existing_map[act_num] = len(existing_data) - 1
            added_count += 1

    # Urutkan berdasarkan actNum numerik (terendah ke tertinggi)
    def parse_act(x):
        try:
            return int(x.get("actNum") or x.get("id") or 0)
        except Exception:
            return 0
            
    existing_data.sort(key=parse_act)

    with open(archive_file, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)

    # Auto Git Commit & Push ke GitHub secara otomatis di background!
    import subprocess
    auto_pushed = False
    try:
        subprocess.run(["git", "add", "archive.json"], cwd=BASE_DIR, check=True)
        subprocess.run(["git", "commit", "-m", f"auto-archive: update archive.json ({added_count} new, {updated_count} updated)"], cwd=BASE_DIR, check=True)
        subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR, check=True)
        auto_pushed = True
        print(f"[AutoGitSync] ✅ Berhasil push archive.json otomatis ke GitHub Pages!")
    except Exception as e:
        print(f"[AutoGitSync] Catatan: Auto-push skipped ({e})")

    return {
        "success": True,
        "total_archived": len(existing_data),
        "added": added_count,
        "updated": updated_count,
        "auto_pushed": auto_pushed,
        "archive_file": archive_file
    }


if __name__ == "__main__":
    print("=" * 60)
    print("  INSTAGRAM KAMISAN POST OCR WEB APPLICATION")
    print("=" * 60)
    print("  Server berjalan di: http://localhost:8000")
    print("  Buka browser dan akses URL di atas!")
    print("=" * 60)
    uvicorn.run("web_app:app", host="127.0.0.1", port=8000, reload=True)
