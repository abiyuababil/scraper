# ============================================================
#  get_profile_urls.py — Ambil Semua Link Post dari Profil IG
# ============================================================

import time
import random
import instaloader
from config import TARGET_USERNAME, SESSION_USERNAME

def fetch_profile_post_urls(username: str = TARGET_USERNAME, max_count: int = 100) -> list[str]:
    """
    Mengambil list URL post dari profil Instagram publik.
    Gunakan session jika ada untuk menghindari rate-limit.
    """
    print(f"[LinkHarvester] Memuat profil: @{username} (Max limit: {max_count or 'semua'})...")
    
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    # Load session jika ada
    import os
    local_session_file = f"session-{SESSION_USERNAME}"
    try:
        if os.path.exists(local_session_file):
            L.load_session_from_file(SESSION_USERNAME, filename=local_session_file)
            print(f"[LinkHarvester] Session dimuat dari '{local_session_file}'")
        elif os.path.exists(SESSION_USERNAME):
            L.load_session_from_file(SESSION_USERNAME)
    except Exception as e:
        print(f"[LinkHarvester] Catatan: Melanjutkan tanpa session ({e})")

    urls = []
    try:
        profile = instaloader.Profile.from_username(L.context, username)
        print(f"[LinkHarvester] Total post di profil @{username}: {profile.mediacount}")

        for post in profile.get_posts():
            if max_count and len(urls) >= max_count:
                break

            post_url = f"https://www.instagram.com/p/{post.shortcode}/"
            urls.append(post_url)
            print(f"  [{len(urls)}] Ditemukan: {post_url}")
            
            # Random micro-delay
            time.sleep(random.uniform(0.3, 0.8))

    except instaloader.exceptions.QueryReturnedNotFoundException:
        print(f"[LinkHarvester] ❌ Profil @{username} tidak ditemukan.")
    except Exception as e:
        print(f"[LinkHarvester] Peringatan saat mengambil link: {e}")

    # Simpan ke urls.txt
    if urls:
        with open("urls.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(urls))
        print(f"\n[LinkHarvester] ✅ {len(urls)} link berhasil disimpan ke file 'urls.txt'")

    return urls


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else TARGET_USERNAME
    fetch_profile_post_urls(target, max_count=50)
