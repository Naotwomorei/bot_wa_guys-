from PIL import Image

try:
    # 1. Membuka gambar asli (pastikan ada file gambar bernama 'foto.jpg' di folder yang sama)
    gambar_asli = Image.open('foto.jpg')
    print("✅ Gambar berhasil dibuka!")

    # 2. Menampilkan informasi dasar gambar
    print(f"Format: {gambar_asli.format}, Ukuran: {gambar_asli.size}, Mode: {gambar_asli.mode}")

    # 3. Membuat efek hitam putih (Grayscale)
    gambar_bw = gambar_asli.convert('L')
    gambar_bw.save('foto_hitam_putih.jpg')
    print("✨ Berhasil membuat gambar Hitam Putih ('foto_hitam_putih.jpg')!")

    # 4. Mengubah ukuran gambar (Resize menjadi setengah dari ukuran asli)
    lebar_baru = gambar_asli.width // 2
    tinggi_baru = gambar_asli.height // 2
    gambar_kecil = gambar_asli.resize((lebar_baru, tinggi_baru))
    gambar_kecil.save('foto_kecil.jpg')
    print(f"✨ Berhasil mengubah ukuran gambar menjadi {lebar_baru}x{tinggi_baru} ('foto_kecil.jpg')!")

except FileNotFoundError:
    print("❌ Waduh, file 'foto.jpg' tidak ditemukan! Masukkan satu foto ke folder ini dulu ya.")