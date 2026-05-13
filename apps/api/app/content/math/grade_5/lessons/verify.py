import json, os
d = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_5\lessons'
for f in sorted(os.listdir(d)):
    if f.endswith('.json'):
        fpath = os.path.join(d, f)
        with open(fpath, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        variants = data.get('lesson_variants', [])
        print(f)
        print(f'  Variants: {len(variants)}')
        print(f'  Fields: {[k for k in data.keys()]}')
        if variants:
            v = variants[0]
            print(f'  v01: title={v["variant_title_th"]}, theme={v["story_theme_th"]}')
            print(f'  v01 blocks ({len(v["visual_blocks"])}): {[b["block_type"] for b in v["visual_blocks"]]}')
        v10 = variants[9] if len(variants) > 9 else None
        if v10:
            print(f'  v10: title={v10["variant_title_th"]}, theme={v10["story_theme_th"]}')
        print()
