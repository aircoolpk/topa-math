import type { LessonProblem } from './types'

/**
 * Demo problem set taken from the approved master prototype
 * (src/reference/LessonMasterPrototype.jsx).
 *
 * It exists so the new lesson architecture can be exercised end to end before
 * the real lesson content is converted. Replace it with the API-driven lesson
 * data when the content migration lands.
 */
export const DEMO_PROBLEMS: LessonProblem[] = [
  {
    "id": "p1",
    "tier": "lower",
    "workspaceType": "base10",
    "gradeLabelTH": "ป.1–ป.3 (ประถมต้น)",
    "gradeLabelEN": "Grades 1–3 (Lower Primary)",
    "topicTH": "การบวกและการจัดกลุ่มหลักสิบ",
    "topicEN": "Addition & Place Value (Base-10)",
    "questionEN": [
      {
        "text": "Mali has "
      },
      {
        "text": "14",
        "highlight": true
      },
      {
        "text": " red apples and picks "
      },
      {
        "text": "12",
        "highlight": true
      },
      {
        "text": " more. How many apples does she have "
      },
      {
        "term": "altogether",
        "display": "altogether"
      },
      {
        "text": "? Group by "
      },
      {
        "term": "tens",
        "display": "tens"
      },
      {
        "text": " to find out!"
      }
    ],
    "questionTH": [
      {
        "text": "มะลิมีแอปเปิ้ลสีแดง "
      },
      {
        "text": "14",
        "highlight": true
      },
      {
        "text": " ผล และเก็บเพิ่มอีก "
      },
      {
        "text": "12",
        "highlight": true
      },
      {
        "text": " ผล มะลิมีแอปเปิ้ล "
      },
      {
        "term": "altogether",
        "display": "รวมกันทั้งหมด"
      },
      {
        "text": " กี่ผล? ลองจัดกลุ่ม "
      },
      {
        "term": "tens",
        "display": "หลักสิบ"
      },
      {
        "text": " เพื่อหาคำตอบกัน!"
      }
    ],
    "rawTTS_EN": "Mali has 14 red apples and picks 12 more. How many apples does she have altogether?",
    "rawTTS_TH": "มะลิมีแอปเปิ้ลสีแดง 14 ผล และเก็บเพิ่มอีก 12 ผล มะลิมีแอปเปิ้ลรวมกันทั้งหมดกี่ผล",
    "choices": [
      "24",
      "26",
      "28",
      "32"
    ],
    "correctAnswer": "26",
    "base10Config": {
      "initialTens": 2,
      "initialOnes": 4,
      "targetTens": 2,
      "targetOnes": 6,
      "unitEmoji": "🍎"
    },
    "hint1TH": "ลองแยกตัวเลขเป็น แท่งสิบ (10) และ หน่วยย่อย (1) ดูสิ: 14 คือ 1 สิบ กับ 4 หน่วย",
    "hint1EN": "Break the numbers into Tens (10) and Ones (1): 14 is 1 Ten and 4 Ones!",
    "hint2TH": "10 + 10 ได้ 20 (2 แท่งสิบ) และนำหลักหน่วยมารวมกัน: 4 + 2 = 6 หน่วย",
    "hint2EN": "10 + 10 makes 20 (2 Tens rods), then add the ones: 4 + 2 = 6 Ones!",
    "nudgeTH": "เกือบถูกแล้ว! ลองนับแท่งหลักสิบ (2 แท่ง = 20) รวมกับหลักหน่วย (4 + 2 = 6) อีกครั้งนะ",
    "nudgeEN": "Almost there! Count the Tens rods (2 rods = 20) plus the Ones cubes (4 + 2 = 6) again!",
    "steps": [
      {
        "titleTH": "ขั้นที่ 1: แยกหลักสิบและหลักหน่วย",
        "titleEN": "Step 1: Split into Tens and Ones",
        "descTH": "14 = 1 แท่งสิบ + 4 หน่วย | 12 = 1 แท่งสิบ + 2 หน่วย",
        "descEN": "14 = 1 Ten + 4 Ones | 12 = 1 Ten + 2 Ones",
        "visual": "10 + 4   and   10 + 2"
      },
      {
        "titleTH": "ขั้นที่ 2: รวมแท่งหลักสิบเข้าด้วยกัน",
        "titleEN": "Step 2: Combine the Tens Rods",
        "descTH": "1 แท่งสิบ + 1 แท่งสิบ = 2 แท่งสิบ (มีค่าเท่ากับ 20)",
        "descEN": "1 Ten + 1 Ten = 2 Tens (which equals 20)",
        "visual": "🟦 10 + 🟦 10 = 20"
      },
      {
        "titleTH": "ขั้นที่ 3: รวมหลักหน่วยเข้าด้วยกัน",
        "titleEN": "Step 3: Combine the Ones Cubes",
        "descTH": "4 หน่วย + 2 หน่วย = 6 หน่วย เมื่อรวมกับ 20 จึงได้ 26!",
        "descEN": "4 Ones + 2 Ones = 6 Ones. 20 + 6 = 26 altogether!",
        "visual": "20 + 🟧 6 = 26"
      }
    ],
    "conceptMicroSteps": [
      {
        "titleTH": "สเต็ป 1/3: รู้จักกับบล็อกฐานสิบ (Base-10)",
        "titleEN": "Micro-Step 1/3: Meet Base-10 Blocks",
        "bodyTH": "เวลาเจอเลขเยอะๆ เราจะมัดบล็อกเล็ก 10 ชิ้น รวมเป็น \"แท่งสิบ\" สีฟ้า 1 แท่ง เพื่อให้นับง่ายขึ้น!",
        "bodyEN": "When counting larger numbers, we bundle 10 single cubes into 1 blue \"Tens Rod\" so we can count super fast!",
        "actionLabelTH": "กดเพื่อมัดรวม 10 หน่วยเป็น 1 แท่งสิบ ✨",
        "actionLabelEN": "Click to bundle 10 Ones into 1 Ten Rod ✨"
      },
      {
        "titleTH": "สเต็ป 2/3: บวกหลักสิบก่อน แล้วค่อยบวกหลักหน่วย",
        "titleEN": "Micro-Step 2/3: Add Tens First, Then Ones",
        "bodyTH": "ในการหาผลรวม (Altogether) ของ 14 + 12 เราแค่นำแท่งสิบมารวมกับแท่งสิบ และหน่วยรวมกับหน่วย",
        "bodyEN": "To find the total altogether for 14 + 12, put the blue Tens rods together and the orange Ones cubes together.",
        "actionLabelTH": "กดเพื่อจัดกลุ่มแท่งสิบและหน่วย 🧩",
        "actionLabelEN": "Click to group Tens & Ones together 🧩"
      },
      {
        "titleTH": "สเต็ป 3/3: พร้อมลุยโจทย์จริงแล้ว!",
        "titleEN": "Micro-Step 3/3: Ready for the Challenge!",
        "bodyTH": "เห็นไหมว่า 2 แท่งสิบ (20) กับ 6 หน่วย รวมกันเป็น 26 ง่ายนิดเดียว ลองไปทำโจทย์ด้วยตัวเองกันเลย!",
        "bodyEN": "2 Tens (20) and 6 Ones make 26! Now try using the interactive workspace yourself!",
        "actionLabelTH": "เริ่มทำโจทย์ฝึกหัดกันเลย 🚀",
        "actionLabelEN": "Start Practice Problem 🚀"
      }
    ]
  },
  {
    "id": "p2",
    "tier": "lower",
    "workspaceType": "base10",
    "gradeLabelTH": "ป.1–ป.3 (ประถมต้น)",
    "gradeLabelEN": "Grades 1–3 (Lower Primary)",
    "topicTH": "การเปรียบเทียบและหาผลต่าง",
    "topicEN": "Comparing Numbers & Difference",
    "questionEN": [
      {
        "text": "Leo collected "
      },
      {
        "text": "35",
        "highlight": true
      },
      {
        "text": " golden stars. Mina collected "
      },
      {
        "text": "21",
        "highlight": true
      },
      {
        "text": " golden stars. What is the "
      },
      {
        "term": "difference",
        "display": "difference"
      },
      {
        "text": " between their stars? Check the "
      },
      {
        "term": "tens",
        "display": "tens"
      },
      {
        "text": " and ones!"
      }
    ],
    "questionTH": [
      {
        "text": "ลีโอสะสมดาวทองได้ "
      },
      {
        "text": "35",
        "highlight": true
      },
      {
        "text": " ดวง มินาสะสมได้ "
      },
      {
        "text": "21",
        "highlight": true
      },
      {
        "text": " ดวง "
      },
      {
        "term": "difference",
        "display": "ผลต่าง"
      },
      {
        "text": " ของจำนวนดาวของทั้งสองคนคือเท่าไร? ลองดูที่ "
      },
      {
        "term": "tens",
        "display": "หลักสิบ"
      },
      {
        "text": " และหลักหน่วยนะ!"
      }
    ],
    "rawTTS_EN": "Leo collected 35 golden stars. Mina collected 21 golden stars. What is the difference between their stars?",
    "rawTTS_TH": "ลีโอสะสมดาวทองได้ 35 ดวง มินาสะสมได้ 21 ดวง ผลต่างของจำนวนดาวของทั้งสองคนคือเท่าไร",
    "choices": [
      "12",
      "14",
      "16",
      "56"
    ],
    "correctAnswer": "14",
    "base10Config": {
      "initialTens": 3,
      "initialOnes": 5,
      "targetTens": 1,
      "targetOnes": 4,
      "unitEmoji": "⭐"
    },
    "hint1TH": "คำว่า \"ผลต่าง (Difference)\" แปลว่าต้องนำเลขมากตั้ง แล้วลบด้วยเลขน้อย (35 - 21)",
    "hint1EN": "\"Difference\" means we subtract the smaller number from the larger number (35 - 21).",
    "hint2TH": "ลองกดปุ่มลบแท่งสิบออก 2 แท่ง (30 - 20 = 10) และลบหน่วยออก 1 ชิ้น (5 - 1 = 4)",
    "hint2EN": "Remove 2 Tens rods (30 - 20 = 10) and remove 1 Ones cube (5 - 1 = 4).",
    "nudgeTH": "ระวังสับสนกับการบวกนะ! คำว่า \"ผลต่าง (Difference)\" คือการหักออก (35 ลบออก 21 เหลือเท่าไรเอ่ย?)",
    "nudgeEN": "Careful! \"Difference\" means subtracting (35 minus 21), not adding them together!",
    "steps": [
      {
        "titleTH": "ขั้นที่ 1: ตั้งจำนวนเริ่มต้นของลีโอ (35)",
        "titleEN": "Step 1: Start with Leo’s amount (35)",
        "descTH": "35 ประกอบด้วย 3 แท่งสิบ (30) และ 5 หน่วย",
        "descEN": "35 has 3 Tens rods (30) and 5 Ones cubes.",
        "visual": "🟦🟦🟦 (30) + 🟧🟧🟧🟧🟧 (5)"
      },
      {
        "titleTH": "ขั้นที่ 2: หักออกตามจำนวนของมินา (21)",
        "titleEN": "Step 2: Subtract Mina’s amount (21)",
        "descTH": "ลบหลักสิบ: 3 แท่ง - 2 แท่ง = เหลือ 1 แท่งสิบ (10)",
        "descEN": "Subtract Tens: 3 Tens - 2 Tens = 1 Ten left (10).",
        "visual": "30 - 20 = 10"
      },
      {
        "titleTH": "ขั้นที่ 3: ลบหลักหน่วยแล้วรวมผลลัพธ์",
        "titleEN": "Step 3: Subtract Ones & Combine",
        "descTH": "ลบหลักหน่วย: 5 - 1 = เหลือ 4 หน่วย รวมเป็น 14 ดวง!",
        "descEN": "Subtract Ones: 5 - 1 = 4 Ones left. Total difference is 14!",
        "visual": "10 + 4 = 14"
      }
    ],
    "conceptMicroSteps": [
      {
        "titleTH": "สเต็ป 1/3: คำว่า \"Difference (ผลต่าง)\" คืออะไร?",
        "titleEN": "Micro-Step 1/3: What does \"Difference\" mean?",
        "bodyTH": "ในโจทย์ EP คำว่า Difference ไม่ได้แปลว่าแปลกต่างกันเฉยๆ แต่หมายถึง \"มากกว่ากันอยู่เท่าไร\" ซึ่งใช้การลบ (-)",
        "bodyEN": "In math word problems, \"Difference\" asks how much more one number is than another using subtraction (-).",
        "actionLabelTH": "กดเพื่อเปรียบเทียบ 35 กับ 21 🔍",
        "actionLabelEN": "Click to compare 35 and 21 🔍"
      },
      {
        "titleTH": "สเต็ป 2/3: หักบล็อกออกทีละหลัก",
        "titleEN": "Micro-Step 2/3: Take Away Tens and Ones",
        "bodyTH": "มี 3 แท่งสิบ เอาออก 2 แท่งสิบ เหลือ 1 แท่งสิบ! มี 5 หน่วย เอาออก 1 หน่วย เหลือ 4 หน่วย!",
        "bodyEN": "From 3 Tens, take away 2 Tens -> 1 Ten left! From 5 Ones, take away 1 One -> 4 Ones left!",
        "actionLabelTH": "กดเพื่อดูผลลัพธ์หลังหักออก ✨",
        "actionLabelEN": "Click to see remaining blocks ✨"
      },
      {
        "titleTH": "สเต็ป 3/3: ลองปรับบล็อกในกระดานจริงกัน!",
        "titleEN": "Micro-Step 3/3: Try it on the Workspace!",
        "bodyTH": "คุณสามารถกดปุ่ม + / - บนกระดานเพื่อจำลองการลบเลขได้ด้วยตัวเอง พร้อมแล้วไปลุยเลย!",
        "bodyEN": "You can click + and - on the workspace to model the subtraction yourself!",
        "actionLabelTH": "ไปที่โจทย์ฝึกหัด 🚀",
        "actionLabelEN": "Go to Practice Problem 🚀"
      }
    ]
  },
  {
    "id": "p3",
    "tier": "upper",
    "workspaceType": "barModel",
    "gradeLabelTH": "ป.4–ป.6 (ประถมปลาย)",
    "gradeLabelEN": "Grades 4–6 (Upper Primary)",
    "topicTH": "การแก้โจทย์ปัญหาด้วยบาร์โมเดล (Bar Model)",
    "topicEN": "Singapore Math Bar Model & Ratio",
    "questionEN": [
      {
        "text": "In a coding club, the "
      },
      {
        "term": "ratio",
        "display": "ratio"
      },
      {
        "text": " of boys to girls is "
      },
      {
        "text": "3 : 2",
        "highlight": true
      },
      {
        "text": ". Dividing the bar model into "
      },
      {
        "term": "equal_parts",
        "display": "equal parts"
      },
      {
        "text": ", if there are "
      },
      {
        "text": "45",
        "highlight": true
      },
      {
        "text": " students "
      },
      {
        "term": "altogether",
        "display": "altogether"
      },
      {
        "text": ", how many boys are in the club?"
      }
    ],
    "questionTH": [
      {
        "text": "ในชมรมโค้ดดิ้งมี "
      },
      {
        "term": "ratio",
        "display": "อัตราส่วน"
      },
      {
        "text": " ของนักเรียนชายต่อนักเรียนหญิงเป็น "
      },
      {
        "text": "3 : 2",
        "highlight": true
      },
      {
        "text": " เมื่อแบ่งบาร์โมเดลออกเป็น "
      },
      {
        "term": "equal_parts",
        "display": "ส่วนที่เท่ากัน"
      },
      {
        "text": " ถ้ามีนักเรียน "
      },
      {
        "term": "altogether",
        "display": "รวมกันทั้งหมด"
      },
      {
        "text": " "
      },
      {
        "text": "45",
        "highlight": true
      },
      {
        "text": " คน จะมีนักเรียนชายกี่คน?"
      }
    ],
    "rawTTS_EN": "In a coding club, the ratio of boys to girls is 3 to 2. If there are 45 students altogether, how many boys are in the club?",
    "rawTTS_TH": "ในชมรมโค้ดดิ้งมีอัตราส่วนของนักเรียนชายต่อนักเรียนหญิงเป็น 3 ต่อ 2 ถ้ามีนักเรียนรวมกันทั้งหมด 45 คน จะมีนักเรียนชายกี่คน",
    "choices": [
      "18",
      "25",
      "27",
      "30"
    ],
    "correctAnswer": "27",
    "barModelConfig": {
      "labelA_TH": "นักเรียนชาย (Boys)",
      "labelA_EN": "Boys",
      "labelB_TH": "นักเรียนหญิง (Girls)",
      "labelB_EN": "Girls",
      "defaultPartsA": 3,
      "defaultPartsB": 2,
      "totalValue": 45,
      "unitValue": 9
    },
    "hint1TH": "ดูที่บาร์โมเดล: นักเรียนชายมี 3 ส่วน นักเรียนหญิงมี 2 ส่วน รวมทั้งหมดมีกี่ส่วน (Units)?",
    "hint1EN": "Look at the Bar Model: Boys have 3 units and Girls have 2 units. How many units are there in total?",
    "hint2TH": "รวมทั้งหมด 5 ส่วน = 45 คน แปลว่า 1 ส่วนมีค่าเท่ากับ 45 ÷ 5 = 9 คน! แล้ว 3 ส่วนของนักเรียนชายคือเท่าไร?",
    "hint2EN": "5 total units = 45 students. So 1 unit = 45 ÷ 5 = 9 students! Now find 3 units for Boys.",
    "nudgeTH": "เกือบได้แล้ว! 1 ส่วน (Unit) มีค่าเท่ากับ 9 คน (45 ÷ 5) แต่นักเรียนชายมี 3 ส่วน ลองนำ 3 × 9 ดูอีกครั้งนะ",
    "nudgeEN": "Close! 1 unit equals 9 students (45 ÷ 5). Since Boys have 3 units, multiply 3 × 9!",
    "steps": [
      {
        "titleTH": "ขั้นที่ 1: นับจำนวนส่วน (Units) ทั้งหมดในบาร์โมเดล",
        "titleEN": "Step 1: Count Total Equal Units in the Bar Model",
        "descTH": "ชาย 3 ส่วน + หญิง 2 ส่วน = รวมทั้งหมด 5 ส่วนที่เท่ากัน",
        "descEN": "Boys (3 units) + Girls (2 units) = 5 equal units altogether.",
        "visual": "[ 1 ][ 2 ][ 3 ] + [ 4 ][ 5 ] = 5 Units"
      },
      {
        "titleTH": "ขั้นที่ 2: หาค่าของ 1 ส่วน (Find 1 Unit)",
        "titleEN": "Step 2: Find the Value of 1 Unit",
        "descTH": "5 ส่วน = 45 คน ดังนั้น 1 ส่วน = 45 ÷ 5 = 9 คน",
        "descEN": "5 units = 45 students → 1 unit = 45 ÷ 5 = 9 students.",
        "visual": "1 Unit = 45 ÷ 5 = 9"
      },
      {
        "titleTH": "ขั้นที่ 3: คำนวณจำนวนนักเรียนชาย (3 ส่วน)",
        "titleEN": "Step 3: Calculate Boys (3 Units)",
        "descTH": "นักเรียนชายมี 3 ส่วน = 3 × 9 = 27 คน",
        "descEN": "Boys = 3 units × 9 = 27 students!",
        "visual": "[ 9 ][ 9 ][ 9 ] = 27"
      }
    ],
    "conceptMicroSteps": [
      {
        "titleTH": "สเต็ป 1/3: เปลี่ยนโจทย์ยาวๆ ให้เป็นภาพด้วย Bar Model",
        "titleEN": "Micro-Step 1/3: Visualize Word Problems with Bar Models",
        "bodyTH": "เมื่อเจอคำว่า Ratio (อัตราส่วน) 3 : 2 เราสามารถวาดแท่งบาร์โมเดลแบ่งเป็น 3 ช่องสำหรับชาย และ 2 ช่องสำหรับหญิง",
        "bodyEN": "When you see a Ratio of 3 : 2, draw a Singapore Bar Model with 3 equal blocks for Boys and 2 equal blocks for Girls.",
        "actionLabelTH": "กดเพื่อสร้างแท่งบาร์โมเดล 3 : 2 📊",
        "actionLabelEN": "Click to build the 3 : 2 Bar Model 📊"
      },
      {
        "titleTH": "สเต็ป 2/3: กฎทองของบาร์โมเดล — \"หาค่าของ 1 ช่องก่อนเสมอ!\"",
        "titleEN": "Micro-Step 2/3: Golden Rule — \"Always Find 1 Unit First!\"",
        "bodyTH": "เมื่อรวมทั้ง 5 ช่องมีค่าเท่ากับ 45 คน เราจึงนำ 45 ÷ 5 เพื่อใส่ตัวเลข 9 ลงในทุกๆ ช่อง",
        "bodyEN": "Since all 5 blocks equal 45 altogether, divide 45 ÷ 5 = 9. Every single block holds 9!",
        "actionLabelTH": "กดเพื่อเติมค่า 1 ช่อง = 9 ลงในบาร์ 🔢",
        "actionLabelEN": "Click to fill 9 into each unit block 🔢"
      },
      {
        "titleTH": "สเต็ป 3/3: ทดลองปรับบาร์โมเดลในโจทย์จริง!",
        "titleEN": "Micro-Step 3/3: Interactive Bar Model Workspace!",
        "bodyTH": "ในหน้าถัดไป คุณสามารถเพิ่ม/ลดช่องบาร์โมเดล และเปิดโหมดแสดงค่าต่อช่องได้ด้วยตัวเอง ไปลองกันเลย!",
        "bodyEN": "In Practice Mode, you can adjust the bars and toggle unit values interactively!",
        "actionLabelTH": "เข้าสู่โหมดโจทย์ฝึกหัด 🚀",
        "actionLabelEN": "Enter Practice Mode 🚀"
      }
    ]
  },
  {
    "id": "p4",
    "tier": "upper",
    "workspaceType": "barModel",
    "gradeLabelTH": "ป.4–ป.6 (ประถมปลาย)",
    "gradeLabelEN": "Grades 4–6 (Upper Primary)",
    "topicTH": "เรขาคณิตและบาร์โมเดลเปรียบเทียบ",
    "topicEN": "Geometry Perimeter & Comparison Model",
    "questionEN": [
      {
        "text": "A rectangular solar panel has a length to width "
      },
      {
        "term": "ratio",
        "display": "ratio"
      },
      {
        "text": " of "
      },
      {
        "text": "4 : 1",
        "highlight": true
      },
      {
        "text": ". If the "
      },
      {
        "term": "difference",
        "display": "difference"
      },
      {
        "text": " between its length and width is "
      },
      {
        "text": "24 cm",
        "highlight": true
      },
      {
        "text": ", what is the length of one long side? (Hint: Use "
      },
      {
        "term": "equal_parts",
        "display": "equal parts"
      },
      {
        "text": " before finding "
      },
      {
        "term": "perimeter",
        "display": "perimeter"
      },
      {
        "text": "!)"
      }
    ],
    "questionTH": [
      {
        "text": "แผงโซลาร์เซลล์ทรงสี่เหลี่ยมผืนผ้ามี "
      },
      {
        "term": "ratio",
        "display": "อัตราส่วน"
      },
      {
        "text": " ความยาวต่อความกว้างเป็น "
      },
      {
        "text": "4 : 1",
        "highlight": true
      },
      {
        "text": " ถ้า "
      },
      {
        "term": "difference",
        "display": "ผลต่าง"
      },
      {
        "text": " ของด้านยาวและด้านกว้างคือ "
      },
      {
        "text": "24 ซม.",
        "highlight": true
      },
      {
        "text": " ด้านยาวจะยาวกี่เซนติเมตร? (คำใบ้: แบ่งเป็น "
      },
      {
        "term": "equal_parts",
        "display": "ส่วนที่เท่ากัน"
      },
      {
        "text": " ก่อนหา "
      },
      {
        "term": "perimeter",
        "display": "ความยาวรอบรูป"
      },
      {
        "text": ")"
      }
    ],
    "rawTTS_EN": "A rectangular solar panel has a length to width ratio of 4 to 1. If the difference between its length and width is 24 centimeters, what is the length of one long side?",
    "rawTTS_TH": "แผงโซลาร์เซลล์ทรงสี่เหลี่ยมผืนผ้ามีอัตราส่วนความยาวต่อความกว้างเป็น 4 ต่อ 1 ถ้าผลต่างของด้านยาวและด้านกว้างคือ 24 เซนติเมตร ด้านยาวจะยาวกี่เซนติเมตร",
    "choices": [
      "28",
      "32",
      "36",
      "40"
    ],
    "correctAnswer": "32",
    "barModelConfig": {
      "labelA_TH": "ด้านยาว (Length)",
      "labelA_EN": "Length",
      "labelB_TH": "ด้านกว้าง (Width)",
      "labelB_EN": "Width",
      "defaultPartsA": 4,
      "defaultPartsB": 1,
      "totalValue": 40,
      "differenceValue": 24,
      "unitValue": 8
    },
    "hint1TH": "ด้านยาวมี 4 ส่วน ด้านกว้างมี 1 ส่วน ดังนั้น \"ผลต่าง (Difference)\" คือ 4 - 1 = 3 ส่วนที่เกินออกมา!",
    "hint1EN": "Length has 4 units, Width has 1 unit. The \"difference\" is the extra 4 - 1 = 3 units!",
    "hint2TH": "3 ส่วนที่เกินมา = 24 ซม. แปลว่า 1 ส่วน = 24 ÷ 3 = 8 ซม. ดังนั้นด้านยาว 4 ส่วนจึงเท่ากับ 4 × 8!",
    "hint2EN": "3 extra units = 24 cm → 1 unit = 24 ÷ 3 = 8 cm. So Length (4 units) = 4 × 8!",
    "nudgeTH": "ลองดูที่ส่วนต่างในบาร์โมเดลนะ: 3 ช่องที่เกินออกมามีค่า 24 ซม. (ช่องละ 8 ซม.) ด้านยาวมี 4 ช่อง ดังนั้น 4 × 8 ได้เท่าไร?",
    "nudgeEN": "Check the difference bracket on the Bar Model: 3 extra units = 24 cm (8 cm per unit). Length is 4 units (4 × 8)!",
    "steps": [
      {
        "titleTH": "ขั้นที่ 1: หาจำนวนส่วนที่ต่างกัน (Difference in Units)",
        "titleEN": "Step 1: Find the Difference in Units",
        "descTH": "ด้านยาว (4 ส่วน) - ด้านกว้าง (1 ส่วน) = ต่างกันอยู่ 3 ส่วน",
        "descEN": "Length (4 units) - Width (1 unit) = 3 extra units.",
        "visual": "4 Units - 1 Unit = 3 Units Difference"
      },
      {
        "titleTH": "ขั้นที่ 2: หาค่าของ 1 ส่วนจากผลต่าง",
        "titleEN": "Step 2: Find 1 Unit from the Difference",
        "descTH": "3 ส่วน = 24 ซม. ดังนั้น 1 ส่วน = 24 ÷ 3 = 8 ซม.",
        "descEN": "3 units = 24 cm → 1 unit = 24 ÷ 3 = 8 cm.",
        "visual": "1 Unit = 24 ÷ 3 = 8 cm"
      },
      {
        "titleTH": "ขั้นที่ 3: คำนวณความยาวของด้านยาว (4 ส่วน)",
        "titleEN": "Step 3: Calculate Length (4 Units)",
        "descTH": "ด้านยาวมี 4 ส่วน = 4 × 8 = 32 เซนติเมตร!",
        "descEN": "Length = 4 units × 8 cm = 32 cm!",
        "visual": "[ 8 ][ 8 ][ 8 ][ 8 ] = 32 cm"
      }
    ],
    "conceptMicroSteps": [
      {
        "titleTH": "สเต็ป 1/3: บาร์โมเดลแบบเปรียบเทียบผลต่าง (Comparison Model)",
        "titleEN": "Micro-Step 1/3: Comparison Bar Models",
        "bodyTH": "เมื่อโจทย์บอก \"ผลต่าง (Difference)\" เราจะวางบาร์ 2 แท่งซ้อนกัน เพื่อดูว่าแท่งยาวเกินแท่งสั้นออกมากี่ช่อง",
        "bodyEN": "When a problem gives the \"Difference\", align the two bars on the left to see how many extra units stick out!",
        "actionLabelTH": "กดเพื่อเทียบส่วนที่เกินออกมา 3 ช่อง 📐",
        "actionLabelEN": "Click to highlight the 3 extra units 📐"
      },
      {
        "titleTH": "สเต็ป 2/3: แบ่งค่าผลต่างลงในช่องที่เกินมา",
        "titleEN": "Micro-Step 2/3: Divide the Difference Evenly",
        "bodyTH": "ส่วนที่เกินมา 3 ช่อง ยาวเท่ากับ 24 ซม. ดังนั้นแต่ละช่องจึงมีค่า 24 ÷ 3 = 8 ซม. เท่ากันทุกช่อง!",
        "bodyEN": "Those 3 extra units equal 24 cm, so each unit is 24 ÷ 3 = 8 cm across the entire diagram!",
        "actionLabelTH": "กดเพื่อใส่ค่า 8 ซม. ในทุกช่อง ✨",
        "actionLabelEN": "Click to label 8 cm per unit ✨"
      },
      {
        "titleTH": "สเต็ป 3/3: พร้อมพิชิตโจทย์ประถมปลาย!",
        "titleEN": "Micro-Step 3/3: Ready to Solve!",
        "bodyTH": "เมื่อรู้ว่า 1 ช่อง = 8 ซม. การหาด้านยาว 4 ช่องก็ง่ายทันที ลองไปปรับบาร์โมเดลในหน้าโจทย์กัน!",
        "bodyEN": "Once you know 1 unit = 8 cm, finding 4 units is super easy. Let’s jump to the problem!",
        "actionLabelTH": "เริ่มทำโจทย์ข้อนี้ 🚀",
        "actionLabelEN": "Solve This Problem 🚀"
      }
    ]
  },
  
    {
      "id": "p5",
      "tier": "lower",
      "workspaceType": "fraction",
      "gradeLabelTH": "ป.1–ป.3 (ประถมต้น)",
      "gradeLabelEN": "Grades 1–3 (Lower Primary)",
      "topicTH": "เศษส่วน (Fractions)",
      "topicEN": "Fractions (Equal Parts)",
      "questionEN": [
        {
          "text": "Mali shares a pizza into "
        },
        {
          "text": "4",
          "highlight": true
        },
        {
          "text": " equal pieces. She eats "
        },
        {
          "text": "1",
          "highlight": true
        },
        {
          "text": " piece. Which fraction did she eat? Tap "
        },
        {
          "term": "equal_parts",
          "display": "equal parts"
        },
        {
          "text": " to learn more."
        }
      ],
      "questionTH": [
        {
          "text": "มะลิแบ่งพิซซ่าเป็น "
        },
        {
          "text": "4",
          "highlight": true
        },
        {
          "text": " ชิ้นที่เท่ากัน แล้วกินไป "
        },
        {
          "text": "1",
          "highlight": true
        },
        {
          "text": " ชิ้น เธอกินไปกี่ส่วน แตะที่ "
        },
        {
          "term": "equal_parts",
          "display": "ส่วนที่เท่ากัน"
        },
        {
          "text": " เพื่อดูคำอธิบาย"
        }
      ],
      "rawTTS_EN": "Mali shares a pizza into 4 equal pieces. She eats 1 piece. Which fraction did she eat?",
      "rawTTS_TH": "มะลิแบ่งพิซซ่าเป็น 4 ชิ้นที่เท่ากัน แล้วกินไป 1 ชิ้น เธอกินไปกี่ส่วน",
      "choices": [
        "1/4",
        "1/2",
        "2/4",
        "4/1"
      ],
      "correctAnswer": "1/4",
      "fractionConfig": {
        "numerator": 1,
        "denominator": 4,
        "shadedParts": 1,
        "targetNumerator": 1,
        "targetDenominator": 4
      },
      "hint1TH": "ลองดูวงกลมที่ถูกแบ่งไว้ด้านบน — นับว่ามีกี่ส่วน แล้วดูว่ามะลิกินไปกี่ส่วน",
      "hint1EN": "Look at the circle split above - count the pieces, then count how many Mali ate.",
      "hint2TH": "มีทั้งหมด 4 ส่วน กินไป 1 ส่วน เขียนเป็นเศษ 1 ส่วนจาก 4 ส่วน",
      "hint2EN": "There are 4 pieces and she ate 1, so that is 1 part out of 4.",
      "nudgeTH": "ใกล้แล้ว! ลองนับชิ้นที่ถูกแบ่งทั้งหมด แล้วดูว่ามะลิกินไปกี่ชิ้น",
      "nudgeEN": "Almost there! Count all the pieces, then count how many Mali ate.",
      "steps": [
        {
          "titleTH": "ขั้นที่ 1: นับส่วนทั้งหมด",
          "titleEN": "Step 1: Count every piece",
          "descTH": "พิซซ่าถูกแบ่งเป็น 4 ส่วนที่เท่ากัน",
          "descEN": "The pizza is split into 4 equal pieces",
          "visual": "4 equal pieces"
        },
        {
          "titleTH": "ขั้นที่ 2: นับส่วนที่กินไป",
          "titleEN": "Step 2: Count the eaten pieces",
          "descTH": "มะลิกินไป 1 ชิ้น จึงระบายไว้ 1 ส่วน",
          "descEN": "Mali ate 1 piece, so 1 part is shaded",
          "visual": "1 of 4 shaded"
        },
        {
          "titleTH": "ขั้นที่ 3: เขียนเป็นเศษส่วน",
          "titleEN": "Step 3: Write the fraction",
          "descTH": "1 ส่วน จากทั้งหมด 4 ส่วน เขียนเป็น 1/4",
          "descEN": "1 part out of 4 is written as 1/4",
          "visual": "1/4"
        }
      ],
      "conceptMicroSteps": [
        {
          "titleTH": "สเต็ป 1/3: รู้จักส่วนที่เท่ากัน",
          "titleEN": "Micro-Step 1/3: Meet equal parts",
          "bodyTH": "เวลาเราหั่นขนมหรือพิซซ่า เราจะหั่นให้ทุกชิ้นมีขนาดเท่ากัน นั่นเรียกว่า ส่วนที่เท่ากัน",
          "bodyEN": "When we cut a cake or a pizza we make every piece the same size - those are equal parts.",
          "actionLabelTH": "กดเพื่อดูว่าส่วนที่เท่ากันหน้าตาเป็นยังไง ✨",
          "actionLabelEN": "Tap to see equal parts up close",
          "emoji": "🧩"
        },
        {
          "titleTH": "สเต็ป 2/3: นับส่วนที่กินไป",
          "titleEN": "Micro-Step 2/3: Count the eaten parts",
          "bodyTH": "ถ้าพิซซ่ามี 4 ส่วน และกินไป 1 ส่วน เราจะเขียนว่า 1 ส่วนจาก 4 ส่วน",
          "bodyEN": "If the pizza has 4 parts and you eat 1, we write one part out of four.",
          "actionLabelTH": "กดเพื่อลองนับชิ้นที่กินไป ⚡",
          "actionLabelEN": "Tap to count the eaten pieces",
          "emoji": "⚡"
        },
        {
          "titleTH": "สเต็ป 3/3: เขียนเป็นเศษส่วน",
          "titleEN": "Micro-Step 3/3: Write the fraction",
          "bodyTH": "เศษส่วนเขียนว่า ตัวเศขบน = ส่วนที่ได้ ตัวเศขล่าง = ส่วนทั้งหมด เช่น 1/4",
          "bodyEN": "A fraction has the parts you got on top and all the parts underneath, like 1/4.",
          "actionLabelTH": "กดเพื่อดูวิธีเขียนเศษส่วน 🏆",
          "actionLabelEN": "Tap to see how to write it",
          "emoji": "🏆"
        }
      ]
    },
    {
      "id": "p6",
      "tier": "upper",
      "workspaceType": "clock",
      "gradeLabelTH": "ป.4–ป.6 (ประถมปลาย)",
      "gradeLabelEN": "Grades 4–6 (Upper Primary)",
      "topicTH": "เวลา (Time)",
      "topicEN": "Telling Time",
      "questionEN": [
        {
          "text": "The lesson starts at "
        },
        {
          "text": "3:00",
          "highlight": true
        },
        {
          "text": ". It takes half an hour. At what time does it end? Use the "
        },
        {
          "term": "difference",
          "display": "difference"
        },
        {
          "text": " between the two times."
        }
      ],
      "questionTH": [
        {
          "text": "เริ่มเรียนเวลา "
        },
        {
          "text": "3:00",
          "highlight": true
        },
        {
          "text": " ใช้เวลาอีกครึ่งชั่วโมง แล้วจะเลิกเวลาไหน ใช้ "
        },
        {
          "term": "difference",
          "display": "ผลต่าง"
        },
        {
          "text": " ระหว่างสองเวลาช่วยคิด"
        }
      ],
      "rawTTS_EN": "The lesson starts at 3 o'clock. It takes half an hour. At what time does it end?",
      "rawTTS_TH": "เริ่มเรียนเวลา 3 โมง ใช้เวลาอีกครึ่งชั่วโมง แล้วจะเลิกเวลาไหน",
      "choices": [
        "3:15",
        "3:30",
        "4:00",
        "3:45"
      ],
      "correctAnswer": "3:30",
      "clockConfig": {
        "hour": 3,
        "minute": 0,
        "targetHour": 3,
        "targetMinute": 30
      },
      "hint1TH": "ครึ่งชั่วโมงเท่ากับกี่นาที? นับเข็มนาทีไป 30 นาทีบนหน้าปัด",
      "hint1EN": "How many minutes is half an hour? Move the minute hand 30 steps.",
      "hint2TH": "ครึ่งชั่วโมง = 30 นาที เริ่มที่ 3:00 จึงเลิกเวลา 3:30",
      "hint2EN": "Half an hour is 30 minutes, so 3:00 becomes 3:30.",
      "nudgeTH": "ใกล้แล้ว! ลองหมุนเข็มนาทีไป 30 นาทีจาก 3:00 แล้วดูว่าเวลาเป็นอะไร",
      "nudgeEN": "Almost there! Move the minute hand 30 minutes from 3:00.",
      "steps": [
        {
          "titleTH": "ขั้นที่ 1: หาเวลาที่ใช้",
          "titleEN": "Step 1: Find the time that passes",
          "descTH": "ครึ่งชั่วโมงเท่ากับ 30 นาที",
          "descEN": "Half an hour is 30 minutes",
          "visual": "30 minutes"
        },
        {
          "titleTH": "ขั้นที่ 2: เดินเข็มนาที",
          "titleEN": "Step 2: Move the minute hand",
          "descTH": "จาก 3:00 เดินเข็มนาทีไป 30 นาที เข็มจะชี้ 6",
          "descEN": "From 3:00 move the minute hand 30 steps, it points at 6",
          "visual": "3:00 -> 3:30"
        },
        {
          "titleTH": "ขั้นที่ 3: ตอบเวลา",
          "titleEN": "Step 3: Say the time",
          "descTH": "เข็มชั่วโมงยังชี้ที่ 3 และเข็มนาทีชี้ที่ 6 → 3:30",
          "descEN": "The hour hand is still on 3 and the minute hand is on 6, so 3:30",
          "visual": "3:30"
        }
      ],
      "conceptMicroSteps": [
        {
          "titleTH": "สเต็ป 1/3: อ่านหน้าปัด",
          "titleEN": "Micro-Step 1/3: Read the clock face",
          "bodyTH": "เข็มสั้นบอกชั่วโมง เข็มยาวบอกนาที เข็มยาวชี้ที่เลข 6 แปลว่า 30 นาที",
          "bodyEN": "The short hand shows the hour, the long hand shows the minutes. Pointing at 6 means 30 minutes.",
          "actionLabelTH": "กดเพื่อดูหน้าปัดนาฬิกา ✨",
          "actionLabelEN": "Tap to see the clock face",
          "emoji": "🧩"
        },
        {
          "titleTH": "สเต็ป 2/3: รู้ว่าครึ่งชั่วโมงเท่ากับกี่นาที",
          "titleEN": "Micro-Step 2/3: Know that half an hour is 30 minutes",
          "bodyTH": "ครึ่งชั่วโมง = 30 นาที เพราะเต็มชั่วโมงมี 60 นาที",
          "bodyEN": "Half an hour is 30 minutes because a full hour has 60.",
          "actionLabelTH": "กดเพื่อนับนาทีบนหน้าปัด ⚡",
          "actionLabelEN": "Tap to count the minutes",
          "emoji": "⚡"
        },
        {
          "titleTH": "สเต็ป 3/3: บอกเวลาที่เลิก",
          "titleEN": "Micro-Step 3/3: Say the end time",
          "bodyTH": "เริ่ม 3:00 ใช้ 30 นาที จึงเลิกเวลา 3:30",
          "bodyEN": "Start at 3:00, add 30 minutes, so it ends at 3:30.",
          "actionLabelTH": "กดเพื่อดูคำตอบ 🏆",
          "actionLabelEN": "Tap to see the answer",
          "emoji": "🏆"
        }
      ]
    }
  
]

export function getDemoProblem(id: string): LessonProblem | undefined {
  return DEMO_PROBLEMS.find((problem) => problem.id === id)
}
