"""Print the exact TypeScript literals of the pricing-page copy.

The strings come from `apps/api/app/routers/billing.py`; they are read with
the AST so that a Thai combining mark that differs by one code point is
preserved exactly.
"""
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY_SOURCE = ROOT / "api" / "app" / "routers" / "billing.py"

source = PY_SOURCE.read_text(encoding="utf-8")
tree = ast.parse(source)


def esc(value: str) -> str:
    out = []
    for char in value:
        if char == "\\":
            out.append("\\\\")
        elif char == "'":
            out.append("\\'")
        elif ord(char) < 0x20 or ord(char) > 0x7E:
            out.append(f"\\u{ord(char):04x}")
        else:
            out.append(char)
    return "".join(out)


def const(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


# The `description` of `_dev_plan_payload()` — an `EP ? ... : ...` expression.
description = None
for node in ast.walk(tree):
    if isinstance(node, ast.IfExp):
        body = const(node.body)
        orelse = const(node.orelse)
        if body and orelse and body.startswith("\u0e1a\u0e17\u0e40\u0e23\u0e35\u0e22\u0e19 EP"):
            description = (orelse, body)

# The fallback feature lists of `_dev_plan_payload()`.
fallbacks = None
for node in ast.walk(tree):
    if isinstance(node, ast.IfExp):
        try:
            body = ast.literal_eval(node.body)
            orelse = ast.literal_eval(node.orelse)
        except (ValueError, TypeError):
            continue
        if (
            isinstance(body, list)
            and isinstance(orelse, list)
            and body
            and orelse
            and all(isinstance(item, str) for item in body + orelse)
        ):
            fallbacks = (orelse, body)

th_desc, ep_desc = description
th_fallback, ep_fallback = fallbacks

print(f"TH_PLAN_DESCRIPTION = {esc(th_desc)!r}")
print(f"EP_PLAN_DESCRIPTION = {esc(ep_desc)!r}")
print("TH_PLAN_FALLBACK_FEATURES = [" + ", ".join(esc(f) for f in th_fallback) + "]")
print("EP_PLAN_FALLBACK_FEATURES = [" + ", ".join(esc(f) for f in ep_fallback) + "]")
