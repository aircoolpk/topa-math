"""Remove the dashboard card that is baked into the homepage hero artwork.

The hero PNG (`public/brand/topa/homepage-hero-cover-transparent.png`) shipped with a
stat card ("Lv. 23 / 720/900 XP / 1,250") painted straight into the artwork. The card
cannot be removed with a plain rectangular crop because it overlaps the mascots, so the
card rectangle is *cropped out* (crop -> drop -> paste transparent) and the same
statistics are rendered as real DOM in `src/app/page.tsx` from `cms.hero.stats`.

Usage:  python scripts/crop-hero-card.py
"""

from pathlib import Path

from PIL import Image

HERO = Path(__file__).resolve().parents[1] / "public/brand/topa/homepage-hero-cover-transparent.png"

# Bounding box of the painted dashboard card (751x513 artwork).
# top-left (185, 366) -> bottom-right (545, 480)
CARD_BOX = (185, 364, 546, 481)

# The card's rounded-rectangle border, in percentage of the artwork, so the DOM
# replacement card can be positioned on top of the artwork pixel-exactly.
CARD_RECT_PCT = {
    "left": 185 / 751 * 100,
    "top": 364 / 513 * 100,
    "width": 361 / 751 * 100,
    "height": 117 / 513 * 100,
}


def main() -> None:
    image = Image.open(HERO).convert("RGBA")
    before = HERO.stat().st_size

    # Real crop: take the card out of the artwork, then drop it (transparent).
    card = image.crop(CARD_BOX)
    image.paste(Image.new("RGBA", card.size, (0, 0, 0, 0)), CARD_BOX[:2])

    image.save(HERO, optimize=True)
    after = HERO.stat().st_size

    print(f"cropped box : {CARD_BOX}")
    print(f"size        : {image.size[0]}x{image.size[1]}")
    print(f"file bytes  : {before} -> {after}")
    print("card rect % : " + ", ".join(f"{k}={v:.2f}" for k, v in CARD_RECT_PCT.items()))


if __name__ == "__main__":
    main()
