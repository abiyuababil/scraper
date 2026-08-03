# ============================================================
#  login_helper.py — Helper untuk Login Instaloader Sekali
# ============================================================
# Jalankan file ini SEKALI untuk menyimpan session:
#   python login_helper.py
#
# Setelah session tersimpan, main.py akan load otomatis.
# Kamu TIDAK perlu jalankan ini lagi kecuali session expired.

import instaloader
import getpass

def do_login():
    print("=" * 50)
    print("  INSTALOADER SESSION HELPER")
    print("=" * 50)
    print("Masukkan username & password akun DUMMY Instagram.")
    print("(Password tidak tersimpan — hanya session cookie yang disimpan)\n")

    username = input("Username Instagram dummy: ").strip()
    password = getpass.getpass("Password: ")

    L = instaloader.Instaloader()
    try:
        L.login(username, password)
        session_filename = f"session-{username}"
        L.save_session_to_file(session_filename)
        print(f"\n✅ Login berhasil! Session disimpan di '{session_filename}'.")
        print(f"   Update config.py: SESSION_USERNAME = \"{username}\"")
    except instaloader.exceptions.BadCredentialsException:
        print("\n❌ Password salah. Coba lagi.")
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        print("\n⚠️  Akun ini mengaktifkan 2FA.")
        code = input("Masukkan kode 2FA: ").strip()
        try:
            session_filename = f"session-{username}"
            L.two_factor_login(code)
            L.save_session_to_file(session_filename)
            print(f"\n✅ Login 2FA berhasil! Session disimpan di '{session_filename}'.")
        except Exception as e:
            print(f"\n❌ Gagal login 2FA: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    do_login()
