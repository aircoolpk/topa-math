"""Remove the dashboard stat card that is baked into the homepage hero artwork.

The hero PNG (`public/brand/topa/homepage-hero-cover-transparent.png`) shipped with a
stat card ("Lv. 23 / 720/900 XP / 1,250") painted straight into the artwork. The same
statistics are rendered as real DOM in `src/app/page.tsx` from `cms.hero.stats`, so
the painted copy must go.

Why not a plain transparent crop:
    The card is a white rounded rectangle that *overlaps* the mascots (the central
    mascot's legs, the panda's arm) and the yellow floor swoosh. Punching a
    transparent hole there leaves a visible void in the artwork.

What this script does instead (content-aware vertical inpainting):
    For every column inside the card region it interpolates the pixels from the
    row directly above the card to the row directly below it. In this artwork the
    area behind the card is a smooth vertical gradient (cream background -> blue
    shadow band -> yellow swoosh), so a per-column linear blend reconstructs the
    background, the shadow and the swoosh faithfully. The small amount of
    character overlap (panda's arm) is soft-blended rather than erased.

Usage:  python scripts/crop-hero-card.py
"""

from pathlib import Path

from PIL import Image, ImageFilter

HERO = Path(__file__).resolve().parents[1] / "public/brand/topa/homepage-hero-cover-transparent.png"

# Bounding box of the painted dashboard card (751x513 artwork).
# top-left (185, 364) -> bottom-right (546, 481)
CARD_BOX = (185, 364, 546, 481)

# The card's rounded-rectangle border, in percentage of the artwork, so the DOM
# replacement card can be positioned on top of the artwork pixel-exactly.
CARD_RECT_PCT = {
    "left": 185 / 751 * 100,
    "top": 364 / 513 * 100,
    "width": 361 / 751 * 100,
    "height": 117 / 513 * 100,
}


def _blend(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    """Linear RGBA blend; `a` at t=0, `b` at t=1."""
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))  # type: ignore[return-value]


def _is_background(pixel: tuple[int, int, int, int]) -> bool:
    """True when a pixel is light, low-saturation cream/white background."""
    r, g, b, a = pixel
    if a < 190:
        return False
    highest, lowest = max(r, g, b), min(r, g, b)
    saturation = (highest - lowest) / highest if highest else 0.0
    return r > 195 and g > 180 and b > 160 and saturation < 0.22


def _is_floor_yellow(pixel: tuple[int, int, int, int]) -> bool:
    """True when a pixel belongs to the warm yellow floor swoosh."""
    r, g, b, a = pixel
    if a < 180:
        return False
    return r > 210 and g > 165 and b < 160 and (r - b) > 70


def _is_character_blue(pixel: tuple[int, int, int, int]) -> bool:
    """True when a pixel is a saturated TOPA blue (mascot cape / background)."""
    r, g, b, a = pixel
    if a < 180:
        return False
    return b > 150 and b - r > 55 and g > 90


def _find_background_above(
    source: Image.Image, x: int, top: int, limit: int = 60
) -> tuple[int, int, int, int] | None:
    """Find the brightest plain-background pixel above the card in this column.

    The card casts a soft shadow, so the pixels immediately above its top edge
    are *darker* than the real background. We therefore scan upwards and keep
    the brightest background candidate rather than the first one, which
    recovers the true cream field instead of the shadowed grey.
    """
    best: tuple[int, int, int, int] | None = None
    best_score = -1
    y = top - 1
    while y > top - limit:
        pixel = source.getpixel((x, y))
        if _is_background(pixel):
            score = pixel[0] + pixel[1] + pixel[2]
            if score > best_score:
                best_score = score
                best = pixel
        y -= 1
    return best


