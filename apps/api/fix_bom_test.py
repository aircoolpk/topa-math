import os

content_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'
problem_files = [
    'curriculum/grade_4/curriculum_map.json',
    'curriculum/grade_5/curriculum_map.json',
    'curriculum/grade_6/curriculum_map.json',
    'g6/quizzes/g6_pre_algebra.json',
    'grade_2/lessons/g2_shapes_2d.json',
    'grade_3/quizzes/g3_multi_step_word_problems.json',
]
for fp in problem_files:
    full = os.path.join(content_dir, fp)
    with open(full, 'rb') as f:
        raw = f.read()
    
    content = raw.decode('utf-8', errors='replace')
    idx = content.find('\ufffd')
    if idx >= 0:
        start = max(0, idx-30)
        end = min(len(raw), idx+30)
        print(f'File: {fp}')
        print(f'  U+FFFD at byte offset {idx}')
        print(f'  Surrounding bytes (hex): {raw[start:end].hex()}')
        # Show what those bytes decode to as latin-1 / cp1252
        decoded_wrong = raw[start:end].decode('latin-1', errors='replace')
        print(f'  If decoded as latin-1: {decoded_wrong}')
        print()
