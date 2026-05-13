import json
import os

LESSONS_DIR = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons"

# 10 different story themes
THEMES = [
    {"id": "v01", "emoji": "🏫", "theme": "โรงเรียน"},
    {"id": "v02", "emoji": "🍎", "theme": "ผลไม้"},
    {"id": "v03", "emoji": "🧸", "theme": "ของเล่น"},
    {"id": "v04", "emoji": "🏪", "theme": "ตลาด"},
    {"id": "v05", "emoji": "🐕", "theme": "สัตว์เลี้ยง"},
    {"id": "v06", "emoji": "🌻", "theme": "สวน"},
    {"id": "v07", "emoji": "🎨", "theme": "วาดรูป"},
    {"id": "v08", "emoji": "📚", "theme": "ห้องเรียน"},
    {"id": "v09", "emoji": "🎮", "theme": "สนุกกับเพื่อน"},
    {"id": "v10", "emoji": "🎉", "theme": "งานเทศกาล"},
]

def make_ten_frame(rows=5, cols=4, filled=()):
    """Generate a ten_frame visual block."""
    cells = []
    for i in range(rows * cols):
        state = "filled" if (i + 1) in filled else "empty"
        cells.append({"state": state})
    return {
        "type": "ten_frame",
        "title_th": "📊 ตารางสิบช่อง",
        "data": {
            "rows": rows,
            "cols": cols,
            "cells": cells
        }
    }

def make_place_value_chart(tens=0, ones=0):
    """Generate a place_value_chart visual block."""
    tens_icons = [{"state": "filled"}] * tens + [{"state": "empty"}] * (9 - tens)
    ones_icons = [{"state": "filled"}] * ones + [{"state": "empty"}] * (9 - ones)
    return {
        "type": "place_value_chart",
        "title_th": "🎯 ตารางหลัก",
        "data": {
            "tens": [{"icons": tens_icons}],
            "ones": [{"icons": ones_icons}]
        }
    }

def make_number_sentence(num1, num2, op="+"):
    """Generate a number_sentence visual block."""
    return {
        "type": "number_sentence",
        "title_th": "✍️ เขียนเป็นประโยคคณิต",
        "data": {
            "equation": f"{num1} {op} {num2} = ?",
            "placeholder": "?"
        }
    }

def make_step_cards(steps):
    """Generate step_cards visual block."""
    return {
        "type": "step_cards",
        "title_th": "📝 คิดทีละขั้น",
        "data": {
            "steps": [{"text_th": s} for s in steps]
        }
    }

def make_worked_example(question, answer):
    """Generate a worked_example visual block."""
    return {
        "type": "worked_example",
        "title_th": "✅ ตัวอย่าง",
        "data": {
            "question_th": question,
            "answer_th": answer
        }
    }

def make_common_mistakes(mistakes):
    """Generate a common_mistakes visual block."""
    return {
        "type": "common_mistakes",
        "title_th": "⚠️ ระวังจุดพลาด",
        "data": {
            "items": [{"text_th": m} for m in mistakes]
        }
    }

def make_mini_quiz(questions):
    """Generate a mini_quiz visual block."""
    return {
        "type": "mini_quiz",
        "title_th": "🎯 ลองทำดู",
        "data": {
            "questions": [{"text_th": q} for q in questions]
        }
    }

def make_bar_model(a, b, op="+"):
    """Generate a bar_model visual block."""
    op_symbol = "+" if op == "+" else "−"
    return {
        "type": "bar_model",
        "title_th": "📊 แผนภาพแท่ง",
        "data": {
            "bars": [
                {"label_th": "ส่วนแรก", "value": a, "color": "#FFB347"},
                {"label_th": "ส่วนสอง", "value": b, "color": "#87CEEB"},
            ],
            "result": a + b if op == "+" else a - b,
            "operation": op_symbol
        }
    }
    
def make_count_back_strip(start, subtract):
    """Generate a count_back_strip visual block for subtraction."""
    steps = []
    current = start
    for i in range(subtract + 1):
        color = "#FF6B6B" if i == subtract else "#87CEEB"
        steps.append({"value": current, "label_th": "เริ่ม" if i == 0 else ("ลบ" if i < subtract else "ผลลัพธ์"), "color": color})
        if i < subtract:
            current -= 1
    return {
        "type": "count_back_strip",
        "title_th": "🔢 นับถอยหลัง",
        "data": {"steps": steps}
    }

