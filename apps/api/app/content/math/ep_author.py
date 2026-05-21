#!/usr/bin/env python3
"""
EP Lesson Authoring Tool for 4-craft.com
Creates English Program (EP) versions of Thai lessons with proper elementary pedagogy.

Usage:
    python3 ep_author.py                  # generate all EP lessons
    python3 ep_author.py --dry-run      # preview without writing
    python3 ep_author.py --grade 3      # only grade 3
    python3 ep_author.py --rebuild       # regenerate existing EP files
"""

from __future__ import annotations

import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────

CONTENT_ROOT = Path(__file__).resolve().parents[2] / "content" / "math"
DRY_RUN = "--dry-run" in sys.argv
REBUILD = "--rebuild" in sys.argv
GRADE_FILTER = None
for arg in sys.argv:
    m = re.match(r"--grade[ =]?(\d)", arg)
    if m:
        GRADE_FILTER = int(m.group(1))

# ── Helpers ─────────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None

def save_json(path: Path, data: dict) -> None:
    if DRY_RUN:
        print(f"  [DRY RUN] Would write: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

def base_lesson_id(payload: dict, path: Path) -> str:
    return payload.get("lesson_id") or payload.get("id") or path.stem

def lesson_program_alias(payload: dict) -> str:
    pt = (payload.get("program_type") or payload.get("content_program_type") or payload.get("track") or "").strip().upper()
    if pt in {"EP", "EN", "ENGLISH"}:
        return "EP"
    if pt in {"TH", "THP"}:
        return "TH"
    return "TH"

def is_thai_lesson(payload: dict) -> bool:
    return lesson_program_alias(payload) == "TH"

# ── English Title Translation ────────────────────────────────────────────────

# Simple pattern-based title translation
TITLE_TRANSLATIONS = {
    # Grade 1
    "บวกเลขไม่เกิน 20 กับพี่อลิส": "Adding numbers up to 20",
    "เปรียบเทียบตัวเลข มากกว่า น้อยกว่า เท่ากับ": "Comparing Numbers: Greater, Less, Equal",
    "นับเลขสนุกสนุก": "Counting Fun",
    "รู้จักเงินบาทไทย": "Thai Money",
    "รู้จักรูปร่างรูปทรงพื้นฐาน": "Basic Shapes",
    "ลบเลขไม่เกิน 20 ง่ายๆ": "Subtracting within 20",
    "ดูเวลาเป็นนาฬิกาและนาที": "Telling Time",
    # Grade 2
    "บวกเลขสองหลักแบบไม่ทด": "Adding two-digit numbers",
    "เงินทอนคิดง่ายนิดเดียว": "Making Change",
    "การคูณคือการบวกซ้ำๆ": "Multiplication as Repeated Addition",
    "รู้จักรูปทรงสองมิติ 2 มิติ": "2D Shapes",
    "ลบเลขสองหลักแบบไม่ทด": "Subtracting two-digit numbers",
    "อ่านปฏิทินและดูเวลาเป็น": "Calendars and Time",
    "พี่หนึ่งพาท่องสูตรคูณ 2, 5, 10": "Times Tables of 2, 5, and 10",
    "มุม วัดได้ รู้จักรูปทรง": "Angles and Shapes",
    "พื้นที่และเส้นรอบรูป": "Area and Perimeter",
    "ทศนิยม ใช้ในเงินและการวัด": "Decimals in Money and Measure",
    "เศษส่วน บวกลบคูณหาร": "Fractions: Add, Subtract, Multiply, Divide",
    "เลขหลายหลักอ่านได้ เขียนเป็น": "Reading and Writing Large Numbers",
    "บวกลบคูณหารเลขหลายหลัก": "Operations with Large Numbers",
    "โจทย์ปัญหาระดับ ป.4": "Grade 4 Word Problems",
    # Grade 3
    "พื้นที่คือขนาดของพื้นผิว": "What is Area?",
    "การหารคือการแบ่งอย่างเท่าๆ กัน": "Division as Equal Sharing",
    "เศษส่วนในชีวิตประจำวัน": "Fractions in Everyday Life",
    "วัดความยาว น้ำหนัก ปริมาตร": "Measuring Length, Weight, and Volume",
    "ทบทวนคณิตศาสตร์ของป.3": "Grade 3 Math Review",
    "โจทย์ปัญหาหลายขั้นตอน": "Multi-step Word Problems",
    "การคูณด้วยแบบจำลองพื้นที่": "Multiplication with Area Model",
    "คูณเลขหลายหลักแบบเข้าใจง่าย": "Multiplying Multi-digit Numbers",
    # Grade 5
    "อ่านกราฟและตารางข้อมูล": "Reading Graphs and Data Tables",
    "ทศนิยม บวก ลบ คูณ หาร": "Decimals: Add, Subtract, Multiply, Divide",
    "เศษส่วน บวก ลบ คูณ หาร": "Fraction Operations",
    "โจทย์หลายขั้นตอนระดับ ป.5": "Grade 5 Multi-step Problems",
    "เปอร์เซ็นต์ ใช้ในชีวิตจริง": "Percentages in Real Life",
    "อัตราส่วน ใช้เปรียบเทียบ": "Ratios and Proportions",
    "ปริมาตรกับพื้นที่ผิว": "Volume and Surface Area",
    # Grade 6
    "สมการ แก้หาค่าตัวแปร": "Solving Equations",
    "เศษส่วน ทศนิยม เปอร์เซ็นต์ เชื่อมโยงกัน": "Fractions, Decimals, and Percents",
    "หา ห.ร.ม. และ ค.ร.น.": "Finding GCF and LCM",
    "เรขาคณิต พื้นที่ ปริมาตร มุม": "Geometry: Area, Volume, and Angles",
    "เตรียมพร้อมสู่ ม.1": "Ready for Middle School",
    "อัตราส่วนและสัดส่วน": "Ratio and Proportion",
    "ปริมาตรทรงต่างๆ": "Volume of 3D Shapes",
}

def translate_title(title_th: str) -> str:
    """Translate Thai lesson title to English."""
    return TITLE_TRANSLATIONS.get(title_th, title_th)

# ── Story Translation ────────────────────────────────────────────────────────
# ── Story Translation ────────────────────────────────────────────────────────

UNIT_MAP = {
    "ลูกบอล": "balls",
    "ลูก": "balls",
    "ส้ม": "oranges",
    "ผล": "oranges",
    "ดินสอ": "pencils",
    "แท่ง": "pencils",
    "สติกเกอร์": "stickers",
    "ดวง": "stickers",
    "ดาว": "stars",
    "น้ำตาล": "pieces of candy",
    "ชิ้น": "pieces",
    "เม็ด": "beads",
    "เล่ม": "books",
    "ใบ": "items",
    "คน": "people",
    "ตัว": "animals",
    "คู่": "pairs",
    "ช่อง": "squares",
    "แถว": "rows",
    "หลัก": "columns",
    "ขนม": "snacks",
    "ลูกแก้ว": "marbles",
    "ดอกไม้": "flowers",
    "ปากกา": "pens",
    "กระดูก": "bones",
    "เสื้อ": "shirts",
    "กางเกง": "pants",
}

ITEM_MAP = {
    "ลูกบอล": "balls",
    "ส้ม": "oranges",
    "ดินสอ": "pencils",
    "สติกเกอร์": "stickers",
    "ดาว": "stars",
    "น้ำตาล": "candy",
    "ขนม": "snacks",
    "ลูกแก้ว": "marbles",
    "ดอกไม้": "flowers",
    "ปากกา": "pens",
    "หนังสือ": "books",
    "สมุด": "notebooks",
}


def _translate_story_core(text_th: str) -> str:
    """Core story translation - reconstruct English from Thai patterns."""
    if not text_th:
        return ""
    
    # Already English?
    if not re.search(r"[\u0E00-\u0E7F]", text_th):
        return text_th
    
    text = text_th
    
    # Helper to find Thai number word
    def extract_numbers(t):
        """Extract number words from Thai text."""
        thai_nums = {
            "หนึ่ง": "1", "สอง": "2", "สาม": "3", "สี่": "4", "ห้า": "5",
            "หก": "6", "เจ็ด": "7", "แปด": "8", "เก้า": "9", "สิบ": "10",
            "สิบเอ็ด": "11", "สิบสอง": "12",
            "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5",
            "๖": "6", "๗": "7", "๘": "8", "๙": "9",
        }
        result = t
        for th, en in thai_nums.items():
            result = result.replace(th, en)
        # Extract digit sequences
        nums = re.findall(r"\d+", result)
        return [int(n) for n in nums]
    
    # Pattern: มี X item เพิ่มอีก Y item รวมกี่
    m = re.search(r"มี\s+(\d+)\s+([^\s]+(?:\s+[^\s]+)?)\s+ใน\s+([^\s]+(?:\s+[^\s]+)?)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+([^\s]+)\s+รวม\s+กี่", text)
    if m:
        n1, item1, place, n2, item2 = m.groups()
        unit1 = ITEM_MAP.get(item1, item1)
        unit2 = ITEM_MAP.get(item2, item2)
        if unit1 == unit2:
            return f"Miss Alice has {n1} {unit1} in her {place}. She gets {n2} more. How many does she have altogether?"
        return f"Miss Alice has {n1} {unit1} in her {place}. She gets {n2} more {unit2}. How many does she have altogether?"
    
    # Pattern: มี X item แล้วได้เพิ่มอีก Y item รวมกี่
    m = re.search(r"มี\s+(\d+)\s+([^\s]+(?:\s+[^\s]+)?)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+([^\s]+)\s+รวม\s+กี่", text)
    if m:
        n1, item1, n2, item2 = m.groups()
        unit1 = ITEM_MAP.get(item1, item1)
        unit2 = ITEM_MAP.get(item2, item2)
        if unit1 == unit2:
            return f"Miss Alice has {n1} {unit1}. She gets {n2} more. How many does she have altogether?"
        return f"Miss Alice has {n1} {unit1}. She gets {n2} more {unit2}. How many does she have altogether?"
    
    # Pattern: พี่อลิสมี X item ใน place แล้วได้เพิ่มอีก Y item รวมกี่
    m = re.search(r"พี่อลิส\s+มี\s+(\d+)\s+([^\s]+(?:\s+[^\s]+)?)\s+ใน\s+([^\s]+(?:\s+[^\s]+)?)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+([^\s]+)\s+รวม\s+กี่", text)
    if m:
        n1, item1, place, n2, item2 = m.groups()
        unit1 = ITEM_MAP.get(item1, item1)
        unit2 = ITEM_MAP.get(item2, item2)
        return f"Miss Alice has {n1} {unit1} in her {place}. She gets {n2} more. How many does she have altogether?"
    
    # Pattern: มี X ใน Y แล้ว ได้เพิ่มอีก Z รวมกี่
    m = re.search(r"มี\s+(\d+)\s+ใน\s+([^\s]+(?:\s+[^\s]+)?)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        n1, place, n2 = m.groups()
        return f"Miss Alice has {n1} in her {place}. She gets {n2} more. How many does she have altogether?"
    
    # Pattern: มี X item เพิ่มอีก Y รวมกี่
    m = re.search(r"มี\s+(\d+)\s+([^\s]+(?:\s+[^\s]+)?)\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        n1, item1, n2 = m.groups()
        unit1 = ITEM_MAP.get(item1, item1)
        return f"Miss Alice has {n1} {unit1}. She gets {n2} more. How many does she have altogether?"
    
    # Pattern: ครูมี X ใน Y มี Z แถว แถวละ W ช่อง เราหาจำนวนช่องทั้งหมด
    m = re.search(r"ครู\s+มี\s+([^\s]+(?:\s+[^\s]+)?)\s+มี\s+(\d+)\s+แถว\s+แถวละ\s+(\d+)\s+ช่อง", text)
    if m:
        thing, rows, cols = m.groups()
        return f"Teacher has a {thing} with {rows} rows and {cols} columns in each row. How many squares are there altogether?"
    
    # Pattern: มี X แถว แถวละ Y ช่อง
    m = re.search(r"มี\s+(\d+)\s+แถว\s+แถวละ\s+(\d+)\s+ช่อง", text)
    if m:
        rows, cols = m.groups()
        total = int(rows) * int(cols)
        return f"Miss Alice has {rows} rows with {cols} squares in each row. How many squares are there in total? ({rows} × {cols} = {total})"
    
    # Pattern: X ช่อง ใน Y แถว
    m = re.search(r"(\d+)\s+ช่อง\s+ใน\s+(\d+)\s+แถว", text)
    if m:
        cols, rows = m.groups()
        total = int(rows) * int(cols)
        return f"Miss Alice has {cols} squares in each row and {rows} rows. How many squares are there in total? ({rows} × {cols} = {total})"
    
    # Fallback: clean up Thai and add framing
    text = re.sub(r"[\u0E00-\u0E7F]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text:
        nums = re.findall(r"\d+", text)
        if nums:
            return f"Look! {' + '.join(nums)} — can you find the answer?"
    
    return "Let's solve this together!"


def translate_story(text_th: str) -> str:
    """Translate Thai story to engaging elementary English."""
    result = _translate_story_core(text_th)
    if result and "?" not in result:
        result += " Can you solve it?"
    return result

# ── Quiz Field Translation ───────────────────────────────────────────────────

def translate_quiz_text(text_th: str) -> str:
    """Translate quiz question/answer text to English."""
    if not text_th:
        return ""
    
    if not re.search(r"[\u0E00-\u0E7F]", text_th):
        return text_th
    
    text = text_th
    
# Split Thai concatenated words that would otherwise be one token
    # รวมมี → รวม มี (total has), รวมกี่ → รวม กี่ (total how many)
    text = re.sub(r"รวมมี", "รวม มี", text)
    text = re.sub(r"รวมกี่", "รวม กี่", text)
    
    # Unit-aware replacements - order matters (longer first)
    unit_map = [
        ("ลูกบอล", "balls"),
        ("ลูกแก้ว", "marbles"),
        ("สติกเกอร์", "stickers"),
        ("ดวงดาว", "stars"),
        ("ดาว", "stars"),
        ("ส้ม", "oranges"),
        ("ผลไม้", "fruits"),
        ("ลูกปัด", "marbles"),
        ("ลูก", "balls"),
        ("ผล", "fruits"),
        ("แท่ง", "pencils"),
        ("ดินสอ", "pencils"),
        ("ดวง", "stickers"),
        ("ชิ้น", "pieces"),
        ("เม็ด", "beads"),
        ("เล่ม", "books"),
        ("ใบ", "leaves"),
        ("คน", "people"),
        ("ตัว", "animals"),
        ("คู่", "pairs"),
    ]
    
    for th, en in unit_map:
        text = text.replace(th, en)
    
    # Pattern: มี X item เพิ่มอีก Y item รวม มี [item] กี่ [unit]?
    m = re.search(r"มี\s+([\D]+?)\s+(\d+)\s+([\D]+?)\s+เพิ่ม\s+อีก\s+(\d+)\s+([\D]+?)\s+รวม\s+มี\s+[\D]+?\s+กี่\s+([\D]+?)\?", text)
    if m:
        n1, n2 = m.group(2), m.group(4)
        return f"Ali has {n1}. She gets {n2} more. How many in total?"
    
    # Pattern: มี X item เพิ่มอีก Y item รวมกี่
    m = re.search(r"มี\s+([\D]+?)\s+(\d+)\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        n1, n2 = m.group(2), m.group(3)
        return f"Ali has {n1}. She gets {n2} more. How many in total?"
    
    # Pattern: มี X ใน Y แล้วได้เพิ่มอีก Z รวมกี่
    m = re.search(r"มี\s+([^\s]+)\s+ใน\s+([^\s]+)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        item, place, n2 = m.groups()
        item_clean = re.sub(r"[\u0E00-\u0E7F]", "", item)
        place_clean = re.sub(r"[\u0E00-\u0E7F]", "", place)
        return f"Miss Alice has {n2} more in her {place_clean}. How many in total?"
    
    # Pattern: X แถว แถวละ Y ช่อง รวมกี่
    m = re.search(r"(\d+)\s+แถว\s+แถวละ\s+(\d+)\s+ช่อง\s+รวม\s+กี่", text)
    if m:
        rows, cols = m.groups()
        total = int(rows) * int(cols)
        return f"Miss Alice has {rows} rows with {cols} squares in each row. How many squares are there in total? ({rows} x {cols} = {total})"
    
    # Pattern: มี X เพิ่มอีก Y รวมกี่
    m = re.search(r"มี\s+(\d+)\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        n1, n2 = m.groups()
        total = int(n1) + int(n2)
        return f"Ali has {n1}. She gets {n2} more. How many in total? ({n1} + {n2} = {total})"
    
    # Pattern: มี X Y แล้วได้เพิ่มอีก Z รวมกี่
    m = re.search(r"มี\s+(\d+)\s+([^\s?]+)\s+แล้ว\s+ได้\s+เพิ่ม\s+อีก\s+(\d+)\s+รวม\s+กี่", text)
    if m:
        n1, item, n2 = m.groups()
        item_clean = re.sub(r"[\u0E00-\u0E7F]", "", item)
        total = int(n1) + int(n2)
        return f"Miss Alice has {n1} {item_clean}. She gets {n2} more. How many in total? ({n1} + {n2} = {total})"
    
    # Remove remaining Thai characters
    if re.search(r"[\u0E00-\u0E7F]", text):
        text = re.sub(r"[\u0E00-\u0E7F]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
    
    # Common ending patterns
    text = re.sub(r"รวม\s+กี่", "How many in total?", text)
    text = re.sub(r"เหลือ\s+กี่", "How many are left?", text)
    text = re.sub(r"ได้\s+รับ\s+กี่", "received how many?", text)
    
    if text and "?" not in text:
        text += "?"
    
    return text

def translate_quiz_list(quiz_th: list) -> list:
    """Translate quiz question list."""
    if not isinstance(quiz_th, list):
        return quiz_th
    result = []
    for q in quiz_th:
        if not isinstance(q, dict):
            result.append(q)
            continue
        q_en = dict(q)
        q_en["question_en"] = translate_quiz_text(q.get("question_th", ""))
        q_en["question_text"] = translate_quiz_text(q.get("question_th", q.get("question_text", "")))
        q_en["explanation_en"] = translate_quiz_text(q.get("explanation_th", q.get("explanation", "")))
        q_en["explanation"] = translate_quiz_text(q.get("explanation_th", ""))
        q_en["choices_en"] = [translate_quiz_text(c) for c in (q.get("choices") or [])]
        q_en["choices"] = [translate_quiz_text(c) for c in (q.get("choices") or [])]
        q_en["answer_en"] = translate_quiz_text(q.get("correct_answer") or q.get("answer") or "")
        q_en["answer"] = translate_quiz_text(q.get("correct_answer") or q.get("answer") or "")
        q_en["correct_answer"] = translate_quiz_text(q.get("correct_answer") or q.get("answer") or "")
        result.append(q_en)
    return result

# ── Vocabulary Translation ───────────────────────────────────────────────────

def translate_vocabulary(vocab_list: list) -> list:
    """Translate vocabulary to English."""
    if not isinstance(vocab_list, list):
        return vocab_list
    result = []
    for v in vocab_list:
        if not isinstance(v, dict):
            result.append(v)
            continue
        en_word = v.get("word", "")
        result.append({
            "word": en_word,
            "meaning_en": v.get("meaning_th", ""),
            "example_en": v.get("example_th", ""),
            "word_th": v.get("word", ""),
            "meaning_th": v.get("meaning_th", ""),
            "example_th": v.get("example_th", ""),
        })
    return result

# ── Block Translation ────────────────────────────────────────────────────────

TRANSLATED_BLOCK_TYPES = {"story_intro", "number_sentence", "mini_quiz", "visual_thinking"}

def translate_block(block: dict) -> dict:
    """Translate a visual block to EP English."""
    block_type = block.get("type", "")
    if block_type not in TRANSLATED_BLOCK_TYPES:
        return block
    
    result = {**block}
    
    if block_type == "story_intro":
        data = block.get("data", {})
        if isinstance(data, dict):
            title_th = data.get("title_th", "")
            text_th = data.get("text_th", "")
            title_en = "Let's find out!" if not title_th else title_th
            text_en = translate_story(text_th)
            result["data"] = {
                **data,
                "title_en": title_en,
                "text_en": text_en,
            }
        return result
    
    if block_type == "number_sentence":
        title_th = block.get("title_th", "")
        title_en = "✍️ Write the solution"
        if "เขียนเป็นประโยคคณิต" in title_th or "เขียนเป็นประโยควิธีทำ" in title_th:
            title_en = "✍️ Write the solution"
        result["title_en"] = title_en
        result["title_th"] = title_th
        return result
    
    if block_type == "mini_quiz":
        data = block.get("data", {})
        if isinstance(data, dict):
            result["data"] = {
                **data,
                "question_en": translate_quiz_text(data.get("question_th", "")),
                "explanation_en": translate_quiz_text(data.get("explanation_th", "")),
                "choices_en": [translate_quiz_text(c) for c in (data.get("choices", []) or [])],
                "answer_en": translate_quiz_text(data.get("answer", "") or data.get("correct_answer", "")),
            }
        return result
    
    return result

def translate_variant_blocks(blocks: list) -> list:
    return [translate_block(b) for b in blocks]

# ── Main Generation ────────────────────────────────────────────────────────

def generate_ep_payload(th_payload: dict, base_id: str) -> dict:
    """Create EP version of a Thai lesson payload."""
    ep = dict(th_payload)
    title_th = th_payload.get("title_th", "")
    
    # Core identity
    ep["lesson_id"] = base_id + "_ep"
    ep["id"] = base_id + "_ep"
    ep["program_type"] = "EP"
    
    # Bilingual titles
    ep["title_en"] = translate_title(title_th)
    ep["title_th"] = title_th
    
    # Objective
    ep["objective_en"] = "Students will be able to " + translate_objective(title_th)
    ep["objective_th"] = th_payload.get("objective_th", "")
    
    # Bilingual story intro
    story_th = th_payload.get("story_intro_th", "")
    if story_th:
        ep["story_intro_en"] = translate_story(story_th)
        ep["story_intro_th"] = story_th
    
    # Vocabulary
    if "vocabulary" in ep:
        ep["vocabulary_en"] = translate_vocabulary(ep["vocabulary"])
    
    # Translate lesson variants
    if "lesson_variants" in ep:
        ep["lesson_variants"] = [
            {
                **variant,
                "variant_title_en": translate_title(variant.get("variant_title_th", "")),
                "story_theme_en": variant.get("story_theme_th", ""),
                "visual_blocks": translate_variant_blocks(variant.get("visual_blocks", [])),
            }
            for variant in ep["lesson_variants"]
        ]
    
    # Translate worked examples
    if "worked_examples" in ep:
        ep["worked_examples_en"] = [
            {
                "title_en": f"Example: {v.get('title_th', '')}",
                "question_en": translate_quiz_text(v.get("question_th", "")),
                "solution_en": translate_quiz_text(v.get("solution_th", "")),
            }
            for v in ep["worked_examples"]
        ]
    
    # Translate common mistakes
    if "common_mistakes" in ep:
        ep["common_mistakes_en"] = [
            f"Mistake: {m}" for m in ep["common_mistakes"]
        ]
    
    # Translate hints
    if "hints" in ep:
        ep["hints_en"] = [f"Hint: {h}" for h in ep["hints"]]
    
    # Translate explanation steps
    if "explanation_steps" in ep:
        ep["explanation_steps_en"] = [f"Step: {s}" for s in ep["explanation_steps"]]
    
    # Mini quiz - top level
    if "quiz_th" in ep:
        ep["quiz_en"] = translate_quiz_list(ep["quiz_th"])
    
    # Update IDs
    ep["quiz_id"] = ep["lesson_id"]
    ep["skill_code"] = ep["lesson_id"]
    
    # Timestamps
    ep["generated_at"] = datetime.now(UTC).isoformat()
    ep["source_lesson_id"] = th_payload.get("lesson_id", "")
    ep["needs_review"] = True  # Flag for human review
    
    return ep

def translate_objective(title_th: str) -> str:
    """Translate lesson objective based on title."""
    if "บวก" in title_th:
        return "add numbers within 20"
    if "ลบ" in title_th:
        return "subtract numbers within 20"
    if "คูณ" in title_th or "สูตรคูณ" in title_th:
        return "multiply using times tables"
    if "หาร" in title_th:
        return "divide by sharing equally"
    if "เปรียบเทียบ" in title_th:
        return "compare numbers using greater than, less than, and equal to"
    if "นับ" in title_th:
        return "count numbers in fun ways"
    if "เงิน" in title_th or "ทอน" in title_th:
        return "recognize Thai money and make change"
    if "รูป" in title_th:
        return "identify and describe basic shapes"
    if "เวลา" in title_th or "นาฬิกา" in title_th:
        return "tell time using clocks"
    if "ปฏิทิน" in title_th:
        return "read calendars and understand dates"
    if "พื้นที่" in title_th:
        return "calculate area and perimeter"
    if "ทศนิยม" in title_th:
        return "work with decimals in money and measurement"
    if "เศษส่วน" in title_th:
        return "understand and use fractions"
    if "มุม" in title_th:
        return "identify and measure angles"
    if "โจทย์" in title_th or "ปัญหา" in title_th:
        return "solve word problems"
    if "วัด" in title_th:
        return "measure length, weight, and volume"
    return "understand this math concept"

def process_lesson(th_path: Path) -> Path | None:
    """Process a single TH lesson file, return EP file path or None."""
    payload = load_json(th_path)
    if not payload:
        return None
    
    if not is_thai_lesson(payload):
        return None
    
    base_id = base_lesson_id(payload, th_path)
    ep_path = th_path.parent / f"{base_id}_ep.json"
    
    if ep_path.exists() and not REBUILD:
        print(f"  [SKIP] EP already exists: {ep_path.name}")
        return ep_path
    
    ep_payload = generate_ep_payload(payload, base_id)
    save_json(ep_path, ep_payload)
    status = "REBUILT" if ep_path.exists() else "CREATED"
    print(f"  [OK] {status}: {ep_path.name}")
    return ep_path

def main() -> None:
    print(f"\n{'='*60}")
    print("EP LESSON AUTHORING TOOL")
    print(f"Dry run: {DRY_RUN}")
    print(f"Rebuild: {REBUILD}")
    print(f"Grade filter: {GRADE_FILTER or 'ALL'}")
    print(f"{'='*60}\n")
    
    grades = range(1, 7) if not GRADE_FILTER else [GRADE_FILTER]
    total = 0
    
    for grade in grades:
        grade_dir = CONTENT_ROOT / f"grade_{grade}" / "lessons"
        if not grade_dir.exists():
            continue
        
        print(f"Grade {grade}:")
        lesson_files = sorted(grade_dir.glob("*.json"))
        th_files = [f for f in lesson_files if load_json(f) and is_thai_lesson(load_json(f))]
        
        for th_file in th_files:
            result = process_lesson(th_file)
            if result:
                total += 1
    
    print(f"\n{'='*60}")
    print(f"Done. Processed {total} EP lessons.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()