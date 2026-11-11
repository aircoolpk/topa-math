#!/usr/bin/env python
"""Generate `src/lib/billing/copy.ts` from the FastAPI billing router.

The Thai copy of the pricing pages lives in `apps/api/app/routers/billing.py`
as string literals. Hand-typing them into TypeScript risks a byte-level
divergence (a different combining mark renders as a different glyph), so the
literals are extracted from the Python AST and written out as `\\u` escapes.

Run it after changing the Python copy:

    python scripts/generate-billing-copy.py
"""
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "api" / "app" / "routers" / "billing.py"
TARGET = ROOT / "api-ts" / "src" / "lib" / "billing" / "copy.ts"


def literal(node: ast.AST):
    """The value of a literal node, or `None` when it is not a constant."""
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError):
        return None


def dict_of(node: ast.AST) -> dict:
    """A dict node as a plain dictionary."""
    if not isinstance(node, ast.Dict):
        return {}
    out = {}
    for key, value in zip(node.keys, node.values):
        if key is None:
            continue
        key_value = literal(key)
        if not isinstance(key_value, str):
            continue
        out[key_value] = literal(value)
    return out


def find_function(tree: ast.Module, name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    return None


def free_plan(tree: ast.Module) -> dict:
    function = find_function(tree, "billing_prices")
    assert function is not None, "billing_prices() not found"
    for node in ast.walk(function):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            values = dict_of(node.value)
            if values.get("plan_code") == "free":
                return values
    raise AssertionError("the free plan of /billing/prices was not found")


def dev_plan(tree: ast.Module) -> tuple[str, str, list[str], list[str]]:
    function = find_function(tree, "_dev_plan_payload")
    assert function is not None, "_dev_plan_payload() not found"
    description = ("", "")
    features = ([], [])
    for node in ast.walk(function):
        if not isinstance(node, ast.Dict):
            continue
        values = dict_of(node)
        if "description" in values and isinstance(values["description"], ast.IfExp):
            description = (
                literal(values["description"].body),
                literal(values["description"].orelse),
            )
        if "features" in values and isinstance(values["features"], ast.IfExp):
            features = (
                literal(values["features"].body),
                literal(values["features"].orelse),
            )
    return description[0], description[1], features[0], features[1]


def legacy_plans(tree: ast.Module) -> list[dict]:
    function = find_function(tree, "billing_plans")
    assert function is not None, "billing_plans() not found"
    for node in ast.walk(function):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.List):
            plans = []
            for element in node.value.elts:
                values = dict_of(element)
                if "id" in values and "plan_code" in values:
                    plans.append(values)
            if len(plans) >= 4:
                return plans
    raise AssertionError("the legacy plan list of /billing/plans was not found")


def escape(value: str) -> str:
    """A TypeScript string literal for `value` (ASCII stays readable)."""
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


def array(values: list[str]) -> str:
    return "[" + ", ".join(f"'{escape(value)}'" for value in values) + "]"


def main() -> int:
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))

    free = free_plan(tree)
    description_ep, description_th, features_ep, features_th = dev_plan(tree)
    legacy = legacy_plans(tree)

    by_id = {plan["id"]: plan for plan in legacy}

    lines = [
        "/**",
        " * The Thai copy of the pricing pages.",
        " *",
        " * GENERATED FILE — do not edit by hand.",
        " *",
        " * The strings are extracted from `apps/api/app/routers/billing.py` by",
        " * `scripts/generate-billing-copy.py`, because a Thai combining mark",
        " * that differs by one code point renders as a different glyph and the",
        " * frontend compares the pricing payload byte for byte.",
        " */",
        "",
        "/** The display name of the free plan on the pricing page. */",
        f"export const FREE_PLAN_DISPLAY_NAME = '{escape(free['display_name'])}'",
        "",
        "/** The description of the Thai plans on the plan list. */",
        f"export const TH_PLAN_DESCRIPTION = '{escape(description_th)}'",
        "",
        "/** The description of the English plans on the plan list. */",
        f"export const EP_PLAN_DESCRIPTION = '{escape(description_ep)}'",
        "",
        "/** The fallback feature list of the English plans. */",
        f"export const EP_PLAN_FALLBACK_FEATURES = {array(features_ep)}",
        "",
        "/** The fallback feature list of the Thai plans. */",
        f"export const TH_PLAN_FALLBACK_FEATURES = {array(features_th)}",
        "",
        "/** The description of the free plan of the legacy plan list. */",
        f"export const LEGACY_FREE_DESCRIPTION = '{escape(by_id['free']['description'])}'",
        "",
        "/** The features of the free plan of the legacy plan list. */",
        f"export const LEGACY_FREE_FEATURES = {array(by_id['free']['features'])}",
        "",
        "/** The description of the Thai program of the legacy plan list. */",
        f"export const LEGACY_THP_DESCRIPTION = '{escape(by_id['thp_monthly']['description'])}'",
        "",
        "/** The features of the Thai program of the legacy plan list. */",
        f"export const LEGACY_THP_FEATURES = {array(by_id['thp_monthly']['features'])}",
        "",
        "/** The description of the English program of the legacy plan list. */",
        f"export const LEGACY_EP_DESCRIPTION = '{escape(by_id['ep_monthly']['description'])}'",
        "",
        "/** The features of the English program of the legacy plan list. */",
        f"export const LEGACY_EP_FEATURES = {array(by_id['ep_monthly']['features'])}",
        "",
        "/** The description of the family plan of the legacy plan list. */",
        f"export const LEGACY_FAMILY_DESCRIPTION = '{escape(by_id['family_monthly']['description'])}'",
        "",
        "/** The features of the family plan of the legacy plan list. */",
        f"export const LEGACY_FAMILY_FEATURES = {array(by_id['family_monthly']['features'])}",
        "",
    ]

    TARGET.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {TARGET}")
    print(json.dumps({"free": free["display_name"], "legacy": list(by_id)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
