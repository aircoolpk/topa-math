import os
import json

content_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

valid_count = 0
invalid_count = 0
invalid_files = []
bom_count = 0
bom_files = []
replacement_files = []

json_files = []
for root, dirs, files in os.walk(content_dir):
    for f in files:
        if f.endswith('.json'):
            json_files.append(os.path.join(root, f))

total = len(json_files)
print(f'Total JSON files scanned: {total}')

for fp in json_files:
    rel = os.path.relpath(fp, content_dir)
    
    with open(fp, 'rb') as f:
        raw = f.read()
    
    has_bom = raw[:3] == b'\xef\xbb\xbf'
    if has_bom:
        content = raw.decode('utf-8-sig')
        bom_count += 1
        bom_files.append(rel)
    else:
        content = raw.decode('utf-8', errors='replace')
    
    repl = content.count('\ufffd')
    
    try:
        obj = json.loads(content)
        valid_count += 1
    except json.JSONDecodeError:
        invalid_count += 1
        invalid_files.append(rel)
    
    if repl > 0:
        replacement_files.append(f'{rel} ({repl} U+FFFD)')

print(f'Valid JSON: {valid_count}')
print(f'Invalid JSON: {invalid_count}')
if invalid_files:
    print(f'Invalid files: {invalid_files}')

print(f'BOM files: {bom_count}')
if bom_files:
    print(f'BOM file list: {bom_files}')

print(f'Files with U+FFFD: {len(replacement_files)}')
if replacement_files:
    for f in replacement_files:
        print(f'  {f}')
