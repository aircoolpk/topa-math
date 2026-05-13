import json, re
path = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)
print('Top-level keys:', list(data.keys()))
print()
# Navigate to mini_quiz blocks
for v in data.get('lesson_variants', []):
    vid = v.get('variant_id', '?')
    blocks = v.get('visual_blocks', [])
    for b in blocks:
        if b.get('type') == 'mini_quiz':
            print(f'Variant {vid}: mini_quiz block keys = {list(b.keys())}')
            content = b.get('content', {})
            print(f'  content keys = {list(content.keys())}')
            questions = content.get('questions', [])
            print(f'  questions count = {len(questions)}')
            for i, q in enumerate(questions):
                print(f'    Q{i+1} keys = {list(q.keys())}')
            break
    break