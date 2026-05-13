@echo off
cd /d "D:\web app\4-craft.com\apps\api\app\content\math\question_banks"
mkdir grade_1 2>nul
mkdir grade_2 2>nul
mkdir grade_3 2>nul
mkdir grade_4 2>nul
mkdir grade_5 2>nul
mkdir grade_6 2>nul
python _gen456.py > gen_out.txt 2>&1
echo RC: %ERRORLEVEL% >> gen_out.txt