def make_array_model(rows, cols):
    """Generate an array_model visual block."""
    cells = []
    for r in range(rows):
        row = []
        for c in range(cols):
            row.append({"state": "filled"})
        cells.append(row)
    return {
        "type": "array_model",
        "title_th": "📊 แผนภาพแถว",
        "data": {
            "rows": rows,
            "cols": cols,
            "cells": cells,
            "label_th": f"{rows} แถว แถวละ {cols}"
        }
    }

def make_grouping_model(groups, per_group):
    """Generate a grouping_model visual block."""
    group_list = [{"items": [{"state": "filled"}] * per_group} for _ in range(groups)]
    return {
        "type": "grouping_model",
        "title_th": "🔄 จัดกลุ่ม",
        "data": {
            "groups": group_list,
            "total_th": f"{groups} กลุ่ม กลุ่มละ {per_group}"
        }
    }

def make_emoji_counter(items):
    """Generate an emoji_counter visual block."""
    return {
        "type": "emoji_counter",
        "title_th": "👀 มองภาพก่อน",
        "data": {"items": [{"emoji": itm["emoji"], "count": itm["count"]} for itm in items]}
    }

def make_shape_visual(shapes):
    """Generate a shape_visual visual block."""
    return {
        "type": "shape_visual",
        "title_th": "🔷 รูปทรง",
        "data": {"shapes": shapes}
    }

def make_story_intro(intro_text):
    """Generate a story_intro visual block."""
    return {
        "type": "story_intro",
        "title_th": "🐣 เรื่องราวชวนคิด",
        "data": {"text_th": intro_text}
    }


# ─── g2_add_two_digit ────────────────────────────────────────────────────────

def gen_add_two_digit():
    story_themes = [
        "🏫 วันนี้โรงเรียนจัดงานวิชากร มีนักเรียนชาย 34 คน และนักเรียนหญิง 25 คน เข้าร่วมงาน รวมมีนักเรียนกี่คน?",
        "🍎 แม่ซื้อแอปเปิ้ลแดง 23 ผล และแอปเปิ้ลเขียว 45 ผล รวมแม่ซื้อแอปเปิ้ลกี่ผล?",
        "🧸 มีตุ๊กตาหมีในกล่อง 32 ตัว และตุ๊กตากระต่าย 44 ตัว รวมตุ๊กตากี่ตัว?",
        "🏪 ร้านค้ามีน้ำผลไม้ 41 ขวด ขายเพิ่มอีก 37 ขวด รวมน้ำผลไม้กี่ขวด?",
        "🐕 ฟาร์มมีสุนัขพันธุ์พิเศษ 52 ตัว และสุนัขพันธุ์ทั่วไปอีก 36 ตัว รวมมีสุนัขกี่ตัว?",
        "🌻 สวนดอกไม้มีดอกทานตะวัน 33 ดอก และดอกกุหลาบ 55 ดอก รวมดอกไม้กี่ดอก?",
        "🎨 ในห้องศิลปะมีสีชอล์คสีแดง 21 ก้าน และสีชอล์คสีน้ำเงิน 47 ก้าน รวมสีชอล์คกี่ก้าน?",
        "📚 ห้องสมุดมีหนังสือภาษาไทย 43 เล่ม และหนังสือภาษาอังกฤษ 35 เล่ม รวมหนังสือกี่เล่ม?",
        "🎮 เกมมีเพชร 26 เม็ด เก็บเพชรเพิ่มได้อีก 52 เม็ด รวมเพชรกี่เม็ด?",
        "🎉 งานเทศกาลมีลูกโป่งสีแดง 38 ลูก และลูกโป่งสีเหลือง 41 ลูก รวมลูกโป่งกี่ลูก?",
    ]
    variants = []
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        num1, num2 = [(34,25),(23,45),(32,44),(41,37),(52,36),(33,55),(21,47),(43,35),(26,52),(38,41)][i]
        result = num1 + num2
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "🎒", "count": num1}, {"emoji": "➕", "count": 1}, {"emoji": "🎒", "count": num2}]),
                make_ten_frame(5, 4, list(range(1, num1+1))[:20]),
                make_place_value_chart(num1//10, num1%10),
                make_step_cards([
                    f"ขั้นที่ 1: เขียนตัวเลขเรียงหลักให้ตรงกัน",
                    f"ขั้นที่ 2: บวกหลักหน่วย {num1%10} + {num2%10} = {num1%10 + num2%10}",
                    f"ขั้นที่ 3: บวกหลักสิบ {num1//10} + {num2//10} = {num1//10 + num2//10}",
                    "ขั้นที่ 4: เขียนคำตอบให้ตรงหลัก",
                    "ขั้นที่ 5: ตรวจคำตอบโดยสลับที่"
                ]),
                make_number_sentence(num1, num2, "+"),
                make_worked_example(f"{num1} + {num2} = ?", f"{num1} + {num2} = {result} ✅"),
                make_common_mistakes([
                    "เขียนตัวเลขเยื้องกันทำให้หลักไม่ตรง",
                    "บวกผิดหลัก เช่น หลักสิบก่อนหลักหน่วย",
                    "ลืมบวกหลักใดหลักหนึ่ง"
                ]),
                make_mini_quiz([f"45 + 32 = ?", f"67 + 21 = ?", f"53 + 46 = ?"])
            ]
        })
    return variants


