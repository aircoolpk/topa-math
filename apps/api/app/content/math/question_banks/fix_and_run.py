#!/usr/bin/env python3
"""Generate question bank files quickly"""
import sys, os, pathlib, json, random

sys.path.insert(0, r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

# Use _gen_all which works
import _gen_all as ga

# Generate for Grade 4, 5, 6
LESSONS = {
    4: ["g4_large_numbers","g4_decimals_intro","g4_fractions","g4_multi_digit_operations","g4_word_problems"],
    5: ["g5_data_graphs","g5_decimals","g5_fraction_operations","g5_multi_step_word_problems","g5_volume_area"],
    6: ["g6_equations_intro","g6_middle_school_prep","g6_ratio_proportion","g6_volume"]
}

for grade, lids in LESSONS.items():
    for lid in lids:
        try:
            ga.gen_file(grade, lid)
        except Exception as e:
            print('ERROR {}: {}'.format(lid, e))

# Now generate for Grade 1-3 using generate_qb.py
# But first fix the g1_counting_20 function
# The issue is it uses enumerate with 6 values but passes 7 to mkq

# For now, let's just generate using the mkq approach directly
import importlib.util
spec = importlib.util.spec_from_file_location('generate_qb', r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
# Don't load - just check structure

print('Grade 4-6: DONE')

# Now let's fix and run Grade 1-2
# The issue in gen_g1_counting_20 is the loop uses enumerate([...], 1) where each tuple has 6 items
# but mkq expects 13 positional args

# Let's write a fixed version of g1_counting_20
import re

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')

# Find and replace the problematic loop
old_loop = '''    for i, (a, q, e, h, s, m) in enumerate([
        (7,'เลข 7 เขียนเป็นตัวเลขอารบิกว่าอะไร','7','นับเลขจาก 1','นับนิ้วมือ 7 นิ้ว ตัวเลขคือ 7','none','มักสับสนระหว่างเลขที่อยู่ข้างหน้ากับข้างหลัง'),
        (13,'เลข 13 เขียนเป็นคำว่าอะไร','13','ท่องจำเลข 10 และ 3','10+3=13','place_value_chart','ลืมว่า 13 = 10+3'),
        (5,'เลข 5 อยู่ตรงไหนในแถว 1,2,3,4,5,6,7,8,9,10','ลำดับที่ 5','นับเลขทีละตัว','นับ 1-10 เลข 5 �อยู่ลำดับที่ 5','number_line','นับผิดโดยเริ่มนับจาก 0'),
        (19,'เลข 19 อยู่ก่อนเลขอะไร','20','นับเลขข้างหลัง','19 ตามด้วย 20','none','นึกว่า 19 ตามด้วย 18'),
        (3,'เลข 3 อยู่ระหว่างเลข 2 กับเลขอะไร','4','นับเลขต่อจาก 2','2 ต่อไปคือ 3 แล้วก็ 4','number_line','นับไปหนึ่งข้ามไป'),
        (9,'เลข 9 เขียนเป็นคำว่าอะไร','9','ท่องเรียงลำดับ','9 เป็นเก้า','none','สับสนกับเลข 6'),
        (15,'เลข 15 อยู่หลังเลขอะไร','14','นับถอยหลัง','14 ตามด้วย 15','none','นับเลขผิดทิศ'),
        (11,'เลข 11 อยู่ระหว่างเลข 10 กับเลขอะไร','12','นับเลขต่อจาก 10','10 แล้ว 11 แล้ว 12','number_line','นับข้ามไปสอง'),
        (17,'เลข 17 เขียนเป็นคำว่าอะไร','17','10+7=17','สิบเจ็ด','place_value_chart','ลืมว่า 17=10+7'),
        (1,'เลข 1 อยู่ลำดับแรกในแถว 1 ถึง 20 จริงหรือไม่','ถูกต้อง','นับเลขจาก 1','1 คือจุดเริ่มต้น','number_line','คิดว่าต้องเริ่มจาก 0'),
        (20,'เลข 20 เป็นเลขที่มากที่สุดในกลุ่ม 15,18,20,12 ใช่หรือไม่','ถูกต้อง','เปรียบเทียบเลข','20 มากกว่า 15,18,12','number_line','ดูแค่ตัวเลขไม่ได้เปรียบเทียบ'),
        (8,'เลข 8 อยู่ก่อนเลข 9 ใช่ไหม','ถูกต้อง','นับเลขต่อ','8 มาก่อน 9 เสมอ','number_line','สับสนลำดับ'),
    ], 1):
        qs.append(mkq(tc, skill, q, a, e, h, s, m, 'นับเลขผิดหรือจำลำดับผิด', 'core', 'routine', 'easy', 'build_confidence', i))'''

# The old loop passes only 8 args to mkq but mkq expects 13
# Let me look at what it SHOULD be
# mkq signature: mkq(tc, skill, qt, ans, ex, ht, ss, model, cwr, qtype, rl, diff, conf, seq)
# Old call: mkq(tc, skill, q, a, e, h, s, m, 'นับเลขผิดหรือจำลำดับผิด', 'core', 'routine', 'easy', 'build_confidence', i)
# That's: tc, skill, qt, ans, ex, ht, ss, m, cwr, qtype, rl, diff, conf, seq = 14 args (but only 13 params!)

# Actually looking more carefully: m (model) is position 8, then cwr is 9
# But the old code passes: q, a, e, h, s, m as position 3-8 (6 values)
# Then cwr='นับเลขผิด...' as 9th
# Then qtype='core' as 10th
# etc.

# The mkq function signature is:
# def mkq(tc, skill, qt, ans, ex, ht, ss, model, cwr, qtype, rl, diff, conf, seq):
# Positional: 1=tc, 2=skill, 3=qt, 4=ans, 5=ex, 6=ht, 7=ss, 8=model, 9=cwr, 10=qtype, 11=rl, 12=diff, 13=conf, 14=seq
# But wait - in the OLD code before my changes, mkq only took 8 positional args!
# Let me check what the original mkq looked like

# Actually looking at current mkq (line 88):
# def mkq(tc, skill, qt, ans, ex, ht, ss, model, cwr, qtype, rl, diff, conf, seq):
# That's 14 params.

# But old code passed: mkq(tc, skill, q, a, e, h, s, m, 'นับเลขผิด...', 'core', 'routine', 'easy', 'build_confidence', i)
# That's: tc, skill, q, a, e, h, s, m, cwr, qtype, rl, diff, conf, i = 14 args

# Wait - the 13th positional arg in old call is 'build_confidence' and 14th is 'i'
# But in mkq signature, position 13 is 'conf' and position 14 is 'seq'
# So it seems like the old code WAS passing 14 args correctly...

# But then mkq also takes 'ss' (solution_strategy) at position 7 and 'model' at position 8
# In old call: position 7 is 's' (should be solution_strategy) and position 8 is 'm' (model)
# That matches!

# Wait let me recount the old call:
# mkq(tc, skill, q, a, e, h, s, m, 'นับเลขผิด...', 'core', 'routine', 'easy', 'build_confidence', i)
#  1    2     3  4  5  6  7  8  9  10    11     12     13       14

# mkq signature:
# def mkq(tc, skill, qt, ans, ex, ht, ss, model, cwr, qtype, rl, diff, conf, seq):
#  1    2     3  4   5  6  7   8     9    10    11   12   13   14

# That matches! So what's the actual error?

# The error was "ValueError: too many values to unpack (expected 6)"
# This happens on the FOR LINE: for i, (a, q, e, h, s, m) in enumerate([...], 1)
# Each tuple in the list has 6 elements: (7,'เลข 7 เขียน...','7','นับเลขจาก 1','นับนิ้วมือ 7 นิ้ว ตัวเลขคือ 7','none','มักสับสน...')
# Wait that's 7 elements! Not 6.

# Count: (7, 'เลข 7 เขียนเป็นตัวเลขอารบิกว่าอะไร', '7', 'นับเลขจาก 1', 'นับนิ้วมือ 7 นิ้ว ตัวเลขคือ 7', 'none', 'มักสับสนระหว่างเลขที่อยู่ข้างหน้ากับข้างหลัง')
# That's 7 elements!

# But the unpacking is: (a, q, e, h, s, m) = 6 variables
# That's the bug - 7 values, 6 variables

# The fix: the 7th element in each tuple is the common_wrong_reason, but it should be passed to mkq as cwr
# So the enumerate should be: for i, (a, q, e, h, s, m, cwr) in enumerate([...], 1):
# And the mkq call should pass cwr instead of hardcoding it

# Let me fix this
print('Found the bug: enumerate unpacks 7 elements but loop only expects 6')
print('Fixing...')

# Actually the simplest fix is to change the enumerate to unpack 7 items
# and pass cwr to mkq instead of hardcoding 'นับเลขผิดหรือจำลำดับผิด'

# But since I can't easily see all the loops, let me just write a targeted fix script