import json

# Check the ORIGINAL broken file structure around line 251
fpath = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(fpath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# Show lines 245-260 from original
with open(r'D:\web app\4-craft.com\apps\api\orig_context.txt', 'w', encoding='utf-8') as out:
    out.write('ORIGINAL file lines 245-260:\n')
    for i in range(244, 260):
        line = lines[i]
        out.write(f'Line {i+1} (len={len(line)}): {repr(line)}\n')
    
    # Find the mini_quiz block start
    for idx, line in enumerate(lines):
        if '"type": "mini_quiz"' in line:
            out.write(f'\nFirst mini_quiz at line {idx+1}\n')
            # Show the whole mini_quiz block from here
            out.write('\nMini_quiz block lines:\n')
            # Count indentation to understand structure
            for j in range(idx, min(len(lines), idx + 30)):
                l = lines[j]
                spaces = len(l) - len(l.lstrip())
                out.write(f'Line {j+1} (indent={spaces}): {repr(l[:80])}\n')
            break