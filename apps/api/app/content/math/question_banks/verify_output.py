#!/usr/bin/env python3
import json, pathlib

base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

for g in [1,2,3,4,5,6]:
    d = base / 'grade_{}'.format(g)
    if d.exists():
        files = sorted(d.glob('*.jsonl'))
        core_total = 0
        challenge_total = 0
        topic_count = len(files)
        for f in files:
            try:
                with open(f, encoding='utf-8') as fp:
                    lines = fp.readlines()
                core_total += sum(1 for l in lines if json.loads(l).get('question_type') == 'core')
                challenge_total += sum(1 for l in lines if json.loads(l).get('question_type') == 'challenge')
            except Exception as e:
                print('Error in {}: {}'.format(f.name, e))
        print('Grade {}: {} topics, {} core + {} challenge = {} total'.format(
            g, topic_count, core_total, challenge_total, core_total + challenge_total))
    else:
        print('Grade {}: no directory'.format(g))