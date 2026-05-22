from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
BACKUP_ROOT = CONTENT_ROOT / "_content_backups" / datetime.now(UTC).strftime("%Y%m%d_%H%M%S_language_variant_restructure")


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")


def backup(path: Path) -> None:
    if not path.exists():
        return
    target = BACKUP_ROOT / path.relative_to(CONTENT_ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)


def lesson_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json"))


def language_for(path: Path, payload: dict[str, Any]) -> str:
    raw = str(payload.get("program_type") or payload.get("content_program_type") or "").upper()
    if raw == "EP" or path.stem.endswith("_ep"):
        return "EP"
    return "TH"


def base_lesson_id(lesson_id: str) -> str:
    for suffix in ("_ep", "_thp", "_th"):
        if lesson_id.lower().endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def thai_title_from_id(base_id: str, fallback: str) -> str:
    titles = {
        "g1_add_within_20": "บวกเลขไม่เกิน 20",
        "g1_compare_numbers": "เปรียบเทียบจำนวน",
        "g1_counting_numbers": "นับจำนวน 1 ถึง 100",
        "g1_money_basic": "รู้จักเงินและราคา",
        "g1_shapes_basic": "รู้จักรูปเรขาคณิต",
        "g2_add_two_digit": "บวกเลขสองหลัก",
        "g2_money_change": "เงินทอนในชีวิตประจำวัน",
        "g2_multiplication_intro": "เริ่มต้นการคูณ",
        "g2_shapes_2d": "รูปเรขาคณิตสองมิติ",
        "g2_subtract_two_digit": "ลบเลขสองหลัก",
        "g3_area_intro": "พื้นที่รูปสี่เหลี่ยม",
        "g3_division_intro": "การหารแบบแบ่งเท่า ๆ กัน",
        "g3_fractions_intro": "เศษส่วนในชีวิตประจำวัน",
        "g3_measurement": "การวัดความยาวและน้ำหนัก",
        "g3_mixed_review": "ทบทวนโจทย์ผสม",
        "g3_multi_step_word_problems": "โจทย์ปัญหาหลายขั้นตอน",
        "g4_angles_geometry": "มุมและเรขาคณิต",
        "g4_area_perimeter": "พื้นที่และเส้นรอบรูป",
        "g4_decimals_intro": "ทศนิยมเบื้องต้น",
        "g4_fractions": "เศษส่วน",
        "g4_large_numbers": "จำนวนนับขนาดใหญ่",
        "g5_data_graphs": "อ่านกราฟและตารางข้อมูล",
        "g5_decimals": "ทศนิยม บวก ลบ คูณ หาร",
        "g5_fraction_operations": "การคำนวณเศษส่วน",
        "g5_multi_step_word_problems": "โจทย์ปัญหาหลายขั้นตอน",
        "g5_percent_intro": "เปอร์เซ็นต์เบื้องต้น",
        "g6_equations_intro": "สมการเบื้องต้น",
        "g6_fraction_decimal_percent": "เศษส่วน ทศนิยม และเปอร์เซ็นต์",
        "g6_gcf_lcm": "ห.ร.ม. และ ค.ร.น.",
        "g6_geometry": "เรขาคณิต ป.6",
        "g6_middle_school_prep": "เตรียมพร้อมคณิต ม.1",
        "g6_ratios_intro": "อัตราส่วนเบื้องต้น",
    }
    return titles.get(base_id, fallback if fallback and not looks_english(fallback) else base_id.replace("_", " "))


