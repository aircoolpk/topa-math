#!/usr/bin/env python3
"""Quick test: run just 1 grade/lesson"""
import sys
sys.path.insert(0, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
import _gen_all
try:
    n = _gen_all.gen_file(4, 'g4_large_numbers')
    print('Success:', n)
except Exception as e:
    print('Error:', e)
    import traceback
    traceback.print_exc()