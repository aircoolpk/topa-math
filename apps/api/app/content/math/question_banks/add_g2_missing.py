#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pathlib, re

script_path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = script_path.read_text(encoding='utf-8')

# 1. Append the two missing functions BEFORE the main block
funcs_to_add = '''

def gen_g2_time_calendar(tc, skill):
    qs = []
    for i in range(1, 13):
        h1 = ri(1,11); h2 = h1 + ri(1,5)
        ctx = f"เด็กเริ่มเข้าเรียนเวลา {h1} โมง จบเวลา {h2} โมง รวมเวลาเรียนกี่ชั่วโมง"
        qs.append(mkq(tc, skill, ctx, f"{h2-h1} ชั่วโมง", f"{h2}-{h1}={h2-h1}", "ดูเวลาเริ่มและจบ", "number_line", "ไม่เข้าใจการนับชั่วโมง", "core", "routine", "easy", "build_confidence", i))
    for i in range(13, 25):
        day = random.choice(["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"])
        day_map = {"จันทร์":0,"อังคาร":1,"พุธ":2,"พฤหัสบดี":3,"ศุกร์":4,"เสาร์":5,"อาทิตย์":6}
        fridown = 4
        idx = day_map.get(day, 0)
        diff = (fridown - idx) % 7
        qs.append(mkq(tc, skill, f"วัน{day} อีกกี่วันจะเป็นวันศุกร์", f"{diff} วัน", f"วันศุกร์อยู่{7-idx} วันหลังจากวัน{day}" if idx <= 4 else "0 วัน", "ใช้ปฏิทิน", "none", "นับวันในสัปดาห์ผิด", "core", "routine", "medium", "build_confidence", i))
    for i in range(25, 33):
        h1 = ri(7,10); m1 = random.choice([0,30]); h2 = h1 + ri(1,4)
        diff_min = (h2-h1)*60 - m1
        ctx = f"เด็กเริ่มทำการบ้านเวลา {h1} โมง {m1} นาที ทำเสร็จเวลา {h2} โมง รวมใช้เวลากี่นาที"
        qs.append(mkq(tc, skill, ctx, f"{diff_min} นาที", f"({h2}-{h1})x60-{m1}={diff_min}", "คำนวณนาทีรวม", "number_line", "ไม่เข้าใจการแปลงชั่วโมงเป็นนาที", "core", "routine", "hard", "build_confidence", i))
    ch = [
        ("พฤหัสบดี","วันจันทร์ อีก 3 วันจะเป็นวันอะไร", "number_line", "จันทร์+3=พฤหัสบดี", "ใช้ปฏิทินนับวัน", "นับวันเกินสัปดาห์"),
        (90,"เด็กดูนาฬิกาแบบ 24 ชั่วโมง บอกว่า 19:00 คือกี่โมง", "number_line", "19:00 คือ 7 โมงเย็น", "ใช้นาฬิกา 24 ชั่วโมง", "ไม่รู้ว่า 19:00 คือ 7 โมงเย็น"),
        (75,"เด็กเริ่มเข้าเรียน 8:45 เลิก 10:00 รวมเวลาเรียนกี่นาที", "number_line", "10:00-8:45=1:15=75 นาที", "ใช้เส้นเวลา", "ไม่รู้วิธีลบนาที"),
        ("ศุกร์","วันพุธ อีก 4 วันจะเป็นวันอะไร", "number_line", "พุธ+4=อาทิตย์ ผิด! ลองใหม่: พุธ+4=พฤหัสบดี", "ใช้ปฏิทินนับวัน", "นับวันเกินสัปดาห์"),
        (45,"เด็กดูนาฬิกาบอก 14:30 แต่นาฬิกาเล็กเดินเร็วกว่าจริง 15 นาที เวลาจริงกี่โมง", "number_line", "14:30-15 นาที=14:15", "ใช้เส้นเวลาปรับนาที", "ไม่เข้าใจว่านาฬิกาเล็กเดินเร็วแปลว่าอะไร"),
        ("เสาร์","วันศุกร์ อีก 1 วันจะเป็นวันอะไร", "number_line", "ศุกร์+1=เสาร์", "ใช้ปฏิทินนับวัน", "นับวันผิดทิศ"),
        (150,"เด็กเริ่มทำการบ้าน 9:00 ทำไป 2 ชั่วโมง 30 นาที จบเวลากี่โมง", "number_line", "9:00+2:30=11:30", "ใช้เส้นเวลาบวกชั่วโมงและนาที", "ไม่รู้วิธีบวกเวลา"),
        (4,"เด็กเดินทาง 3 ชั่วโมง 45 นาที ถ้าเริ่ม 13:15 จะถึงปลายทางกี่โมง", "number_line", "13:15+3:45=17:00", "ใช้เส้นเวลาบวกชั่วโมงและนาที", "ไม่รู้วิธีบวกเวลา"),
    ]
    diffs = ["easy","medium","hard","easy","medium","hard","easy","medium"]
    for i, (a, q, ss, h, cwr) in enumerate(ch, 33):
        qs.append(mkq(tc, skill, q, str(a), ss, h, ss, "number_line", cwr, "challenge", "non_routine", diffs[i], "stretch_thinking", i))
    return qs

def gen_g2_shapes_2d(tc, skill):
    qs = []
    shapes_data = [
        ("วงกลม",0,0),("วงรี",0,0),("สามเหลี่ยม",3,3),
        ("สี่เหลี่ยม",4,4),("ห้าเหลี่ยม",5,5),("หกเหลี่ยม",6,6),
    ]
    for i in range(1, 13):
        name,corners,sides = random.choice(shapes_data)
        qs.append(mkq(tc, skill, f"{name} มีกี่มุม", str(corners), f"{name} มี {corners} มุม", "นับมุมของรูป", "none", "นับมุมผิด", "core", "routine", "easy", "build_confidence", i))
    for i in range(13, 25):
        name,corners,sides = random.choice(shapes_data)
        qs.append(mkq(tc, skill, f"{name} มีกี่ด้าน", str(sides), f"{name} มี {sides} ด้าน", "นับด้านของรูป", "none", "นับด้านผิด", "core", "routine", "medium", "build_confidence", i))
    for i in range(25, 33):
        s1,_,_ = random.choice(shapes_data[:-1])
        s2,_,_ = random.choice(shapes_data[:-1])
        idx1 = [x[0] for x in shapes_data].index(s1)
        idx2 = [x[0] for x in shapes_data].index(s2)
        diff = abs(shapes_data[idx1][1] - shapes_data[idx2][1])
        qs.append(mkq(tc, skill, f"{s1} กับ {s2} ต่างกันกี่มุม", str(diff), f"{s1} มีมุมต่างจาก {s2} อยู่ {diff} มุม", "นับมุมของทั้งสองรูป", "none", "ไม่เปรียบเทียบจำนวนมุมได้", "core", "routine", "hard", "build_confidence", i))
    ch = [
        ("รูปหกเหลี่ยม","รูปทรงที่มี 6 มุม เรียกว่าอะไร", "none", "รูปทรงที่มี 6 มุมคือรูปหกเหลี่ยม", "ใช้ความรู้เรื่องจำนวนมุม", "ไม่รู้ว่าจำนวนมุมบอกชื่อรูป"),
        (4,"รูปสามเหลี่ยมหน้าจั่วมีด้านเท่ากันกี่ด้าน และมุมเท่ากันกี่มุม", "none", "รูปสามเหลี่ยมหน้าจั่วมี 2 ด้านเท่า 3 มุมเท่า", "ใช้ความรู้เรื่องรูปสามเหลี่ยมหน้าจั่ว", "ไม่รู้ว่าหน้าจั่วหมายความว่าอะไร"),
        ("ไม่ใช่","รูปสี่เหลี่ยมจัตุรัสกับรูปสี่เหลี่ยมผืนผ้าเป็นรูปเดียวกันหรือไม่ เพราะอะไร", "none", "สี่เหลี่ยมจัตุรัสมีด้านทุกด้านเท่ากัน สี่เหลี่ยมผืนผ้าด้านตรงข้ามเท่าแต่ไม่ทุกด้าน ดังนั้นไม่ใช่รูปเดียวกัน", "ใช้ความรู้เรื่องลักษณะรูปสี่เหลี่ยม", "ไม่แยกแยะความแตกต่างระหว่างสี่เหลี่ยมจัตุรัสกับสี่เหลี่ยมผืนผ้า"),
        (3,"ถ้าวาดรูปสามเหลี่ยม 2 รูปต่อกันที่ฐาน จะได้รูปอะไร", "none", "ขึ้นอยู่กับว่าวางต่อกันอย่างไร อาจได้รูปสี่เหลี่ยมหรือรูปอื่น", "ใช้ภาพจำลองทางจิต", "ไม่เข้าใจว่าการต่อรูปให้รูปใหม่ขึ้นอยู่กับวิธีการ"),
        (8,"รูปแปดเหลี่ยมมีกี่ด้าน และกี่มุม", "none", "รูปแปดเหลี่ยมมี 8 ด้าน 8 มุม", "ใช้ความรู้เรื่องรูปหลายเหลี่ยม", "ไม่รู้จักรูปแปดเหลี่ยม"),
        ("ได้หลายรูป","ถ้าตัดวงกลมออกเป็น 4 ส่วนเท่าๆ กัน แต่ละส่วนเรียกว่าอะไร และนำมาต่อกันจะได้รูปอะไร", "none", "แต่ละส่วนเรียกว่าควอแรนต์ ต่อกันได้วงกลมเต็มหรือรูปอื่น", "ใช้ภาพจำลอง", "ไม่รู้จักควอแรนต์และการต่อรูป"),
        (5,"รูปห้าเหลี่ยมมีด้านเท่ากันทุกด้านใช่ไหม ถ้าไม่ใช่ด้านไหนต่างกัน", "ไม่ใช่ รูปห้าเหลี่ยมทั่วไปด้านไม่จำเป็นเท่ากันทุกด้าน", "ใช้ความรู้เรื่องรูปห้าเหลี่ยม", "ไม่เข้าใจว่าความเท่าของด้านขึ้นอยู่กับชนิดของรูปห้าเหลี่ยม"),
        (6,"ถ้านำรูปหกเหลี่ยม 2 รูปมาวางต่อกันที่ด้านหนึ่ง รูปใหม่มีกี่ด้าน", "none", "ขึ้นอยู่กับว่าวางต่อกันอย่างไร อาจได้ 8-10 ด้าน", "ใช้ภาพจำลอง", "ไม่เข้าใจการนับด้านหลังต่อรูป"),
    ]
    diffs = ["easy","medium","hard","easy","medium","hard","easy","medium"]
    for i, (a, q, ss, h, cwr) in enumerate(ch, 33):
        qs.append(mkq(tc, skill, q, str(a), ss, h, ss, "none", cwr, "challenge", "non_routine", diffs[i], "stretch_thinking", i))
    return qs

'''

