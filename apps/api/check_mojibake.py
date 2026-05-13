import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path
from http.client import HTTPConnection

content_path = Path("apps/api/app/content/math")

# 1. Full JSON parse check
valid = 0
invalid = 0
invalid_files = []
bom_files = []
replacement_files = []
mojibake_files = []

for f in content_path.rglob("*.json"):
    try:
        with open(f, 'rb') as fp:
            raw = fp.read()
        has_bom = raw[:3] == b'\xef\xbb\xbf'
        if has_bom:
            content = raw.decode('utf-8-sig')
        else:
            content = raw.decode('utf-8', errors='replace')
        obj = json.loads(content)
        valid += 1
        if has_bom:
            bom_files.append(str(f.relative_to(content_path)))
    except json.JSONDecodeError as e:
        invalid += 1
        invalid_files.append(f"{f.relative_to(content_path)}: {e.msg} at line {e.lineno}")

    # Check for replacement char
    if '\ufffd' in content:
        replacement_files.append(str(f.relative_to(content_path)))

print(f"JSON parse: {valid} valid, {invalid} invalid")
if invalid_files:
    print(f"Invalid files: {invalid_files}")
print(f"BOM files: {len(bom_files)}: {bom_files}")
print(f"Replacement char files: {len(replacement_files)}: {replacement_files}")

# 2. Try API response (non-SSL)
print("\n--- API Response Test ---")
try:
    conn = HTTPConnection("127.0.0.1", 8001, timeout=5)
    conn.request("GET", "/health")
    resp = conn.getresponse()
    print(f"/health status: {resp.status}")
    conn.close()
except Exception as e:
    print(f"API not reachable: {e}")
