import json, os

base_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

summary = []
for grade in ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6']:
    lessons_dir = os.path.join(base_dir, grade, 'lessons')
    if not os.path.exists(lessons_dir):
        continue
    
    files = sorted([f for f in os.listdir(lessons_dir) if f.endswith('.json')])
    grade_stats = {'files': 0, 'questions': 0, 'has_correct': 0, 'has_answer': 0, 'has_choices': 0, 'thai_exp': 0}
    
    for fname in files:
        fpath = os.path.join(lessons_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            grade_stats['files'] += 1
        except:
            continue
        
        for q in data.get('questions', []):
            grade_stats['questions'] += 1
            if 'correct_answer' in q:
                grade_stats['has_correct'] += 1
            if 'answer' in q:
                grade_stats['has_answer'] += 1
            if isinstance(q.get('choices'), list) and len(q.get('choices', [])) > 0:
                grade_stats['has_choices'] += 1
            if q.get('explanation_th', '').startswith('คำตอบคือ'):
                grade_stats['thai_exp'] += 1
    
    summary.append('%s: %d files, %d questions, correct=%d, answer=%d, choices=%d, thai_exp=%d' % (
        grade, grade_stats['files'], grade_stats['questions'],
        grade_stats['has_correct'], grade_stats['has_answer'],
        grade_stats['has_choices'], grade_stats['thai_exp']))

with open(r'D:\web app\4-craft.com\apps\api\grade_summary.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(summary))

print('Done')
for s in summary:
    print(s)