import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

files = [
    r'D:\web app\4-craft.com\apps\api\app\content\math\grade_3\lessons\g3_area_intro.json',
    r'D:\web app\4-craft.com\apps\api\app\content\math\grade_3\lessons\g3_division_intro.json',
    r'D:\web app\4-craft.com\apps\api\app\content\math\grade_3\lessons\g3_fractions_intro.json',
]
for fp in files:
    with open(fp, 'rb') as f:
        obj = json.load(f)
    variants = obj.get('lesson_variants', [])
    print(f'{obj["lesson_id"]}: {len(variants)} variants')
    for v in variants:
        blocks = v.get('visual_blocks', [])
        for b in blocks:
            if b.get('type') == 'mini_quiz':
                has_ca = 'correct_answer' in b
                print(f'  {v["variant_id"]}: mini_quiz correct_answer={has_ca} answer={b.get("answer")}')