# ============================================================
#  main.py — Entry Point Instagram Kamisan Scraper
# ============================================================

import sys
from scraper import _init_loader, load_session, fetch_kamisan_posts
from ocr_engine import classify_images
from output_handler import save_results, print_summary
from config import TARGET_USERNAME


def main():
    print("=" * 60)
    print("  INSTAGRAM KAMISAN SCRAPER + OCR")
    print("=" * 60)
    print(f"  Target   : @{TARGET_USERNAME}")
    print("=" * 60 + "\n")

    # 1. Inisialisasi Instaloader & load session
    L = _init_loader()
    session_ok = load_session(L)

    if not session_ok:
        print("\n[Main] ⚠️  Melanjutkan tanpa session (mode anonymous).")
        print("       Rate limit akan lebih cepat kena. Disarankan login terlebih dahulu.")
        confirm = input("       Lanjutkan? (y/n): ").strip().lower()
        if confirm != "y":
            print("[Main] Dibatalkan.")
            sys.exit(0)

    # 2. Fetch & filter post Kamisan
    print("\n[Main] Tahap 1: Fetch posts dari Instagram...\n")
    raw_posts = fetch_kamisan_posts(L)

    if not raw_posts:
        print("[Main] ❌ Tidak ada post yang ditemukan. Script selesai.")
        sys.exit(0)

    print(f"\n[Main] {len(raw_posts)} post Kamisan ditemukan. Mulai OCR...\n")

    # 3. Jalankan OCR & klasifikasi gambar per post
    results = []
    for i, post in enumerate(raw_posts, 1):
        print(f"[Main] OCR Post {i}/{len(raw_posts)} | Kamisan ke-{post['kamisan_number']}")

        image_urls = post.get("image_urls", [])

        if image_urls:
            classified = classify_images(image_urls)
        else:
            print("  [Main] ⚠️  Tidak ada gambar pada post ini.")
            classified = {"selebaran": None, "foto": [], "ocr_texts": {}}

        results.append({
            "kamisan_number": post["kamisan_number"],
            "post_url":       post["post_url"],
            "date_utc":       post["date_utc"],
            "caption":        post["caption"],
            "selebaran":      classified["selebaran"],
            "foto":           classified["foto"],
            "ocr_texts":      classified["ocr_texts"],
        })

    # 4. Simpan semua hasil
    print("\n[Main] Tahap 3: Menyimpan hasil...\n")
    paths = save_results(results)

    # 5. Tampilkan ringkasan
    print_summary(results)

    print(f"\n[Main] ✅ Semua selesai!")
    print(f"  JSON : {paths['json']}")
    print(f"  CSV  : {paths['csv']}")
    print(f"  TXT  : {paths['txt']}")


if __name__ == "__main__":
    main()
