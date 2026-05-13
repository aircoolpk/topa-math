import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'
BACKUP = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round1'
os.makedirs(BACKUP, exist_ok=True)

issues = {'missing_correct_answer': 0, 'missing_nonlist_choices': 0, 'has_answer_no_correct': 0, 'total': 0}
files_with_issues = []

for grade in range(1, 7):
    grade_dir = os.path.join(BASE, f'grade_{grade}', 'lessons')
    if not os.path.isdir(grade_dir):
        continue
    for fn in os.listdir(grade_dir):
        if not fn.endswith('.json'):
            continue
        fp = os.path.join(grade_dir, fn)
        with open(fp, 'rb') as f:
            try:
                obj = json.load(f)
            except:
                print(f'INVALID: {fp}')
                continue
        
        lesson_id = obj.get('lesson_id', fn)
        file_issues = []
        
        for variant in obj.get('lesson_variants', []):
            for block in variant.get('visual_blocks', []):
                if block.get('type') != 'mini_quiz':
                    continue
                
                issues['total'] += 1
                mq = block
                has_ca = 'correct_answer' in mq and str(mq.get('correct_answer', '')).strip() != ''
                has_ans = 'answer' in mq and str(mq.get('answer', '')).strip() != ''
                choices = mq.get('choices')
                choices_ok = isinstance(choices, list) and len(choices) > 0
                
                if not has_ca and has_ans:
                    issues['missing_correct_answer'] += 1
                    file_issues.append({
                        'lesson': lesson_id,
                        'variant': variant.get('variant_id'),
                        'type': 'missing_correct_answer',
                        'answer': mq.get('answer'),
                        'question': mq.get('question', '')[:60]
                    })
                elif has_ca and not has_ca and has_ans:
                    issues['has_answer_no_correct'] += 1
                
                if not choices_ok:
                    issues['missing_nonlist_choices'] += 1
                    file_issues.append({
                        'lesson': lesson_id,
                        'variant': variant.get('variant_id'),
                        'type': 'missing_nonlist_choices',
                        'choices': choices,
                        'answer': mq.get('correct_answer') or mq.get('answer')
                    })
        
        if file_issues:
            files_with_issues.append({'file': fn, 'fp': fp, 'issues': file_issues})
            print(f'\n{fp}')
            for iss in file_issues:
                print(f"  {iss['variant']}: {iss['type']} | answer={iss.get('answer')} | q={iss.get('question', '')[:40]}")

print(f'\n\n=== SUMMARY ===')
print(f"Total mini_quiz: {issues['total']}")
print(f"Missing correct_answer: {issues['missing_correct_answer']}")
print(f"Missing/non-list choices: {issues['missing_nonlist_choices']}")
print(f"Has answer but no correct_answer: {issues['has_answer_no_correct']}")
print(f'Files with issues: {len(files_with_issues)}')