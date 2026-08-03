# ============================================================
#  scraper.py — Instaloader Wrapper untuk Kamisan Posts
# ============================================================

import re
import time
import random
import instaloader
from config import (
    TARGET_USERNAME,
    CAPTION_KEYWORDS,
    MAX_POSTS,
    DELAY_MIN,
    DELAY_MAX,
    SESSION_USERNAME,
)


def _init_loader() -> instaloader.Instaloader:
    """Inisialisasi Instaloader tanpa download file otomatis."""
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )
    return L


def load_session(L: instaloader.Instaloader) -> bool:
    """
    Load session dari file Instaloader.
    Dua opsi pencarian:
    1. File session lokal di folder project (session-USERNAME)
    2. File session default Instaloader
    """
    import os
    local_session_file = f"session-{SESSION_USERNAME}"
    
    try:
        if os.path.exists(local_session_file):
            L.load_session_from_file(SESSION_USERNAME, filename=local_session_file)
            print(f"[Scraper] ✅ Session lokal dimuat dari '{local_session_file}'")
            return True
        else:
            L.load_session_from_file(SESSION_USERNAME)
            print(f"[Scraper] ✅ Session dimuat untuk akun: {SESSION_USERNAME}")
            return True
    except FileNotFoundError:
        print(f"[Scraper] ⚠️  Session file tidak ditemukan untuk '{SESSION_USERNAME}'.")
        print("         Coba jalankan: python login_helper.py")
        return False
    except Exception as e:
        print(f"[Scraper] ❌ Gagal load session: {e}")
        return False


def _extract_kamisan_number(caption: str) -> str:
    """
    Ekstrak nomor aksi Kamisan dari caption menggunakan regex.
    Contoh caption: '@AksiKamisan ke-917', 'Kamisan ke-754', 'Kamisan #754', 'KAMISAN 754'
    Kembalikan string nomor, atau '?' jika tidak ditemukan.
    """
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


def _get_image_urls(post: instaloader.Post) -> list[str]:
    """
    Ambil semua URL gambar dari sebuah post.
    Mendukung post tunggal maupun carousel (GraphSidecar).
    Hanya mengambil gambar (bukan video).
    """
    urls = []
    try:
        if post.typename == "GraphSidecar":
            # Carousel: iterasi semua node
            for node in post.get_sidecar_nodes():
                if not node.is_video:
                    urls.append(node.display_url)
        elif not post.is_video:
            # Post gambar tunggal
            urls.append(post.url)
    except Exception as e:
        print(f"  [Scraper] Peringatan: gagal ambil image URLs: {e}")
        if post.url:
            urls.append(post.url)
    return urls


def _caption_matches(caption: str) -> bool:
    """Cek apakah caption mengandung frasa spesifik yang dikonfigurasi."""
    if not caption:
        return False
    caption_lower = caption.lower()
    
    if CAPTION_MATCH_MODE.upper() == "ALL":
        return all(kw.lower() in caption_lower for kw in CAPTION_KEYWORDS)
    else:
        return any(kw.lower() in caption_lower for kw in CAPTION_KEYWORDS)


def fetch_kamisan_posts(L: instaloader.Instaloader) -> list[dict]:
    """
    Fetch semua post dari TARGET_USERNAME, filter yang caption-nya
    mengandung keyword Kamisan, lalu kembalikan list data mentah per post.

    Return list of dict:
    {
        "shortcode": str,
        "post_url": str,
        "date_utc": str,
        "caption": str,
        "kamisan_number": str,
        "image_urls": list[str],
    }
    """
    # Load profil
    try:
        profile = instaloader.Profile.from_username(L.context, TARGET_USERNAME)
        print(f"[Scraper] Profil ditemukan: @{profile.username} ({profile.mediacount} post total)")
    except instaloader.exceptions.ProfileNotExistsException:
        print(f"[Scraper] ❌ Profil '{TARGET_USERNAME}' tidak ditemukan.")
        return []
    except Exception as e:
        print(f"[Scraper] ❌ Gagal memuat profil: {e}")
        return []

    posts_data = []
    total_checked = 0
    total_matched = 0

    print(f"[Scraper] Mulai iterasi post... (MAX_POSTS={MAX_POSTS or 'semua'})\n")

    for post in profile.get_posts():
        if MAX_POSTS and total_checked >= MAX_POSTS:
            break

        total_checked += 1
        caption = post.caption or ""

        # Filter berdasarkan caption
        if not _caption_matches(caption):
            # Delay tetap diperlukan meski skip, agar tidak kena rate limit
            time.sleep(random.uniform(0.5, 1.5))
            continue

        total_matched += 1
        kamisan_number = _extract_kamisan_number(caption)
        image_urls = _get_image_urls(post)
        post_url = f"https://www.instagram.com/p/{post.shortcode}/"

        print(f"[Scraper] ✅ #{total_matched} | Kamisan ke-{kamisan_number} | {post.date_utc.date()} | {len(image_urls)} gambar")

        posts_data.append({
            "shortcode": post.shortcode,
            "post_url": post_url,
            "date_utc": post.date_utc.isoformat(),
            "caption": caption,
            "kamisan_number": kamisan_number,
            "image_urls": image_urls,
        })

        # Delay antar post untuk menghindari rate limit
        delay = random.uniform(DELAY_MIN, DELAY_MAX)
        print(f"         ⏳ Delay {delay:.1f}s...")
        time.sleep(delay)

    print(f"\n[Scraper] Selesai. Diperiksa: {total_checked} post | Cocok: {total_matched} post")
    return posts_data
