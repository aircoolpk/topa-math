import json
from pathlib import Path

content_path = Path("apps/api/app/content/math")
bad = []
total = 0

for f in content_path.rglob("*.json"):
    total += 1
    try:
        with open(f, "r", encoding="utf-8") as fp:
            json.load(fp)
    except Exception as e:
        bad.append((str(f), str(e)))

print("TOTAL JSON:", total)
print("BAD JSON:", len(bad))

for file, err in bad:
    print("BAD:", file)
    print("ERROR:", err)
    print()
