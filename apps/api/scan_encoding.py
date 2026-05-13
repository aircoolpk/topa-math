import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path

content_path = Path("apps/api/app/content/math")
mojibake_count = 0
mojibake_files = []
valid_count = 0
bom_count = 0
bom_files = []
repl_count = 0
repl_files = []
total = 0

for f in content_path.rglob("*.json"):
    total += 1
    try:
        with open(f, "rb") as fp:
            raw = fp.read()
        
        has_bom = raw[:3] == b'\xef\xbb\xbf'
        if has_bom:
            content = raw.decode("utf-8-sig")
            bom_count += 1
            bom_files.append(str(f.relative_to(content_path)))
        else:
            content = raw.decode("utf-8", errors="replace")
        
        obj = json.loads(content)
        valid_count += 1
        
        # Mojibake detection: look for sequences of 3 Latin-1 Supplement chars
        # These could be Thai UTF-8 bytes (E0-B8-*) double-decoded as Latin-1
        moji_seqs = re.findall(r'[\u00e0-\u00ff][\u00e0-\u00ff][\u00e0-\u00ff]', content) if 're' in dir() else []
        if moji_seqs:
            mojibake_count += 1
            mojibake_files.append(str(f.relative_to(content_path)) + f" ({len(moji_seqs)} moji seqs)")
        
    except json.JSONDecodeError as e:
        print(f"INVALID JSON: {f.relative_to(content_path)}: {e.msg} line {e.lineno}")
        continue
    
    if '\ufffd' in content:
        repl_count += 1
        repl_files.append(str(f.relative_to(content_path)))

print(f"\nTotal JSON files scanned: {total}")
print(f"Valid JSON: {valid_count}")
print(f"Invalid JSON: {total - valid_count}")
print(f"Files with BOM: {bom_count}")
print(f"Files with U+FFFD (replacement char): {repl_count}")
print(f"Files with mojibake sequences: {mojibake_count}")
print()
print(f"Files with U+FFFD:")
for rf in repl_files:
    print(f"  {rf}")
