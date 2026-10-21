# Membuat cover Festival Rupiah & QRIS dan Jelajah QRIS UMKM (1200x630).
# Jalankan: FONT_DIR=<folder berisi outfit-latin-700-normal.woff dan
#   plus-jakarta-sans-latin-{500,700}-normal.woff> python3 event/bi-jabar-2026/buat-cover.py
# Font dari paket npm @fontsource/outfit dan @fontsource/plus-jakarta-sans (folder files/).
# Tanpa FONT_DIR dipakai DejaVu Sans.
#
# Kartu Jelajah memotong cover menjadi pita tengah (kira-kira y 115-515),
# jadi judul dan elemen penting diletakkan di sana.
from PIL import Image, ImageDraw, ImageFont
import os, random

W, H = 1200, 630
SS = 2  # supersampling supaya tepi lingkaran halus
OUT = os.path.join(os.path.dirname(__file__), "gambar")
os.makedirs(OUT, exist_ok=True)
FONT_DIR = os.environ.get("FONT_DIR", "")

def font(name, size, fallback="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
    path = os.path.join(FONT_DIR, name)
    return ImageFont.truetype(path if FONT_DIR and os.path.exists(path) else fallback, size * SS)

DISPLAY = lambda s: font("outfit-latin-700-normal.woff", s)
SANS = lambda s: font("plus-jakarta-sans-latin-500-normal.woff", s, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
SANS_BOLD = lambda s: font("plus-jakarta-sans-latin-700-normal.woff", s)

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# Token docs/BRAND.md
BG, CREAM, ON_HERO = "#0D1024", "#FAF7F2", "#E3E1FF"
HERO_FROM, HERO_TO = "#4B45E0", "#6D2FD8"
MERCHANT, KOMUNITAS, WARGA = "#F06A2A", "#0F8B6D", "#2D4FCF"
IRIS = ("#7E7A2C", "#9A4E80", "#1A6AA6")
XP, POINTS, WARN, SUCCESS = "#5CCBF5", "#F7A1C2", "#F5B544", "#34D399"

def gradient(c1, c2):
    w, h = W * SS, H * SS
    a, b = rgb(c1), rgb(c2)
    vertical = Image.linear_gradient("L").resize((w, h))
    horizontal = Image.linear_gradient("L").rotate(90).transpose(Image.Transpose.FLIP_LEFT_RIGHT).resize((w, h))
    grad = Image.blend(horizontal, vertical, 0.5)  # diagonal 135°: kiri-atas ke kanan-bawah
    return Image.composite(Image.new("RGB", (w, h), b), Image.new("RGB", (w, h), a), grad)

def s(v): return int(v * SS)

def symbol(img, cx, cy, size):
    # Simbol tiga lingkaran Gasyu (public/brand/gasyu-favicon.svg), skala 100 -> size
    k = size / 100
    circles = [((50, 32), MERCHANT), ((34, 60), KOMUNITAS), ((66, 60), WARGA)]
    masks = []
    for (x, y), color in circles:
        m = Image.new("L", img.size, 0)
        ImageDraw.Draw(m).ellipse((s(cx + (x - 28) * k), s(cy + (y - 28) * k), s(cx + (x + 28) * k), s(cy + (y + 28) * k)), fill=255)
        img.paste(Image.new("RGB", img.size, rgb(color)), mask=m)
        masks.append(m)
    from PIL import ImageChops
    for (i, j), color in zip(((0, 1), (0, 2), (1, 2)), IRIS):
        img.paste(Image.new("RGB", img.size, rgb(color)), mask=ImageChops.multiply(masks[i], masks[j]))

def centered(d, y, text, f, fill):
    b = d.textbbox((0, 0), text, font=f)
    d.text(((W * SS - (b[2] - b[0])) / 2 - b[0], s(y)), text, font=f, fill=fill)

def chip(d, y, text, f, bg=(13, 16, 36, 190), fg=CREAM):
    b = d.textbbox((0, 0), text, font=f)
    tw, th = b[2] - b[0], b[3] - b[1]
    x0 = (W * SS - tw) / 2 - s(22)
    d.rounded_rectangle((x0, s(y), x0 + tw + s(44), s(y) + th + s(24)), radius=s(40), fill=bg)
    d.text((x0 + s(22) - b[0], s(y) + s(12) - b[1]), text, font=f, fill=fg)

def qr_motif(d, x, y, cell, n, color, seed):
    # Pola mirip QR (dekorasi, bukan QR yang bisa dipindai)
    rnd = random.Random(seed)
    for r in range(n):
        for c in range(n):
            finder = (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)
            if finder:
                rr = r - (n - 7) if r >= n - 7 else r
                cc = c - (n - 7) if c >= n - 7 else c
                on = rr in (0, 6) or cc in (0, 6) or (2 <= rr <= 4 and 2 <= cc <= 4)
            else:
                on = rnd.random() < 0.45
            if on:
                d.rounded_rectangle((s(x + c * cell), s(y + r * cell), s(x + c * cell + cell - 2), s(y + r * cell + cell - 2)), radius=s(2), fill=color)

def coin(d, cx, cy, r, color, label, f):
    d.ellipse((s(cx - r), s(cy - r), s(cx + r), s(cy + r)), fill=color)
    d.ellipse((s(cx - r + 10), s(cy - r + 10), s(cx + r - 10), s(cy + r - 10)), outline=(255, 255, 255, 120), width=s(4))
    b = d.textbbox((0, 0), label, font=f)
    d.text((s(cx) - (b[2] - b[0]) / 2 - b[0], s(cy) - (b[3] - b[1]) / 2 - b[1]), label, font=f, fill=(255, 255, 255, 235))

def finish(img, name):
    img.resize((W, H), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, name), optimize=True)
    print("tersimpan", os.path.join(OUT, name))

# --- Festival Rupiah & QRIS Cimahi ---------------------------------------
img = gradient(HERO_FROM, HERO_TO)
d = ImageDraw.Draw(img, "RGBA")
for cx, cy, r, a in ((80, 90, 210, 26), (1130, 560, 260, 22), (1050, 70, 120, 30), (160, 600, 140, 24)):
    d.ellipse((s(cx - r), s(cy - r), s(cx + r), s(cy + r)), fill=(255, 255, 255, a))
qr_motif(d, 24, 190, 6, 25, (255, 255, 255, 46), 3)
coin(d, 1115, 205, 62, rgb(WARN) + (235,), "Rp", DISPLAY(44))
coin(d, 1120, 360, 46, rgb(MERCHANT) + (235,), "Rp", DISPLAY(32))
coin(d, 1080, 480, 34, rgb(POINTS) + (235,), "Rp", DISPLAY(24))
symbol(img, 600, 150, 54)
d = ImageDraw.Draw(img, "RGBA")
centered(d, 200, "Festival Rupiah & QRIS", DISPLAY(78), CREAM)
centered(d, 300, "Cimahi", DISPLAY(56), rgb(WARN))
chip(d, 388, "Sabtu, 21 November 2026  ·  Alun-alun Kota Cimahi", SANS_BOLD(26))
centered(d, 455, "Gasyu bersama Bank Indonesia Jawa Barat, UMKM, dan komunitas Cimahi", SANS(24), ON_HERO)
finish(img, "cover-festival-rupiah-qris.png")

# --- Jelajah QRIS UMKM Cimahi --------------------------------------------
img = gradient(KOMUNITAS, IRIS[2])
d = ImageDraw.Draw(img, "RGBA")
for cx, cy, r, a in ((1120, 80, 220, 24), (90, 560, 240, 22), (150, 60, 110, 28), (1100, 600, 130, 26)):
    d.ellipse((s(cx - r), s(cy - r), s(cx + r), s(cy + r)), fill=(255, 255, 255, a))
# Rute titik-titik antar-outlet
route = [(70, 470), (150, 360), (85, 240), (1120, 230), (1050, 350), (1130, 460)]
for (x1, y1), (x2, y2) in zip(route, route[1:]):
    if x2 - x1 > 300: continue  # jalur terputus di belakang judul
    steps = 10
    for t in range(steps):
        px, py = x1 + (x2 - x1) * t / steps, y1 + (y2 - y1) * t / steps
        d.ellipse((s(px - 4), s(py - 4), s(px + 4), s(py + 4)), fill=(255, 255, 255, 110))
for (x, y), color in zip(route, (MERCHANT, WARN, POINTS, XP, MERCHANT, SUCCESS)):
    d.ellipse((s(x - 26), s(y - 26), s(x + 26), s(y + 26)), fill=rgb(color) + (245,))
    d.rounded_rectangle((s(x - 12), s(y - 12), s(x + 12), s(y + 12)), radius=s(4), outline=(255, 255, 255, 235), width=s(4))
    d.rectangle((s(x - 4), s(y - 4), s(x + 4), s(y + 4)), fill=(255, 255, 255, 235))
symbol(img, 600, 150, 54)
d = ImageDraw.Draw(img, "RGBA")
centered(d, 200, "Jelajah QRIS UMKM", DISPLAY(80), CREAM)
centered(d, 300, "Cimahi", DISPLAY(56), rgb(WARN))
chip(d, 388, "22 November – 6 Desember 2026  ·  Selesaikan 10 misi", SANS_BOLD(26))
centered(d, 455, "Belanja di UMKM Cimahi pakai QRIS, sendiri atau bareng grup", SANS(24), (226, 243, 238))
finish(img, "cover-jelajah-qris-umkm.png")
