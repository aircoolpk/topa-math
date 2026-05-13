import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api'
files = {
    'g3_area_intro': 'app\content\math\grade_3\lessons\g3_area_intro.json',
    'g3_division_intro': 'app\content\math\grade_3\lessons\g3_division_intro.json',
    'g3_fractions_intro': 'app\content\math\grade_3\lessons\g3_fractions_intro.json',
}

for lesson_id, rel_path in files.items():
    fp = os.path.join(BASE, rel_path)
    with open(fp, 'rb') as f:
        obj = json.load(f)
    
    print(f'\n=== {lesson_id} ===')
    for variant in obj.get('lesson_variants', []):
        vid = variant.get('variant_id')
        blocks = variant.get('visual_blocks', [])
        block_types = [b.get('type') for b in blocks]
        
        mq = next((b for b in blocks if b.get('type') == 'mini_quiz'), None)
        if mq:
            ca = mq.get('correct_answer')
            ans = mq.get('answer')
            ch = mq.get('choices')
            et = mq.get('explanation_th')
            print(f'  {vid} blocks: {block_types}')
            print(f'  mini_quiz correct_answer={ca!r} answer={ans!r}')
            print(f'  choices: {ch}')
            print(f'  explanation_th: {et!r}')
        else:
            print(f'  {vid} blocks: {block_types} -- NO MINI_QUIZ')