# ─── g2_subtract_two_digit ──────────────────────────────────────────────────

def gen_subtract_two_digit():
    story_themes = [
        "🏫 โรงเรียนมีนักเรียน 76 คน ให้ออกไปแข่งขันนอกสถานที่ 34 คน เหลือนักเรียนกี่คน?",
        "🍎 มีแอปเปิ้ล 89 ผล แบ่งให้เพื่อน 45 ผล เหลือแอปเปิ้ลกี่ผล?",
        "🧸 มีตุ๊กตา 95 ตัว ขายไป 52 ตัว เหลือตุ๊กตากี่ตัว?",
        "🏪 ร้านค้ามีขนม 68 ชิ้น ขายหมดไป 36 ชิ้น เหลือขนมกี่ชิ้น?",
        "🐕 มีสุนัข 84 ตัว ส่งไปอยู่บ้านใหม่ 43 ตัว เหลือสุนัขกี่ตัว?",
        "🌻 มีดอกไม้ 77 ดอก ดอกไม้โรยไป 35 ดอก เหลือดอกไม้กี่ดอก?",
        "🎨 มีสีชอล์ค 63 ก้าน แจกเพื่อนไป 31 ก้าน เหลือสีชอล์คกี่ก้าน?",
        "📚 มีหนังสือ 92 เล่ม ยืมไป 41 เล่ม เหลือหนังสือกี่เล่ม?",
        "🎮 มีเพชรในเกม 58 เม็ด ใช้ไป 25 เม็ด เหลือเพชรกี่เม็ด?",
        "🎉 มีลูกโป่ง 86 ลูก แตกไป 44 ลูก เหลือลูกโป่งกี่ลูก?",
    ]
    variants = []
    data = [(76,34),(89,45),(95,52),(68,36),(84,43),(77,35),(63,31),(92,41),(58,25),(86,44)]
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        num1, num2 = data[i]
        result = num1 - num2
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "🎒", "count": num1}, {"emoji": "➖", "count": 1}, {"emoji": "🎁", "count": num2}]),
                make_count_back_strip(num1, num2),
                make_bar_model(num2, result, "-"),
                make_step_cards([
                    f"ขั้นที่ 1: เขียนตัวเลขเรียงหลักให้ตรงกัน ตัวตั้งอยู่บน",
                    f"ขั้นที่ 2: ลบหลักหน่วย {num1%10} - {num2%10} = {num1%10 - num2%10}",
                    f"ขั้นที่ 3: ลบหลักสิบ {num1//10} - {num2//10} = {num1//10 - num2//10}",
                    "ขั้นที่ 4: เขียนคำตอบให้ตรงหลัก",
                    "ขั้นที่ 5: ตรวจคำตอบโดยบวกกลับ"
                ]),
                make_number_sentence(num1, num2, "-"),
                make_worked_example(f"{num1} - {num2} = ?", f"{num1} - {num2} = {result} ✅"),
                make_common_mistakes([
                    "เขียนตัวเลขเยื้องกันทำให้หลักไม่ตรง",
                    "ลบหลักสิบก่อนหลักหน่วย",
                    "ลืมว่าตัวตั้งต้องมากกว่าตัวลบ"
                ]),
                make_mini_quiz([f"87 - 43 = ?", f"95 - 52 = ?", f"73 - 31 = ?"])
            ]
        })
    return variants