# Find where to insert (before "if __name__")
parts = src.split('if __name__ == ')
if len(parts) != 2:
    print(f"ERROR: expected 2 parts, got {len(parts)}")
    exit(1)

new_src = parts[0] + funcs_to_add + '\nif __name__ == ' + parts[1]

# Fix GEN_MAP: add the two missing entries
old_g2_map = "    'g2_money_change': gen_g2_money_change,\n}"
new_g2_map = "    'g2_money_change': gen_g2_money_change,\n    'g2_time_calendar': gen_g2_time_calendar,\n    'g2_shapes_2d': gen_g2_shapes_2d,\n}"
new_src = new_src.replace(old_g2_map, new_g2_map)

# Fix TOPICS: add the two missing entries
old_g2_topics = "        ('g2_money_change','เงินและการทอนเงิน','g2_money_change'),\n    ],\n}"
new_g2_topics = "        ('g2_money_change','เงินและการทอนเงิน','g2_money_change'),\n        ('g2_time_calendar','เวลาและปฏิทิน','g2_time_calendar'),\n        ('g2_shapes_2d','รูปทรงสองมิติ','g2_shapes_2d'),\n    ],\n}"
new_src = new_src.replace(old_g2_topics, new_g2_topics)

script_path.write_text(new_src, encoding='utf-8')
print('Done. New length:', len(new_src))