def english_title_from_id(base_id: str, fallback: str) -> str:
    titles = {
        "fractions": "Fractions in Everyday Life",
        "area": "Area of Rectangles",
        "division": "Division as Equal Sharing",
        "decimal": "Decimals in Money and Measurement",
        "money": "Money and Change",
        "multi_step": "Multi-Step Word Problems",
        "word_problem": "Word Problems",
        "multiplication": "Multiplication with Equal Groups",
        "geometry": "Geometry",
        "ratio": "Ratios",
        "equation": "Simple Equations",
        "percent": "Percents",
        "graph": "Graphs and Tables",
        "measurement": "Measurement",
        "counting": "Counting Numbers",
        "compare": "Comparing Numbers",
        "add": "Addition",
        "subtract": "Subtraction",
    }
    for key, title in titles.items():
        if key in base_id:
            return title
    return fallback if fallback and looks_english(fallback) else base_id.replace("_", " ").title()


def looks_english(text: str) -> bool:
    letters = sum(1 for ch in text if "A" <= ch <= "Z" or "a" <= ch <= "z")
    thai = sum(1 for ch in text if "\u0e00" <= ch <= "\u0e7f")
    return letters > thai


def topic_kind(base_id: str) -> str:
    checks = [
        ("fraction", ("fraction", "fractions")),
        ("decimal", ("decimal", "money_change", "money")),
        ("area", ("area", "perimeter")),
        ("division", ("division", "divide")),
        ("multiplication", ("multiplication", "multiply")),
        ("multi_step", ("multi_step", "word_problem", "word_problems")),
        ("geometry", ("geometry", "shape", "angle", "volume")),
        ("ratio", ("ratio",)),
        ("equation", ("equation",)),
        ("percent", ("percent",)),
        ("graph", ("graph", "data")),
        ("measurement", ("measurement",)),
        ("compare", ("compare",)),
        ("counting", ("counting",)),
        ("subtraction", ("subtract", "subtraction")),
        ("addition", ("add", "addition")),
    ]
    for kind, keys in checks:
        if any(key in base_id for key in keys):
            return kind
    return "addition"


