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


def fetch_post_details(url_or_shortcode: str) -> dict:
    """
    Fetch detail satu post Instagram berdasarkan URL atau Shortcode.
    
    Return:
    {
        "success": bool,
        "error": str | None,
        "shortcode": str,
        "post_url": str,
        "caption": str,
        "kamisan_number": str,
        "image_urls": list[str],
        "date_utc": str
    }
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
    L = get_loader()

    try:
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
        print(f"[PostParser] Error fetching shortcode {shortcode}: {e}")
        return {
            "success": False,
            "error": f"Gagal memuat post '{shortcode}': {e}",
            "shortcode": shortcode,
            "post_url": post_url,
            "caption": "",
            "kamisan_number": "?",
            "image_urls": [],
            "date_utc": ""
        }
