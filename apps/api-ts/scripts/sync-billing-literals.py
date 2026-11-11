#!/usr/bin/env python
"""Sync the billing literals of the TypeScript port with the FastAPI source.

The Thai copy of the pricing pages is compared byte for byte by the frontend
parity suite, and a single differing combining mark renders as a different
glyph. This script therefore *writes* the literals from the Python source into
the TypeScript libraries instead of relying on hand-typed copies.

It is idempotent: running it twice does not change anything.

    python scripts/sync-billing-literals.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY_SOURCE = ROOT / "api" / "app" / "routers" / "billing.py"
FORMAT_TS = ROOT / "api-ts" / "src" / "lib" / "billing" / "format.ts"
PLANS_TS = ROOT / "api-ts" / "src" / "lib" / "billing" / "plans.ts"
SETTINGS_TS = ROOT / "api-ts" / "src" / "lib" / "billing" / "settings.ts"


def unescape(value: str) -> str:
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), value)


def escape(value: str) -> str:
    """A TypeScript string literal that keeps the exact code points."""
    out = []
    for char in value:
        if char == "\\":
            out.append("\\\\")
        elif char == "'":
            out.append("\\'")
        elif char == "\n":
            out.append("\\n")
        elif ord(char) < 0x20 or ord(char) > 0x7E:
            out.append(f"\\u{ord(char):04x}")
        else:
            out.append(char)
    return "".join(out)


def python_source() -> str:
    return PY_SOURCE.read_text(encoding="utf-8")


def literal_after(source: str, marker: str) -> str:
    """The value of the first string literal that follows `marker`."""
    index = source.index(marker)
    match = re.search(r'"((?:[^"\\\n]|\\.)*)"', source[index:])
    if match is None:
        raise AssertionError(f"no literal after {marker!r}")
    return unescape(match.group(1))


def replace_constant(path: Path, name: str, value: str) -> bool:
    """Rewrite `export const <name> = '...'` with `value`."""
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"(export const {name} = ')([^']*)(')")
    match = pattern.search(source)
    if match is None:
        raise AssertionError(f"{name} not found in {path}")
    if match.group(2) == value:
        return False
    path.write_text(
        pattern.sub(lambda m: m.group(1) + escape(value) + m.group(3), source, count=1),
        encoding="utf-8",
    )
    return True


def replace_array_entry(path: Path, marker: str, value: str) -> bool:
    """Rewrite the string literal that follows `marker` inside a TS file."""
    source = path.read_text(encoding="utf-8")
    index = source.index(marker)
    match = re.compile(r"'((?:[^'\\\n]|\\.)*)'").search(source, index)
    if match is None:
        raise AssertionError(f"no literal after {marker!r} in {path}")
    if match.group(1) == escape(value):
        return False
    path.write_text(
        source[: match.start(1)] + escape(value) + source[match.end(1) :],
        encoding="utf-8",
    )
    return True


def main() -> int:
    source = python_source()
    changed: list[str] = []

    # 1. `format.ts` — the messages of the billing endpoints.
    note_th = literal_after(source, '"note_th":')
    if replace_constant(FORMAT_TS, "FOUNDER_NOTE_TH", note_th):
        changed.append("format.ts:FOUNDER_NOTE_TH")

    manual_pending = literal_after(source, '"message": "\\u0e2a')
    if replace_constant(FORMAT_TS, "MANUAL_PENDING_MESSAGE", manual_pending):
        changed.append("format.ts:MANUAL_PENDING_MESSAGE")

    stripe_customer = literal_after(source, 'detail="\\u0e22\\u0e31\\u0e07\\u0e44\\u0e21')
    if replace_constant(FORMAT_TS, "MISSING_STRIPE_CUSTOMER_MESSAGE", stripe_customer):
        changed.append("format.ts:MISSING_STRIPE_CUSTOMER_MESSAGE")

    no_child = literal_after(source, 'detail="\\u0e44\\u0e21\\u0e48\\u0e1e\\u0e1a')
    if replace_constant(FORMAT_TS, "NO_CHILD_PROFILE_MESSAGE", no_child):
        changed.append("format.ts:NO_CHILD_PROFILE_MESSAGE")

    # 2. `plans.ts` — the feature list and the product ids.
    feature_markers = [
        '"\\u0e1b\\u0e2d\\u0e25\\u0e2d\\u0e25\\u0e2a\\u0e17\\u0e14\\u0e23\\u0e35\\u0e22\\u0e19',
        '"\\u0e41\\u0e1a\\u0e1a\\u0e1d\\u0e36\\u0e01\\u0e2b\\u0e31\\u0e14',
        '"\\u0e23\\u0e30\\u0e1a\\u0e1a\\u0e27\\u0e34\\u0e40\\u0e04\\u0e23\\u0e32\\u0e30',
        '"\\u0e41\\u0e1a\\u0e1a\\u0e1d\\u0e36\\u0e01\\u0e2b\\u0e31\\u0e14\\u0e17\\u0e35\\u0e49\\u0e07\\u0e17\\u0e30',
        '"Quest \\u0e23\\u0e32\\u0e22\\u0e27\\u0e31\\u0e19 / \\u0e2a\\u0e31\\u0e1b\\u0e14\\u0e32\\u0e2b\\u0e4c / \\u0e40\\u0e14\\u0e37\\u0e2d\\u0e19"',
        '"XP / Level / Rank \\u0e17\\u0e31\\u0e49\\u0e27\\u0e1b\\u0e23\\u0e30\\u0e14\\u0e2d\\u0e34',
        '"Avatar \\u0e41\\u0e25\\u0e30\\u0e2d\\u0e32\\u0e15\\u0e23\\u0e4c"',
    ]
    feature_values = [
        "\\u0e1b\\u0e2d\\u0e25\\u0e2d\\u0e25\\u0e2a\\u0e17\\u0e14\\u0e23\\u0e35\\u0e22\\u0e19",
        "\\u0e41\\u0e1a\\u0e1a\\u0e1d\\u0e36\\u0e01\\u0e2b\\u0e31\\u0e14",
        "\\u0e23\\u0e30\\u0e1a\\u0e1a\\u0e27\\u0e34\\u0e40\\u0e04\\u0e23\\u0e32\\u0e30",
        "\\u0e41\\u0e1a\\u0e1a\\u0e1d\\u0e36\\u0e01\\u0e2b\\u0e31\\u0e14\\u0e17\\u0e35\\u0e49\\u0e07\\u0e17\\u0e30",
        "Quest \\u0e23\\u0e32\\u0e22\\u0e27\\u0e31\\u0e19 / \\u0e2a\\u0e31\\u0e1b\\u0e14\\u0e32\\u0e2b\\u0e4c / \\u0e40\\u0e14\\u0e37\\u0e2d\\u0e19",
        "XP / Level / Rank \\u0e17\\u0e31\\u0e49\\u0e27\\u0e1b\\u0e23\\u0e30\\u0e14\\u0e2d\\u0e34",
        "Avatar \\u0e41\\u0e25\\u0e30\\u0e2d\\u0e32\\u0e15\\u0e23\\u0e4c",
    ]
    # The feature list of the FastAPI source, in order.
    feature_block = re.search(
        r"TH_PLAN_FEATURES: tuple\[str, \.\.\.\] = \((.*?)\n\)", source, re.S
    )
    if feature_block is None:
        raise AssertionError("TH_PLAN_FEATURES not found")
    features = [
        unescape(match.group(1))
        for match in re.finditer(r'"((?:[^"\\\n]|\\.)*)"', feature_block.group(1))
    ]
    if len(features) != len(feature_values):
        raise AssertionError(f"expected {len(feature_values)} features, found {len(features)}")

    plans_source = PLANS_TS.read_text(encoding="utf-8")
    for marker, value in zip(feature_markers, features):
        if marker not in plans_source:
            raise AssertionError(f"feature marker not found: {marker}")
        if replace_array_entry(PLANS_TS, marker, value):
            changed.append(f"plans.ts:feature({marker[:24]}…)")

    # 3. `plans.ts` — the product ids.
    product_ids = dict(
        re.findall(r'plan_code: \'([a-z_]+)\',\s*\n\s*price_env: \'[A-Za-z]+\',\s*\n\s*product_id: \'([^\']+)\'', plans_source)
    )
    for plan_code, product_id in re.findall(
        r'plan_code="([a-z_]+)",\s*\n\s*price_env="[a-z_]+",\s*\n\s*product_id="([^"]+)"', source
    ):
        current = product_ids.get(plan_code)
        if current is None:
            continue
        if current == product_id:
            continue
        updated = re.sub(
            rf"(plan_code: '{plan_code}',\s*\n\s*price_env: '[A-Za-z]+',\s*\n\s*product_id: ')[^']+(')",
            lambda m: m.group(1) + product_id + m.group(2),
            PLANS_TS.read_text(encoding="utf-8"),
            count=1,
        )
        PLANS_TS.write_text(updated, encoding="utf-8")
        changed.append(f"plans.ts:product_id({plan_code})")

    # 4. `settings.ts` — the founder-pricing default.
    #
    # FastAPI defaults `founder_pricing_enabled` to True, so the pricing page
    # shows the founder plans. The Worker has to default to the same value,
    # otherwise the two services disagree whenever the variable is unset.
    settings_source = SETTINGS_TS.read_text(encoding="utf-8")
    if "founderPricingEnabled: bool(env, 'FOUNDER_PRICING_ENABLED', false)" in settings_source:
        SETTINGS_TS.write_text(
            settings_source.replace(
                "founderPricingEnabled: bool(env, 'FOUNDER_PRICING_ENABLED', false)",
                "founderPricingEnabled: bool(env, 'FOUNDER_PRICING_ENABLED', true)",
            ),
            encoding="utf-8",
        )
        changed.append("settings.ts:founderPricingEnabled")

    print(f"changed {len(changed)} constant(s)")
    for entry in changed:
        print("  ", entry)
    return 0


if __name__ == "__main__":
    sys.exit(main())
