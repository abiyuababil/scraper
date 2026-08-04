# ============================================================
#  web_app.py — FastAPI Web Application Server
# ============================================================

import os
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


@app.get("/")
def read_root(request: Request):
    """Render antarmuka utama Web UI."""
    return templates.TemplateResponse(request=request, name="index.html")


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


if __name__ == "__main__":
    print("=" * 60)
    print("  INSTAGRAM KAMISAN POST OCR WEB APPLICATION")
    print("=" * 60)
    print("  Server berjalan di: http://localhost:8000")
    print("  Buka browser dan akses URL di atas!")
    print("=" * 60)
    uvicorn.run("web_app:app", host="127.0.0.1", port=8000, reload=True)
