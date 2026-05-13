import json, os
d = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_5\lessons'
results = []
for f in sorted(os.listdir(d)):
    if f.endswith('.json'):
        fpath = os.path.join(d, f)
        with open(fpath, encoding='utf-8') as fp:
            data = json.load(fp)
        variants = data.get('lesson_variants', [])
        size_kb = os.path.getsize(fpath) // 1024
        results.append(f'{f}: {len(variants)} variants, {size_kb}KB')

for r in results:
    print(r)
