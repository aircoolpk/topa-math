#!/usr/bin/env python3
import subprocess, sys

# Run the actual script
result = subprocess.run(
    [sys.executable, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py'],
    capture_output=True, text=True, encoding='utf-8', timeout=120,
    cwd=r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks'
)
print('STDOUT:', result.stdout[:2000])
print('STDERR:', result.stderr[:1000])
print('Return code:', result.returncode)

# Check what was generated
import pathlib
base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
for g in range(1,7):
    d = base / 'grade_{}'.format(g)
    files = list(d.glob('*.jsonl')) if d.exists() else []
    print('Grade {}: {} files'.format(g, len(files)))