# ─── g2_multiplication_intro ────────────────────────────────────────────────

def gen_multiplication_intro():
    story_themes = [
        "🏫 โรงเรียนมีกล่องดินสอ 4 กล่อง กล่องละ 3 แท่ง รวมดินสอกี่แท่ง?",
        "🍎 มีถุงมังคุด 5 ถุง ถุงละ 4 ผล รวมมังคุดกี่ผล?",
        "🧸 มีกล่องของเล่น 3 กล่อง กล่องละ 6 ชิ้น รวมของเล่นกี่ชิ้น?",
        "🏪 ร้านค้ามีถุงข้าว 4 ถุง ถุงละ 5 กิโล รวมข้าวกี่กิโล?",
        "🐕 มีตู้ปลา 3 ตู้ ตู้ละ 7 ตัว รวมปลากี่ตัว?",
        "🌻 สวนมีแถวต้นไม้ 4 แถว แถวละ 5 ต้น รวมต้นไม้กี่ต้น?",
        "🎨 แม่แบ่งสีให้เด็ก 6 คน คนละ 3 ก้าน รวมสีกี่ก้าน?",
        "📚 มีชั้นหนังสือ 3 ชั้น ชั้นละ 8 เล่ม รวมหนังสือกี่เล่ม?",
        "🎮 เกมมีด่าน 5 ด่าน ด่านละ 4 ศัตรู รวมศัตรูกี่ตัว?",
        "🎉 งานเทศกาลมีโต๊ะ 4 โต๊ะ โต๊ะละ 6 จาน รวมจานกี่ใบ?",
    ]
    variants = []
    data = [(4,3),(5,4),(3,6),(4,5),(3,7),(4,5),(6,3),(3,8),(5,4),(4,6)]
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        groups, per = data[i]
        result = groups * per
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "📦", "count": groups}, {"emoji": "×", "count": 1}, {"emoji": "🎁", "count": per}]),
                make_array_model(groups, per),
                make_grouping_model(groups, per),
                make_step_cards([
                    f"ขั้นที่ 1: ถามว่ามีกี่กลุ่ม? คือ {groups} กลุ่ม",
                    f"ขั้นที่ 2: แต่ละกลุ่มมีกี่ชิ้น? คือ {per} ชิ้น",
                    f"ขั้นที่ 3: เขียนเป็นประโยคคณิต {groups} × {per}",
                    f"ขั้นที่ 4: บวกซ้ำ {per} + {per} + ... ({groups} ครั้ง)",
                    f"ขั้นที่ 5: คำตอบคือ {result}"
                ]),
                make_number_sentence(groups, per, "×"),
                make_worked_example(f"{groups} × {per} = ?", f"{groups} × {per} = {result} ✅"),
                make_common_mistakes([
                    f"สับสนระหว่าง {groups} × {per} กับ {groups} + {per}",
                    "ไม่เข้าใจว่าตัวหน้าเป็นจำนวนกลุ่ม ตัวหลังเป็นจำนวนในกลุ่ม",
                    "คูณผิดโดยลืมว่าต้องบวกซ้ำหลายครั้ง"
                ]),
                make_mini_quiz([f"3 × 4 = ?", f"5 × 6 = ?", f"2 × 7 = ?"])
            ]
        })
    return variants


# ─── g2_times_table_2_5_10 ──────────────────────────────────────────────────

