#!/usr/bin/env python3
"""
Fix EP variants and calendar-type mini_quizzes
"""

import json
import re
import random
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

# Calendar facts
CALENDAR_FACTS = {
    "เดือนกรกฎาคมมีกี่วัน": "31 วัน",
    "เดือนสิงหาคมมีกี่วัน": "31 วัน",
    "เดือนกันยายนมีกี่วัน": "30 วัน",
    "เดือนเมษายนมีกี่วัน": "30 วัน",
    "เดือนมิถุนายนมีกี่วัน": "30 วัน",
    "เดือนกุมภาพันธ์มีกี่วัน": "28 วัน (หรือ 29 วันในปีอธิกมาตุ)",
    "วันพุธแล้ว 3 วันเป็นวันอะไร": "วันเสาร์",
    "วันอาทิตย์แล้ว 2 วันเป็นวันอะไร": "วันอังคาร",
    "วันจันทร์แล้ว 1 วันเป็นวันอะไร": "วันอังคาร",
    "วันศุกร์แล้ว 4 วันเป็นวันอะไร": "วันอังคาร",
    "ปีอธิกมาตุคือปีไหน": "ปีที่เดือนกุมภาพันธ์มี 29 วัน",
    "ปีอธิกมาตุ": "ปีที่เดือนกุมภาพันธ์มี 29 วัน",
}

DAYS = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"]

def extract_numbers(text):
    if not isinstance(text, str):
        return []
    return [int(n) for n in re.findall(r'\d+', text)]

def calculate_answer(question, lesson_id):
    numbers = extract_numbers(question)
    if not numbers:
        return None
    
    if "นาฬิกา" in question or ("โมง" in question and "ชั่วโมง" in question):
        return f"{numbers[0] + numbers[1]} โมง" if len(numbers) >= 2 else f"{numbers[0]} โมง"
    
    if "เพิ่มอีก" in question or "รวม" in question:
        return str(numbers[0] + numbers[1]) if len(numbers) >= 2 else str(numbers[0])
    
    if "ใช้ไป" in question or "เหลือ" in question:
        return str(numbers[0] - numbers[1]) if len(numbers) >= 2 else str(numbers[0])
    
    if "กลุ่มละ" in question or "คูณ" in question.lower():
        return str(numbers[0] * numbers[1]) if len(numbers) >= 2 else str(numbers[0])
    
    if "แบ่ง" in question or "÷" in question:
        return str(numbers[0] // numbers[1]) if len(numbers) >= 2 and numbers[1] != 0 else None
    
    expr = re.search(r'[\d\s\+\-\*\/]+', question)
    if expr:
        try:
            return str(eval(expr.group().strip()))
        except:
            pass
    
    return str(numbers[0])

def get_factual_answer(question):
    for key, val in CALENDAR_FACTS.items():
        if key in question:
            return val
    return None

def generate_choices(correct_answer, question):
    random.seed(42)
    
    nums = extract_numbers(str(correct_answer))
    if not nums:
        # Non-numeric answer
        if any(day in correct_answer for day in DAYS):
            # Day of week question
            correct_day = None
            for day in DAYS:
                if day in correct_answer:
                    correct_day = day
                    break
            if correct_day:
                idx = DAYS.index(correct_day)
                wrong = []
                for offset in [-3, -1, 1, 3]:
                    idx2 = (idx + offset) % 7
                    wrong.append(DAYS[idx2])
                    if len(wrong) >= 3:
                        break
                choices = wrong[:3]
                choices.append(correct_day)
                random.shuffle(choices)
                return choices, correct_day
        
        # Fallback
        return [correct_answer, "ไม่ทราบ", "ข้อ ก", "ข้อ ข"], correct_answer
    
    correct_num = nums[0]
    unit = str(correct_answer).replace(str(correct_num), "", 1).strip()
    
    offsets = [-3, -2, -1, 1, 2, 3, 5, 10]
    wrong = []
    for o in offsets:
        v = correct_num + o
        if v > 0 and v != correct_num:
            wrong.append(v)
        if len(wrong) >= 3:
            break
    
    choices = wrong[:3]
    choices.append(correct_num)
    random.shuffle(choices)
    
    if unit:
        choices = [f"{c}{unit}" for c in choices]
        correct_formatted = f"{correct_num}{unit}"
    else:
        choices = [str(c) for c in choices]
        correct_formatted = str(correct_num)
    
    return choices, correct_formatted

def fix_ep_variants(filepath):
    """Fix EP variants that have empty mini_quizzes"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "lesson_variants" not in data:
        return 0
    
    th_variants = {v["variant_id"]: v for v in data["lesson_variants"] if not v["variant_id"].startswith("ep_")}
    ep_variants = [v for v in data["lesson_variants"] if v["variant_id"].startswith("ep_")]
    
    if not ep_variants or not th_variants:
        return 0
    
    fixed_count = 0
    
    for ep_v in ep_variants:
        # Find corresponding TH variant
        th_vid = ep_v["variant_id"].replace("ep_", "")
        if th_vid in th_variants:
            th_v = th_variants[th_vid]
        else:
            th_v = list(th_variants.values())[0]  # Use first TH variant
        
        # For each mini_quiz in EP, copy choices/answers from TH
        for ep_block in ep_v.get("visual_blocks", []):
            if ep_block.get("type") == "mini_quiz":
                # Find corresponding TH mini_quiz
                for th_block in th_v.get("visual_blocks", []):
                    if th_block.get("type") == "mini_quiz":
                        # Copy structure from TH
                        if "data" in th_block and isinstance(th_block["data"], dict):
                            questions = th_block["data"].get("questions", [])
                            if questions and len(questions) > 0:
                                q = questions[0]
                                question_text = q.get("text_th", q.get("text_en", ""))
                                correct_answer = calculate_answer(question_text, data.get("lesson_id", ""))
                                if not correct_answer:
                                    correct_answer = get_factual_answer(question_text)
                                if correct_answer:
                                    choices, correct_formatted = generate_choices(correct_answer, question_text)
                                    # Create mini_quiz structure for EP
                                    ep_block["question"] = question_text
                                    ep_block["choices"] = choices
                                    ep_block["answer"] = correct_formatted
                                    fixed_count += 1
                        elif "choices" in th_block and "answer" in th_block:
                            ep_block["choices"] = th_block["choices"]
                            ep_block["answer"] = th_block["answer"]
                            ep_block["question"] = th_block.get("question", "")
                            fixed_count += 1
                        break
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return fixed_count

def main():
    total = 0
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            continue
        
        for json_file in dir_path.glob("*.json"):
            if json_file.name.startswith(("gen_", "check", "verify")):
                continue
            
            try:
                fixed = fix_ep_variants(json_file)
                if fixed > 0:
                    print(f"[OK] {json_file.name} - fixed {fixed} EP mini_quizzes")
                    total += fixed
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
    
    print(f"\nTotal EP mini_quizzes fixed: {total}")

if __name__ == "__main__":
    main()