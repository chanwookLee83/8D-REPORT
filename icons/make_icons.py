"""품질 대책서 PWA 아이콘 생성기 (PIL) — 8D 심볼"""
from PIL import Image, ImageDraw, ImageFont

ACCENT = (79, 70, 229)        # indigo-600
ACCENT_DK = (55, 48, 163)     # indigo-800
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(px):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, px)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return m


def gradient(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        d.line(
            [(0, y), (size, y)],
            fill=(
                int(ACCENT[0] * (1 - t) + ACCENT_DK[0] * t),
                int(ACCENT[1] * (1 - t) + ACCENT_DK[1] * t),
                int(ACCENT[2] * (1 - t) + ACCENT_DK[2] * t),
                255,
            ),
        )
    return img


def draw_content(img, scale=1.0):
    """중앙에 '8D' + 하단 피쉬본 화살표. scale<1 이면 안전 영역 축소(마스커블)."""
    size = img.width
    d = ImageDraw.Draw(img)
    cx = size / 2
    cy = size / 2 - size * 0.06 * scale

    font = load_font(int(size * 0.46 * scale))
    text = "8D"
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=font, fill=WHITE)

    # 하단 피쉬본 스파인 + 화살표
    lw = max(2, int(size * 0.028 * scale))
    y = cy + th / 2 + size * 0.17 * scale
    x0 = cx - size * 0.24 * scale
    x1 = cx + size * 0.18 * scale
    d.line([(x0, y), (x1, y)], fill=WHITE, width=lw)
    ah = size * 0.05 * scale
    d.polygon([(x1 + ah * 1.6, y), (x1, y - ah), (x1, y + ah)], fill=WHITE)
    for bx in (x0 + size * 0.10 * scale, x0 + size * 0.24 * scale, x0 + size * 0.38 * scale):
        d.line([(bx, y), (bx - size * 0.06 * scale, y - size * 0.11 * scale)], fill=WHITE, width=lw)
        d.line([(bx, y), (bx - size * 0.06 * scale, y + size * 0.11 * scale)], fill=WHITE, width=lw)


def make_standard(size):
    img = gradient(size)
    img.putalpha(rounded_mask(size, int(size * 0.22)))
    draw_content(img, scale=1.0)
    img.save(f"icon-{size}.png")


def make_maskable(size):
    img = gradient(size)  # 풀블리드 (라운딩 없음)
    draw_content(img, scale=0.78)  # 안전 영역 안으로
    img.save(f"icon-maskable-{size}.png")


make_standard(192)
make_standard(512)
make_maskable(512)
print("icons done")
