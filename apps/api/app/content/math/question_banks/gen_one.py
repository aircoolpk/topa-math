import os, sys, pathlib, json, random
sys.path.insert(0, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
os.chdir(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
import _gen_all
# Run just ONE lesson
try:
    n = _gen_all.gen_file(4, 'g4_large_numbers')
    print('OK:', n)
except Exception as e:
    print('ERROR:', e)
    import traceback
    traceback.print_exc()