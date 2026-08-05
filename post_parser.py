# ============================================================
#  post_parser.py — Parse Instagram Post URL Single / Bulk
# ============================================================

import re
import instaloader
import requests
from config import SESSION_USERNAME

_loader = None

def get_loader() -> instaloader.Instaloader:
    """Inisialisasi atau dapatkan instance Instaloader singleton."""
    global _loader
    if _loader is None:
        _loader = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            quiet=True,
        )
        # Coba load session jika ada
        import os
        local_session_file = f"session-{SESSION_USERNAME}"
        try:
            if os.path.exists(local_session_file):
                _loader.load_session_from_file(SESSION_USERNAME, filename=local_session_file)
                print(f"[PostParser] Session dimuat dari {local_session_file}")
            elif os.path.exists(SESSION_USERNAME):
                _loader.load_session_from_file(SESSION_USERNAME)
        except Exception as e:
            print(f"[PostParser] Catatan: Melanjutkan tanpa session ({e})")
    return _loader


def extract_shortcode(url: str) -> str | None:
    """
    Ekstrak shortcode dari URL Instagram.
    Contoh: https://www.instagram.com/p/C123456/ -> C123456
    """
    url = url.strip()
    match = re.search(r'instagram\.com/(?:p|reel)/([A-Za-z0-9_\-]+)', url)
    if match:
        return match.group(1)
    # Jika input langsung shortcode
    if re.match(r'^[A-Za-z0-9_\-]+$', url):
        return url
    return None


def extract_kamisan_number(caption: str) -> str:
    """Ekstrak nomor aksi Kamisan dari caption."""
    patterns = [
        r'[@#]?[Aa]ksi\s*[Kk]amisan\s+ke[–\-]?\s*(\d+)',  # @AksiKamisan ke-917 / AksiKamisan ke-917
        r'[Kk]amisan\s+ke[–\-]?\s*(\d+)',                 # Kamisan ke-754 / Kamisan ke 754
        r'[Kk]amisan\s*#\s*(\d+)',                          # Kamisan #754
        r'[Kk]amisan\s+(\d+)',                              # Kamisan 754
        r'#[Kk]amisan(\d+)',                                # #Kamisan754
    ]
    for pattern in patterns:
        match = re.search(pattern, caption)
        if match:
            return match.group(1)
    return "?"


def _fetch_via_embed_page(shortcode: str, num_hint: str = "?") -> dict | None:
    """Fallback fetch post via Public HTML Embed Page jika OEmbed/Instaloader gagal/404."""
    post_url = f"https://www.instagram.com/p/{shortcode}/"
    embed_url = f"{post_url}embed/captioned/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        resp = requests.get(embed_url, headers=headers, timeout=10)
        if resp.status_code == 200 and resp.text:
            image_urls = []
            matches = re.findall(r'src="([^"]+fbcdn\.net[^"]+)"', resp.text)
            for m in matches:
                clean_url = m.replace("&amp;", "&")
                if clean_url not in image_urls:
                    image_urls.append(clean_url)

            # Extract caption dari Embed HTML
            caption = ""
            cap_match = re.search(r'<div class="Caption"[^>]*>(.*?)</div>', resp.text, re.DOTALL)
            if cap_match:
                caption = re.sub(r'<[^>]+>', ' ', cap_match.group(1)).strip()

            kamisan_num = extract_kamisan_number(caption)
            if kamisan_num == "?" and num_hint != "?":
                kamisan_num = num_hint

            if image_urls:
                print(f"[PostParser] ✅ Berhasil fetch via Public Embed HTML Page: {shortcode}")
                return {
                    "success": True,
                    "error": None,
                    "shortcode": shortcode,
                    "post_url": post_url,
                    "caption": caption,
                    "kamisan_number": kamisan_num,
                    "image_urls": image_urls,
                    "date_utc": ""
                }
    except Exception as e:
        print(f"[PostParser] Embed page HTML error for {shortcode}: {e}")
    return None


