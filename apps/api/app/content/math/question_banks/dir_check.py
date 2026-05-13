#!/usr/bin/env python3
import pathlib

base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
for d in sorted(base.glob('grade_*')):
    files = list(d.glob('*.jsonl'))
    print('{}: {} files'.format(d.name, len(files)))