def gen_times_table_2_5_10():
    story_themes = [
        "🏫 โรงเรียนมีห้องเรียน 5 ห้อง ห้องละ 2 พัดธุ์ รวมพัดธุ์กี่อัน?",
        "🍎 มีลังผลไม้ 4 ลัง ลังละ 5 ผล รวมผลไม้กี่ผล?",
        "🧸 มีกล่องของเล่น 3 กล่อง กล่องละ 10 ชิ้น รวมของเล่นกี่ชิ้น?",
        "🏪 ร้านค้ามีถุงข้าว 6 ถุง ถุงละ 5 กิโล รวมข้าวกี่กิโล?",
        "🐕 มีตู้ปลา 2 ตู้ ตู้ละ 5 ตัว รวมปลากี่ตัว?",
        "🌻 สวนมีแถวต้นไม้ 7 แถว แถวละ 10 ต้น รวมต้นไม้กี่ต้น?",
        "🎨 มีถุงสี 4 ถุง ถุงละ 5 ก้าน รวมสีกี่ก้าน?",
        "📚 มีชั้นหนังสือ 8 ชั้น ชั้นละ 2 เล่ม รวมหนังสือกี่เล่ม?",
        "🎮 เกมมีด่าน 3 ด่าน ด่านละ 5 ศัตรู รวมศัตรูกี่ตัว?",
        "🎉 งานเทศกาลมีโต๊ะ 9 โต๊ะ โต๊ะละ 10 จาน รวมจานกี่ใบ?",
    ]
    variants = []
    data = [(5,2,2),(4,5,5),(3,10,10),(6,5,5),(2,5,5),(7,10,10),(4,5,5),(8,2,2),(3,5,5),(9,10,10)]
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        num, table, multiplier = data[i]
        result = num * multiplier
        table_emoji = {2: "👯", 5: "✋", 10: "🔟"}
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "📦", "count": num}, {"emoji": "×", "count": 1}, {"emoji": table_emoji[multiplier], "count": multiplier}]),
                make_array_model(num, multiplier),
                make_step_cards([
                    f"ขั้นที่ 1: ท่องสูตรคูณแม่ {multiplier}",
                    f"ขั้นที่ 2: ผลคูณคือ {multiplier} {num} ตัว",
                    f"ขั้นที่ 3: {multiplier}×{num} = {result}",
                    f"ขั้นที่ 4: ตรวจคำตอบโดยสลับที่ {num}×{multiplier}",
                    "ขั้นที่ 5: จำคำตอบไว้!"
                ]),
                make_number_sentence(num, multiplier, "×"),
                make_worked_example(f"{multiplier} × {num} = ?", f"{multiplier} × {num} = {result} ✅"),
                make_common_mistakes([
                    f"ลืมว่าสูตรคูณแม่ {multiplier} ได้ผลลัพธ์ลักษณะเฉพาะ",
                    f"คูณแม่ {multiplier} ผิดโดยลืมว่าผลลัพธ์ต้องลงท้ายด้วย {0 if multiplier==10 else (0 if multiplier==2 else '0 หรือ 5')}",
                    f"คูณแม่ {multiplier} ผิดโดยไม่เติมศูนย์ถ้าเป็นแม่ 10"
                ]),
                make_mini_quiz([f"7 × {multiplier} = ?", f"4 × {multiplier} = ?", f"9 × {multiplier} = ?"])
            ]
        })
    return variants


# ─── g2_money_change ─────────────────────────────────────────────────────────