def _fetch_via_oembed(shortcode: str, num_hint: str = "?") -> dict | None:
    """Fallback fetch post via Instagram OEmbed Public API (bebas login_required & 403)."""
    post_url = f"https://www.instagram.com/p/{shortcode}/"
    oembed_endpoint = f"https://api.instagram.com/oembed/?url={post_url}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        resp = requests.get(oembed_endpoint, headers=headers, timeout=10)
        if resp.status_code == 200 and resp.text and resp.text.strip().startswith("{"):
            data = resp.json()
            caption = data.get("title", "")
            thumb_url = data.get("thumbnail_url", "")
            
            kamisan_num = extract_kamisan_number(caption)
            if kamisan_num == "?" and num_hint != "?":
                kamisan_num = num_hint

            image_urls = [thumb_url] if thumb_url else []

            # Cek juga halaman embed untuk gambar carousel tambahan
            try:
                embed_resp = requests.get(f"{post_url}embed/", headers=headers, timeout=8)
                if embed_resp.status_code == 200 and embed_resp.text:
                    matches = re.findall(r'src="([^"]+fbcdn\.net[^"]+)"', embed_resp.text)
                    for m in matches:
                        clean_url = m.replace("&amp;", "&")
                        if clean_url not in image_urls:
                            image_urls.append(clean_url)
            except Exception:
                pass

            print(f"[PostParser] ✅ Berhasil fetch via Public OEmbed Fallback: {shortcode}")
            return {
                "success": True,
                "error": None,
                "shortcode": shortcode,
                "post_url": post_url,
                "caption": caption,
                "kamisan_number": kamisan_num,
                "image_urls": image_urls,
                "date_utc": ""
            }
    except Exception as e:
        print(f"[PostParser] OEmbed API skipped for {shortcode} ({e}). Mencoba HTML Embed...")
    
    return _fetch_via_embed_page(shortcode, num_hint)


def fetch_post_details(url_or_shortcode: str) -> dict:
    """
    Fetch detail satu post Instagram berdasarkan URL atau Shortcode.
    Menggunakan Public OEmbed API sebagai prioritas utama untuk menghindari 403 login_required.
    """
    shortcode = extract_shortcode(url_or_shortcode)
    if not shortcode:
        return {
            "success": False,
            "error": f"URL Instagram tidak valid: {url_or_shortcode}",
            "shortcode": "",
            "post_url": url_or_shortcode,
            "caption": "",
            "kamisan_number": "?",
            "image_urls": [],
            "date_utc": ""
        }

    # Cek apakah ada nomor awalan di input (misal: "796 : https://...")
    num_hint = "?"
    num_match = re.match(r'^\s*(\d+)\s*[:\-]', url_or_shortcode)
    if num_match:
        num_hint = num_match.group(1)

    post_url = f"https://www.instagram.com/p/{shortcode}/"

    # PRIORITAS 1: Panggil Public OEmbed API Instagram terlebih dahulu (Bypass 403 Login Required secara instan)
    oembed_res = _fetch_via_oembed(shortcode, num_hint)
    if oembed_res and oembed_res.get("success") and oembed_res.get("image_urls"):
        return oembed_res

    # PRIORITAS 2: Instaloader Fallback (hanya 1x attempt tanpa retries hanging)
    try:
        L = get_loader()
        L.context.max_connection_attempts = 1
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        caption = post.caption or ""
        kamisan_num = extract_kamisan_number(caption)
        if kamisan_num == "?" and num_hint != "?":
            kamisan_num = num_hint
        
        image_urls = []
        if post.typename == "GraphSidecar":
            for node in post.get_sidecar_nodes():
                if not node.is_video:
                    image_urls.append(node.display_url)
        elif not post.is_video:
            image_urls.append(post.url)

        return {
            "success": True,
            "error": None,
            "shortcode": shortcode,
            "post_url": post_url,
            "caption": caption,
            "kamisan_number": kamisan_num,
            "image_urls": image_urls,
            "date_utc": post.date_utc.isoformat() if post.date_utc else ""
        }
    except Exception as e:
        print(f"[PostParser] Instaloader skipped ({e})")
        if oembed_res:
            return oembed_res

        return {
            "success": False,
            "error": f"Gagal memuat post '{shortcode}': {e}",
            "shortcode": shortcode,
            "post_url": post_url,
            "caption": "",
            "kamisan_number": num_hint if num_hint != "?" else "?",
            "image_urls": [],
            "date_utc": ""
        }
