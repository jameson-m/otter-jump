#!/usr/bin/env python3
"""
Generate the PWA app icons into assets/icons/ — a little scene of a character
reaching for the shiny rock on a sunny hill. Build/asset tool, not game runtime.

Requirements: pip install pillow
Usage: python3 tools/make-icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR = os.path.join(ROOT, "assets", "characters", "kiwi.png")  # the icon's star
OUT = os.path.join(ROOT, "assets", "icons")
S = 512  # master size


def vgrad(w, h, top, bot):
    g = Image.new("RGB", (w, h))
    px = g.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return g


def make_master():
    img = vgrad(S, S, (95, 182, 232), (205, 238, 251)).convert("RGBA")  # sky, full-bleed
    d = ImageDraw.Draw(img, "RGBA")

    # Soft sun, top-right.
    sun = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sun).ellipse([S * 0.62, S * 0.06, S * 0.95, S * 0.39], fill=(255, 244, 194, 235))
    img.alpha_composite(sun.filter(ImageFilter.GaussianBlur(6)))

    # Rolling hills.
    d.ellipse([-S * 0.25, S * 0.62, S * 0.6, S * 1.3], fill=(120, 200, 120, 255))
    d.ellipse([S * 0.45, S * 0.66, S * 1.25, S * 1.35], fill=(108, 192, 112, 255))
    d.rectangle([0, int(S * 0.86), S, S], fill=(96, 182, 104, 255))

    # Shiny rock with sparkles, right side.
    rx, ry = int(S * 0.70), int(S * 0.66)
    d.polygon([(rx - 46, ry + 30), (rx - 54, ry - 22), (rx - 12, ry - 40),
               (rx + 34, ry - 30), (rx + 50, ry + 6), (rx + 20, ry + 34)], fill=(170, 182, 200, 255))
    d.polygon([(rx - 30, ry + 24), (rx - 40, ry - 10), (rx - 6, ry - 26), (rx + 6, ry)], fill=(196, 206, 222, 255))
    for sx, sy, r in [(rx + 18, ry - 20, 12), (rx - 16, ry + 4, 8), (rx + 6, ry + 18, 9)]:
        d.polygon([(sx, sy - r), (sx + r * .28, sy - r * .28), (sx + r, sy), (sx + r * .28, sy + r * .28),
                   (sx, sy + r), (sx - r * .28, sy + r * .28), (sx - r, sy), (sx - r * .28, sy - r * .28)],
                  fill=(255, 255, 255, 255))

    # Character on the hill, kept inside the maskable safe area.
    ch = Image.open(CHAR).convert("RGBA")
    h = int(S * 0.5)
    ch = ch.resize((int(h * ch.width / ch.height), h), Image.LANCZOS)
    img.alpha_composite(ch, (int(S * 0.18), int(S * 0.86) - h + 8))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    m = make_master()
    m.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "icon-192.png"))
    m.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon-512.png"))
    m.save(os.path.join(OUT, "icon-maskable-512.png"))                 # full-bleed background
    m.convert("RGB").resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-touch-icon.png"))
    m.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, "favicon-64.png"))
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