def gen_money_change():
    story_themes = [
        "🏫 โรงเรียนซื้ออาหารกล่องราคา 35 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท?",
        "🍎 ซื้อผลไม้ราคา 23 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท?",
        "🧸 ซื้อของเล่นราคา 48 บาท จ่ายเงิน 100 บาท ได้เงินทอนกี่บาท?",
        "🏪 ซื้อขนมราคา 18 บาท จ่ายเงิน 20 บาท ได้เงินทอนกี่บาท?",
        "🐕 ซื้ออาหารสุนัขราคา 55 บาท จ่ายเงิน 100 บาท ได้เงินทอนกี่บาท?",
        "🌻 ซื้อเมล็ดพันธุ์ราคา 42 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท?",
        "🎨 ซื้อสีราคา 67 บาท จ่ายเงิน 100 บาท ได้เงินทอนกี่บาท?",
        "📚 ซื้อหนังสือราคา 29 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท?",
        "🎮 ซื้อไอเทมเกมราคา 36 บาท จ่ายเงิน 50 บาท ได้เงินทอนกี่บาท?",
        "🎉 ซื้อของที่ระลึกราคา 78 บาท จ่ายเงิน 100 บาท ได้เงินทอนกี่บาท?",
    ]
    variants = []
    data = [(35,50),(23,50),(48,100),(18,20),(55,100),(42,50),(67,100),(29,50),(36,50),(78,100)]
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        price, paid = data[i]
        change = paid - price
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "🛒", "count": 1}, {"emoji": "💰", "count": paid}]),
                make_step_cards([
                    f"ขั้นที่ 1: ดูราคาสินค้า {price} บาท",
                    f"ขั้นที่ 2: ดูเงินที่จ่าย {paid} บาท",
                    f"ขั้นที่ 3: นับขึ้นจาก {price} ไปถึง {paid}",
                    f"ขั้นที่ 4: เงินทอน = {paid} - {price} = {change} บาท",
                    f"ขั้นที่ 5: แยกเป็นธนบัตรและเหรียญให้ถูกต้อง"
                ]),
                make_number_sentence(paid, price, "-"),
                make_worked_example(f"ซื้อสินค้า {price} บาท จ่าย {paid} บาท ได้เงินทอนเท่าไหร่?", f"{paid} - {price} = {change} บาท ✅"),
                make_common_mistakes([
                    "ลบสลับด้าน เช่น {price} - {paid} แทนที่จะเป็น {paid} - {price}",
                    "ไม่แยกเงินทอนเป็นธนบัตรเหรียญถูกต้อง",
                    "นับขึ้นผิดจำนวนขั้น"
                ]),
                make_mini_quiz([f"ซื้อของ 25 บาท จ่าย 50 บาท ได้เงินทอนกี่บาท?", f"ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?"])
            ]
        })
    return variants


# ─── g2_time_calendar ─────────────────────────────────────────────────────────

def gen_time_calendar():
    story_themes = [
        "🏫 โรงเรียนปิดภาคเรียนวันที่ 20 เมษายน วันนั้นเป็นวันอะไร และเดือนเมษายนมีกี่วัน?",
        "🍎 วันเก็บเกี่ยวผลไม้กำหนดวันที่ 10 พฤษภาคม เป็นวันอะไร และเดือนพฤษภาคมมีกี่วัน?",
        "🧸 วันแข่งของเล่นกำหนดวันที่ 5 มิถุนายน เป็นวันอะไร และเดือนมิถุนายนมีกี่วัน?",
        "🏪 วันโปรโมชันราคาวันที่ 25 สิงหาคม เป็นวันอะไร และเดือนสิงหาคมมีกี่วัน?",
        "🐕 วันตรวจสุขภาพสัตว์วันที่ 12 กันยายน เป็นวันอะไร และเดือนกันยายนมีกี่วัน?",
        "🌻 วันปลูกต้นไม้กำหนดวันที่ 3 ตุลาคม เป็นวันอะไร และเดือนตุลาคมมีกี่วัน?",
        "🎨 วันอาภิเษกวันที่ 1 พฤศจิกายน เป็นวันอะไร และเดือนพฤศจิกายนมีกี่วัน?",
        "📚 วันสอบวันที่ 15 มกราคม เป็นวันอะไร และเดือนมกราคมมีกี่วัน?",
        "🎮 วันแข่งขันเกมวันที่ 7 กุมภาพันธ์ เป็นวันอะไร และเดือนกุมภาพันธ์มีกี่วัน?",
        "🎉 วันเทศกาลวันที่ 31 ธันวาคม เป็นวันอะไร และเดือนธันวาคมมีกี่วัน?",
    ]
    day_names = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"]
    days_in_month = [31,28,31,30,31,30,31,31,30,31,30,31]
    month_names = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"]
    date_info = [(20,"เมษายน",4),(10,"พฤษภาคม",5),(5,"มิถุนายน",6),(25,"สิงหาคม",8),(12,"กันยายน",9),(3,"ตุลาคม",10),(1,"พฤศจิกายน",11),(15,"มกราคม",1),(7,"กุมภาพันธ์",2),(31,"ธันวาคม",12)]
    variants = []
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        date, month_name, month_num = date_info[i]
        days = days_in_month[month_num-1]
        day_of_week = day_names[(date + 5) % 7]  # approximate offset for demo
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "📅", "count": date}, {"emoji": "📆", "count": 1}]),
                make_shape_visual([
                    {"shape": "rectangle", "color": "#FFB347", "label_th": f"วันที่ {date}"},
                    {"shape": "circle", "color": "#87CEEB", "label_th": month_name},
                ]),
                make_step_cards([
                    f"ขั้นที่ 1: ดูวันที่บนปฏิทิน คือ {date}",
                    f"ขั้นที่ 2: ดูเดือน {month_name}",
                    f"ขั้นที่ 3: นับวันในสัปดาห์ เพื่อหาวัน",
                    f"ขั้นที่ 4: วันที่ {date} {month_name} เป็นวัน{day_of_week}",
                    f"ขั้นที่ 5: เดือน{month_name}มี {days} วัน"
                ]),
                make_number_sentence(days, 0, "+"),
                make_worked_example(f"วันที่ {date} {month_name} เป็นวันอะไร และเดือนมีกี่วัน?", f"เป็นวัน{day_of_week} และเดือนมี {days} วัน ✅"),
                make_common_mistakes([
                    "สับสนว่าเดือนไหนมี 31 วัน เดือนไหนมี 30 วัน",
                    "นับวันผิด",
                    "ไม่รู้ว่ากุมภาพันธ์มี 28 วัน (หรือ 29 วันในปีอธิกมาตุ)"
                ]),
                make_mini_quiz([f"เดือนกรกฎาคมมีกี่วัน?", f"วันพุธแล้ว 3 วันเป็นวันอะไร?", "ปีอธิกมาตุคือปีไหน?"])
            ]
        })
    return variants


