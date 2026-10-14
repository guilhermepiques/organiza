"""Gera os ícones PNG do PWA a partir do mesmo desenho do icons/icon.svg.

Uso (na raiz do projeto):  python tools/make-icons.py
Requer Pillow (pip install pillow).
"""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (39, 39, 42, 255)      # grafite (#27272a)
FG = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"
SCALE = 4  # supersampling para bordas suaves


def draw(size: int, maskable: bool) -> Image.Image:
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BG)
        inset = 0.18  # mantém o símbolo dentro da zona segura
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
        inset = 0.0
    # mesmo traço do SVG (viewBox 512): M150 266 l70 70 142-150
    def p(x, y):
        k = s / 512
        cx = cy = s / 2
        f = 1 - inset
        return (cx + (x * k - cx) * f, cy + (y * k - cy) * f)

    pts = [p(150, 266), p(220, 336), p(362, 186)]
    w = int(44 * s / 512 * (1 - inset))
    d.line(pts, fill=FG, width=w, joint="curve")
    r = w / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        draw(size, False).save(OUT / f"icon-{size}.png")
    draw(512, True).save(OUT / "icon-maskable-512.png")
    print("Ícones gerados em", OUT)


if __name__ == "__main__":
    main()
