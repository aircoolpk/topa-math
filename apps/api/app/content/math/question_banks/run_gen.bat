@echo off
cd /d "D:\web app\4-craft.com\apps\api\app\content\math\question_banks"
python _gen_all.py > gen_out.txt 2>&1
echo Return code: %ERRORLEVEL% >> gen_out.txt