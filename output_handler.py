# ============================================================
#  output_handler.py — Format & Simpan Hasil Scraping
# ============================================================

import json
import csv
import os
from config import OUTPUT_DIR, OUTPUT_JSON, OUTPUT_CSV, OUTPUT_TXT


def _ensure_output_dir():
    """Buat folder output jika belum ada."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _format_single_entry(entry: dict) -> str:
    """
    Format satu entri Kamisan ke format teks yang diminta:

        Kamisan [Nomor Aksi]
        Sumber: [URL Post]
        Selebaran: [URL Gambar Selebaran]
        Foto: [URL Gambar Foto]
    """
    lines = []
    lines.append(f"Kamisan ke-{entry['kamisan_number']}")
    lines.append(f"Sumber: {entry['post_url']}")

    # Selebaran
    selebaran = entry.get("selebaran") or "-"
    lines.append(f"Selebaran: {selebaran}")

    # Foto — bisa lebih dari satu, tampilkan semua
    foto_list = entry.get("foto", [])
    if foto_list:
        # Jika hanya 1 foto, tampilkan langsung
        # Jika lebih dari 1, tampilkan sebagai list bernomor
        if len(foto_list) == 1:
            lines.append(f"Foto: {foto_list[0]}")
        else:
            lines.append("Foto:")
            for i, url in enumerate(foto_list, 1):
                lines.append(f"  {i}. {url}")
    else:
        lines.append("Foto: -")

    return "\n".join(lines)


def save_results(results: list[dict]) -> dict[str, str]:
    """
    Simpan semua hasil ke tiga format:
      - JSON  : data lengkap termasuk OCR text
      - CSV   : ringkasan kolom utama
      - TXT   : format teks terstruktur siap pakai

    `results` adalah list of dict dengan struktur:
    {
        "kamisan_number": str,
        "post_url": str,
        "date_utc": str,
        "caption": str,
        "selebaran": str | None,
        "foto": list[str],
        "ocr_texts": dict,
    }

    Kembalikan dict path file yang dibuat.
    """
    _ensure_output_dir()

    # --- Urutkan berdasarkan nomor Kamisan (ascending) ---
    def sort_key(e):
        try:
            return int(e["kamisan_number"])
        except (ValueError, KeyError):
            return 0

    results_sorted = sorted(results, key=sort_key)

    # --- 1. JSON ---
    json_path = os.path.join(OUTPUT_DIR, OUTPUT_JSON)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results_sorted, f, ensure_ascii=False, indent=2)
    print(f"[Output] ✅ JSON disimpan: {json_path}")

    # --- 2. CSV ---
    csv_path = os.path.join(OUTPUT_DIR, OUTPUT_CSV)
    csv_fields = ["kamisan_number", "post_url", "date_utc", "selebaran", "foto", "caption"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        for entry in results_sorted:
            # Convert list foto ke string dipisah |
            row = dict(entry)
            row["foto"] = " | ".join(entry.get("foto", []))
            writer.writerow(row)
    print(f"[Output] ✅ CSV disimpan: {csv_path}")

    # --- 3. TXT (Format Terstruktur) ---
    txt_path = os.path.join(OUTPUT_DIR, OUTPUT_TXT)
    separator = "\n" + ("=" * 60) + "\n"
    entries_formatted = [_format_single_entry(e) for e in results_sorted]
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(separator.join(entries_formatted))
        f.write("\n")
    print(f"[Output] ✅ TXT disimpan: {txt_path}")

    return {"json": json_path, "csv": csv_path, "txt": txt_path}


def print_summary(results: list[dict]):
    """Tampilkan ringkasan hasil di konsol."""
    print("\n" + "=" * 60)
    print(f"  RINGKASAN HASIL SCRAPING")
    print("=" * 60)
    print(f"  Total post Kamisan ditemukan : {len(results)}")

    with_selebaran = sum(1 for r in results if r.get("selebaran"))
    print(f"  Post dengan selebaran terdeteksi: {with_selebaran}")
    print(f"  Post tanpa selebaran (semua foto): {len(results) - with_selebaran}")
    print("=" * 60)

    # Tampilkan beberapa entri pertama sebagai preview
    preview_count = min(3, len(results))
    if preview_count:
        print(f"\n--- PREVIEW ({preview_count} pertama) ---\n")
        for i, entry in enumerate(results[:preview_count]):
            print(_format_single_entry(entry))
            print()
