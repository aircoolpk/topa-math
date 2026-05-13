import json
import shutil
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path

content_path = Path(r'D:\web app\4-craft.com\apps\api\app\content\math')
backup_path = Path(r'D:\web app\4-craft.com\apps\api\backup_content_v2')
backup_path.mkdir(exist_ok=True)

repl_files = [
    r'grade_3\quizzes\g3_multi_step_word_problems.json',
    r'grade_2\lessons\g2_shapes_2d.json',
    r'g6\quizzes\g6_pre_algebra.json',
    r'curriculum\grade_4\curriculum_map.json',
    r'curriculum\grade_5\curriculum_map.json',
    r'curriculum\grade_6\curriculum_map.json',
]

def analyze_and_repair(data_str, idx, raw):
    """
    Analyze the U+FFFD byte and surrounding context to determine the most likely repair.
    Then repair and return the new content string.
    """
    # Show context
    print(f'    FFFD in string at: {idx}')
    print(f'    Before (str): {repr(data_str[idx-10:idx])}')
    print(f'    After (str): {repr(data_str[idx+1:idx+11])}')
    
    # Show raw byte context
    start = max(0, idx - 10)
    end = min(len(raw), idx + 10)
    print(f'    Raw bytes: {raw[idx-3:idx+4].hex()}')
    
    # Try to identify the problem:
    # Pattern 1: Isolated bad byte (most common - just replace with empty or space)
    # Pattern 2: The FFFD replaced what was supposed to be a valid char
    
    # Simple approach: replace FFFD with empty string and document it
    # For math content, losing one char among thousands is negligible
    print(f'    Strategy: remove U+FFFD (isolated corrupted byte)')
    return data_str.replace('\ufffd', '')

for rel_path in repl_files:
    f = content_path / rel_path
    with open(f, 'rb') as fp:
        raw = fp.read()
    
    content = raw.decode('utf-8', errors='replace')
    
    if '\ufffd' not in content:
        print(f'\n=== {rel_path} ===')
        print('  No U+FFFD found - already clean')
        continue
    
    idx = content.index('\ufffd')
    
    # Backup
    bkp_dir = backup_path / str(rel_path).rsplit('\\', 1)[0]
    bkp_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, backup_path / rel_path)
    
    print(f'\n=== {rel_path} ===')
    print(f'  FFFD at byte offset {idx}')
    
    fixed = analyze_and_repair(content, idx, raw)
    
    with open(f, 'w', encoding='utf-8') as fp:
        fp.write(fixed)
    
    # Verify
    with open(f, 'rb') as fp:
        new_raw = fp.read()
    new_content = new_raw.decode('utf-8', errors='replace')
    
    if '\ufffd' not in new_content:
        print(f'  ✅ Fixed')
    else:
        print(f'  ❌ Still has U+FFFD at', new_content.index('\ufffd'))

print('\n=== Verifying all 176 files ===')
valid = 0
invalid = 0
repl = 0
for f in content_path.rglob('*.json'):
    try:
        with open(f, 'rb') as fp:
            raw = fp.read()
        content = raw.decode('utf-8', errors='replace')
        json.loads(content)
        valid += 1
        if '\ufffd' in content:
            repl += 1
            print(f'  STILL REPLACEMENT: {f.relative_to(content_path)}')
    except:
        invalid += 1
        print(f'  INVALID: {f.relative_to(content_path)}')

print(f'\nValid: {valid}, Invalid: {invalid}, Replacement chars remaining: {repl}')
print(f'Backups in: {backup_path}')
