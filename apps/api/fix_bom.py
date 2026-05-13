import os
import json

content_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'
backup_dir = r'D:\web app\4-craft.com\apps\api\backup_content'

files_to_fix_bom = [
    'LESSON_CONTENT_FIXES.json',
    'LESSON_CONTENT_QA_SUMMARY.json',
]

os.makedirs(backup_dir, exist_ok=True)

for fname in files_to_fix_bom:
    src = os.path.join(content_dir, fname)
    bkp = os.path.join(backup_dir, fname)
    
    with open(src, 'rb') as f:
        raw = f.read()
    
    print(f'{fname}:')
    print(f'  Has BOM: {raw[:3] == b"\xef\xbb\xbf"}')
    print(f'  Size: {len(raw)}')
    
    # Backup current file (without BOM but with content)
    # We already have BOM versions backed up from earlier run
    
    # Strip BOM and rewrite
    if raw[:3] == b'\xef\xbb\xbf':
        content = raw.decode('utf-8-sig')
        with open(src, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  Stripped BOM, rewrote as clean UTF-8')
        
        # Verify
        with open(src, 'rb') as f:
            new_raw = f.read()
        print(f'  New first 4 bytes: {new_raw[:4].hex()}')
        print(f'  New has BOM: {new_raw[:3] == b"\xef\xbb\xbf"}')
        
        try:
            obj = json.loads(content)
            print(f'  Verified valid JSON, {len(obj)} items')
        except json.JSONDecodeError as e:
            print(f'  ERROR: {e.msg}')