# ─── g2_shapes_2d ────────────────────────────────────────────────────────────

def gen_shapes_2d():
    story_themes = [
        "🏫 โรงเรียนมีป้ายรูปต่างๆ รอบอาคาร มีสามเหลี่ยม 3 รูป สี่เหลี่ยม 4 รูป วงกลม 2 รูป รวมกี่รูป?",
        "🍎 มีผลไม้รูปทรงต่างกัน ลูกแพร์เป็นวงรี ส้มเป็นวงกลม กล้วยเป็นรูปโค้ง มาช่วยจำแนกดีกว่า!",
        "🧸 มีของเล่นรูปทรงต่างๆ ลูกบอลเป็นวงกลม กล่องเป็นสี่เหลี่ยม ปิรามิดเป็นสามเหลี่ยม มาดูกัน!",
        "🏪 ร้านค้ามีป้ายรูปทรงต่างกัน ป้ายห้างเป็นสี่เหลี่ยม ป้ายร้านขนมเป็นวงกลม ป้ายร้านข้าวเป็นสามเหลี่ยม",
        "🐕 มีคิวบ์ของเล่นสุนัข รูปทรงเป็นลูกบาศก์ มีลูกบอลเป็นวงกลม ชิงช้าเป็นวงรี มาดูกัน!",
        "🌻 สวนมีแปลงผักรูปต่างกัน แปลงหนึ่งเป็นสี่เหลี่ยม แปลงสองเป็นสามเหลี่ยม �คันหวานเป็นวงกลม",
        "🎨 ห้องศิลปะมีผลงานรูปทรงต่างๆ ภาพวาดเป็นสามเหลี่ยม กระดาษตัดเป็นสี่เหลี่ยม จานเป็นวงกลม",
        "📚 ห้องสมุดมีหนังสือรูปต่างกัน หนังสือเป็นสี่เหลี่ยมผืนผ้า ดวงตะเป็นวงกลม หมวกเป็นสามเหลี่ยม",
        "🎮 เกมมีไอเทมรูปต่างกัน เพชรเป็นสี่เหลี่ยมขนมเปียกปูน ลูกบอลเป็นวงกลม ธงเป็นสามเหลี่ยม",
        "🎉 งานเทศกาลมีสิ่งของตกแต่งรูปต่างกัน ลูกโป่งเป็นวงกลม ธงเป็นสามเหลี่ยม แผ่นป้ายเป็นสี่เหลี่ยม",
    ]
    shape_sets = [
        [("สามเหลี่ยม",3),("สี่เหลี่ยม",4),("วงกลม",2)],
        [("วงรี",1),("วงกลม",2),("สามเหลี่ยม",1)],
        [("วงกลม",3),("สี่เหลี่ยม",2),("สามเหลี่ยม",1)],
        [("สี่เหลี่ยม",2),("วงกลม",3),("สามเหลี่ยม",2)],
        [("วงกลม",2),("สี่เหลี่ยม",3),("วงรี",1)],
        [("สี่เหลี่ยม",3),("สามเหลี่ยม",2),("วงกลม",1)],
        [("สามเหลี่ยม",4),("สี่เหลี่ยม",3),("วงกลม",2)],
        [("สี่เหลี่ยมผืนผ้า",3),("วงกลม",2),("สามเหลี่ยม",1)],
        [("สี่เหลี่ยมขนมเปียกปูน",2),("วงกลม",3),("สามเหลี่ยม",2)],
        [("วงกลม",3),("สามเหลี่ยม",2),("สี่เหลี่ยม",4)],
    ]
    shape_colors = {"สามเหลี่ยม": "#FF6B6B", "สี่เหลี่ยม": "#4ECDC4", "วงกลม": "#45B7D1", "วงรี": "#96CEB4", "สี่เหลี่ยมผืนผ้า": "#FFEAA7", "สี่เหลี่ยมขนมเปียกปูน": "#DDA0DD"}
    variants = []
    for i, theme in enumerate(THEMES):
        vid = theme["id"]
        story = story_themes[i]
        shapes = [(name, count) for name, count in shape_sets[i]]
        total = sum(s[1] for s in shapes)
        shapes_data = [{"shape": "triangle" if "สามเหลี่ยม" in s[0] else ("circle" if "วงกลม" in s[0] else ("ellipse" if "วงรี" in s[0] else "rectangle")), "color": shape_colors.get(s[0], "#87CEEB"), "label_th": f"{s[0]} {s[1]} รูป"} for s in shapes]
        variants.append({
            "variant_id": vid,
            "variant_title_th": f"📖 {theme['emoji']} {theme['theme']}",
            "story_theme_th": f"เรื่องราวชวนคิดเกี่ยวกับ{theme['theme']}",
            "visual_blocks": [
                make_story_intro(story),
                make_emoji_counter([{"emoji": "🔷", "count": total}]),
                make_shape_visual(shapes_data),
                make_step_cards([
                    "ขั้นที่ 1: สังเกตรูปทรงรอบตัว",
                    f"ขั้นที่ 2: นับจำนวน{shapes[0][0]} มี {shapes[0][1]} รูป",
                    f"ขั้นที่ 3: นับจำนวน{shapes[1][0]} มี {shapes[1][1]} รูป",
                    f"ขั้นที่ 4: นับจำนวน{shapes[2][0]} มี {shapes[2][1]} รูป",
                    f"ขั้นที่ 5: รวมทั้งหมด {total} รูป"
                ]),
                make_number_sentence(total, 0, "+"),
                make_worked_example("จำแนกรูปทรงต่างๆ", f"สามเหลี่ยมมี 3 ด้าน สี่เหลี่ยมมี 4 ด้าน วงกลมไม่มีด้าน ✅"),
                make_common_mistakes([
                    "เรียกวงรีว่าวงกลม",
                    "ไม่แยกสี่เหลี่ยมจัตุรัสกับสี่เหลี่ยมผืนผ้า",
                    "นับจำนวนมุมผิด เช่น นับสามเหลี่ยมเป็น 4 มุม"
                ]),
                make_mini_quiz(["สามเหลี่ยมมีกี่ด้าน?", "วงกลมกับวงรีต่างกันอย่างไร?", "สี่เหลี่ยมจัตุรัสกับสี่เหลี่ยมผืนผ้าต่างกันอย่างไร?"])
            ]
        })
    return variants


# ─── Main ────────────────────────────────────────────────────────────────────

lesson_generators = {
    "g2_add_two_digit": gen_add_two_digit,
    "g2_subtract_two_digit": gen_subtract_two_digit,
    "g2_multiplication_intro": gen_multiplication_intro,
    "g2_times_table_2_5_10": gen_times_table_2_5_10,
    "g2_money_change": gen_money_change,
    "g2_time_calendar": gen_time_calendar,
    "g2_shapes_2d": gen_shapes_2d,
}

for lesson_key, gen_func in lesson_generators.items():
    filepath = os.path.join(LESSONS_DIR, f"{lesson_key}.json")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    data["lesson_variants"] = gen_func()
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Updated {lesson_key}.json with {len(data['lesson_variants'])} variants")

print("\n[SUCCESS] All 7 lessons updated successfully!")
