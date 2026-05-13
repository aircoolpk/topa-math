import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'
total_mq = 0
schema_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
missing_ca = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
missing_ch = {'A': 0, 'B': 0, 'C': 0, 'D': 0}

for grade in range(1, 7):
    grade_dir = os.path.join(BASE, f'grade_{grade}', 'lessons')
    if not os.path.isdir(grade_dir):
        continue
    for fn in os.listdir(grade_dir):
        if not fn.endswith('.json'):
            continue
        fp = os.path.join(grade_dir, fn)
        with open(fp, 'rb') as f:
            obj = json.load(f)
        for variant in obj.get('lesson_variants', []):
            for block in variant.get('visual_blocks', []):
                if block.get('type') != 'mini_quiz':
                    continue
                total_mq += 1
                data = block.get('data', {})
                
                if 'questions' in data:
                    schema = 'B'
                    questions = data.get('questions', [])
                elif 'content' in block and isinstance(block.get('content'), dict):
                    if 'questions' in block.get('content', {}):
                        schema = 'C'
                        questions = block.get('content', {}).get('questions', [])
                    else:
                        schema = 'D'
                        questions = []
                elif block.get('question'):
                    schema = 'A'
                    questions = [block]
                else:
                    schema = 'D'
                    questions = []
                
                schema_counts[schema] = schema_counts.get(schema, 0) + 1
                
                # Check missing correct_answer
                if schema == 'A':
                    has_ca = 'correct_answer' in block and str(block.get('correct_answer', '')).strip() != ''
                    has_ch = isinstance(block.get('choices'), list) and len(block.get('choices', [])) > 0
                elif schema == 'B':
                    all_have_ca = all('correct_answer' in q and str(q.get('correct_answer', '')).strip() != '' for q in questions)
                    all_have_ch = all(isinstance(q.get('choices'), list) and len(q.get('choices', [])) > 0 for q in questions)
                    has_ca = all_have_ca and len(questions) > 0
                    has_ch = all_have_ch and len(questions) > 0
                elif schema == 'C':
                    all_have_ca = all('answer_th' in q or 'answer' in q for q in questions)
                    all_have_ch = all(isinstance(q.get('options_th'), list) and len(q.get('options_th', [])) > 0 for q in questions)
                    has_ca = all_have_ca
                    has_ch = all_have_ch
                else:
                    has_ca = False
                    has_ch = False
                
                if not has_ca:
                    missing_ca[schema] = missing_ca.get(schema, 0) + 1
                if not has_ch:
                    missing_ch[schema] = missing_ch.get(schema, 0) + 1

print(f'Total mini_quiz blocks: {total_mq}')
print(f'Schema A: {schema_counts.get("A", 0)} blocks, {missing_ca.get("A", 0)} missing correct_answer, {missing_ch.get("A", 0)} missing choices')
print(f'Schema B: {schema_counts.get("B", 0)} blocks, {missing_ca.get("B", 0)} missing correct_answer, {missing_ch.get("B", 0)} missing choices')
print(f'Schema C: {schema_counts.get("C", 0)} blocks, {missing_ca.get("C", 0)} missing correct_answer, {missing_ch.get("C", 0)} missing choices')
print(f'Schema D: {schema_counts.get("D", 0)} blocks, {missing_ca.get("D", 0)} missing correct_answer, {missing_ch.get("D", 0)} missing choices')