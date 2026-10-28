# Membuat gambar dummy (cover aktivitas, logo penyelenggara, bukti bayar, foto misi)
# dengan Pillow. Jalankan: python3 dummy-data/buat-gambar.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, random

OUT = os.path.join(os.path.dirname(__file__), "gambar")
os.makedirs(OUT, exist_ok=True)
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
random.seed(7)

def gradient(w, h, c1, c2, angle=135):
    # angle 135 = diagonal kiri-atas ke kanan-bawah (gradien hero di BRAND.md); 90 = atas ke bawah
    img = Image.new("RGB", (w, h), c1)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = y / (h - 1) if angle == 90 else (x / (w - 1) + y / (h - 1)) / 2
            px[x, y] = tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))
    return img

def hexrgb(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5))

def cover(name, title, subtitle, c1, c2, emoji_shapes=12):
    img = gradient(1200, 630, hexrgb(c1), hexrgb(c2))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(emoji_shapes):  # lingkaran lembut sebagai dekorasi
        r = random.randint(60, 220); x = random.randint(-100, 1200); y = random.randint(-100, 630)
        d.ellipse((x, y, x + r, y + r), fill=(255, 255, 255, random.randint(14, 36)))
    # Teks di tengah supaya tetap terbaca saat kartu memotong bagian atas/bawah gambar.
    f = ImageFont.truetype(BOLD, 66 if len(title) < 22 else 54)
    tb = d.textbbox((0, 0), title, font=f); tw = tb[2] - tb[0]
    d.rounded_rectangle((600 - 85, 215, 600 + 85, 215 + 44), 22, fill=(13, 16, 36, 170))
    fb = ImageFont.truetype(BOLD, 24); bb = d.textbbox((0, 0), "gasyu", font=fb)
    d.text((600 - (bb[2] - bb[0]) / 2, 225), "gasyu", font=fb, fill=(250, 247, 242))
    d.text((600 - tw / 2, 280), title, font=f, fill=(255, 255, 255))
    f2 = ImageFont.truetype(REG, 28); sb = d.textbbox((0, 0), subtitle, font=f2)
    d.text((600 - (sb[2] - sb[0]) / 2, 365), subtitle, font=f2, fill=(227, 225, 255))
    img.save(os.path.join(OUT, f"cover-{name}.png"), optimize=True)

def logo(name, initials, c1, c2, label):
    img = gradient(512, 512, hexrgb(c1), hexrgb(c2))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(BOLD, 200)
    bbox = d.textbbox((0, 0), initials, font=f)
    d.text(((512 - (bbox[2] - bbox[0])) / 2 - bbox[0], (512 - (bbox[3] - bbox[1])) / 2 - bbox[1] - 30), initials, font=f, fill=(255, 255, 255))
    f2 = ImageFont.truetype(REG, 34)
    bbox = d.textbbox((0, 0), label, font=f2)
    d.text(((512 - (bbox[2] - bbox[0])) / 2, 400), label, font=f2, fill=(250, 247, 242))
    img.save(os.path.join(OUT, f"logo-{name}.png"), optimize=True)

def receipt(name, lines):
    img = Image.new("RGB", (720, 1100), (245, 246, 250))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((40, 40, 680, 1060), 24, fill=(255, 255, 255), outline=(220, 222, 232))
    d.text((80, 80), "m-Banking", font=ImageFont.truetype(BOLD, 36), fill=(30, 34, 70))
    d.text((80, 130), "Bukti Transfer Berhasil", font=ImageFont.truetype(REG, 26), fill=(90, 95, 130))
    y = 220
    for k, v in lines:
        d.text((80, y), k, font=ImageFont.truetype(REG, 24), fill=(120, 125, 160))
        d.text((80, y + 32), v, font=ImageFont.truetype(BOLD, 30), fill=(30, 34, 70))
        y += 100
    d.ellipse((560, 70, 640, 150), fill=(76, 200, 120)); d.text((583, 85), "✓", font=ImageFont.truetype(BOLD, 48), fill=(255, 255, 255))
    img.save(os.path.join(OUT, f"bukti-{name}.png"), optimize=True)

def photo(name, caption, c1, c2):
    img = gradient(900, 1200, hexrgb(c1), hexrgb(c2), 90).filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(40):
        r = random.randint(20, 160); x = random.randint(0, 900); y = random.randint(0, 1200)
        d.ellipse((x, y, x + r, y + r), fill=(255, 255, 255, random.randint(10, 40)))
    d.rounded_rectangle((40, 1040, 860, 1150), 20, fill=(0, 0, 0, 120))
    d.text((64, 1070), caption, font=ImageFont.truetype(BOLD, 34), fill=(255, 255, 255))
    img.save(os.path.join(OUT, f"foto-{name}.png"), optimize=True)

cover("night-run", "Cimahi Night Run 5K", "Lari malam santai keliling pusat kota · Cimahi Runners", "#4B45E0", "#6D2FD8")
cover("festival-kuliner", "Festival Kuliner Pasar Atas", "Seblak, kopi, surabi, live akustik · Seblak Teh Ai × Kopi Lereng", "#7A4B12", "#C2410C")
cover("jelajah-kopi", "Jelajah 3 Kedai Kopi Lereng", "Challenge 2 minggu · 3 titik · 250 Jejak + 60 poin", "#145C48", "#1F6F8B")
cover("workshop-mural", "Workshop Mural Tembok Pasar", "Khusus member Cimahi Creative Hub", "#7A2554", "#3B2F8F")
logo("kopi-lereng", "KL", "#5B3A1E", "#A0522D", "Kopi Lereng")
logo("seblak-teh-ai", "SA", "#C2410C", "#F0508A", "Seblak Teh Ai")
logo("batik-cimahi", "BC", "#3B2F8F", "#6D5BF0", "Batik Cimahi Heritage")
logo("bengkel-jaya", "BJ", "#1F2937", "#4B5563", "Bengkel Motor Jaya")
logo("toko-buku", "TC", "#1F6F8B", "#5CCBF5", "Toko Buku Cendekia")
logo("nasi-liwet", "NL", "#166534", "#65A30D", "Nasi Liwet Mang Udin")
logo("cimahi-runners", "CR", "#4B45E0", "#8F93FF", "Cimahi Runners")
logo("cimahi-gowes", "CG", "#0F766E", "#2DD4BF", "Cimahi Gowes")
logo("creative-hub", "CH", "#7A2554", "#F0508A", "Cimahi Creative Hub")
logo("sahabat-lingkungan", "SL", "#145C48", "#4ADE80", "Sahabat Lingkungan")
logo("cimahi-foodies", "CF", "#B45309", "#FBBF24", "Cimahi Foodies")
receipt("night-run-dimas", [("Tujuan", "BCA 7310223344 · ANDI FIRMANSYAH"), ("Nominal", "Rp35.000"), ("Berita", "Dimas Aditya NightRun"), ("Tanggal", "Hari ini 14.32 WIB"), ("No. Referensi", "20261016143201DMS")])
photo("festival-dimas", "Foto bareng Teh Ai di stand seblak", "#C2410C", "#F0508A")
photo("festival-siti", "Siti & Teh Ai, seblak level 3!", "#7A4B12", "#F7A1C2")
photo("kopi-nadia", "Ulasan Kopi Lereng: 5 bintang", "#5B3A1E", "#A0522D")
print("selesai:", sorted(os.listdir(OUT)))
