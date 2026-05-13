import json, os

base_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

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
        
        if isinstance(data, list):
            print('List at:', os.path.relpath(fpath, base_dir))
            continue
        
        questions = data.get('questions', [])
        if isinstance(questions, list):
            for i, q in enumerate(questions):
                if not isinstance(q, dict):
                    print('Non-dict at %s[%d]: type=%s' % (fname, i, type(q)))
                    break