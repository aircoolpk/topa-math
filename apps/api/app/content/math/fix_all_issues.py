#!/usr/bin/env python3
"""
Fix remaining issues - EP variants with Format B (data.questions[]) structure
"""

import json
import re
import random
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

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
        if any(day in correct_answer for day in DAYS):
            correct_day = next((day for day in DAYS if day in correct_answer), None)
            if correct_day:
                idx = DAYS.index(correct_day)
                wrong = []
                for offset in [-3, -1, 1, 3]:
                    wrong.append(DAYS[(idx + offset) % 7])
                    if len(wrong) >= 3:
                        break
                choices = wrong[:3] + [correct_day]
                random.shuffle(choices)
                return choices, correct_day
        return [correct_answer, "ไม่ทราบ", "ข้อ ก", "ข้อ ข"], correct_answer
    
    correct_num = nums[0]
    unit = str(correct_answer).replace(str(correct_num), "", 1).strip()
    
    offsets = [-3, -2, -1, 1, 2, 3, 5, 10]
    wrong = [correct_num + o for o in offsets if correct_num + o > 0 and correct_num + o != correct_num][:3]
    
    while len(wrong) < 3:
        wrong.append(correct_num + len(wrong) + 1)
    
    choices = wrong[:3] + [correct_num]
    random.shuffle(choices)
    
    if unit:
        choices = [f"{c}{unit}" for c in choices]
        correct_formatted = f"{correct_num}{unit}"
    else:
        choices = [str(c) for c in choices]
        correct_formatted = str(correct_num)
    
    return choices, correct_formatted

def get_question_text(block):
    """Extract question text from block, handling both formats"""
    if "question" in block and block["question"]:
        return block["question"]
    if "data" in block and isinstance(block["data"], dict):
        questions = block["data"].get("questions", [])
        if questions:
            return questions[0].get("text_th", questions[0].get("text_en", ""))
    return ""

def fix_all_issues(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lesson_id = data.get("lesson_id", filepath.stem)
    fixed_count = 0
    
    if "lesson_variants" not in data:
        return 0
    
    # Build map of TH variants
    th_variants = {v["variant_id"]: v for v in data["lesson_variants"] if not v["variant_id"].startswith("ep_")}
    ep_variants = [v for v in data["lesson_variants"] if v["variant_id"].startswith("ep_")]
    
    for variant in data["lesson_variants"]:
        vid = variant.get("variant_id", "")
        
        for block in variant.get("visual_blocks", []):
            if block.get("type") != "mini_quiz":
                continue
            
            # Get current state
            if "data" in block and isinstance(block["data"], dict):
                questions = block["data"].get("questions", [])
                current_question = questions[0].get("text_th", "") if questions else ""
                current_choices = questions[0].get("choices") if questions else None
                current_answer = questions[0].get("answer") if questions else None
            else:
                current_question = block.get("question", "")
                current_choices = block.get("choices")
                current_answer = block.get("answer")
            
            needs_fix = (
                current_choices is None or 
                current_choices == [] or
                current_choices == ["A", "B", "C", "D"] or
                current_answer is None or
                current_answer == "" or
                current_answer in ["A", "B", "C", "D"] or
                (current_answer and current_choices and current_answer not in current_choices)
            )
            
            if not needs_fix:
                continue
            
            # Calculate correct answer
            correct_answer = calculate_answer(current_question, lesson_id)
            if not correct_answer:
                correct_answer = get_factual_answer(current_question)
            
            if not correct_answer:
                continue
            
            new_choices, correct_formatted = generate_choices(correct_answer, current_question)
            
            # Update block
            if "data" in block and isinstance(block["data"], dict):
                questions = block["data"].get("questions", [])
                if questions:
                    questions[0]["choices"] = new_choices
                    questions[0]["answer"] = correct_formatted
            else:
                block["question"] = current_question
                block["choices"] = new_choices
                block["answer"] = correct_formatted
            
            fixed_count += 1
        
        # Fix EP variants that have empty mini_quiz
        if vid.startswith("ep_"):
            # Find matching TH variant
            th_vid = vid.replace("ep_", "")
            th_v = th_variants.get(th_vid) or list(th_variants.values())[0] if th_variants else None
            
            if th_v:
                for ep_block in variant.get("visual_blocks", []):
                    if ep_block.get("type") == "mini_quiz":
                        ep_question = ep_block.get("question", "")
                        ep_choices = ep_block.get("choices")
                        ep_answer = ep_block.get("answer")
                        
                        if not ep_choices or ep_choices == [] or not ep_answer or ep_answer == "":
                            # Find TH mini_quiz with same index
                            th_mqs = [b for b in th_v.get("visual_blocks", []) if b.get("type") == "mini_quiz"]
                            ep_mqs = [b for b in variant.get("visual_blocks", []) if b.get("type") == "mini_quiz"]
                            
                            for i, ep_mq in enumerate(ep_mqs):
                                if not ep_mq.get("choices") or ep_mq.get("choices") == [] or not ep_mq.get("answer"):
                                    # Try to get from TH
                                    if i < len(th_mqs):
                                        th_mq = th_mqs[i]
                                        th_question = get_question_text(th_mq)
                                        
                                        correct_answer = calculate_answer(th_question, lesson_id)
                                        if not correct_answer:
                                            correct_answer = get_factual_answer(th_question)
                                        
                                        if correct_answer:
                                            new_choices, correct_formatted = generate_choices(correct_answer, th_question)
                                            ep_mq["question"] = th_question
                                            ep_mq["choices"] = new_choices
                                            ep_mq["answer"] = correct_formatted
                                            fixed_count += 1
    
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
                fixed = fix_all_issues(json_file)
                if fixed > 0:
                    print(f"[OK] {json_file.name} - fixed {fixed}")
                    total += fixed
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
    
    print(f"\nTotal fixes: {total}")

if __name__ == "__main__":
    main()