#!/usr/bin/env python3
"""Run _gen_all.py to generate Grade 4-6 files"""
import subprocess, sys, os

base = r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks'
os.chdir(base)

result = subprocess.run(
    [sys.executable, '_gen_all.py'],
    capture_output=True, text=True, encoding='utf-8', timeout=60
)
print('STDOUT:', result.stdout[:2000])
print('STDERR:', result.stderr[:1000])
print('Return code:', result.returncode)

# Check what was generated
import pathlib
base_path = pathlib.Path(base)
for g in [4, 5, 6]:
    d = base_path / 'grade_{}'.format(g)
    if d.exists():
        files = sorted(d.glob('*.jsonl'))
        print('Grade {}: {} files'.format(g, len(files)))
        for f in files:
            with open(f, 'r', encoding='utf-8', errors='replace') as fp:
                lines = [l for l in fp if l.strip()]
            print('  {}: {} lines'.format(f.name, len(lines)))