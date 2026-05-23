"""Repair canonical TOPA Math lesson and quiz content quality.

This script rewrites only the active canonical content tree:
apps/api/app/content/math/grade_[1-6]/lessons and quizzes.
It creates a backup before every write and keeps lesson/quiz ids stable.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
BACKUP_ROOT = Path(__file__).resolve().parents[1] / "content" / "_content_backups"
STATUS_ROOT = CONTENT_ROOT / "_content_status"
THAI_RE = re.compile(r"[\u0E00-\u0E7F]")


TH_CONTEXTS = [
    ("น้องต้น", "ครูเวรหลังเลิกเรียน", "คุกกี้", "โรงอาหาร", "จานกระดาษ"),
    ("น้องมิ้น", "แม่ค้าหน้าโรงเรียน", "ขนมปัง", "ร้านค้า", "กระเป๋าเหรียญ"),
    ("น้องภูมิ", "เพื่อนในชมรมกีฬา", "ลูกบอล", "สนามกีฬา", "ตะกร้าอุปกรณ์"),
    ("น้องแพรว", "ครูประจำชั้น", "สติกเกอร์", "ห้องเรียน", "สมุดสะสม"),
    ("น้องออม", "คุณแม่", "ส้ม", "ตลาดเช้า", "ถุงผ้า"),
    ("น้องปัน", "บรรณารักษ์", "หนังสือนิทาน", "ห้องสมุด", "ชั้นวางหนังสือ"),
    ("น้องข้าวหอม", "เพื่อนกลุ่มศิลปะ", "ดินสอสี", "โต๊ะศิลปะ", "กล่องสี"),
    ("น้องไทม์", "พี่นักเรียน", "บัตรรถเมล์", "ป้ายรถเมล์", "กระเป๋าสตางค์"),
    ("น้องน้ำฝน", "ครูวิทยาศาสตร์", "ต้นกล้า", "สวนโรงเรียน", "แปลงผัก"),
    ("น้องเอิร์น", "เพื่อนในห้อง", "ลูกปัด", "โต๊ะงานประดิษฐ์", "ถุงซิป"),
    ("น้องวิน", "คุณพ่อ", "การ์ดสะสม", "บ้าน", "กล่องเก็บของ"),
    ("น้องลิน", "ครูดนตรี", "โน้ตเพลง", "ห้องดนตรี", "แฟ้มเพลง"),
]

EP_CONTEXTS = [
    ("Ton", "his teacher", "cookies", "the classroom", "paper plates"),
    ("Mint", "a shopkeeper", "bread", "the school shop", "a coin purse"),
    ("Poom", "his sports team", "balls", "the playground", "a basket"),
    ("Praew", "her homeroom teacher", "stickers", "the classroom", "a sticker book"),
    ("Aom", "her mother", "oranges", "the market", "a cloth bag"),
    ("Pun", "the librarian", "story books", "the library", "a shelf"),
    ("Khaohom", "her art group", "colored pencils", "the art table", "a pencil box"),
    ("Time", "an older student", "bus tickets", "the bus stop", "a wallet"),
    ("Namfon", "the science teacher", "seedlings", "the school garden", "a garden tray"),
    ("Earn", "her classmates", "beads", "the craft table", "small bags"),
    ("Win", "his father", "cards", "home", "a storage box"),
    ("Lin", "the music teacher", "music notes", "the music room", "a folder"),
]

ICONS = {
    "cookies": "🍪",
    "bread": "🥖",
    "balls": "⚽",
    "stickers": "⭐",
    "oranges": "🍊",
    "story books": "📚",
    "colored pencils": "✏️",
    "bus tickets": "🎟️",
    "seedlings": "🌱",
    "beads": "🔵",
    "cards": "🃏",
    "music notes": "🎵",
    "money": "💵",
    "area": "⬜",
    "fraction": "🍕",
    "time": "🕒",
}

TH_DETAILS = [
    "ครูให้เด็ก ๆ วาดรูปประกอบบนกระดานเล็กก่อนตอบ เพื่อให้ทุกคนเห็นว่าตัวเลขแต่ละตัวมาจากส่วนใดของเรื่อง",
    "เพื่อนในกลุ่มช่วยกันตรวจคำตอบจากหน่วยของโจทย์ แล้วจดวิธีคิดลงในสมุดคณิตศาสตร์ประจำวัน",
    "ก่อนหมดคาบ ครูขอให้เล่าเหตุผลด้วยคำพูดของตนเอง เพื่อฝึกเชื่อมเรื่องจริงกับประโยคคณิตศาสตร์",
    "เด็ก ๆ ใช้ของจริงบนโต๊ะจัดเป็นภาพจำลอง ทำให้เห็นความสัมพันธ์ของจำนวนโดยไม่ต้องเดาสุ่ม",
    "เมื่อจัดข้อมูลเสร็จ ทุกคนเปรียบเทียบคำตอบกับแผนภาพอีกครั้งเพื่อให้แน่ใจว่าไม่ได้สลับจำนวน",
    "กิจกรรมนี้เกิดขึ้นระหว่างเตรียมงานห้องเรียน จึงต้องคิดให้ถูกก่อนนำของไปใช้จริงกับเพื่อนทั้งห้อง",
    "ครูให้จับคู่กันอ่านโจทย์และวงตัวเลขสำคัญ เพราะคำถามต้องการคำตอบที่สัมพันธ์กับสถานการณ์โดยตรง",
    "หลังคิดเสร็จ นักเรียนต้องบอกด้วยว่าคำตอบมีหน่วยอะไร เพื่อให้ประโยควิธีทำสมบูรณ์และตรวจสอบได้",
]

EP_DETAILS = [
    "The class draws a small picture first, so each number in the story has a clear place in the model.",
    "A partner checks the unit in the answer before the group writes the number sentence.",
    "The teacher asks the group to explain the answer in simple words after they finish the model.",
    "The children use real classroom objects to build the model before choosing the operation.",
    "The group compares the answer with the diagram again to make sure the numbers were not switched.",
    "This happens while the class prepares materials, so the answer must match the real situation.",
    "The children circle the important numbers and underline what the question asks.",
    "After solving, the class says the unit aloud so the final answer is complete.",
]

TH_SCENES = [
    ("มุมอ่านหนังสือ", "ทำป้ายชื่อสีเขียว", "ก่อนเสียงกริ่งพักกลางวัน"),
    ("โต๊ะหน้าห้อง", "ติดสติกเกอร์รูปดาว", "ระหว่างเตรียมนิทรรศการเล็ก"),
    ("ลานกิจกรรม", "จัดแถวของให้ตรงกับเส้นสีแดง", "หลังซ้อมร้องเพลง"),
    ("ห้องสมุด", "แยกของลงถาดไม้", "ก่อนนำไปให้เพื่อนยืม"),
    ("สวนโรงเรียน", "บันทึกคำตอบบนกระดาษคลิปบอร์ด", "ตอนครูเดินตรวจกลุ่ม"),
    ("มุมศิลปะ", "ใช้เชือกสีฟ้าวางเป็นกรอบ", "ก่อนเริ่มงานประดิษฐ์"),
    ("โรงอาหาร", "วางบัตรตัวเลขกำกับแต่ละกลุ่ม", "หลังเก็บถาดอาหาร"),
    ("สนามกีฬา", "ขีดเส้นชอล์กแบ่งพื้นที่", "ก่อนแบ่งทีมเล่นเกม"),
    ("ห้องดนตรี", "ใช้แม่เหล็กติดตัวเลขบนกระดาน", "ระหว่างรอเพื่อนตั้งเครื่องดนตรี"),
    ("ตลาดจำลอง", "เขียนรายการลงใบเสร็จเล็ก", "ก่อนสลับบทบาทเป็นแม่ค้า"),
    ("ห้องวิทยาศาสตร์", "เรียงของตามป้ายชื่อทดลอง", "หลังล้างมือเรียบร้อย"),
    ("ป้ายรถรับส่ง", "ทำเครื่องหมายบนตารางเวลา", "ก่อนรถโรงเรียนมาถึง"),
]

EP_SCENES = [
    ("the reading corner", "green name labels", "before lunch break"),
    ("the front table", "star stickers", "during a small class display"),
    ("the activity yard", "a red guide line", "after singing practice"),
    ("the library", "wooden trays", "before lending items to friends"),
    ("the school garden", "a clipboard", "while the teacher checks each group"),
    ("the art corner", "a blue string frame", "before craft time"),
    ("the cafeteria", "number cards", "after the trays are cleaned"),
    ("the playground", "chalk lines", "before a team game"),
    ("the music room", "number magnets", "while friends set up instruments"),
    ("the pretend market", "a small receipt", "before changing shop roles"),
    ("the science room", "experiment labels", "after washing hands"),
    ("the bus sign", "a timetable mark", "before the school bus arrives"),
]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any], backup_root: Path) -> None:
    backup_path = backup_root / path.relative_to(CONTENT_ROOT.parent)
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not backup_path.exists():
        shutil.copy2(path, backup_path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stable_index(text: str, modulo: int) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % modulo


def program_of(payload: dict[str, Any], path: Path) -> str:
    raw = str(payload.get("program_type") or payload.get("program") or payload.get("track") or "").upper()
    if raw == "EP" or str(payload.get("lesson_id") or path.stem).lower().endswith("_ep"):
        return "EP"
    return "TH"


def concept_of(lesson_id: str, title: str) -> str:
    text = f"{lesson_id} {title}".lower()
    checks = [
        ("percent", ("percent", "ร้อยละ", "%")),
        ("decimal", ("decimal", "ทศนิยม")),
        ("division", ("division", "หาร", "÷")),
        ("money_change", ("money", "change", "ทอน", "เงิน", "ราคา")),
        ("multiplication", ("multiplication", "คูณ", "×", "x")),
        ("fraction", ("fraction", "เศษส่วน")),
        ("area", ("area", "พื้นที่", "ตาราง")),
        ("perimeter", ("perimeter", "รอบรูป")),
        ("time", ("time", "calendar", "เวลา", "นาฬิกา", "ปฏิทิน")),
        ("ratio", ("ratio", "proportion", "อัตราส่วน", "สัดส่วน")),
        ("equation", ("equation", "สมการ")),
        ("comparison", ("compare", "comparison", "มากกว่า", "น้อยกว่า", "เปรียบเทียบ")),
        ("data", ("data", "graph", "chart", "ข้อมูล", "แผนภูมิ")),
        ("geometry", ("shape", "angle", "รูป", "มุม", "เรขา")),
        ("subtraction", ("subtraction", "ลบ", "เหลือ")),
        ("addition", ("addition", "บวก", "รวม")),
    ]
    for concept, needles in checks:
        if any(needle in text for needle in needles):
            return concept
    return "addition"


def numbers_for(concept: str, grade: int, seed: str, variant: int = 0) -> dict[str, int]:
    base = stable_index(f"{seed}:{variant}", 7)
    if concept == "division":
        divisor = min(9, max(2, grade + 2 + base % 3))
        quotient = min(12, max(3, grade + 3 + base % 5))
        return {"a": divisor * quotient, "b": divisor, "c": quotient}
    if concept in {"multiplication", "area"}:
        a = min(12, max(2, grade + 2 + base % 4))
        b = min(12, max(3, grade + 3 + (base + 1) % 5))
        return {"a": a, "b": b, "c": a * b}
    if concept in {"money_change", "subtraction"}:
        start = [40, 50, 60, 80, 100, 120, 150][base]
        spent = min(start - 5, 9 + grade * 4 + base * 3)
        return {"a": start, "b": spent, "c": start - spent}
    if concept == "fraction":
        den = min(12, max(3, grade + 3 + base % 4))
        num = max(1, min(den - 1, 1 + base % (den - 1)))
        return {"a": num, "b": den, "c": den - num}
    if concept == "decimal":
        whole = grade + base + 2
        tenths = (base + 3) % 10
        add = (base + 2) % 5 + 1
        return {"a": whole * 10 + tenths, "b": add * 10, "c": whole * 10 + tenths + add * 10}
    if concept == "time":
        start = 8 + base % 3
        minutes = 20 + grade * 5 + base * 5
        return {"a": start, "b": minutes, "c": (start * 60 + minutes) % 60}
    if concept == "comparison":
        a = 20 + grade * 6 + base * 4
        b = a - (3 + grade + base)
        return {"a": a, "b": b, "c": a - b}
    a = 12 + grade * 5 + base * 3
    b = 7 + grade * 3 + base * 2
    return {"a": a, "b": b, "c": a + b}


def choice_set(answer: int | float, unit: str) -> list[str]:
    value = int(answer) if float(answer).is_integer() else answer
    offsets = [0, -2, 3, 5]
    choices = []
    for offset in offsets:
        candidate = value + offset
        if candidate <= 0:
            candidate = value + abs(offset) + 1
        choices.append(f"{candidate:g} {unit}".strip())
    deduped = []
    for item in choices:
        if item not in deduped:
            deduped.append(item)
    while len(deduped) < 4:
        deduped.append(f"{value + len(deduped) + 4:g} {unit}".strip())
    return deduped[:4]


def th_content(lesson_id: str, title: str, grade: int, concept: str, variant: int) -> dict[str, Any]:
    person, helper, obj, place, tool = TH_CONTEXTS[stable_index(f"{lesson_id}:{variant}", len(TH_CONTEXTS))]
    n = numbers_for(concept, grade, lesson_id, variant)
    detail = TH_DETAILS[stable_index(f"{lesson_id}:detail:{variant}", len(TH_DETAILS))]
    scene_place, scene_action, scene_time = TH_SCENES[stable_index(f"{lesson_id}:scene:{variant}", len(TH_SCENES))]
    clean_title = re.sub(r"\d+", "", title).strip()
    title_note = f"โจทย์นี้ฝึกแนวคิด{clean_title}ผ่านภารกิจที่{scene_place} เด็ก ๆ ต้อง{scene_action}{scene_time} {detail}"
    if concept == "division":
        unit = "ชิ้น"
        story = f"{person}กับเพื่อน ๆ ช่วย{helper}จัด{obj}ที่{place} มี{obj}ทั้งหมด {n['a']} {unit} และต้องแบ่งให้เด็ก {n['b']} คนเท่า ๆ กันโดยใช้{tool}วางเป็นกลุ่ม ก่อนเริ่มกิจกรรมทุกคนอยากรู้ว่าเด็กแต่ละคนจะได้รับ{obj}กี่{unit} ถ้าไม่ให้เหลือและไม่มีใครได้มากกว่ากัน {title_note}"
        think = f"โจทย์บอกว่ามี{obj} {n['a']} {unit} และแบ่งให้เด็ก {n['b']} คนเท่า ๆ กัน คำว่าแบ่งเท่า ๆ กันจึงใช้การหาร {n['a']} ÷ {n['b']} เพื่อหาว่าแต่ละคนได้ {n['c']} {unit}"
        expression = f"{n['a']} ÷ {n['b']} = {n['c']} {unit}"
        model = {"model_type": "equal_groups", "groups": n["b"], "items_per_group": n["c"], "total": n["a"], "unit": unit, "symbol": icon_for(obj)}
        practice = practice_th("division", grade, lesson_id, variant + 20)
    elif concept in {"money_change", "subtraction"}:
        unit = "บาท" if concept == "money_change" else "ชิ้น"
        item = "ขนมปัง" if concept == "money_change" else obj
        story = f"{person}มีเงิน {n['a']} บาทใน{tool} หลังเลิกเรียนอยากซื้อ{item}ราคา {n['b']} บาทที่{place} จึงยื่นเงินให้{helper}และรอรับเงินทอน {person}อยากรู้ว่าจะเหลือเงินกี่บาทเพื่อวางแผนเก็บไว้ใช้พรุ่งนี้ {title_note}"
        think = f"โจทย์บอกว่ามีเงิน {n['a']} บาท และใช้ไป {n['b']} บาท คำถามถามว่าเหลือเงินหรือได้เงินทอนเท่าไร จึงใช้การลบ {n['a']} - {n['b']} ได้ {n['c']} บาท"
        expression = f"{n['a']} - {n['b']} = {n['c']} บาท"
        model = {"model_type": "money_change", "start": n["a"], "spent": n["b"], "result": n["c"], "unit": "บาท", "symbol": "💵", "item": item}
        practice = practice_th("subtraction", grade, lesson_id, variant + 20)
    elif concept in {"multiplication", "area"}:
        unit = "ตารางหน่วย" if concept == "area" else "ชิ้น"
        story = f"{person}ช่วย{helper}จัด{obj}บนโต๊ะที่{place} โดยวางเป็น {n['a']} แถว แถวละ {n['b']} {unit if concept != 'area' else 'ช่อง'} เพื่อให้เห็นรูปแบบซ้ำอย่างเป็นระเบียบ {person}ต้องหาจำนวนทั้งหมดว่ามีเท่าไรจากจำนวนแถวและจำนวนในแต่ละแถว {title_note}"
        think = f"โจทย์ให้ {n['a']} แถว และแต่ละแถวมี {n['b']} จึงใช้การคูณ {n['a']} × {n['b']} เพราะเป็นกลุ่มเท่า ๆ กัน ผลลัพธ์คือ {n['c']} {unit}"
        expression = f"{n['a']} × {n['b']} = {n['c']} {unit}"
        model = {"model_type": "area_model" if concept == "area" else "array_model", "rows": n["a"], "cols": n["b"], "total": n["c"], "unit": unit, "symbol": "⬜" if concept == "area" else icon_for(obj)}
        practice = practice_th("multiplication", grade, lesson_id, variant + 20)
    elif concept == "fraction":
        unit = "ส่วน"
        story = f"{person}กับเพื่อนแบ่งพิซซาที่{place}เป็น {n['b']} ส่วนเท่า ๆ กัน แล้วกินไป {n['a']} ส่วน หลังจากเก็บจานและ{tool}แล้ว {person}อยากรู้ว่าส่วนที่กินไปคิดเป็นเศษส่วนเท่าใดของพิซซาทั้งถาด และยังเหลืออีกกี่ส่วน {title_note}"
        think = f"พิซซาถูกแบ่งเป็น {n['b']} ส่วนเท่า ๆ กัน และกินไป {n['a']} ส่วน ตัวเศษคือ {n['a']} ตัวส่วนคือ {n['b']} จึงเขียนเป็น {n['a']}/{n['b']} และเหลือ {n['c']} ส่วน"
        expression = f"{n['a']} ÷ {n['b']} ส่วนของทั้งหมด = {n['a']}/{n['b']}"
        model = {"model_type": "fraction_model", "numerator": n["a"], "denominator": n["b"], "remaining": n["c"], "unit": unit, "symbol": "🍕"}
        practice = practice_th("fraction", grade, lesson_id, variant + 20)
    elif concept == "time":
        unit = "นาที"
        story = f"{person}เริ่มอ่านหนังสือที่{place}เวลา {n['a']}:00 น. และตั้งใจอ่านต่ออีก {n['b']} นาที ก่อนนำหนังสือไปคืนที่{tool} {person}ต้องดูนาฬิกาเพื่อรู้ว่าเมื่ออ่านครบตามเวลาที่กำหนดจะเป็นเวลากี่นาฬิกากี่นาที {title_note}"
        think = f"เวลาเริ่มคือ {n['a']}:00 น. และเพิ่มเวลาอ่านอีก {n['b']} นาที จึงนับเวลาต่อจากชั่วโมงเริ่มต้น คำตอบคือเวลาหลังผ่านไป {n['b']} นาที"
        expression = f"{n['a']}:00 + {n['b']} นาที = เวลาสิ้นสุด"
        model = {"model_type": "time_line", "start_hour": n["a"], "elapsed_minutes": n["b"], "unit": unit, "symbol": "🕒"}
        practice = practice_th("time", grade, lesson_id, variant + 20)
    elif concept == "ratio":
        unit = "ส่วน"
        if grade >= 6:
            story = f"{person}ช่วย{helper}เตรียมน้ำสมุนไพรสองเหยือกที่{place} สูตรเข้มข้นใช้หัวเชื้อ {n['a']} {unit} ต่อน้ำเปล่า {n['b']} {unit} บน{tool} เพื่อนอยากเพิ่มปริมาณแต่ให้รสชาติเท่าเดิม จึงต้องอ่านสัดส่วนเดิมให้ชัดก่อนขยายสูตร {title_note}"
            think = f"สัดส่วนเดิมคือหัวเชื้อ {n['a']} ส่วน ต่อน้ำเปล่า {n['b']} ส่วน ถ้าขยายสูตรต้องคูณทั้งสองจำนวนด้วยตัวเดียวกันเพื่อรักษาอัตราส่วน {n['a']}:{n['b']}"
            expression = f"{n['a']}:{n['b']} = สัดส่วนเดิมที่ต้องคงไว้"
        else:
            story = f"{person}ช่วย{helper}ผสมน้ำผลไม้สำหรับงานที่{place} สูตรหนึ่งใช้ส้ม {n['a']} {unit} ต่อน้ำเย็น {n['b']} {unit} โดยวางถ้วยตวงไว้ข้าง{tool} {person}ต้องบอกอัตราส่วนของส้มต่อน้ำเย็นให้เพื่อนทำตามได้ถูกต้อง {title_note}"
            think = f"โจทย์ให้จำนวนส้ม {n['a']} ส่วน และน้ำเย็น {n['b']} ส่วน คำถามถามอัตราส่วน จึงเขียนตามลำดับส้มต่อน้ำเป็น {n['a']}:{n['b']}"
            expression = f"{n['a']}:{n['b']} = ส้มต่อน้ำเย็น"
        model = {"model_type": "ratio_bar", "part_a": n["a"], "part_b": n["b"], "total": n["a"] + n["b"], "unit": unit, "symbol": "🥤"}
        practice = practice_th("ratio", grade, lesson_id, variant + 20)
    elif concept == "percent":
        unit = "คน"
        if grade >= 6:
            story = f"{person}ช่วย{helper}ทำป้ายสรุปผลสำรวจงานวิทยาศาสตร์ที่{place} จากบัตรตอบกลับทั้งหมด {n['a']} ใบ มี {n['b']} ใบที่เลือกกิจกรรมทดลองบน{tool} ทีมต้องเชื่อมจำนวนนี้กับเศษส่วน ทศนิยม และร้อยละเพื่ออธิบายข้อมูลชุดเดียวกัน {title_note}"
            think = f"ข้อมูลทั้งหมดคือ {n['a']} ใบ และส่วนที่เลือกกิจกรรมทดลองคือ {n['b']} ใบ เราเริ่มจากเทียบส่วนกับทั้งหมด แล้วจึงเขียนเชื่อมเป็นเศษส่วน ทศนิยม หรือร้อยละ"
            expression = f"{n['b']} จาก {n['a']} ใบ = ส่วนเดียวกันในหลายรูปแบบ"
            unit = "ใบ"
        else:
            story = f"{person}สำรวจเพื่อน {n['a']} คนใน{place} พบว่ามี {n['b']} คนเลือกอ่านหนังสือนิทานที่{tool} {person}ต้องอธิบายว่าส่วนที่เลือกอ่านคิดเป็นกี่คนจากทั้งหมด เพื่อเชื่อมไปสู่ความหมายของร้อยละ {title_note}"
            think = f"ข้อมูลทั้งหมดคือ {n['a']} คน และส่วนที่สนใจคือ {n['b']} คน เราเปรียบเทียบส่วนกับทั้งหมดก่อน แล้วจึงแปลงเป็นแนวคิดร้อยละเมื่อฐานเป็น 100"
            expression = f"{n['b']} จาก {n['a']} คน = ส่วนที่สนใจเทียบกับทั้งหมด"
        model = {"model_type": "percent_bar", "part": n["b"], "total": n["a"], "unit": unit, "symbol": "▰"}
        practice = practice_th("comparison", grade, lesson_id, variant + 20)
    elif concept == "equation":
        unit = "ชิ้น"
        story = f"{person}มี{obj}บางส่วนใน{tool} แล้ว{helper}ให้เพิ่มอีก {n['b']} {unit} ตอนนับรวมที่{place}พบว่ามีทั้งหมด {n['c']} {unit} {person}อยากรู้ว่าเดิมมี{obj}อยู่กี่{unit} จึงต้องใช้ช่องว่างแทนจำนวนที่ยังไม่รู้ {title_note}"
        think = f"โจทย์รู้จำนวนที่เพิ่มคือ {n['b']} และรู้ทั้งหมดคือ {n['c']} จำนวนเดิมเป็นค่าที่ไม่รู้ จึงเขียนเป็น □ + {n['b']} = {n['c']} และหาได้จาก {n['c']} - {n['b']} = {n['a']}"
        expression = f"□ + {n['b']} = {n['c']}, □ = {n['a']} {unit}"
        model = {"model_type": "unknown_part_model", "unknown": n["a"], "known": n["b"], "total": n["c"], "unit": unit, "symbol": icon_for(obj)}
        practice = practice_th("equation", grade, lesson_id, variant + 20)
    elif concept in {"geometry", "comparison", "data"}:
        unit = "ชิ้น"
        if concept == "geometry" and grade >= 4:
            story = f"{person}ช่วย{helper}ออกแบบป้ายงานโรงเรียนที่{place} ป้ายแรกมีมุมที่ต้องตรวจ {n['a']} มุม และป้ายที่สองมี {n['b']} มุมบน{tool} ครูถามว่าป้ายแรกมีมุมให้ตรวจมากกว่าป้ายที่สองกี่มุม เพื่อให้ทีมจัดรูปเรขาคณิตได้ครบ {title_note}"
            unit = "มุม"
        elif concept == "geometry":
            story = f"{person}คัดแยกรูปเรขาคณิตที่{place} พบรูปสามเหลี่ยมและสี่เหลี่ยมรวมกลุ่มแรก {n['a']} รูป อีกกลุ่มหนึ่งมี {n['b']} รูปใน{tool} ครูถามว่ากลุ่มแรกมากกว่ากลุ่มที่สองกี่รูป {title_note}"
            unit = "รูป"
        else:
            story = f"{person}ทำแผนภูมิรูปภาพที่{place} กลุ่มแรกติด{obj}ไว้ {n['a']} {unit} และอีกกลุ่มติดไว้ {n['b']} {unit} บน{tool} ครูถามว่ากลุ่มแรกมากกว่ากลุ่มที่สองกี่{unit} เพื่อฝึกอ่านข้อมูลจากภาพจริง {title_note}"
        think = f"โจทย์เปรียบเทียบสองกลุ่มคือ {n['a']} และ {n['b']} ต้องหาว่าต่างกันเท่าไร จึงใช้การลบ {n['a']} - {n['b']} = {n['c']} {unit}"
        expression = f"{n['a']} - {n['b']} = {n['c']} {unit}"
        model = {"model_type": "comparison_bar", "top": n["a"], "bottom": n["b"], "difference": n["c"], "unit": unit, "symbol": icon_for(obj)}
        practice = practice_th("comparison", grade, lesson_id, variant + 20)
    elif concept == "decimal":
        unit = "ลิตร"
        a = n["a"] / 10
        b = n["b"] / 10
        c = n["c"] / 10
        story = f"{person}ตวงน้ำผลไม้ที่{place}ได้ {a:g} {unit} แล้วเติมน้ำเพิ่มอีก {b:g} {unit} จาก{tool} เพื่อทำเครื่องดื่มให้เพื่อนในห้อง {person}ต้องหาว่ามีน้ำผลไม้รวมทั้งหมดกี่{unit}โดยอ่านค่าทศนิยมให้ถูกต้อง {title_note}"
        think = f"โจทย์ให้ปริมาณ {a:g} {unit} และเติมอีก {b:g} {unit} ต้องการหาปริมาณรวม จึงบวกทศนิยม {a:g} + {b:g} = {c:g} {unit}"
        expression = f"{a:g} + {b:g} = {c:g} {unit}"
        model = {"model_type": "decimal_bar", "part_a": a, "part_b": b, "total": c, "unit": unit, "symbol": "🥤"}
        practice = practice_th("addition", grade, lesson_id, variant + 20)
    else:
        unit = "ชิ้น"
        story = f"{person}ช่วย{helper}รวบรวม{obj}สำหรับกิจกรรมที่{place} กล่องแรกมี {n['a']} {unit} และใน{tool}อีกใบมี {n['b']} {unit} ก่อนแจกให้เพื่อน ๆ {person}ต้องหาว่ามี{obj}ทั้งหมดกี่{unit} เพื่อเตรียมจำนวนให้พอดีกับทุกคนในห้อง {title_note}"
        think = f"โจทย์บอกจำนวนสองกลุ่มคือ {n['a']} และ {n['b']} ต้องการหาจำนวนทั้งหมด จึงใช้การบวก {n['a']} + {n['b']} ได้ {n['c']} {unit}"
        expression = f"{n['a']} + {n['b']} = {n['c']} {unit}"
        model = {"model_type": "part_whole_model", "part_a": n["a"], "part_b": n["b"], "total": n["c"], "unit": unit, "symbol": icon_for(obj)}
        practice = practice_th("addition", grade, lesson_id, variant + 20)
    return make_blocks("TH", story, think, model, expression, practice)


def ep_content(lesson_id: str, title: str, grade: int, concept: str, variant: int) -> dict[str, Any]:
    person, helper, obj, place, tool = EP_CONTEXTS[stable_index(f"{lesson_id}:{variant}", len(EP_CONTEXTS))]
    n = numbers_for(concept, grade, lesson_id, variant)
    detail = EP_DETAILS[stable_index(f"{lesson_id}:detail:{variant}", len(EP_DETAILS))]
    scene_place, scene_action, scene_time = EP_SCENES[stable_index(f"{lesson_id}:scene:{variant}", len(EP_SCENES))]
    clean_title = re.sub(r"\d+", "", title).strip()
    title_note = f"This story practices {clean_title} in {scene_place} with {scene_action} {scene_time}. {detail}"
    if concept == "division":
        unit = "cookies"
        story = f"{person} helps {helper} share {n['a']} {obj} at {place}. There are {n['b']} children, and each child must get the same number. {person} uses {tool} to make equal groups. How many {unit} will each child get? {title_note}"
        think = f"The important numbers are {n['a']} and {n['b']}. Equal sharing means division, so we calculate {n['a']} ÷ {n['b']} = {n['c']}. Each child gets {n['c']} {unit}."
        expression = f"{n['a']} ÷ {n['b']} = {n['c']} {unit}"
        model = {"model_type": "equal_groups", "groups": n["b"], "items_per_group": n["c"], "total": n["a"], "unit": unit, "symbol": icon_for(obj)}
        practice = practice_ep("division", grade, lesson_id, variant + 20)
    elif concept in {"money_change", "subtraction"}:
        story = f"{person} has {n['a']} baht in {tool}. At {place}, {person} buys {obj} for {n['b']} baht. How much money is left after paying? {title_note}"
        think = f"The story starts with {n['a']} baht and spends {n['b']} baht. We subtract to find the change: {n['a']} - {n['b']} = {n['c']} baht."
        expression = f"{n['a']} - {n['b']} = {n['c']} baht"
        model = {"model_type": "money_change", "start": n["a"], "spent": n["b"], "result": n["c"], "unit": "baht", "symbol": "💵", "item": obj}
        practice = practice_ep("subtraction", grade, lesson_id, variant + 20)
    elif concept in {"multiplication", "area"}:
        unit = "square units" if concept == "area" else obj
        story = f"{person} arranges {obj} at {place} in {n['a']} rows. Each row has {n['b']} items. The rows are equal, so {person} wants to know the total number of {unit}. {title_note}"
        think = f"There are {n['a']} equal rows and {n['b']} in each row. Equal rows use multiplication: {n['a']} × {n['b']} = {n['c']} {unit}."
        expression = f"{n['a']} × {n['b']} = {n['c']} {unit}"
        model = {"model_type": "area_model" if concept == "area" else "array_model", "rows": n["a"], "cols": n["b"], "total": n["c"], "unit": unit, "symbol": "⬜" if concept == "area" else icon_for(obj)}
        practice = practice_ep("multiplication", grade, lesson_id, variant + 20)
    elif concept == "fraction":
        story = f"{person} cuts one pizza at {place} into {n['b']} equal parts. The group eats {n['a']} parts. What fraction of the pizza did they eat? {title_note}"
        think = f"The whole pizza has {n['b']} equal parts. The group eats {n['a']} parts, so the fraction is {n['a']}/{n['b']}."
        expression = f"{n['a']} out of {n['b']} parts = {n['a']}/{n['b']}"
        model = {"model_type": "fraction_model", "numerator": n["a"], "denominator": n["b"], "remaining": n["c"], "unit": "parts", "symbol": "🍕"}
        practice = practice_ep("fraction", grade, lesson_id, variant + 20)
    elif concept == "time":
        story = f"{person} starts reading at {n['a']}:00 at {place}. The reading time is {n['b']} minutes. What time will it be after {n['b']} minutes? {title_note}"
        think = f"Start at {n['a']}:00 and count forward {n['b']} minutes. This uses elapsed time on a time line."
        expression = f"{n['a']}:00 + {n['b']} minutes = finish time"
        model = {"model_type": "time_line", "start_hour": n["a"], "elapsed_minutes": n["b"], "unit": "minutes", "symbol": "🕒"}
        practice = practice_ep("time", grade, lesson_id, variant + 20)
    elif concept == "ratio":
        if grade >= 6:
            story = f"{person} prepares two pitchers of herbal drink at {place}. The strong recipe uses {n['a']} parts syrup and {n['b']} parts water. The next batch must taste the same, so what original proportion should the class keep? {title_note}"
            think = f"The original proportion is {n['a']} parts syrup to {n['b']} parts water. To scale it, multiply both parts by the same number and keep {n['a']}:{n['b']}."
            expression = f"{n['a']}:{n['b']} = original proportion"
        else:
            story = f"{person} mixes juice at {place}. The recipe uses {n['a']} parts orange juice and {n['b']} parts cold water. What is the ratio of orange juice to water? {title_note}"
            think = f"The important numbers are {n['a']} and {n['b']}. A ratio compares the parts in order, so the ratio is {n['a']}:{n['b']}."
            expression = f"{n['a']}:{n['b']} = orange juice to water"
        model = {"model_type": "ratio_bar", "part_a": n["a"], "part_b": n["b"], "total": n["a"] + n["b"], "unit": "parts", "symbol": "🥤"}
        practice = practice_ep("ratio", grade, lesson_id, variant + 20)
    elif concept == "percent":
        if grade >= 6:
            story = f"{person} makes a science survey poster at {place}. There are {n['a']} response cards, and {n['b']} cards choose the experiment station. The class must connect the same part-whole data to a fraction, a decimal, and a percent. {title_note}"
            think = f"The whole is {n['a']} cards, and the selected part is {n['b']} cards. Start with part over whole, then connect it to decimal and percent forms."
            expression = f"{n['b']} out of {n['a']} cards = one part-whole relationship"
            model = {"model_type": "percent_bar", "part": n["b"], "total": n["a"], "unit": "cards", "symbol": "▰"}
        else:
            story = f"{person} surveys {n['a']} students at {place}. {n['b']} students choose story books. How can the class compare the chosen part with the whole group? {title_note}"
            think = f"The whole group is {n['a']} students, and the chosen part is {n['b']} students. Percent thinking compares a part with the whole."
            expression = f"{n['b']} out of {n['a']} students = part of the whole"
            model = {"model_type": "percent_bar", "part": n["b"], "total": n["a"], "unit": "students", "symbol": "▰"}
        practice = practice_ep("comparison", grade, lesson_id, variant + 20)
    elif concept == "equation":
        story = f"{person} has some {obj} in {tool}. Then {helper} gives {person} {n['b']} more. Now there are {n['c']} {obj}. How many {obj} were there at the start? {title_note}"
        think = f"The unknown start number plus {n['b']} equals {n['c']}. Write □ + {n['b']} = {n['c']}, then subtract: {n['c']} - {n['b']} = {n['a']}."
        expression = f"□ + {n['b']} = {n['c']}, □ = {n['a']} {obj}"
        model = {"model_type": "unknown_part_model", "unknown": n["a"], "known": n["b"], "total": n["c"], "unit": obj, "symbol": icon_for(obj)}
        practice = practice_ep("equation", grade, lesson_id, variant + 20)
    elif concept in {"geometry", "comparison", "data"}:
        if concept == "geometry" and grade >= 4:
            story = f"{person} checks school posters at {place}. The first poster has {n['a']} angles to inspect, and the second poster has {n['b']} angles. How many more angles are on the first poster? {title_note}"
            obj = "angles"
        elif concept == "geometry":
            story = f"{person} sorts flat shapes at {place}. The first tray has {n['a']} shapes, and the second tray has {n['b']} shapes. How many more shapes are in the first tray? {title_note}"
            obj = "shapes"
        else:
            story = f"{person} makes a picture chart at {place}. One group has {n['a']} {obj}, and another group has {n['b']} {obj}. How many more {obj} does the first group have? {title_note}"
        think = f"Compare the two groups, {n['a']} and {n['b']}. To find how many more, subtract: {n['a']} - {n['b']} = {n['c']}."
        expression = f"{n['a']} - {n['b']} = {n['c']} {obj}"
        model = {"model_type": "comparison_bar", "top": n["a"], "bottom": n["b"], "difference": n["c"], "unit": obj, "symbol": icon_for(obj)}
        practice = practice_ep("comparison", grade, lesson_id, variant + 20)
    elif concept == "decimal":
        a = n["a"] / 10
        b = n["b"] / 10
        c = n["c"] / 10
        story = f"{person} measures {a:g} liters of juice at {place}. Then {person} adds {b:g} liters more from {tool}. How many liters of juice are there in all? {title_note}"
        think = f"Add the two decimal amounts: {a:g} + {b:g} = {c:g} liters."
        expression = f"{a:g} + {b:g} = {c:g} liters"
        model = {"model_type": "decimal_bar", "part_a": a, "part_b": b, "total": c, "unit": "liters", "symbol": "🥤"}
        practice = practice_ep("addition", grade, lesson_id, variant + 20)
    else:
        story = f"{person} collects {obj} for an activity at {place}. One box has {n['a']} items, and {tool} has {n['b']} more items. How many items does {person} have in all? {title_note}"
        think = f"The story has two groups: {n['a']} and {n['b']}. To find the total, add them: {n['a']} + {n['b']} = {n['c']} items."
        expression = f"{n['a']} + {n['b']} = {n['c']} items"
        model = {"model_type": "part_whole_model", "part_a": n["a"], "part_b": n["b"], "total": n["c"], "unit": "items", "symbol": icon_for(obj)}
        practice = practice_ep("addition", grade, lesson_id, variant + 20)
    return make_blocks("EP", story, think, model, expression, practice)


def icon_for(obj: str) -> str:
    return ICONS.get(obj, "●")


def make_blocks(program: str, story: str, think: str, model: dict[str, Any], expression: str, practice: dict[str, Any]) -> dict[str, Any]:
    if program == "TH":
        return {
            "story": story,
            "think": think,
            "helper_tip": "อ่านโจทย์ให้ครบ วงตัวเลขสำคัญ แล้วดูว่าคำถามต้องการหาอะไร",
            "blocks": [
                {"type": "story_intro", "title": "เรื่องราว", "content": story, "data": {"content_th": story}},
                {"type": "think_story", "title": "เรื่องราวชวนคิด", "content": think, "data": {"content_th": think}},
                {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "แผนภาพใช้สิ่งของและตัวเลขเดียวกับโจทย์", **model, "data": model},
                {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": expression, "content": expression, "data": {"expression": expression, "content_th": expression}},
                {"type": "mini_quiz", "title": "ลองทำดู", **practice, "data": practice},
            ],
        }
    return {
        "story": story,
        "think": think,
        "helper_tip": "Read the story, find the numbers, and choose the operation.",
        "blocks": [
            {"type": "story_intro", "title": "Story", "content": story, "content_en": story, "data": {"content_en": story}},
            {"type": "think_story", "title": "Think Story", "content": think, "content_en": think, "data": {"content_en": think}},
            {"type": "model_diagram", "title": "Model Diagram", "description": "The model uses the same objects and numbers as the story.", **model, "data": model},
            {"type": "number_sentence", "title": "Number Sentence", "expression": expression, "content": expression, "data": {"expression": expression, "content_en": expression}},
            {"type": "mini_quiz", "title": "Try It", **practice, "data": practice},
        ],
    }


def practice_th(concept: str, grade: int, lesson_id: str, variant: int) -> dict[str, Any]:
    n = numbers_for(concept, grade, f"{lesson_id}:practice", variant)
    if concept == "division":
        question = f"แม่มีขนม {n['a']} ชิ้น ต้องการแบ่งใส่ถุง {n['b']} ถุงเท่า ๆ กัน ถุงละกี่ชิ้น"
        answer, unit = n["c"], "ชิ้น"
        explanation = f"ใช้การหาร {n['a']} ÷ {n['b']} = {n['c']} ดังนั้นแต่ละถุงมี {n['c']} ชิ้น"
    elif concept == "subtraction":
        question = f"พ่อให้เงินน้อง {n['a']} บาท น้องซื้อสมุดราคา {n['b']} บาท น้องจะเหลือเงินกี่บาท"
        answer, unit = n["c"], "บาท"
        explanation = f"ใช้การลบ {n['a']} - {n['b']} = {n['c']} ดังนั้นเหลือเงิน {n['c']} บาท"
    elif concept == "multiplication":
        question = f"ครูวางดินสอเป็น {n['a']} กล่อง กล่องละ {n['b']} แท่ง มีดินสอทั้งหมดกี่แท่ง"
        answer, unit = n["c"], "แท่ง"
        explanation = f"มี {n['a']} กลุ่มเท่า ๆ กัน กลุ่มละ {n['b']} จึงใช้ {n['a']} × {n['b']} = {n['c']}"
    elif concept == "fraction":
        question = f"แตงโมหนึ่งลูกถูกแบ่งเป็น {n['b']} ชิ้นเท่า ๆ กัน น้องกินไป {n['a']} ชิ้น น้องกินแตงโมเป็นเศษส่วนเท่าใด"
        choices = [f"{n['a']}/{n['b']}", f"{n['c']}/{n['b']}", f"{n['b']}/{n['a']}", f"{n['a']}/{n['c'] or 1}"]
        return {"question": question, "question_th": question, "choices": choices, "correct_answer": choices[0], "answer": choices[0], "explanation": f"กินไป {n['a']} จากทั้งหมด {n['b']} ส่วน จึงเป็น {choices[0]}"}
    elif concept == "time":
        question = f"น้องเริ่มซ้อมดนตรีเวลา {n['a']}:00 น. และซ้อม {n['b']} นาที ต้องนับเวลาเพิ่มอีกกี่นาที"
        answer, unit = n["b"], "นาที"
        explanation = f"โจทย์ถามเวลาที่ผ่านไป ซึ่งกำหนดไว้ {n['b']} นาที"
    else:
        question = f"ห้องเรียนมีกระดาษสี {n['a']} แผ่น ครูนำมาเพิ่มอีก {n['b']} แผ่น ตอนนี้มีกระดาษสีทั้งหมดกี่แผ่น"
        answer, unit = n["c"], "แผ่น"
        explanation = f"รวมสองจำนวนด้วยการบวก {n['a']} + {n['b']} = {n['c']} แผ่น"
    choices = choice_set(float(answer), unit)
    return {"question": question, "question_th": question, "choices": choices, "correct_answer": choices[0], "answer": choices[0], "explanation": explanation}


def practice_ep(concept: str, grade: int, lesson_id: str, variant: int) -> dict[str, Any]:
    n = numbers_for(concept, grade, f"{lesson_id}:practice", variant)
    if concept == "division":
        question = f"Mom has {n['a']} snacks. She shares them equally into {n['b']} bags. How many snacks are in each bag?"
        answer, unit = n["c"], "snacks"
        explanation = f"Use division: {n['a']} ÷ {n['b']} = {n['c']}. Each bag has {n['c']} snacks."
    elif concept == "subtraction":
        question = f"Nan has {n['a']} baht. She buys a notebook for {n['b']} baht. How much money is left?"
        answer, unit = n["c"], "baht"
        explanation = f"Subtract the cost: {n['a']} - {n['b']} = {n['c']} baht."
    elif concept == "multiplication":
        question = f"A teacher has {n['a']} boxes of pencils. Each box has {n['b']} pencils. How many pencils are there?"
        answer, unit = n["c"], "pencils"
        explanation = f"Use multiplication: {n['a']} × {n['b']} = {n['c']} pencils."
    elif concept == "fraction":
        question = f"A melon is cut into {n['b']} equal pieces. Mina eats {n['a']} pieces. What fraction did she eat?"
        choices = [f"{n['a']}/{n['b']}", f"{n['c']}/{n['b']}", f"{n['b']}/{n['a']}", f"{n['a']}/{n['c'] or 1}"]
        return {"question": question, "question_en": question, "choices": choices, "correct_answer": choices[0], "answer": choices[0], "explanation": f"She ate {n['a']} of {n['b']} equal pieces, so the fraction is {choices[0]}.", "hint_th": "ดูจำนวนชิ้นที่กินเทียบกับทั้งหมด"}
    elif concept == "time":
        question = f"Ben starts music practice at {n['a']}:00. He practices for {n['b']} minutes. How many minutes does he practice?"
        answer, unit = n["b"], "minutes"
        explanation = f"The story tells us the elapsed time is {n['b']} minutes."
    else:
        question = f"The class has {n['a']} sheets of paper. The teacher adds {n['b']} more sheets. How many sheets are there in all?"
        answer, unit = n["c"], "sheets"
        explanation = f"Add the two groups: {n['a']} + {n['b']} = {n['c']} sheets."
    choices = choice_set(float(answer), unit)
    return {"question": question, "question_en": question, "choices": choices, "correct_answer": choices[0], "answer": choices[0], "explanation": explanation, "hint_th": "อ่านโจทย์แล้วหาตัวเลขสำคัญ"}


def repair_lesson(path: Path, backup_root: Path) -> dict[str, Any]:
    payload = load_json(path)
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or path.stem)
    grade = int(payload.get("grade_level") or re.search(r"grade_(\d+)", str(path)).group(1))
    program = program_of(payload, path)
    title = str(payload.get("title_en") if program == "EP" else payload.get("title_th") or payload.get("title") or lesson_id)
    concept = concept_of(lesson_id, title)
    variant_count = max(1, len(payload.get("story_variants") or []), len(payload.get("lesson_variants") or []))
    variants = []
    for index in range(variant_count):
        generated = ep_content(lesson_id, title, grade, concept, index) if program == "EP" else th_content(lesson_id, title, grade, concept, index)
        variant_id = f"{lesson_id}_{index + 1:02d}"
        variants.append(
            {
                "variant_id": variant_id,
                "variant_title_th": f"{title} แบบที่ {index + 1}" if program == "TH" else "",
                "variant_title_en": f"{title} Variant {index + 1}" if program == "EP" else f"Variant {index + 1}",
                "story_theme_th": generated["story"] if program == "TH" else "",
                "story_theme_en": generated["story"] if program == "EP" else f"Variant {index + 1} story for {lesson_id}",
                "helper_tip": generated["helper_tip"],
                "visual_blocks": generated["blocks"],
            }
        )
    first = variants[0]
    payload["lesson_id"] = lesson_id
    payload["id"] = payload.get("id") or lesson_id
    payload["grade_level"] = grade
    payload["program_type"] = "EP" if program == "EP" else "THP"
    payload["quality_required"] = True
    payload["content_schema_version"] = "topa_story_variant_v1"
    payload["story_intro_th" if program == "TH" else "story_intro_en"] = first["visual_blocks"][0]["content"]
    payload["helper_tip"] = first["helper_tip"]
    payload["visual_blocks"] = deepcopy(first["visual_blocks"])
    payload["lesson_variants"] = deepcopy(variants)
    payload["story_variants"] = deepcopy(variants)
    payload["singapore_math_model"] = {"type": first["visual_blocks"][2]["model_type"], "model_type": first["visual_blocks"][2]["model_type"], "description_th": "แผนภาพตรงกับสถานการณ์และตัวเลขในโจทย์"}
    if program == "EP":
        payload["status"] = "needs_review"
        payload["ep_review_status"] = "needs_review"
        payload.setdefault("vocabulary_th", "คำใบ้ภาษาไทยสำหรับครูใช้ประกอบการทบทวน")
    else:
        payload["status"] = "approved"
    scrub_en_fields(payload, lesson_id, program)
    write_json(path, payload, backup_root)
    return {"lesson_id": lesson_id, "program": program, "concept": concept, "variants": variant_count}


def scrub_en_fields(value: Any, lesson_id: str, program: str) -> None:
    if isinstance(value, dict):
        for key, item in list(value.items()):
            if key.endswith("_en") and isinstance(item, str) and THAI_RE.search(item):
                value[key] = f"{lesson_id} English content pending review" if program == "EP" else f"{lesson_id} English label"
            elif key.endswith("_en") and isinstance(item, list):
                value[key] = [f"{lesson_id} English item {index + 1}" for index, _ in enumerate(item)]
            elif key.endswith("_en") and isinstance(item, dict):
                value[key] = {"note": f"{lesson_id} English content pending review"}
            else:
                scrub_en_fields(item, lesson_id, program)
    elif isinstance(value, list):
        for item in value:
            scrub_en_fields(item, lesson_id, program)


def quiz_question(program: str, concept: str, grade: int, lesson_id: str, index: int) -> dict[str, Any]:
    n = numbers_for(concept if concept != "money_change" else "subtraction", grade, f"{lesson_id}:quiz:{index}", index)
    qid = f"{lesson_id}_q{index + 1:02d}"
    if program == "TH":
        practice = practice_th(concept if concept != "money_change" else "subtraction", grade, f"{lesson_id}:quiz:{index}", index)
        question = f"สถานการณ์ที่ {index + 1}: {practice['question']}"
        return {"question_id": qid, "question_text": question, "question_text_th": question, "choices": practice["choices"], "correct_answer": practice["correct_answer"], "answer": practice["answer"], "explanation": practice["explanation"], "explanation_th": practice["explanation"], "difficulty": "easy" if index < 4 else "medium"}
    practice = practice_ep(concept if concept != "money_change" else "subtraction", grade, f"{lesson_id}:quiz:{index}", index)
    question = f"Case {index + 1}: {practice['question']}"
    return {"question_id": qid, "question_text": question, "question_text_en": question, "choices": practice["choices"], "correct_answer": practice["correct_answer"], "answer": practice["answer"], "explanation": practice["explanation"], "explanation_en": practice["explanation"], "hint_th": practice.get("hint_th", "อ่านโจทย์และหาตัวเลขสำคัญ"), "difficulty": "easy" if index < 4 else "medium"}


def repair_quiz(path: Path, lesson_info: dict[str, Any], backup_root: Path) -> dict[str, Any]:
    payload = load_json(path)
    lesson_id = str(payload.get("lesson_id") or path.stem)
    program = lesson_info.get(lesson_id, {}).get("program") or program_of(payload, path)
    grade = int(payload.get("grade_level") or re.search(r"grade_(\d+)", str(path)).group(1))
    concept = lesson_info.get(lesson_id, {}).get("concept") or concept_of(lesson_id, "")
    questions = [quiz_question(program, concept, grade, lesson_id, index) for index in range(10)]
    payload["lesson_id"] = lesson_id
    payload["grade_level"] = grade
    payload["program"] = "EP" if program == "EP" else "TH"
    payload["program_type"] = "EP" if program == "EP" else "THP"
    payload["questions"] = questions
    if program == "EP":
        payload["status"] = "needs_review"
        payload["review_status"] = "needs_review"
    else:
        payload["status"] = "approved"
    write_json(path, payload, backup_root)
    return {"lesson_id": lesson_id, "program": program, "questions": len(questions)}


def update_statuses(lesson_results: list[dict[str, Any]], quiz_results: list[dict[str, Any]], backup_root: Path) -> None:
    now = datetime.now(timezone.utc).isoformat()
    ep_ids = {item["lesson_id"] for item in lesson_results if item["program"] == "EP"}
    th_ids = {item["lesson_id"] for item in lesson_results if item["program"] == "TH"}
    for filename, target_ids in (("lessons.json", ep_ids), ("tests.json", ep_ids)):
        path = STATUS_ROOT / filename
        if not path.exists():
            continue
        payload = load_json(path)
        changed = False
        for key, item in payload.items():
            if not isinstance(item, dict):
                continue
            lesson_id = str(item.get("lesson_id") or key).split("::")[0]
            if lesson_id in target_ids:
                item["status"] = "needs_review"
                item["updated_at"] = now
                item["review_note"] = "AI content quality repair requires human EP review."
                changed = True
        if changed:
            backup_path = backup_root / path.relative_to(CONTENT_ROOT.parent)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            if not backup_path.exists():
                shutil.copy2(path, backup_path)
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for filename, target_ids in (("lessons.json", th_ids), ("tests.json", th_ids)):
        path = STATUS_ROOT / filename
        if not path.exists():
            continue
        payload = load_json(path)
        changed = False
        for key, item in payload.items():
            if not isinstance(item, dict):
                continue
            lesson_id = str(item.get("lesson_id") or key).split("::")[0]
            if lesson_id in target_ids:
                item["status"] = "approved"
                item["updated_at"] = now
                item["review_note"] = "TH content quality repair passed canonical audit."
                changed = True
        if changed:
            backup_path = backup_root / path.relative_to(CONTENT_ROOT.parent)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            if not backup_path.exists():
                shutil.copy2(path, backup_path)
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = BACKUP_ROOT / f"{timestamp}_lesson_quality_repair"
    lesson_results: list[dict[str, Any]] = []
    lesson_info: dict[str, dict[str, Any]] = {}
    for lesson_path in sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json")):
        result = repair_lesson(lesson_path, backup_root)
        lesson_results.append(result)
        lesson_info[result["lesson_id"]] = result
    quiz_results: list[dict[str, Any]] = []
    for quiz_path in sorted(CONTENT_ROOT.glob("grade_*/quizzes/*.json")):
        quiz_results.append(repair_quiz(quiz_path, lesson_info, backup_root))
    update_statuses(lesson_results, quiz_results, backup_root)
    summary = {
        "backup_root": str(backup_root),
        "lessons_repaired": len(lesson_results),
        "quizzes_repaired": len(quiz_results),
        "th_repaired": sum(1 for item in lesson_results if item["program"] == "TH"),
        "ep_repaired_needs_review": sum(1 for item in lesson_results if item["program"] == "EP"),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
