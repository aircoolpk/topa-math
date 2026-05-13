import json, os

base = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
for fname in os.listdir(base):
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(base, fname)
    try:
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            json.load(f)
        print('OK:', fname)
    except Exception as e:
        print('FAIL:', fname, '-', str(e)[:120])
