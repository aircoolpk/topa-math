import json
from pathlib import Path

content_path = Path("apps/api/app/content/math")

bad_keywords = [
    "lorem",
    "TODO",
    "undefined",
    "null",
    "NaN",
    "???",
    "�",
    "分析",
    "步骤",
    "计算",
    "问题",
    "答",
    "こんにちは",
    "단계",
]

hits = []

def collect_text(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from collect_text(v)
    elif isinstance(obj, list):
        for x in obj:
            yield from collect_text(x)
    elif isinstance(obj, str):
        yield obj

for f in content_path.rglob("*.json"):
    try:
        data = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue

    for text in collect_text(data):
        low = text.lower()
        for kw in bad_keywords:
            if kw.lower() in low:
                hits.append((str(f), kw, text[:250]))

print("BAD TEXT HITS:", len(hits))
for file, kw, text in hits[:100]:
    print("\nFILE:", file)
    print("KEYWORD:", kw)
    print("TEXT:", text)
