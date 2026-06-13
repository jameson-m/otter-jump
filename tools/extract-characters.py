#!/usr/bin/env python3
"""
Extract the hand-drawn characters from the source PDF into transparent, game-ready
sprite PNGs in assets/characters/.

This is the reproducible pipeline that produced the committed sprites. It is a
build/asset tool, not part of the game runtime.

Pipeline per page (one character each, drawn on white paper):
  1. Render the PDF page to a raster at 300 DPI            (poppler: pdftoppm)
  2. AI background removal to isolate the drawing          (rembg / u2net)
  3. Despeckle stray islands, enhance contrast/saturation  (Pillow + scipy)
  4. Add a soft white "sticker" outline for readability    (so faint pencil
     drawings read against both the sky and the green hills)
  5. Trim to content and normalise height, then save       (Pillow)

Requirements:
    brew install poppler            # provides pdftoppm
    pip install rembg pillow numpy scipy

Usage:
    python3 tools/extract-characters.py [path/to/source.pdf]
"""
import os
import sys
import subprocess
import tempfile

from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(ROOT, "assets", "source", "characters.pdf")
OUT_DIR = os.path.join(ROOT, "assets", "characters")

# Page order in the PDF -> (slug, per-character enhancement).
CHARACTERS = [
    ("one",         dict(contrast=1.25, color=1.35)),
    ("silly-bunny", dict(contrast=1.20, color=1.30)),
    ("teddy",       dict(contrast=1.35, color=1.55)),
    ("zoomy",       dict(contrast=1.70, color=1.20)),  # faint pencil -> push hard
    ("kiwi",        dict(contrast=1.20, color=1.30)),
]

OUTPUT_HEIGHT = 320  # px; the game scales sprites down from here


def despeckle(im, min_frac=0.0008):
    """Drop tiny isolated alpha islands while keeping real parts (e.g. One's sprout)."""
    try:
        from scipy import ndimage
    except ImportError:
        return im
    a = np.array(im)[:, :, 3]
    mask = a > 30
    lbl, n = ndimage.label(mask)
    if n == 0:
        return im
    sizes = ndimage.sum(mask, lbl, range(1, n + 1))
    keep = np.zeros_like(mask)
    thresh = mask.sum() * min_frac
    for i, s in enumerate(sizes, 1):
        if s >= thresh:
            keep |= (lbl == i)
    arr = np.array(im)
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    return Image.fromarray(arr)


def add_outline(im, grow=6, blur=4, color=(255, 255, 255), alpha=235):
    """Soft white sticker outline so the sprite lifts off any background."""
    pad = grow + blur + 4
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.alpha_composite(im, (pad, pad))
    al = np.array(big)[:, :, 3]
    m = Image.fromarray((al > 40).astype("uint8") * 255)
    m = m.filter(ImageFilter.MaxFilter(grow * 2 + 1)).filter(ImageFilter.GaussianBlur(blur))
    mask = np.array(m).astype("float32") / 255 * (alpha / 255)
    out = np.zeros((big.height, big.width, 4), "uint8")
    out[:, :, 0], out[:, :, 1], out[:, :, 2] = color
    out[:, :, 3] = (mask * 255).astype("uint8")
    base = Image.fromarray(out, "RGBA")
    base.alpha_composite(big)
    return base.crop(base.getbbox())


def render_pages(pdf_path, workdir):
    prefix = os.path.join(workdir, "page")
    subprocess.run(["pdftoppm", "-png", "-r", "300", pdf_path, prefix], check=True)
    return sorted(p for p in os.listdir(workdir) if p.startswith("page") and p.endswith(".png"))


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    os.makedirs(OUT_DIR, exist_ok=True)
    session = new_session("u2net")
    with tempfile.TemporaryDirectory() as workdir:
        pages = render_pages(pdf_path, workdir)
        if len(pages) < len(CHARACTERS):
            raise SystemExit(f"expected {len(CHARACTERS)} pages, got {len(pages)}")
        for (slug, enh), page in zip(CHARACTERS, pages):
            src = Image.open(os.path.join(workdir, page)).convert("RGBA")
            im = remove(src, session=session)        # 2. AI background removal
            im = despeckle(im)                        # 3. clean + enhance
            im = ImageEnhance.Contrast(im).enhance(enh["contrast"])
            im = ImageEnhance.Color(im).enhance(enh["color"])
            bbox = im.getbbox()
            if bbox:
                im = im.crop(bbox)
            im = add_outline(im)                      # 4. sticker outline
            w = round(im.width * OUTPUT_HEIGHT / im.height)
            im = im.resize((w, OUTPUT_HEIGHT), Image.LANCZOS)  # 5. normalise + save
            im.save(os.path.join(OUT_DIR, f"{slug}.png"))
            print(f"  {slug:12s} -> assets/characters/{slug}.png  ({im.width}x{im.height})")
    print("done")


if __name__ == "__main__":
    main()
