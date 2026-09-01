"""품질 대책서 PWA 아이콘 생성기 (PIL)"""
from PIL import Image, ImageDraw
import math

ACCENT = (79, 70, 229)        # indigo-600
ACCENT_DK = (55, 48, 163)     # indigo-800
WHITE = (255, 255, 255)


def rounded(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return m


def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 배경 그라데이션 (수직)
    for y in range(size):
        t = y / size
        r = int(ACCENT[0] * (1 - t) + ACCENT_DK[0] * t)
        g = int(ACCENT[1] * (1 - t) + ACCENT_DK[1] * t)
        b = int(ACCENT[2] * (1 - t) + ACCENT_DK[2] * t)
        d.line([(0, y), (size, y)], fill=(r, g, b, 255))
    img.putalpha(rounded(size, int(size * 0.22)))

    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    # 특성요인도(피쉬본) 상징 - 중심 척추 + 대각선 뼈
    lw = max(2, int(size * 0.035))
    spine_y = cy + size * 0.02
    d.line([(size * 0.16, spine_y), (size * 0.78, spine_y)], fill=WHITE, width=lw)
    # 화살표 머리
    d.polygon([
        (size * 0.86, spine_y),
        (size * 0.74, spine_y - size * 0.06),
        (size * 0.74, spine_y + size * 0.06),
    ], fill=WHITE)
    for i, bx in enumerate((0.30, 0.46, 0.62)):
        d.line([(size * bx, spine_y), (size * (bx - 0.10), spine_y - size * 0.20)],
               fill=WHITE, width=lw)
        d.line([(size * bx, spine_y), (size * (bx - 0.10), spine_y + size * 0.20)],
               fill=WHITE, width=lw)
    img.save(f"icon-{size}.png")


for s in (192, 512):
    make(s)

# 마스커블용 (여백 큰 버전)
big = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
d = ImageDraw.Draw(big)
for y in range(512):
    t = y / 512
    r = int(ACCENT[0] * (1 - t) + ACCENT_DK[0] * t)
    g = int(ACCENT[1] * (1 - t) + ACCENT_DK[1] * t)
    b = int(ACCENT[2] * (1 - t) + ACCENT_DK[2] * t)
    d.line([(0, y), (512, y)], fill=(r, g, b, 255))
inner = make(512) or Image.open("icon-512.png")
scaled = Image.open("icon-512.png").resize((360, 360))
big.paste(scaled, (76, 76), scaled)
big.save("icon-maskable-512.png")
print("icons done")
