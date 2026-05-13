import json, os
base = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons"
for f in sorted(os.listdir(base)):
    if f.endswith('.json') and 'generate' not in f:
        with open(os.path.join(base, f), 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        variants = data.get('lesson_variants', [])
        print(f + ': ' + str(len(variants)) + ' variants')
        if variants:
            v = variants[0]
            print('  - First variant: ' + v['variant_id'] + ', ' + v['variant_title_th'])
            print('  - Theme: ' + v['story_theme_th'])
            print('  - Blocks: ' + str([b['type'] for b in v['visual_blocks']]))
            print('  - Last variant: ' + variants[-1]['variant_id'])
