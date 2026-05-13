import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'

schema_a_issues = []  # single-question, missing correct_answer
schema_b_issues = []  # multi-question (data.questions), missing correct_answer in sub-questions
unclear_issues = []   # can't determine

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
            except Exception:
                continue
        
        lesson_id = obj.get('lesson_id', fn)
        
        for variant in obj.get('lesson_variants', []):
            for block in variant.get('visual_blocks', []):
                if block.get('type') != 'mini_quiz':
                    continue
                
                mq = block
                data = mq.get('data', {})
                
                # Schema A: single question (question field at top or data level)
                if 'questions' in data:
                    # Schema B: multi-question
                    for i, q in enumerate(data.get('questions', [])):
                        has_ca = 'correct_answer' in q and str(q.get('correct_answer', '')).strip() != ''
                        has_ans = 'answer' in q and str(q.get('answer', '')).strip() != ''
                        if not has_ca and has_ans:
                            schema_b_issues.append({
                                'lesson': lesson_id,
                                'variant': variant.get('variant_id'),
                                'sub_idx': i,
                                'answer': q.get('answer'),
                                'text': q.get('text_th', '')[:50]
                            })
                else:
                    # Schema A: single question
                    has_ca = 'correct_answer' in mq and str(mq.get('correct_answer', '')).strip() != ''
                    has_ans = 'answer' in mq and str(mq.get('answer', '')).strip() != ''
                    if not has_ca and has_ans:
                        schema_a_issues.append({
                            'lesson': lesson_id,
                            'variant': variant.get('variant_id'),
                            'answer': mq.get('answer'),
                            'question': mq.get('question', '')[:50]
                        })

print(f'Schema A (single-question): {len(schema_a_issues)} issues')
print(f'Schema B (multi-question sub-questions): {len(schema_b_issues)} issues')
print()
print('Schema A files:')
a_files = set(x['lesson'] for x in schema_a_issues)
for f in sorted(a_files):
    count = len([x for x in schema_a_issues if x['lesson'] == f])
    print(f'  {f}: {count} variants')

print()
print('Schema B files:')
b_files = set(x['lesson'] for x in schema_b_issues)
for f in sorted(b_files):
    count = len([x for x in schema_b_issues if x['lesson'] == f])
    print(f'  {f}: {count} sub-questions')