import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'
files_to_check = {
    'g2_add_two_digit': 'grade_2/lessons/g2_add_two_digit.json',
    'g2_money_change': 'grade_2/lessons/g2_money_change.json',
    'g2_multiplication_intro': 'grade_2/lessons/g2_multiplication_intro.json',
    'g2_shapes_2d': 'grade_2/lessons/g2_shapes_2d.json',
    'g2_subtract_two_digit': 'grade_2/lessons/g2_subtract_two_digit.json',
    'g2_times_table_2_5_10': 'grade_2/lessons/g2_times_table_2_5_10.json',
    'g2_time_calendar': 'grade_2/lessons/g2_time_calendar.json',
    'g4_angles_geometry': 'grade_4/lessons/g4_angles_geometry.json',
    'g4_area_perimeter': 'grade_4/lessons/g4_area_perimeter.json',
    'g4_decimals_intro': 'grade_4/lessons/g4_decimals_intro.json',
    'g4_fractions': 'grade_4/lessons/g4_fractions.json',
    'g4_large_numbers': 'grade_4/lessons/g4_large_numbers.json',
    'g4_multi_digit_operations': 'grade_4/lessons/g4_multi_digit_operations.json',
    'g4_word_problems': 'grade_4/lessons/g4_word_problems.json',
}

for lesson_id, rel_path in files_to_check.items():
    fp = os.path.join(BASE, rel_path)
    if not os.path.exists(fp):
        print(f'{lesson_id}: FILE NOT FOUND')
        continue
    with open(fp, 'rb') as f:
        obj = json.load(f)
    
    v = obj['lesson_variants'][0]
    mq = next((b for b in v.get('visual_blocks', []) if b.get('type') == 'mini_quiz'), None)
    if not mq:
        print(f'{lesson_id}: no mini_quiz found')
        continue
    
    data = mq.get('data', {})
    if 'questions' in data:
        print(f'{lesson_id}: Schema B with {len(data.get("questions", []))} sub-questions')
        for i, q in enumerate(data.get('questions', [])):
            has_ca = 'correct_answer' in q and str(q.get('correct_answer', '')).strip() != ''
            has_ans = 'answer' in q and str(q.get('answer', '')).strip() != ''
            has_ch = isinstance(q.get('choices'), list) and len(q.get('choices', [])) > 0
            ans = q.get('answer', '')
            print(f'  q{i}: has_ca={has_ca} has_ans={has_ans} has_ch={has_ch} answer={ans}')
    else:
        has_ca = 'correct_answer' in mq and str(mq.get('correct_answer', '')).strip() != ''
        has_ans = 'answer' in mq and str(mq.get('answer', '')).strip() != ''
        has_ch = isinstance(mq.get('choices'), list) and len(mq.get('choices', [])) > 0
        print(f'{lesson_id}: Schema A has_ca={has_ca} has_ans={has_ans} has_ch={has_ch}')