import json, os

base_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

both_count = 0
answer_only = 0
correct_only = 0
neither = 0

for root, dirs, files in os.walk(base_dir):
    for fname in files:
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
        except:
            continue
        
        # Skip list-type root (not lesson files)
        if isinstance(data, list):
            continue
        
        questions = data.get('questions', [])
        if not isinstance(questions, list):
            continue
        
        for q in questions:
            if not isinstance(q, dict):
                continue
            has_answer = 'answer' in q
            has_correct = 'correct_answer' in q
            
            if has_answer and has_correct:
                both_count += 1
            elif has_answer:
                answer_only += 1
            elif has_correct:
                correct_only += 1
            else:
                neither += 1

with open(r'D:\web app\4-craft.com\apps\api\count_result.txt', 'w') as f:
    f.write('Questions with BOTH answer AND correct_answer: %d\n' % both_count)
    f.write('Questions with ONLY answer: %d\n' % answer_only)
    f.write('Questions with ONLY correct_answer: %d\n' % correct_only)
    f.write('Questions with NEITHER: %d\n' % neither)

print('Done')
print('Both:', both_count)
print('Answer only:', answer_only)
print('Correct only:', correct_only)
print('Neither:', neither)