"""Print the exact TypeScript literals for the billing copy taken from the FastAPI source."""
import ast
import json
import re
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


# The literals of the FastAPI source, resolved by the AST.
literals: dict[str, str] = {}

for node in ast.walk(tree):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        literals.setdefault(node.value, node.value)

note_th = None
for node in ast.walk(tree):
    if isinstance(node, ast.Dict):
        for key, value in zip(node.keys, node.values):
            if (
                isinstance(key, ast.Constant)
                and key.value == "note_th"
                and isinstance(value, ast.Constant)
            ):
                note_th = value.value

manual = None
for node in ast.walk(tree):
    if isinstance(node, ast.Dict):
        for key, value in zip(node.keys, node.values):
            if (
                isinstance(key, ast.Constant)
                and key.value == "message"
                and isinstance(value, ast.Constant)
            ):
                manual = value.value

stripe_customer = None
no_child = None
for node in ast.walk(tree):
    if isinstance(node, ast.Call):
        for keyword in node.keywords:
            if keyword.arg == "detail" and isinstance(keyword.value, ast.Constant):
                value = keyword.value.value
                if isinstance(value, str) and value.startswith("\u0e22\u0e31\u0e07"):
                    stripe_customer = value
                if isinstance(value, str) and value.startswith("\u0e44\u0e21\u0e48"):
                    no_child = value

print("FOUNDER_NOTE_TH = '" + esc(note_th) + "'")
print("MANUAL_PENDING_MESSAGE = '" + esc(manual) + "'")
print("MISSING_STRIPE_CUSTOMER_MESSAGE = '" + esc(stripe_customer) + "'")
print("NO_CHILD_PROFILE_MESSAGE = '" + esc(no_child) + "'")
