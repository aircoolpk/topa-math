import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path

content_path = Path(r'D:\web app\4-craft.com\apps\api\app\content\math')

repl_files = [
    r'grade_3\quizzes\g3_multi_step_word_problems.json',
    r'grade_2\lessons\g2_shapes_2d.json',
    r'g6\quizzes\g6_pre_algebra.json',
    r'curriculum\grade_4\curriculum_map.json',
    r'curriculum\grade_5\curriculum_map.json',
    r'curriculum\grade_6\curriculum_map.json',
]

def find_repair(data_str, byte_offset, raw_bytes):
    """Try to find the correct Thai by looking at surrounding valid UTF-8 sequences"""
    # The U+FFFD is at a specific byte position - try to figure out what char it replaced
    # by looking at the valid Thai sequences before and after
    before = raw_bytes[max(0, byte_offset-6):byte_offset]
    after = raw_bytes[byte_offset+1:byte_offset+7]
    
    print(f"  6 bytes before FFFD: {before.hex()} = {before.decode('utf-8', errors='replace')}")
    print(f"  6 bytes after FFFD: {after.hex()} = {after.decode('utf-8', errors='replace')}")
    
    # If we can identify the Thai char from context
    # The byte sequence E0-B8-xy typically starts Thai consonants/vowels
    # Let's see if the FFFD is between Thai bytes
    if len(before) >= 3 and len(after) >= 1:
        possible_thai_start = before[-3:]
        if possible_thai_start[0] == 0xE0:
            print(f"  Possible Thai start sequence: {possible_thai_start.hex()}")

for rel_path in repl_files:
    f = content_path / rel_path
    with open(f, 'rb') as fp:
        raw = fp.read()
    
    content = raw.decode('utf-8', errors='replace')
    idx = content.index('\ufffd')
    
    print(f'\n=== {rel_path} ===')
    print(f'  U+FFFD at byte offset {idx}')
    print(f'  Char before (3 chars): {repr(content[idx-3:idx])}')
    print(f'  Char after (3 chars): {repr(content[idx+1:idx+4])}')
    
    find_repair(content, idx, raw)
