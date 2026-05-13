import os, sys
print('CWD:', os.getcwd())
print('Python:', sys.executable)
# Test _gen_all import
sys.path.insert(0, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
os.chdir(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')
import _gen_all
print('gen_file exists:', hasattr(_gen_all, 'gen_file'))
print('LESSONS:', _gen_all.LESSONS)