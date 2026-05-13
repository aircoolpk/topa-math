#!/usr/bin/env python3
import pathlib, json

base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
for g in [1,2,3,4,5,6]:
    d = base / 'grade_{}'.format(g)
    if d.exists():
        files = sorted(d.glob('*.jsonl'))
        total = 0
        parse_errors = 0
        for f in files:
            try:
                with open(f, 'r', encoding='utf-8', errors='replace') as fp:
                    lines = [l for l in fp if l.strip()]
                total += len(lines)
                if lines:
                    try:
                        q = json.loads(lines[0])
                    except:
                        parse_errors += 1
            except Exception as e:
                pass
        print('Grade {}: {} files, {} lines, {} parse_errors'.format(g, len(files), total, parse_errors))
    else:
        print('Grade {}: no directory'.format(g))