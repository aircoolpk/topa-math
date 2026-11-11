"""Compare the Thai/product literals of the Worker billing libs with the FastAPI source.

The comparison is done on code points: a Thai combining mark that differs by
one code point renders as a different glyph and the frontend compares the
pricing payload byte for byte.

    python scripts/compare-billing-literals.py
"""
import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY_SOURCE = ROOT / "api" / "app" / "routers" / "billing.py"
TS_ROOT = ROOT / "api-ts" / "src" / "lib" / "billing"

source = PY_SOURCE.read_text(encoding="utf-8")
tree = ast.parse(source)


def codepoints(value: str) -> str:
    return " ".join(f"U+{ord(char):04X}" for char in value)


def ts_strings(path: Path) -> list[str]:
    """Every single-quoted string literal of a TypeScript file, unescaped."""
    text = path.read_text(encoding="utf-8")
    out = []
    for match in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", text):
        raw = match.group(1)
        raw = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), raw)
        raw = raw.replace("\\\\", "\\").replace("\\'", "'")
        out.append(raw)
    return out


def const_of(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


# ── The literals of the FastAPI source ────────────────────────────────────
fastapi: dict[str, str] = {}

for node in ast.walk(tree):
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        if isinstance(node, ast.AnnAssign):
            target, value = node.target, node.value
        else:
            target, value = node.targets[0], node.value
        name = target.id if isinstance(target, ast.Name) else ""
        if name in {"TH_PLAN_FEATURES", "EP_PLAN_FEATURES"} and isinstance(value, ast.Tuple):
            fastapi[name] = "\n".join(
                const_of(item) or "" for item in value.elts
            )

for node in ast.walk(tree):
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        name = node.target.id
        if name == "PLAN_CATALOG" and isinstance(node.value, ast.Dict):
            for key, value in zip(node.value.keys, node.value.values):
                code = const_of(key)
                if code is None or not isinstance(value, ast.Call):
                    continue
                product = None
                for keyword in value.keywords:
                    if keyword.arg == "product_id":
                        product = const_of(keyword.value)
                if product:
                    fastapi[f"product_id:{code}"] = product

for node in ast.walk(tree):
    if isinstance(node, ast.Dict):
        for key, value in zip(node.keys, node.values):
            if isinstance(key, ast.Constant) and key.value == "note_th":
                found = const_of(value)
                if found:
                    fastapi["note_th"] = found

for node in ast.walk(tree):
    if isinstance(node, ast.Call):
        for keyword in node.keywords:
            if keyword.arg != "detail":
                continue
            found = const_of(keyword.value)
            if not found:
                continue
            if found.startswith("\u0e2a\u0e48\u0e07\u0e04\u0e33"):
                fastapi["manual_pending"] = found
            elif found.startswith("\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a"):
                fastapi["missing_stripe_customer"] = found
            elif found.startswith("\u0e44\u0e21\u0e48\u0e1e\u0e1a"):
                fastapi["no_child_profile"] = found

# The descriptions of `_dev_plan_payload()` — an `EP ? ... : ...` expression.
for node in ast.walk(tree):
    if isinstance(node, ast.IfExp):
        body, orelse = const_of(node.body), const_of(node.orelse)
        if body and orelse and "EP" in body:
            fastapi["ep_description"] = body
            fastapi["th_description"] = orelse

# ── The literals of the Worker libraries ──────────────────────────────────
problems: list[str] = []

plans = ts_strings(TS_ROOT / "plans.ts")
fmt = ts_strings(TS_ROOT / "format.ts")
copy = ts_strings(TS_ROOT / "copy.ts")


def check(name: str, expected: str, haystack: list[str], where: str) -> None:
    if expected in haystack:
        print(f"OK   {name}")
        return
    problems.append(name)
    print(f"DIFF {name} ({where})")
    print(f"     fastapi: {codepoints(expected)}")
    for candidate in haystack:
        if candidate[:2] == expected[:2]:
            print(f"     worker : {codepoints(candidate)}")


for name in ("TH_PLAN_FEATURES", "EP_PLAN_FEATURES"):
    for line in fastapi[name].split("\n"):
        if line and line not in plans:
            problems.append(f"{name}: {line}")
            print(f"DIFF {name} item: {codepoints(line)}")
        elif line:
            print(f"OK   {name} item")

for code, expected in fastapi.items():
    if not code.startswith("product_id:"):
        continue
    if expected in plans:
        print(f"OK   {code}")
    else:
        problems.append(code)
        print(f"DIFF {code}: fastapi {expected} missing in plans.ts")

for key, where, haystack in (
    ("note_th", "format.ts", fmt),
    ("manual_pending", "format.ts", fmt),
    ("missing_stripe_customer", "format.ts", fmt),
    ("no_child_profile", "format.ts", fmt),
    ("th_description", "copy.ts", copy),
    ("ep_description", "copy.ts", copy),
):
    if key in fastapi:
        check(key, fastapi[key], haystack, where)

print()
print(f"{len(problems)} problem(s)")
for problem in problems:
    print(f"  - {problem}")