def th_variant(base_id: str, title: str, variant_num: int) -> dict[str, Any]:
    kind = topic_kind(base_id)
    contexts = {
        "fraction": ("เค้กกล้วยหอม", 1, 4, 1, "ชิ้น", "1/4"),
        "decimal": ("สมุดภาพ", 50, 23.75, 26.25, "บาท", "50 - 23.75 = 26.25 บาท"),
        "area": ("แปลงผักของห้องเรียน", 6, 5, 30, "ตารางเมตร", "6 × 5 = 30 ตารางเมตร"),
        "division": ("ขนมปัง", 30, 6, 5, "ชิ้น", "30 ÷ 6 = 5 ชิ้น"),
        "multiplication": ("สติกเกอร์", 6, 4, 24, "ดวง", "6 × 4 = 24 ดวง"),
        "multi_step": ("น้ำผลไม้", 15, 8, 72, "บาท", "(15 × 8) - (6 × 8) = 72 บาท"),
        "geometry": ("กระดาษรูปสี่เหลี่ยม", 4, 6, 24, "ช่อง", "4 × 6 = 24 ช่อง"),
        "ratio": ("น้ำหวาน", 2, 3, 5, "ส่วน", "2 : 3"),
        "equation": ("กล่องดินสอ", 12, 5, 17, "แท่ง", "x + 5 = 17 ดังนั้น x = 12"),
        "percent": ("แบบฝึกหัด", 20, 5, 25, "เปอร์เซ็นต์", "5 จาก 20 = 25%"),
        "graph": ("ตารางผลไม้", 12, 8, 20, "ชิ้น", "12 + 8 = 20 ชิ้น"),
        "measurement": ("ริบบิ้น", 120, 35, 85, "เซนติเมตร", "120 - 35 = 85 เซนติเมตร"),
        "compare": ("ลูกแก้ว", 18, 24, 24, "ลูก", "24 > 18"),
        "counting": ("ดาวกระดาษ", 10, 5, 15, "ดวง", "10 + 5 = 15 ดวง"),
        "subtraction": ("บัตรสะสม", 42, 18, 24, "ใบ", "42 - 18 = 24 ใบ"),
        "addition": ("หนังสือนิทาน", 18, 7, 25, "เล่ม", "18 + 7 = 25 เล่ม"),
    }
    item, a, b, ans, unit, expression = contexts[kind]
    if kind == "fraction":
        story = (
            f"วันนี้ครูให้นักเรียนช่วยแบ่ง{item}หนึ่งถาดในกิจกรรมคณิตศาสตร์ ถาดนี้ถูกตัดเป็น {b} ส่วนเท่า ๆ กัน "
            f"น้องมะลิได้รับ {a} ส่วนจากทั้งหมด เพื่อน ๆ ในกลุ่มต้องช่วยกันอธิบายว่าส่วนที่น้องมะลิได้รับเขียนเป็นเศษส่วนได้อย่างไร "
            f"ทุกคนสังเกตว่าหนึ่งถาดคือหนึ่งหน่วยเต็ม และเมื่อแบ่งเท่า ๆ กันแล้ว แต่ละชิ้นมีขนาดเท่ากัน จึงใช้เศษส่วนบอกจำนวนส่วนที่เลือกจากทั้งหมด"
        )
        think = f"ข้อมูลสำคัญคือมีของเต็ม 1 ถาด แบ่งเป็น {b} ส่วนเท่า ๆ กัน และเลือก {a} ส่วน เศษคือจำนวนส่วนที่เลือก ส่วนคือจำนวนส่วนทั้งหมด จึงใช้เศษส่วน {a}/{b}"
        model = {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": f"วาดถาด{item}เป็น {b} ส่วนเท่า ๆ กัน แล้วระบาย {a} ส่วน", "model_type": "fraction_visual", "numerator": a, "denominator": b, "total": b, "symbol": "□", "unit": unit}
        practice = {"type": "mini_quiz", "title": "ลองทำดู", "question": "แตงโม 1 ลูกแบ่งเป็น 6 ชิ้นเท่า ๆ กัน น้องหยิบ 2 ชิ้น เขียนเป็นเศษส่วนได้เท่าไร", "choices": ["1/6", "2/6", "4/6", "6/2"], "correct_answer": "2/6", "answer": "2/6", "explanation": "หยิบ 2 ชิ้นจากทั้งหมด 6 ชิ้น จึงเป็น 2/6"}
        number = {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": f"{a}/{b}", "content": f"เลือก {a} ส่วนจากทั้งหมด {b} ส่วน"}
    elif kind == "multi_step":
        story = (
            f"ร้านของห้องเรียนขาย{item}แก้วละ {a} บาท ได้ทั้งหมด {b} แก้ว แต่มีต้นทุนแก้วละ 6 บาท "
            f"หัวหน้ากลุ่มต้องหากำไรทั้งหมดเพื่อนำเงินไปซื้ออุปกรณ์เพิ่ม โจทย์นี้ต้องคิดมากกว่าหนึ่งขั้นตอน "
            f"เริ่มจากหายอดขายทั้งหมดก่อน จากนั้นหาต้นทุนทั้งหมด แล้วนำยอดขายลบด้วยต้นทุน นักเรียนจึงจะรู้ว่ากลุ่มได้กำไรจริงเท่าไร"
            f" ถ้ารีบเอาตัวเลขมาบวกหรือลบกันทันทีอาจตอบผิดได้ เพราะ {a} บาทคือราคาขายต่อแก้ว ส่วน 6 บาทคือต้นทุนต่อแก้ว และ {b} แก้วคือจำนวนที่ขายได้ทั้งหมด"
        )
        think = f"ขั้นที่ 1 หายอดขาย {a} × {b} = {a*b} บาท ขั้นที่ 2 หาต้นทุน 6 × {b} = {6*b} บาท ขั้นที่ 3 นำมาลบกัน ได้กำไร {ans} บาท"
        model = {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "แผนภาพแยกยอดขาย ต้นทุน และกำไร", "model_type": "bar_model", "groups": [{"label": "ยอดขาย", "value": a*b}, {"label": "ต้นทุน", "value": 6*b}, {"label": "กำไร", "value": ans}], "unit": unit}
        practice = {"type": "mini_quiz", "title": "ลองทำดู", "question": "ขายขนม 5 ชิ้น ชิ้นละ 10 บาท ต้นทุนชิ้นละ 4 บาท ได้กำไรเท่าไร", "choices": ["20 บาท", "25 บาท", "30 บาท", "50 บาท"], "correct_answer": "30 บาท", "answer": "30 บาท", "explanation": "ยอดขาย 5×10=50 ต้นทุน 5×4=20 กำไร 50-20=30 บาท"}
        number = {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": expression, "content": "ทำทีละขั้นตอนแล้วรวมเป็นประโยคเดียว"}
    else:
        story = (
            f"น้องต้นช่วยครูจัดกิจกรรมเรื่อง{title}โดยใช้{item}เป็นตัวอย่าง ครูให้ข้อมูลสำคัญสองจำนวนคือ {a} และ {b} "
            f"นักเรียนต้องอ่านโจทย์ให้ครบก่อนเลือกวิธีคิด เพราะคำถามต้องการหาคำตอบที่สัมพันธ์กับสถานการณ์จริง "
            f"เมื่อทุกคนช่วยกันจัดข้อมูลเป็นภาพ จะเห็นว่าจำนวนที่ให้มาสามารถนำมาเขียนเป็นประโยคคณิตศาสตร์ได้อย่างชัดเจน และตรวจคำตอบได้จากหน่วยของโจทย์"
        )
        think = f"ข้อมูลสำคัญคือ {a} และ {b} หน่วยของโจทย์คือ{unit} ต้องเลือกวิธีคิดที่เข้ากับเรื่อง {title} แล้วตรวจว่าคำตอบคือ {ans} {unit}"
        model_type = "area_model" if kind in {"area", "geometry"} else "array_model"
        model = {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": f"จัดข้อมูลจากเรื่องเป็นภาพ {a} กับ {b} เพื่อเห็นความสัมพันธ์", "model_type": model_type, "rows": int(b) if isinstance(b, int) and b <= 10 else 4, "cols": int(a) if isinstance(a, int) and a <= 10 else 6, "total": ans if isinstance(ans, int) else None, "unit": unit, "symbol": "■"}
        practice = {"type": "mini_quiz", "title": "ลองทำดู", "question": f"ถ้าเปลี่ยนจำนวนเป็น 5 และ 6 ในเรื่องเดียวกับ {title} คำตอบที่เหมาะสมคือข้อใด", "choices": ["11", "24", "30", "36"], "correct_answer": "30", "answer": "30", "explanation": "ใช้วิธีเดียวกัน 5 × 6 = 30"}
        number = {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": expression, "content": "เขียนตัวเลขและเครื่องหมายให้ตรงกับสถานการณ์"}
    return {
        "variant_id": f"{base_id}_{variant_num:02d}",
        "status": "approved",
        "title": f"{title} แบบที่ {variant_num}",
        "story": story,
        "think_story": think,
        "model_diagram": model,
        "number_sentence": number,
        "practice": practice,
        "helper_tip": f"อ่านเรื่องให้จบก่อน แล้ววงตัวเลขที่สำคัญในบทเรียน {title}",
        "visual_blocks": [
            {"type": "story_intro", "title": "เรื่องราว", "content": story},
            {"type": "think_story", "title": "เรื่องราวชวนคิด", "content": think},
            model,
            number,
            practice,
        ],
    }


def ep_variant(base_id: str, title: str, variant_num: int) -> dict[str, Any]:
    kind = topic_kind(base_id)
    if kind == "fraction":
        story = (
            "Mali has one small cake for her study group. The cake is cut into 4 equal pieces. "
            "Mali takes 1 piece and leaves the rest for her friends. The whole cake is one whole. "
            "Because the pieces are equal, we can use a fraction to show Mali's part. "
            "The top number tells how many pieces she takes. The bottom number tells how many equal pieces are in the whole cake. "
            "Before writing the answer, Mali checks that every piece is the same size. This is important because fractions only work when the whole is split into equal parts. She says the story in her own words, points to the shaded piece, and writes the fraction carefully."
        )
        think = "The key facts are 1 whole cake, 4 equal pieces, and 1 piece taken. The fraction is 1/4."
        model = {"type": "model_diagram", "title": "Use a Model", "description": "Draw one cake split into 4 equal parts and shade 1 part.", "model_type": "fraction_visual", "numerator": 1, "denominator": 4, "total": 4, "symbol": "□", "unit": "part"}
        number = {"type": "number_sentence", "title": "Number Sentence", "expression": "1/4", "content": "1 part out of 4 equal parts"}
        practice = {"type": "mini_quiz", "title": "Try It", "question": "A watermelon is cut into 6 equal pieces. Ben takes 2 pieces. What fraction shows Ben's pieces?", "choices": ["1/6", "2/6", "4/6", "6/2"], "correct_answer": "2/6", "answer": "2/6", "explanation": "Ben takes 2 pieces out of 6 equal pieces, so the fraction is 2/6."}
    elif kind == "decimal":
        story = (
            "Nina buys a notebook for 23.75 baht. She pays with a 50 baht banknote. "
            "The shopkeeper needs to find the change. Money amounts can have decimal points, so Nina lines up the decimal points before subtracting. "
            "She thinks of 50 baht as 50.00 baht. Then she subtracts the price from the money paid. "
            "Nina checks each place value: baht, tenths, and hundredths. She does not move the decimal point. She writes the numbers in a neat column, subtracts from right to left, and reads the answer as the amount of change she should receive."
        )
        think = "The key facts are 50.00 baht paid and 23.75 baht price. Use subtraction to find the change."
        model = {"type": "model_diagram", "title": "Use a Model", "description": "50 baht is split into 23.75 baht price and 26.25 baht change.", "model_type": "bar_model", "groups": [{"label": "price", "value": 23.75}, {"label": "change", "value": 26.25}], "unit": "baht"}
        number = {"type": "number_sentence", "title": "Number Sentence", "expression": "50.00 - 23.75 = 26.25 baht", "content": "Line up decimal points and subtract."}
        practice = {"type": "mini_quiz", "title": "Try It", "question": "You pay 100 baht for a ruler that costs 35.50 baht. How much change do you get?", "choices": ["54.50 baht", "64.50 baht", "65.50 baht", "75.50 baht"], "correct_answer": "64.50 baht", "answer": "64.50 baht", "explanation": "100.00 - 35.50 = 64.50 baht."}
    elif kind == "multi_step":
        story = (
            "Ton's class sells fruit juice at the school fair. One cup sells for 15 baht, and the class sells 8 cups. "
            "Each cup costs 6 baht to make because the class must buy fruit, ice, and cups. Ton wants to know the profit. "
            "This is a multi-step problem, so he cannot use only one quick operation. First, he finds the total sales. "
            "Second, he finds the total cost. Third, he subtracts the cost from the sales. This organized plan helps him avoid mixing up price, cost, and profit."
        )
        think = "The key facts are 15 baht per cup, 8 cups sold, and 6 baht cost per cup. Find sales, find cost, then subtract to get profit."
        model = {"type": "model_diagram", "title": "Use a Model", "description": "Show sales, cost, and profit as connected bars.", "model_type": "bar_model", "groups": [{"label": "sales", "value": 120}, {"label": "cost", "value": 48}, {"label": "profit", "value": 72}], "unit": "baht"}
        number = {"type": "number_sentence", "title": "Number Sentence", "expression": "(15 × 8) - (6 × 8) = 72 baht", "content": "Solve sales first, cost second, then subtract."}
        practice = {"type": "mini_quiz", "title": "Try It", "question": "A class sells 5 snacks for 10 baht each. Each snack costs 4 baht to make. What is the profit?", "choices": ["20 baht", "25 baht", "30 baht", "50 baht"], "correct_answer": "30 baht", "answer": "30 baht", "explanation": "Sales are 5 × 10 = 50 baht. Cost is 5 × 4 = 20 baht. Profit is 30 baht."}
    else:
        story = (
            f"Ton is learning {title} with objects from class. The teacher gives two important numbers: 6 and 5. "
            "Ton reads the problem slowly and decides which operation matches the story. "
            "Then he draws a simple model so he can see the numbers clearly. "
            "The model helps him write a number sentence and check that the answer uses the correct unit. "
            "He does not guess from the numbers alone. He asks, what does each number mean, and what is the question asking? After that, he connects the picture to the number sentence. This habit helps him solve a new problem with different numbers later."
        )
        think = f"The key numbers are 6 and 5. Choose the operation that matches {title}. Use the model to get 30."
        model = {"type": "model_diagram", "title": "Use a Model", "description": "Show 5 rows and 6 columns. Count all boxes.", "model_type": "area_model", "rows": 5, "cols": 6, "total": 30, "unit": "items", "symbol": "■"}
        number = {"type": "number_sentence", "title": "Number Sentence", "expression": "5 × 6 = 30", "content": "Multiply rows by columns."}
        practice = {"type": "mini_quiz", "title": "Try It", "question": "A small garden has 4 rows and 7 columns of tiles. How many tiles are there in all?", "choices": ["11", "24", "28", "32"], "correct_answer": "28", "answer": "28", "explanation": "4 × 7 = 28 tiles."}
    return {
        "variant_id": f"{base_id}_ep_{variant_num:02d}",
        "status": "approved",
        "title": f"{title} Variant {variant_num}",
        "story": story,
        "think_story": think,
        "model_diagram": model,
        "number_sentence": number,
        "practice": practice,
        "helper_tip": f"Read the story first. Circle the important numbers for {title}.",
        "visual_blocks": [
            {"type": "story_intro", "title": "Story", "content": story},
            {"type": "think_story", "title": "Think About It", "content": think},
            model,
            number,
            practice,
        ],
    }


def test_rows(lesson_id: str, base_id: str, grade: int, language: str, title: str) -> list[dict[str, Any]]:
    rows = []
    kind = topic_kind(base_id)
    for i in range(1, 11):
        if language == "TH":
            if kind == "fraction":
                question = f"น้องฟ้าแบ่งเค้ก 1 ก้อนเป็น {i+3} ส่วนเท่า ๆ กัน แล้วหยิบ {min(2, i+2)} ส่วนให้เพื่อน เศษส่วนที่แสดงส่วนที่หยิบคือข้อใด"
                answer = f"{min(2, i+2)}/{i+3}"
                choices = [f"1/{i+3}", answer, f"{i+3}/{min(2, i+2)}", f"{i+2}/{i+4}"]
                explanation = f"หยิบ {min(2, i+2)} ส่วนจากทั้งหมด {i+3} ส่วน จึงเป็น {answer}"
            elif kind == "decimal":
                price = 20 + i + 0.75
                paid = 50
                answer_value = paid - price
                question = f"น้องต้นซื้ออุปกรณ์ราคา {price:.2f} บาท และจ่ายเงิน {paid:.2f} บาท ต้องได้รับเงินทอนกี่บาท"
                answer = f"{answer_value:.2f} บาท"
                choices = [f"{answer_value-1:.2f} บาท", answer, f"{answer_value+1:.2f} บาท", f"{answer_value+2:.2f} บาท"]
                explanation = f"เงินทอน = เงินที่จ่าย - ราคา = {paid:.2f} - {price:.2f} = {answer}"
            elif kind == "multi_step":
                price = 12 + i
                cost = 5 + (i % 3)
                count = i + 4
                answer_value = (price * count) - (cost * count)
                question = f"น้องต้นขายน้ำผลไม้แก้วละ {price} บาท ได้ทั้งหมด {count} แก้ว แต่มีต้นทุนแก้วละ {cost} บาท ถ้าต้องหากำไรทั้งหมด ต้องหายอดขายและต้นทุนก่อน แล้วจึงลบกัน กำไรทั้งหมดเป็นเท่าไร"
                answer = f"{answer_value} บาท"
                choices = [f"{price + cost} บาท", f"{price * count} บาท", answer, f"{answer_value + count} บาท"]
                explanation = f"ยอดขาย {price} × {count} = {price * count} บาท ต้นทุน {cost} × {count} = {cost * count} บาท กำไร = {price * count} - {cost * count} = {answer_value} บาท"
            else:
                a, b = i + 4, i + 2
                answer_value = a * b
                question = f"ครูให้นักเรียนจัดแผ่นภาพเรื่อง {title} เป็น {b} แถว แถวละ {a} ชิ้น ถ้าต้องนับจำนวนทั้งหมด ควรคำนวณอย่างไร"
                answer = str(answer_value)
                choices = [str(a + b), str(answer_value - 2), answer, str(answer_value + 4)]
                explanation = f"ใช้การคูณ {b} × {a} = {answer_value}"
            question_text = question
            explanation_key = "explanation_th"
        else:
            if kind == "fraction":
                denom = i + 3
                answer = f"2/{denom}"
                question_text = f"Mali cuts one cake into {denom} equal pieces. She gives 2 pieces to her friends. What fraction shows the pieces she gives away?"
                choices = [f"1/{denom}", answer, f"{denom}/2", f"3/{denom}"]
                explanation = f"She gives 2 pieces out of {denom} equal pieces, so the fraction is {answer}."
            elif kind == "decimal":
                price = 20 + i + 0.75
                answer_value = 50 - price
                answer = f"{answer_value:.2f} baht"
                question_text = f"Nina buys school supplies for {price:.2f} baht. She pays 50.00 baht. How much change should she get?"
                choices = [f"{answer_value-1:.2f} baht", answer, f"{answer_value+1:.2f} baht", f"{answer_value+2:.2f} baht"]
                explanation = f"Change = 50.00 - {price:.2f} = {answer}."
            elif kind == "multi_step":
                price = 12 + i
                cost = 5 + (i % 3)
                count = i + 4
                answer_value = (price * count) - (cost * count)
                answer = f"{answer_value} baht"
                question_text = f"Ton sells fruit juice for {price} baht per cup. He sells {count} cups. Each cup costs {cost} baht to make. First find the total sales, then find the total cost, and subtract to find the profit. What is the profit?"
                choices = [f"{price + cost} baht", f"{price * count} baht", answer, f"{answer_value + count} baht"]
                explanation = f"Sales are {price} × {count} = {price * count} baht. Cost is {cost} × {count} = {cost * count} baht. Profit is {answer_value} baht."
            else:
                a, b = i + 4, i + 2
                answer_value = a * b
                answer = str(answer_value)
                question_text = f"Ton arranges picture cards for {title}. There are {b} rows with {a} cards in each row. How many cards are there in all?"
                choices = [str(a + b), str(answer_value - 2), answer, str(answer_value + 4)]
                explanation = f"Multiply rows by cards in each row: {b} × {a} = {answer_value}."
            explanation_key = "explanation_en"
        rows.append(
            {
                "question_id": f"{lesson_id}_q{i:03d}",
                "grade_level": grade,
                "lesson_id": lesson_id,
                "topic_code": base_id,
                "skill_code": lesson_id,
                "question_type": "challenge" if i in {5, 10} else "core",
                "routine_level": "non_routine" if i in {5, 10} else "routine",
                "difficulty": "medium" if i in {4, 5, 9, 10} else "easy",
                "confidence_role": "stretch_thinking" if i in {5, 10} else "build_confidence",
                "question_text_th": question_text if language == "TH" else "",
                "question_text_en": question_text if language == "EP" else "",
                "choices": choices,
                "correct_answer": answer,
                explanation_key: explanation,
                "explanation_th": explanation if language == "TH" else "",
                "explanation_en": explanation if language == "EP" else "",
            }
        )
    return rows


def repair_lesson(path: Path) -> tuple[bool, str]:
    payload = read_json(path)
    if not payload:
        return False, "invalid_json"
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or path.stem)
    base_id = base_lesson_id(lesson_id)
    grade = int(payload.get("grade_level") or path.parent.parent.name.split("_")[-1])
    language = language_for(path, payload)
    title = thai_title_from_id(base_id, str(payload.get("title_th") or "")) if language == "TH" else english_title_from_id(base_id, str(payload.get("title_en") or ""))
    variants = [th_variant(base_id, title, 1)] if language == "TH" else [ep_variant(base_id, title, 1)]
    payload.update(
        {
            "lesson_id": lesson_id,
            "id": lesson_id,
            "base_lesson_id": base_id,
            "content_schema_version": "topa_story_variant_v1",
            "program": language,
            "language": "th" if language == "TH" else "ep",
            "program_type": "EP" if language == "EP" else "THP",
            "grade_level": grade,
            "lesson_title": title,
            "title_th": title if language == "TH" else "",
            "title_en": title if language == "EP" else english_title_from_id(base_id, ""),
            "topic": topic_kind(base_id),
            "topic_code": base_id,
            "skill_code": lesson_id,
            "icon": icon_for(topic_kind(base_id)),
            "status": "approved",
            "has_test": True,
            "story_variants": variants,
            "lesson_variants": [
                {
                    "variant_id": variant["variant_id"],
                    "variant_title_th": variant["title"],
                    "variant_title_en": variant["title"],
                    "story_theme_th": variant["story"],
                    "story_theme_en": variant["story"],
                    "helper_tip": variant["helper_tip"],
                    "visual_blocks": variant["visual_blocks"],
                }
                for variant in variants
            ],
            "visual_blocks": variants[0]["visual_blocks"],
            "helper_tip": variants[0]["helper_tip"],
        }
    )
    if language == "TH":
        payload["objective_th"] = f"เข้าใจเรื่อง{title}จากสถานการณ์จริง ใช้แผนภาพและประโยควิธีทำได้ถูกต้อง"
        payload["objective_en"] = ""
    else:
        payload["objective_en"] = f"Learn {title} with a story, a model, a number sentence, and practice."
        payload["objective_th"] = ""
        payload["story_intro_th"] = ""
        payload["thai_support"] = ""
    write_json(path, payload)
    rows = test_rows(lesson_id, base_id, grade, language, title)
    write_jsonl(CONTENT_ROOT / "question_banks" / f"grade_{grade}" / f"{lesson_id}.jsonl", rows)
    quiz_path = CONTENT_ROOT / f"grade_{grade}" / "quizzes" / f"{lesson_id}.json"
    write_json(quiz_path, {"lesson_id": lesson_id, "grade_level": grade, "program": language, "questions": rows})
    return True, language


def icon_for(kind: str) -> str:
    return {
        "fraction": "fraction",
        "decimal": "coins",
        "area": "grid",
        "division": "divide",
        "multiplication": "times",
        "multi_step": "steps",
        "geometry": "shapes",
        "ratio": "ratio",
        "equation": "equation",
        "percent": "percent",
        "graph": "chart",
        "measurement": "ruler",
    }.get(kind, "book")


def main() -> None:
    summary = {"repaired_th": 0, "repaired_ep": 0, "failed": [], "backup_root": str(BACKUP_ROOT)}
    for path in lesson_files():
        ok, result = repair_lesson(path)
        if not ok:
            summary["failed"].append({"path": str(path), "reason": result})
        elif result == "EP":
            summary["repaired_ep"] += 1
        else:
            summary["repaired_th"] += 1
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
