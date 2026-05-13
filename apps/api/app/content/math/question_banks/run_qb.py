#!/usr/bin/env python3
import subprocess, sys
result = subprocess.run(
    [sys.executable, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py'],
    capture_output=True, text=True, encoding='utf-8'
)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)
print('Return code:', result.returncode)