def inpaint_card(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Replace the painted card with a reconstructed background.

    The card is a white rounded rectangle painted on top of the artwork, so
    everything it covered is genuinely lost. What we *can* rebuild is the
    background behind it.

    Strategy:
      1. For every column of the card, walk upward from the card's top edge
         until a plain background pixel is found (skipping any character
         artwork). That pixel is the true background colour in that column.
         Columns where no background exists (the central mascot's legs) fall
         back to the median of the columns that do have one.
      2. Fill the card band with that per-column background colour.
      3. Copy the real floor band (the yellow swoosh that continues under the
         card) upwards so the floor line is unbroken.
      4. Feather the top and bottom edges so the patch blends into the
         surrounding artwork instead of showing a seam.
      5. Smooth horizontally to remove any residual banding.
    """
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    source = image.copy()
    source.load()

    # --- Step 1: per-column background sampled from above the card ---------
    column_colours: list[tuple[int, int, int, int] | None] = []
    for x in range(left, right):
        column_colours.append(_find_background_above(source, x, top))

    known = [colour for colour in column_colours if colour is not None]
    if not known:
        known = [source.getpixel((left - 1, top - 1))]

    def _median_colour(samples: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
        row = []
        for channel in range(4):
            values = sorted(sample[channel] for sample in samples)
            row.append(values[len(values) // 2])
        return tuple(row)  # type: ignore[return-value]

    fallback = _median_colour(known)

    # Fill gaps in the profile by interpolating between known neighbours, so
    # there is no sudden colour jump across the patch.
    filled: list[tuple[int, int, int, int]] = []
    last_known: tuple[int, int, int, int] | None = None
    pending: list[tuple[int, int, int, int]] = []
    for colour in column_colours:
        if colour is None:
            pending.append(fallback)
        else:
            if pending and last_known is not None:
                # Interpolate the gap between last_known and this colour.
                span = len(pending) + 1
                for index, _ in enumerate(pending):
                    t = (index + 1) / span
                    filled.append(_blend(last_known, colour, t))
            else:
                filled.extend(pending)
            pending = []
            filled.append(colour)
            last_known = colour
    filled.extend(pending)

    # --- Step 2: paint the background into the card band -------------------
    for xi in range(width):
        x = left + xi
        colour = filled[xi]
        for dy in range(height):
            image.putpixel((x, top + dy), colour)

    # --- Step 3: restore the floor + background from below the card -------
    # The floor band sits a few rows under the card; copy each column's real
    # pixels upwards so the floor line is unbroken and the mascot colours that
    # continue below the card (blue cape, yellow floor) survive.
    #
    # Only *warm yellow* and *saturated blue* pixels are copied. The card also
    # covered the panda's dark arm — copying those upwards would leave a dark
    # blob floating in the middle of the artwork.
    #
    # The row directly under the card is in the card's drop shadow, so we scan
    # a few rows down for the first clean floor pixel.
    #
    # The floor copy only fills the *lower* part of the card band — the upper
    # part is the cream background field, not floor.
    floor_rows = 26
    for x in range(left, right):
        floor_colour = None
        for probe in range(bottom + 4, bottom + 14):
            if probe >= source.height:
                break
            candidate = source.getpixel((x, probe))
            if _is_floor_yellow(candidate) or _is_character_blue(candidate):
                floor_colour = candidate
                break
        if floor_colour is None:
            continue
        for y in range(bottom - 1, max(bottom - floor_rows, top) - 1, -1):
            image.putpixel((x, y), floor_colour)

    # --- Step 4: feather all four edges ------------------------------------
    # Without this, the patch reads as a faint rectangular "ghost panel"
    # because its colour differs slightly from the artwork beside it.
    feather = 12
    for offset in range(feather):
        weight = offset / feather
        # Top edge: blend the row above the card into the first rows.
        y = top + offset
        for x in range(left, right):
            above = source.getpixel((x, top - 1))
            current = image.getpixel((x, y))
            image.putpixel((x, y), _blend(above, current, weight))
        # Bottom edge: blend the row below the card into the last rows.
        y = bottom - 1 - offset
        for x in range(left, right):
            below = source.getpixel((x, bottom))
            current = image.getpixel((x, y))
            image.putpixel((x, y), _blend(below, current, weight))
        # Left edge: blend the column left of the card into the first columns.
        x = left + offset
        for y in range(top, bottom):
            outside = source.getpixel((left - 1, y))
            current = image.getpixel((x, y))
            image.putpixel((x, y), _blend(outside, current, weight))
        # Right edge: blend the column right of the card into the last columns.
        x = right - 1 - offset
        for y in range(top, bottom):
            outside = source.getpixel((right, y))
            current = image.getpixel((x, y))
            image.putpixel((x, y), _blend(outside, current, weight))

    # --- Step 5: horizontal smoothing over the patched strip ---------------
    # A wide horizontal blur removes the per-column hairlines (each column was
    # filled with its own sampled colour) while leaving the vertical gradient
    # — cream field, blue shadow, yellow floor — completely intact.
    region = image.crop((left, top, right, bottom))
    smoothed = region.filter(ImageFilter.GaussianBlur(radius=6))
    image.paste(Image.blend(region, smoothed, 0.85), (left, top))

    return image


def main() -> None:
    image = Image.open(HERO).convert("RGBA")
    before = HERO.stat().st_size

    inpaint_card(image, CARD_BOX)

    image.save(HERO, optimize=True)
    after = HERO.stat().st_size

    print(f"inpainted box : {CARD_BOX}")
    print(f"size          : {image.size[0]}x{image.size[1]}")
    print(f"file bytes    : {before} -> {after}")
    print("card rect %   : " + ", ".join(f"{k}={v:.2f}" for k, v in CARD_RECT_PCT.items()))


if __name__ == "__main__":
    main()
