import json, shutil

# Trace the structure more carefully

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
lessons_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
fpath = lessons_dir + '\\g2_add_two_digit.json'
shutil.copy2(backup_dir + '\\g2_add_two_digit.json', fpath)

THAI = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

with open(fpath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the mini_quiz block start and trace its structure
import re

# Find first mini_quiz
m = re.search(r'"type"\s*:\s*"mini_quiz"', content)
if m:
    start = m.start()
    
    # Find where this mini_quiz block ends
    depth = 0
    i = start
    block_start = None
    while i < len(content):
        if content[i] == '{':
            if depth == 0:
                block_start = i
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0 and block_start is not None:
                block_end = i + 1
                block = content[block_start:block_end]
                
                # Analyze the block structure
                with open(r'D:\web app\4-craft.com\apps\api\block_analysis.txt', 'w', encoding='utf-8') as out:
                    out.write('Mini_quiz block from char %d to %d (len=%d)\n\n' % (block_start, block_end, len(block)))
                    
                    # Show the lines in the block (use split for newlines)
                    lines = block.split('\n')
                    out.write('Lines in mini_quiz block:\n')
                    for i, line in enumerate(lines):
                        spaces = len(line) - len(line.lstrip()) if line else 0
                        out.write('%d (indent=%d): %s\n' % (i+1, spaces, repr(line[:100])))
                    
                    out.write('\nLast 500 chars:\n')
                    out.write(repr(block[-500:]))
                break
        i += 1

print('Analysis written to block_analysis.txt')