import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  Eye,
  Pencil,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Star,
  Gem,
  RotateCcw,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Layers,
  Award,
  Lightbulb,
  X,
  Plus,
  Minus,
  Calculator,
  Grid,
  Play,
  Globe,
  Eraser,
  Sliders,
  Compass
} from 'lucide-react';

// ==========================================
// SOUND EFFECTS ENGINE (Web Audio API)
// ==========================================
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.18, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === 'nudge') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(240, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch (e) {
    // Ignore audio errors if blocked by browser autoplay policy
  }
};

// ==========================================
// GLOSSARY DICTIONARY WITH VISUAL SVG DIAGRAMS
// ==========================================
const GLOSSARY_DB = {
  altogether: {
    en: 'Altogether',
    th: 'รวมกันทั้งหมด',
    phonetic: '/ˌɔːl.təˈɡeð.ər/',
    descEN: 'Combine two or more amounts into one total.',
    descTH: 'การนำจำนวนตั้งแต่ 2 กลุ่มมารวมกันเป็นจำนวนเดียว (ใช้การบวก +)',
    diagram: 'addition'
  },
  tens: {
    en: 'Tens',
    th: 'หลักสิบ',
    phonetic: '/tenz/',
    descEN: 'A group of 10 single units bundled together.',
    descTH: 'กลุ่มของจำนวน 10 หน่วยที่มัดรวมกันเป็น 1 แท่งสิบ',
    diagram: 'tens'
  },
  difference: {
    en: 'Difference',
    th: 'ผลต่าง',
    phonetic: '/ˈdɪf.ər.əns/',
    descEN: 'How much more or less one amount is compared to another.',
    descTH: 'ส่วนที่ต่างกันเมื่อนำสองจำนวนมาเปรียบเทียบกัน (ใช้การลบ -)',
    diagram: 'difference'
  },
  ratio: {
    en: 'Ratio',
    th: 'อัตราส่วน',
    phonetic: '/ˈreɪ.ʃi.oʊ/',
    descEN: 'Comparison of two quantities showing how many times one value contains another.',
    descTH: 'การเปรียบเทียบปริมาณสองปริมาณเป็นส่วนๆ ที่เท่ากัน เช่น 2 : 3',
    diagram: 'ratio'
  },
  perimeter: {
    en: 'Perimeter',
    th: 'ความยาวรอบรูป',
    phonetic: '/pəˈrɪm.ɪ.tər/',
    descEN: 'Total distance around the outside edge of a 2D shape.',
    descTH: 'ผลรวมความยาวของด้านทุกด้านที่ล้อมรอบรูปเรขาคณิต',
    diagram: 'perimeter'
  },
  equal_parts: {
    en: 'Equal parts',
    th: 'ส่วนที่เท่ากัน',
    phonetic: '/ˈiː.kwəl pɑːrts/',
    descEN: 'Sections or blocks that have the exact same size and value.',
    descTH: 'การแบ่งบาร์โมเดลหรือรูปภาพออกเป็นช่องที่มีขนาดและค่าเท่ากันทุกช่อง',
    diagram: 'equal_parts'
  }
};

// ==========================================
// LESSON & PROBLEM DATASET (LOWER & UPPER PRIMARY)
// ==========================================
const PROBLEMS = [
  // Problem 0: Lower Primary (P.1-P.3) - Addition & Base-10 Regrouping
  {
    id: 'p1',
    tier: 'lower',
    gradeLabelTH: 'ป.1–ป.3 (ประถมต้น)',
    gradeLabelEN: 'Grades 1–3 (Lower Primary)',
    topicTH: 'การบวกและการจัดกลุ่มหลักสิบ',
    topicEN: 'Addition & Place Value (Base-10)',
    questionEN: [
      { text: 'Mali has ' },
      { text: '14', highlight: true },
      { text: ' red apples and picks ' },
      { text: '12', highlight: true },
      { text: ' more. How many apples does she have ' },
      { term: 'altogether', display: 'altogether' },
      { text: '? Group by ' },
      { term: 'tens', display: 'tens' },
      { text: ' to find out!' }
    ],
    questionTH: [
      { text: 'มะลิมีแอปเปิ้ลสีแดง ' },
      { text: '14', highlight: true },
      { text: ' ผล และเก็บเพิ่มอีก ' },
      { text: '12', highlight: true },
      { text: ' ผล มะลิมีแอปเปิ้ล ' },
      { term: 'altogether', display: 'รวมกันทั้งหมด' },
      { text: ' กี่ผล? ลองจัดกลุ่ม ' },
      { term: 'tens', display: 'หลักสิบ' },
      { text: ' เพื่อหาคำตอบกัน!' }
    ],
    rawTTS_EN: 'Mali has 14 red apples and picks 12 more. How many apples does she have altogether?',
    rawTTS_TH: 'มะลิมีแอปเปิ้ลสีแดง 14 ผล และเก็บเพิ่มอีก 12 ผล มะลิมีแอปเปิ้ลรวมกันทั้งหมดกี่ผล',
    choices: ['24', '26', '28', '32'],
    correctAnswer: '26',
    initialTens: 2,
    initialOnes: 4,
    targetTens: 2,
    targetOnes: 6,
    hint1TH: 'ลองแยกตัวเลขเป็น แท่งสิบ (10) และ หน่วยย่อย (1) ดูสิ: 14 คือ 1 สิบ กับ 4 หน่วย',
    hint1EN: 'Break the numbers into Tens (10) and Ones (1): 14 is 1 Ten and 4 Ones!',
    hint2TH: '10 + 10 ได้ 20 (2 แท่งสิบ) และนำหลักหน่วยมารวมกัน: 4 + 2 = 6 หน่วย',
    hint2EN: '10 + 10 makes 20 (2 Tens rods), then add the ones: 4 + 2 = 6 Ones!',
    nudgeTH: 'เกือบถูกแล้ว! ลองนับแท่งหลักสิบ (2 แท่ง = 20) รวมกับหลักหน่วย (4 + 2 = 6) อีกครั้งนะ',
    nudgeEN: 'Almost there! Count the Tens rods (2 rods = 20) plus the Ones cubes (4 + 2 = 6) again!',
    steps: [
      {
        titleTH: 'ขั้นที่ 1: แยกหลักสิบและหลักหน่วย',
        titleEN: 'Step 1: Split into Tens and Ones',
        descTH: '14 = 1 แท่งสิบ + 4 หน่วย | 12 = 1 แท่งสิบ + 2 หน่วย',
        descEN: '14 = 1 Ten + 4 Ones | 12 = 1 Ten + 2 Ones',
        visual: '10 + 4   and   10 + 2'
      },
      {
        titleTH: 'ขั้นที่ 2: รวมแท่งหลักสิบเข้าด้วยกัน',
        titleEN: 'Step 2: Combine the Tens Rods',
        descTH: '1 แท่งสิบ + 1 แท่งสิบ = 2 แท่งสิบ (มีค่าเท่ากับ 20)',
        descEN: '1 Ten + 1 Ten = 2 Tens (which equals 20)',
        visual: '🟦 10 + 🟦 10 = 20'
      },
      {
        titleTH: 'ขั้นที่ 3: รวมหลักหน่วยเข้าด้วยกัน',
        titleEN: 'Step 3: Combine the Ones Cubes',
        descTH: '4 หน่วย + 2 หน่วย = 6 หน่วย เมื่อรวมกับ 20 จึงได้ 26!',
        descEN: '4 Ones + 2 Ones = 6 Ones. 20 + 6 = 26 altogether!',
        visual: '20 + 🟧 6 = 26'
      }
    ],
    conceptMicroSteps: [
      {
        titleTH: 'สเต็ป 1/3: รู้จักกับบล็อกฐานสิบ (Base-10)',
        titleEN: 'Micro-Step 1/3: Meet Base-10 Blocks',
        bodyTH: 'เวลาเจอเลขเยอะๆ เราจะมัดบล็อกเล็ก 10 ชิ้น รวมเป็น "แท่งสิบ" สีฟ้า 1 แท่ง เพื่อให้นับง่ายขึ้น!',
        bodyEN: 'When counting larger numbers, we bundle 10 single cubes into 1 blue "Tens Rod" so we can count super fast!',
        actionLabelTH: 'กดเพื่อมัดรวม 10 หน่วยเป็น 1 แท่งสิบ ✨',
        actionLabelEN: 'Click to bundle 10 Ones into 1 Ten Rod ✨'
      },
      {
        titleTH: 'สเต็ป 2/3: บวกหลักสิบก่อน แล้วค่อยบวกหลักหน่วย',
        titleEN: 'Micro-Step 2/3: Add Tens First, Then Ones',
        bodyTH: 'ในการหาผลรวม (Altogether) ของ 14 + 12 เราแค่นำแท่งสิบมารวมกับแท่งสิบ และหน่วยรวมกับหน่วย',
        bodyEN: 'To find the total altogether for 14 + 12, put the blue Tens rods together and the orange Ones cubes together.',
        actionLabelTH: 'กดเพื่อจัดกลุ่มแท่งสิบและหน่วย 🧩',
        actionLabelEN: 'Click to group Tens & Ones together 🧩'
      },
      {
        titleTH: 'สเต็ป 3/3: พร้อมลุยโจทย์จริงแล้ว!',
        titleEN: 'Micro-Step 3/3: Ready for the Challenge!',
        bodyTH: 'เห็นไหมว่า 2 แท่งสิบ (20) กับ 6 หน่วย รวมกันเป็น 26 ง่ายนิดเดียว ลองไปทำโจทย์ด้วยตัวเองกันเลย!',
        bodyEN: '2 Tens (20) and 6 Ones make 26! Now try using the interactive workspace yourself!',
        actionLabelTH: 'เริ่มทำโจทย์ฝึกหัดกันเลย 🚀',
        actionLabelEN: 'Start Practice Problem 🚀'
      }
    ]
  },

  // Problem 1: Lower Primary (P.1-P.3) - Subtraction / Difference
  {
    id: 'p2',
    tier: 'lower',
    gradeLabelTH: 'ป.1–ป.3 (ประถมต้น)',
    gradeLabelEN: 'Grades 1–3 (Lower Primary)',
    topicTH: 'การเปรียบเทียบและหาผลต่าง',
    topicEN: 'Comparing Numbers & Difference',
    questionEN: [
      { text: 'Leo collected ' },
      { text: '35', highlight: true },
      { text: ' golden stars. Mina collected ' },
      { text: '21', highlight: true },
      { text: ' golden stars. What is the ' },
      { term: 'difference', display: 'difference' },
      { text: ' between their stars? Check the ' },
      { term: 'tens', display: 'tens' },
      { text: ' and ones!' }
    ],
    questionTH: [
      { text: 'ลีโอสะสมดาวทองได้ ' },
      { text: '35', highlight: true },
      { text: ' ดวง มินาสะสมได้ ' },
      { text: '21', highlight: true },
      { text: ' ดวง ' },
      { term: 'difference', display: 'ผลต่าง' },
      { text: ' ของจำนวนดาวของทั้งสองคนคือเท่าไร? ลองดูที่ ' },
      { term: 'tens', display: 'หลักสิบ' },
      { text: ' และหลักหน่วยนะ!' }
    ],
    rawTTS_EN: 'Leo collected 35 golden stars. Mina collected 21 golden stars. What is the difference between their stars?',
    rawTTS_TH: 'ลีโอสะสมดาวทองได้ 35 ดวง มินาสะสมได้ 21 ดวง ผลต่างของจำนวนดาวของทั้งสองคนคือเท่าไร',
    choices: ['12', '14', '16', '56'],
    correctAnswer: '14',
    initialTens: 3,
    initialOnes: 5,
    targetTens: 1,
    targetOnes: 4,
    hint1TH: 'คำว่า "ผลต่าง (Difference)" แปลว่าต้องนำเลขมากตั้ง แล้วลบด้วยเลขน้อย (35 - 21)',
    hint1EN: '"Difference" means we subtract the smaller number from the larger number (35 - 21).',
    hint2TH: 'ลองกดปุ่มลบแท่งสิบออก 2 แท่ง (30 - 20 = 10) และลบหน่วยออก 1 ชิ้น (5 - 1 = 4)',
    hint2EN: 'Remove 2 Tens rods (30 - 20 = 10) and remove 1 Ones cube (5 - 1 = 4).',
    nudgeTH: 'ระวังสับสนกับการบวกนะ! คำว่า "ผลต่าง (Difference)" คือการหักออก (35 ลบออก 21 เหลือเท่าไรเอ่ย?)',
    nudgeEN: 'Careful! "Difference" means subtracting (35 minus 21), not adding them together!',
    steps: [
      {
        titleTH: 'ขั้นที่ 1: ตั้งจำนวนเริ่มต้นของลีโอ (35)',
        titleEN: 'Step 1: Start with Leo’s amount (35)',
        descTH: '35 ประกอบด้วย 3 แท่งสิบ (30) และ 5 หน่วย',
        descEN: '35 has 3 Tens rods (30) and 5 Ones cubes.',
        visual: '🟦🟦🟦 (30) + 🟧🟧🟧🟧🟧 (5)'
      },
      {
        titleTH: 'ขั้นที่ 2: หักออกตามจำนวนของมินา (21)',
        titleEN: 'Step 2: Subtract Mina’s amount (21)',
        descTH: 'ลบหลักสิบ: 3 แท่ง - 2 แท่ง = เหลือ 1 แท่งสิบ (10)',
        descEN: 'Subtract Tens: 3 Tens - 2 Tens = 1 Ten left (10).',
        visual: '30 - 20 = 10'
      },
      {
        titleTH: 'ขั้นที่ 3: ลบหลักหน่วยแล้วรวมผลลัพธ์',
        titleEN: 'Step 3: Subtract Ones & Combine',
        descTH: 'ลบหลักหน่วย: 5 - 1 = เหลือ 4 หน่วย รวมเป็น 14 ดวง!',
        descEN: 'Subtract Ones: 5 - 1 = 4 Ones left. Total difference is 14!',
        visual: '10 + 4 = 14'
      }
    ],
    conceptMicroSteps: [
      {
        titleTH: 'สเต็ป 1/3: คำว่า "Difference (ผลต่าง)" คืออะไร?',
        titleEN: 'Micro-Step 1/3: What does "Difference" mean?',
        bodyTH: 'ในโจทย์ EP คำว่า Difference ไม่ได้แปลว่าแปลกต่างกันเฉยๆ แต่หมายถึง "มากกว่ากันอยู่เท่าไร" ซึ่งใช้การลบ (-)',
        bodyEN: 'In math word problems, "Difference" asks how much more one number is than another using subtraction (-).',
        actionLabelTH: 'กดเพื่อเปรียบเทียบ 35 กับ 21 🔍',
        actionLabelEN: 'Click to compare 35 and 21 🔍'
      },
      {
        titleTH: 'สเต็ป 2/3: หักบล็อกออกทีละหลัก',
        titleEN: 'Micro-Step 2/3: Take Away Tens and Ones',
        bodyTH: 'มี 3 แท่งสิบ เอาออก 2 แท่งสิบ เหลือ 1 แท่งสิบ! มี 5 หน่วย เอาออก 1 หน่วย เหลือ 4 หน่วย!',
        bodyEN: 'From 3 Tens, take away 2 Tens -> 1 Ten left! From 5 Ones, take away 1 One -> 4 Ones left!',
        actionLabelTH: 'กดเพื่อดูผลลัพธ์หลังหักออก ✨',
        actionLabelEN: 'Click to see remaining blocks ✨'
      },
      {
        titleTH: 'สเต็ป 3/3: ลองปรับบล็อกในกระดานจริงกัน!',
        titleEN: 'Micro-Step 3/3: Try it on the Workspace!',
        bodyTH: 'คุณสามารถกดปุ่ม + / - บนกระดานเพื่อจำลองการลบเลขได้ด้วยตัวเอง พร้อมแล้วไปลุยเลย!',
        bodyEN: 'You can click + and - on the workspace to model the subtraction yourself!',
        actionLabelTH: 'ไปที่โจทย์ฝึกหัด 🚀',
        actionLabelEN: 'Go to Practice Problem 🚀'
      }
    ]
  },

  // Problem 2: Upper Primary (P.4-P.6) - Singapore Math Bar Model (Ratio & Word Problem)
  {
    id: 'p3',
    tier: 'upper',
    gradeLabelTH: 'ป.4–ป.6 (ประถมปลาย)',
    gradeLabelEN: 'Grades 4–6 (Upper Primary)',
    topicTH: 'การแก้โจทย์ปัญหาด้วยบาร์โมเดล (Bar Model)',
    topicEN: 'Singapore Math Bar Model & Ratio',
    questionEN: [
      { text: 'In a coding club, the ' },
      { term: 'ratio', display: 'ratio' },
      { text: ' of boys to girls is ' },
      { text: '3 : 2', highlight: true },
      { text: '. Dividing the bar model into ' },
      { term: 'equal_parts', display: 'equal parts' },
      { text: ', if there are ' },
      { text: '45', highlight: true },
      { text: ' students ' },
      { term: 'altogether', display: 'altogether' },
      { text: ', how many boys are in the club?' }
    ],
    questionTH: [
      { text: 'ในชมรมโค้ดดิ้งมี ' },
      { term: 'ratio', display: 'อัตราส่วน' },
      { text: ' ของนักเรียนชายต่อนักเรียนหญิงเป็น ' },
      { text: '3 : 2', highlight: true },
      { text: ' เมื่อแบ่งบาร์โมเดลออกเป็น ' },
      { term: 'equal_parts', display: 'ส่วนที่เท่ากัน' },
      { text: ' ถ้ามีนักเรียน ' },
      { term: 'altogether', display: 'รวมกันทั้งหมด' },
      { text: ' ' },
      { text: '45', highlight: true },
      { text: ' คน จะมีนักเรียนชายกี่คน?' }
    ],
    rawTTS_EN: 'In a coding club, the ratio of boys to girls is 3 to 2. If there are 45 students altogether, how many boys are in the club?',
    rawTTS_TH: 'ในชมรมโค้ดดิ้งมีอัตราส่วนของนักเรียนชายต่อนักเรียนหญิงเป็น 3 ต่อ 2 ถ้ามีนักเรียนรวมกันทั้งหมด 45 คน จะมีนักเรียนชายกี่คน',
    choices: ['18', '25', '27', '30'],
    correctAnswer: '27',
    barModelConfig: {
      labelA_TH: 'นักเรียนชาย (Boys)',
      labelA_EN: 'Boys',
      labelB_TH: 'นักเรียนหญิง (Girls)',
      labelB_EN: 'Girls',
      defaultPartsA: 3,
      defaultPartsB: 2,
      totalValue: 45,
      unitValue: 9
    },
    hint1TH: 'ดูที่บาร์โมเดล: นักเรียนชายมี 3 ส่วน นักเรียนหญิงมี 2 ส่วน รวมทั้งหมดมีกี่ส่วน (Units)?',
    hint1EN: 'Look at the Bar Model: Boys have 3 units and Girls have 2 units. How many units are there in total?',
    hint2TH: 'รวมทั้งหมด 5 ส่วน = 45 คน แปลว่า 1 ส่วนมีค่าเท่ากับ 45 ÷ 5 = 9 คน! แล้ว 3 ส่วนของนักเรียนชายคือเท่าไร?',
    hint2EN: '5 total units = 45 students. So 1 unit = 45 ÷ 5 = 9 students! Now find 3 units for Boys.',
    nudgeTH: 'เกือบได้แล้ว! 1 ส่วน (Unit) มีค่าเท่ากับ 9 คน (45 ÷ 5) แต่นักเรียนชายมี 3 ส่วน ลองนำ 3 × 9 ดูอีกครั้งนะ',
    nudgeEN: 'Close! 1 unit equals 9 students (45 ÷ 5). Since Boys have 3 units, multiply 3 × 9!',
    steps: [
      {
        titleTH: 'ขั้นที่ 1: นับจำนวนส่วน (Units) ทั้งหมดในบาร์โมเดล',
        titleEN: 'Step 1: Count Total Equal Units in the Bar Model',
        descTH: 'ชาย 3 ส่วน + หญิง 2 ส่วน = รวมทั้งหมด 5 ส่วนที่เท่ากัน',
        descEN: 'Boys (3 units) + Girls (2 units) = 5 equal units altogether.',
        visual: '[ 1 ][ 2 ][ 3 ] + [ 4 ][ 5 ] = 5 Units'
      },
      {
        titleTH: 'ขั้นที่ 2: หาค่าของ 1 ส่วน (Find 1 Unit)',
        titleEN: 'Step 2: Find the Value of 1 Unit',
        descTH: '5 ส่วน = 45 คน ดังนั้น 1 ส่วน = 45 ÷ 5 = 9 คน',
        descEN: '5 units = 45 students → 1 unit = 45 ÷ 5 = 9 students.',
        visual: '1 Unit = 45 ÷ 5 = 9'
      },
      {
        titleTH: 'ขั้นที่ 3: คำนวณจำนวนนักเรียนชาย (3 ส่วน)',
        titleEN: 'Step 3: Calculate Boys (3 Units)',
        descTH: 'นักเรียนชายมี 3 ส่วน = 3 × 9 = 27 คน',
        descEN: 'Boys = 3 units × 9 = 27 students!',
        visual: '[ 9 ][ 9 ][ 9 ] = 27'
      }
    ],
    conceptMicroSteps: [
      {
        titleTH: 'สเต็ป 1/3: เปลี่ยนโจทย์ยาวๆ ให้เป็นภาพด้วย Bar Model',
        titleEN: 'Micro-Step 1/3: Visualize Word Problems with Bar Models',
        bodyTH: 'เมื่อเจอคำว่า Ratio (อัตราส่วน) 3 : 2 เราสามารถวาดแท่งบาร์โมเดลแบ่งเป็น 3 ช่องสำหรับชาย และ 2 ช่องสำหรับหญิง',
        bodyEN: 'When you see a Ratio of 3 : 2, draw a Singapore Bar Model with 3 equal blocks for Boys and 2 equal blocks for Girls.',
        actionLabelTH: 'กดเพื่อสร้างแท่งบาร์โมเดล 3 : 2 📊',
        actionLabelEN: 'Click to build the 3 : 2 Bar Model 📊'
      },
      {
        titleTH: 'สเต็ป 2/3: กฎทองของบาร์โมเดล — "หาค่าของ 1 ช่องก่อนเสมอ!"',
        titleEN: 'Micro-Step 2/3: Golden Rule — "Always Find 1 Unit First!"',
        bodyTH: 'เมื่อรวมทั้ง 5 ช่องมีค่าเท่ากับ 45 คน เราจึงนำ 45 ÷ 5 เพื่อใส่ตัวเลข 9 ลงในทุกๆ ช่อง',
        bodyEN: 'Since all 5 blocks equal 45 altogether, divide 45 ÷ 5 = 9. Every single block holds 9!',
        actionLabelTH: 'กดเพื่อเติมค่า 1 ช่อง = 9 ลงในบาร์ 🔢',
        actionLabelEN: 'Click to fill 9 into each unit block 🔢'
      },
      {
        titleTH: 'สเต็ป 3/3: ทดลองปรับบาร์โมเดลในโจทย์จริง!',
        titleEN: 'Micro-Step 3/3: Interactive Bar Model Workspace!',
        bodyTH: 'ในหน้าถัดไป คุณสามารถเพิ่ม/ลดช่องบาร์โมเดล และเปิดโหมดแสดงค่าต่อช่องได้ด้วยตัวเอง ไปลองกันเลย!',
        bodyEN: 'In Practice Mode, you can adjust the bars and toggle unit values interactively!',
        actionLabelTH: 'เข้าสู่โหมดโจทย์ฝึกหัด 🚀',
        actionLabelEN: 'Enter Practice Mode 🚀'
      }
    ]
  },

  // Problem 3: Upper Primary (P.4-P.6) - Perimeter & Comparison Bar Model
  {
    id: 'p4',
    tier: 'upper',
    gradeLabelTH: 'ป.4–ป.6 (ประถมปลาย)',
    gradeLabelEN: 'Grades 4–6 (Upper Primary)',
    topicTH: 'เรขาคณิตและบาร์โมเดลเปรียบเทียบ',
    topicEN: 'Geometry Perimeter & Comparison Model',
    questionEN: [
      { text: 'A rectangular solar panel has a length to width ' },
      { term: 'ratio', display: 'ratio' },
      { text: ' of ' },
      { text: '4 : 1', highlight: true },
      { text: '. If the ' },
      { term: 'difference', display: 'difference' },
      { text: ' between its length and width is ' },
      { text: '24 cm', highlight: true },
      { text: ', what is the length of one long side? (Hint: Use ' },
      { term: 'equal_parts', display: 'equal parts' },
      { text: ' before finding ' },
      { term: 'perimeter', display: 'perimeter' },
      { text: '!)' }
    ],
    questionTH: [
      { text: 'แผงโซลาร์เซลล์ทรงสี่เหลี่ยมผืนผ้ามี ' },
      { term: 'ratio', display: 'อัตราส่วน' },
      { text: ' ความยาวต่อความกว้างเป็น ' },
      { text: '4 : 1', highlight: true },
      { text: ' ถ้า ' },
      { term: 'difference', display: 'ผลต่าง' },
      { text: ' ของด้านยาวและด้านกว้างคือ ' },
      { text: '24 ซม.', highlight: true },
      { text: ' ด้านยาวจะยาวกี่เซนติเมตร? (คำใบ้: แบ่งเป็น ' },
      { term: 'equal_parts', display: 'ส่วนที่เท่ากัน' },
      { text: ' ก่อนหา ' },
      { term: 'perimeter', display: 'ความยาวรอบรูป' },
      { text: ')' }
    ],
    rawTTS_EN: 'A rectangular solar panel has a length to width ratio of 4 to 1. If the difference between its length and width is 24 centimeters, what is the length of one long side?',
    rawTTS_TH: 'แผงโซลาร์เซลล์ทรงสี่เหลี่ยมผืนผ้ามีอัตราส่วนความยาวต่อความกว้างเป็น 4 ต่อ 1 ถ้าผลต่างของด้านยาวและด้านกว้างคือ 24 เซนติเมตร ด้านยาวจะยาวกี่เซนติเมตร',
    choices: ['28', '32', '36', '40'],
    correctAnswer: '32',
    barModelConfig: {
      labelA_TH: 'ด้านยาว (Length)',
      labelA_EN: 'Length',
      labelB_TH: 'ด้านกว้าง (Width)',
      labelB_EN: 'Width',
      defaultPartsA: 4,
      defaultPartsB: 1,
      totalValue: 40,
      differenceValue: 24,
      unitValue: 8
    },
    hint1TH: 'ด้านยาวมี 4 ส่วน ด้านกว้างมี 1 ส่วน ดังนั้น "ผลต่าง (Difference)" คือ 4 - 1 = 3 ส่วนที่เกินออกมา!',
    hint1EN: 'Length has 4 units, Width has 1 unit. The "difference" is the extra 4 - 1 = 3 units!',
    hint2TH: '3 ส่วนที่เกินมา = 24 ซม. แปลว่า 1 ส่วน = 24 ÷ 3 = 8 ซม. ดังนั้นด้านยาว 4 ส่วนจึงเท่ากับ 4 × 8!',
    hint2EN: '3 extra units = 24 cm → 1 unit = 24 ÷ 3 = 8 cm. So Length (4 units) = 4 × 8!',
    nudgeTH: 'ลองดูที่ส่วนต่างในบาร์โมเดลนะ: 3 ช่องที่เกินออกมามีค่า 24 ซม. (ช่องละ 8 ซม.) ด้านยาวมี 4 ช่อง ดังนั้น 4 × 8 ได้เท่าไร?',
    nudgeEN: 'Check the difference bracket on the Bar Model: 3 extra units = 24 cm (8 cm per unit). Length is 4 units (4 × 8)!',
    steps: [
      {
        titleTH: 'ขั้นที่ 1: หาจำนวนส่วนที่ต่างกัน (Difference in Units)',
        titleEN: 'Step 1: Find the Difference in Units',
        descTH: 'ด้านยาว (4 ส่วน) - ด้านกว้าง (1 ส่วน) = ต่างกันอยู่ 3 ส่วน',
        descEN: 'Length (4 units) - Width (1 unit) = 3 extra units.',
        visual: '4 Units - 1 Unit = 3 Units Difference'
      },
      {
        titleTH: 'ขั้นที่ 2: หาค่าของ 1 ส่วนจากผลต่าง',
        titleEN: 'Step 2: Find 1 Unit from the Difference',
        descTH: '3 ส่วน = 24 ซม. ดังนั้น 1 ส่วน = 24 ÷ 3 = 8 ซม.',
        descEN: '3 units = 24 cm → 1 unit = 24 ÷ 3 = 8 cm.',
        visual: '1 Unit = 24 ÷ 3 = 8 cm'
      },
      {
        titleTH: 'ขั้นที่ 3: คำนวณความยาวของด้านยาว (4 ส่วน)',
        titleEN: 'Step 3: Calculate Length (4 Units)',
        descTH: 'ด้านยาวมี 4 ส่วน = 4 × 8 = 32 เซนติเมตร!',
        descEN: 'Length = 4 units × 8 cm = 32 cm!',
        visual: '[ 8 ][ 8 ][ 8 ][ 8 ] = 32 cm'
      }
    ],
    conceptMicroSteps: [
      {
        titleTH: 'สเต็ป 1/3: บาร์โมเดลแบบเปรียบเทียบผลต่าง (Comparison Model)',
        titleEN: 'Micro-Step 1/3: Comparison Bar Models',
        bodyTH: 'เมื่อโจทย์บอก "ผลต่าง (Difference)" เราจะวางบาร์ 2 แท่งซ้อนกัน เพื่อดูว่าแท่งยาวเกินแท่งสั้นออกมากี่ช่อง',
        bodyEN: 'When a problem gives the "Difference", align the two bars on the left to see how many extra units stick out!',
        actionLabelTH: 'กดเพื่อเทียบส่วนที่เกินออกมา 3 ช่อง 📐',
        actionLabelEN: 'Click to highlight the 3 extra units 📐'
      },
      {
        titleTH: 'สเต็ป 2/3: แบ่งค่าผลต่างลงในช่องที่เกินมา',
        titleEN: 'Micro-Step 2/3: Divide the Difference Evenly',
        bodyTH: 'ส่วนที่เกินมา 3 ช่อง ยาวเท่ากับ 24 ซม. ดังนั้นแต่ละช่องจึงมีค่า 24 ÷ 3 = 8 ซม. เท่ากันทุกช่อง!',
        bodyEN: 'Those 3 extra units equal 24 cm, so each unit is 24 ÷ 3 = 8 cm across the entire diagram!',
        actionLabelTH: 'กดเพื่อใส่ค่า 8 ซม. ในทุกช่อง ✨',
        actionLabelEN: 'Click to label 8 cm per unit ✨'
      },
      {
        titleTH: 'สเต็ป 3/3: พร้อมพิชิตโจทย์ประถมปลาย!',
        titleEN: 'Micro-Step 3/3: Ready to Solve!',
        bodyTH: 'เมื่อรู้ว่า 1 ช่อง = 8 ซม. การหาด้านยาว 4 ช่องก็ง่ายทันที ลองไปปรับบาร์โมเดลในหน้าโจทย์กัน!',
        bodyEN: 'Once you know 1 unit = 8 cm, finding 4 units is super easy. Let’s jump to the problem!',
        actionLabelTH: 'เริ่มทำโจทย์ข้อนี้ 🚀',
        actionLabelEN: 'Solve This Problem 🚀'
      }
    ]
  }
];

// ==========================================
// GLOSSARY DIAGRAM RENDERER (MINI SVG)
// ==========================================
const GlossaryDiagram = ({ type }) => {
  switch (type) {
    case 'addition':
      return (
        <svg viewBox="0 0 220 70" className="w-full h-16 bg-amber-50 rounded-xl border border-amber-200 p-1">
          <rect x="15" y="18" width="55" height="24" rx="6" fill="#f97316" />
          <text x="42" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Part A</text>
          <text x="82" y="35" textAnchor="middle" fill="#ea580c" fontSize="16" fontWeight="bold">+</text>
          <rect x="95" y="18" width="45" height="24" rx="6" fill="#3b82f6" />
          <text x="117" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Part B</text>
          <path d="M15 48 Q77 62 140 48" stroke="#16a34a" strokeWidth="2.5" fill="none" />
          <text x="178" y="36" textAnchor="middle" fill="#15803d" fontSize="12" fontWeight="bold">= Total!</text>
        </svg>
      );
    case 'tens':
      return (
        <svg viewBox="0 0 220 70" className="w-full h-16 bg-sky-50 rounded-xl border border-sky-200 p-1">
          {[...Array(10)].map((_, i) => (
            <rect key={i} x={14 + i * 18} y="22" width="15" height="26" rx="2" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1" />
          ))}
          <text x="110" y="62" textAnchor="middle" fill="#0369a1" fontSize="10" fontWeight="bold">10 Ones = 1 Ten Rod (1 แท่งสิบ)</text>
        </svg>
      );
    case 'difference':
      return (
        <svg viewBox="0 0 220 70" className="w-full h-16 bg-rose-50 rounded-xl border border-rose-200 p-1">
          <rect x="15" y="12" width="130" height="20" rx="4" fill="#6366f1" />
          <rect x="15" y="38" width="75" height="20" rx="4" fill="#94a3b8" />
          <line x1="92" y1="38" x2="145" y2="38" stroke="#e11d48" strokeWidth="2" strokeDasharray="3 3" />
          <rect x="92" y="36" width="53" height="22" rx="4" fill="#ffe4e6" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x="118" y="51" textAnchor="middle" fill="#be123c" fontSize="10" fontWeight="bold">Diff (?)</text>
        </svg>
      );
    case 'ratio':
    case 'equal_parts':
      return (
        <svg viewBox="0 0 220 70" className="w-full h-16 bg-indigo-50 rounded-xl border border-indigo-200 p-1">
          {[0, 1, 2].map((i) => (
            <rect key={i} x={20 + i * 36} y="14" width="33" height="20" rx="4" fill="#4f46e5" />
          ))}
          {[0, 1].map((i) => (
            <rect key={i} x={20 + i * 36} y="38" width="33" height="20" rx="4" fill="#06b6d4" />
          ))}
          <text x="165" y="28" textAnchor="middle" fill="#3730a3" fontSize="11" fontWeight="bold">3 Units</text>
          <text x="165" y="52" textAnchor="middle" fill="#0e7490" fontSize="11" fontWeight="bold">2 Units</text>
        </svg>
      );
    case 'perimeter':
      return (
        <svg viewBox="0 0 220 70" className="w-full h-16 bg-emerald-50 rounded-xl border border-emerald-200 p-1">
          <rect x="55" y="14" width="110" height="42" rx="4" fill="#d1fae5" stroke="#059669" strokeWidth="3" strokeDasharray="6 3" />
          <text x="110" y="39" textAnchor="middle" fill="#065f46" fontSize="11" fontWeight="bold">All 4 Sides = Perimeter</text>
        </svg>
      );
    default:
      return null;
  }
};

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Core Navigation & Curriculum States
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const currentProblem = PROBLEMS[currentProblemIndex];
  const isLowerTier = currentProblem.tier === 'lower';

  // Modes: 'practice' (โหมดโจทย์) | 'concept' (โหมดสอน Micro-steps)
  const [lessonMode, setLessonMode] = useState('practice');
  const [conceptStep, setConceptStep] = useState(0);

  // Language Engine: 'BILINGUAL' | 'EP' | 'TH'
  const [langMode, setLangMode] = useState('BILINGUAL');
  const [isPeekingTranslation, setIsPeekingTranslation] = useState(false);
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Rewards & Gamification
  const [stars, setStars] = useState(120);
  const [gems, setGems] = useState(15);
  const [rewardBurst, setRewardBurst] = useState(false);
  const [completedIds, setCompletedIds] = useState([]);

  // Input & Feedback Loop State
  const [inputMode, setInputMode] = useState('choices'); // 'choices' | 'keypad'
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [feedbackState, setFeedbackState] = useState('idle'); // 'idle' | 'nudge' | 'correct' | 'solution_modal'

  // Interactive Workspace State - Lower Primary (Base-10 Blocks)
  const [tensCount, setTensCount] = useState(currentProblem.initialTens || 2);
  const [onesCount, setOnesCount] = useState(currentProblem.initialOnes || 6);

  // Interactive Workspace State - Upper Primary (Singapore Bar Model)
  const [barPartsA, setBarPartsA] = useState(currentProblem.barModelConfig?.defaultPartsA || 3);
  const [barPartsB, setBarPartsB] = useState(currentProblem.barModelConfig?.defaultPartsB || 2);
  const [showUnitValues, setShowUnitValues] = useState(false);
  const [showBrackets, setShowBrackets] = useState(true);

  // Utility Dock Modals & Overlays
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [penColor, setPenColor] = useState('#ef4444');
  const [isEraser, setIsEraser] = useState(false);
  const [hintDrawerOpen, setHintDrawerOpen] = useState(false);
  const [hintLevel, setHintLevel] = useState(1);
  const [vocabDrawerOpen, setVocabDrawerOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  // Canvas Refs for Scratchpad
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Sync interactive manipulatives when problem changes
  useEffect(() => {
    setSelectedAnswer('');
    setWrongAttempts(0);
    setFeedbackState('idle');
    setActiveGlossaryTerm(null);
    setHintDrawerOpen(false);
    setHintLevel(1);
    setConceptStep(0);

    if (currentProblem.tier === 'lower') {
      setTensCount(currentProblem.initialTens || 2);
      setOnesCount(currentProblem.initialOnes || 4);
    } else if (currentProblem.barModelConfig) {
      setBarPartsA(currentProblem.barModelConfig.defaultPartsA);
      setBarPartsB(currentProblem.barModelConfig.defaultPartsB);
      setShowUnitValues(false);
      setShowBrackets(true);
    }
  }, [currentProblemIndex]);

  // Setup Scratchpad Canvas on resize or toggle
  useEffect(() => {
    if (!scratchpadOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, [scratchpadOpen]);

  // ==========================================
  // TEXT-TO-SPEECH (DUAL-VOICE TTS)
  // ==========================================
  const speakQuestion = (lang) => {
    playSound('pop');
    setIsSpeaking(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = lang === 'TH' ? currentProblem.rawTTS_TH : currentProblem.rawTTS_EN;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'TH' ? 'th-TH' : 'en-US';
      utterance.rate = 0.92;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsSpeaking(false), 2000);
    }
  };

  // ==========================================
  // SCRATCHPAD DRAWING HANDLERS
  // ==========================================
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 26;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 4;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    playSound('pop');
  };

  // ==========================================
  // EMPATHETIC 2-STAGE ANSWER CHECKING LOOP
  // ==========================================
  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;

    if (selectedAnswer === currentProblem.correctAnswer) {
      playSound('success');
      setFeedbackState('correct');
      if (!completedIds.includes(currentProblem.id)) {
        setCompletedIds([...completedIds, currentProblem.id]);
      }
      setStars((prev) => prev + 10);
      setGems((prev) => prev + 1);
      setRewardBurst(true);
      setTimeout(() => setRewardBurst(false), 1800);
    } else {
      playSound('nudge');
      if (wrongAttempts === 0) {
        // Attempt 1: Gentle Amber Nudge (No scary red X!)
        setWrongAttempts(1);
        setFeedbackState('nudge');
      } else {
        // Attempt 2: Open Step-by-Step Visual Solution Modal
        setWrongAttempts(2);
        setFeedbackState('solution_modal');
      }
    }
  };

  const handleNextProblem = () => {
    playSound('pop');
    const nextIdx = (currentProblemIndex + 1) % PROBLEMS.length;
    setCurrentProblemIndex(nextIdx);
  };

  // Helper to render tokenized problem text with interactive Glossary underlines
  const renderTokenizedLine = (tokens, isThaiLine) => {
    return (
      <span className="leading-relaxed">
        {tokens.map((tok, i) => {
          if (tok.term) {
            const termData = GLOSSARY_DB[tok.term];
            const isActive = activeGlossaryTerm === tok.term;
            return (
              <button
                key={i}
                onClick={() => {
                  playSound('pop');
                  setActiveGlossaryTerm(isActive ? null : tok.term);
                }}
                className={`inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-lg font-bold transition-all border-b-2 border-dashed cursor-pointer ${
                  isLowerTier
                    ? isActive
                      ? 'bg-amber-200 text-amber-950 border-amber-600 scale-105'
                      : 'bg-amber-100/80 text-amber-900 border-amber-500 hover:bg-amber-200/70'
                    : isActive
                    ? 'bg-cyan-500/30 text-cyan-200 border-cyan-300 scale-105'
                    : 'bg-indigo-950/60 text-cyan-300 border-cyan-400 hover:bg-indigo-900/80'
                }`}
                title="Click for Bilingual Visual Glossary"
              >
                <span>{tok.display}</span>
                <Sparkles className="w-3.5 h-3.5 inline shrink-0 opacity-80" />
              </button>
            );
          }
          if (tok.highlight) {
            return (
              <span
                key={i}
                className={`inline-block mx-0.5 px-2 py-0.5 rounded-lg font-extrabold ${
                  isLowerTier
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 shadow-sm'
                }`}
              >
                {tok.text}
              </span>
            );
          }
          return <span key={i}>{tok.text}</span>;
        })}
      </span>
    );
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col justify-between select-none transition-colors duration-500 ${
        isLowerTier
          ? 'bg-gradient-to-b from-sky-100 via-amber-50/60 to-emerald-50 text-slate-800'
          : 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100'
      }`}
      style={{
        fontFamily: isLowerTier
          ? "'Fredoka', 'Sarabun', sans-serif"
          : "'Nunito', 'Sarabun', sans-serif"
      }}
    >
      {/* Google Fonts Injection for Thai & English Primary Readability */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito:wght@500;700;800&family=Sarabun:wght@400;600;700;800&display=swap');
        @keyframes gentleShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-gentle-shake {
          animation: gentleShake 0.45s ease-in-out;
        }
      `}</style>

      {/* =========================================================
          ZONE 1: TOP NAVIGATION BAR & ADAPTIVE THEME DEMO CONTROLS
         ========================================================= */}
      <header
        className={`h-16 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 border-b z-30 transition-colors ${
          isLowerTier
            ? 'bg-white/90 backdrop-blur-md border-amber-200 shadow-sm'
            : 'bg-slate-900/90 backdrop-blur-md border-indigo-500/30 shadow-lg'
        }`}
      >
        {/* Left: Exit Button + Age Tier Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              playSound('pop');
              setExitModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 font-bold transition-all active:scale-95 ${
              isLowerTier
                ? 'bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-[0_3px_0_#c2410c]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Exit</span>
          </button>

          {/* Dynamic Age-Tier Switcher (P.1-P.3 vs P.4-P.6) */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isLowerTier ? 'bg-amber-100/80 border-amber-300' : 'bg-slate-800 border-indigo-500/40'
            }`}
          >
            <button
              onClick={() => {
                playSound('pop');
                setCurrentProblemIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                isLowerTier
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌱 ป.1–ป.3 (Adventure)
            </button>
            <button
              onClick={() => {
                playSound('pop');
                setCurrentProblemIndex(2);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                !isLowerTier
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚀 ป.4–ป.6 (Sci-Fi Quest)
            </button>
          </div>

          {/* Concept vs Practice Mode Switcher */}
          <div
            className={`hidden md:flex items-center p-1 rounded-xl border ${
              isLowerTier ? 'bg-sky-100 border-sky-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <button
              onClick={() => {
                playSound('pop');
                setLessonMode('concept');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lessonMode === 'concept'
                  ? isLowerTier
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : isLowerTier
                  ? 'text-sky-800'
                  : 'text-slate-400'
              }`}
            >
              <Play className="w-3 h-3" />
              <span>โหมดสอน (Concept)</span>
            </button>
            <button
              onClick={() => {
                playSound('pop');
                setLessonMode('practice');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lessonMode === 'practice'
                  ? isLowerTier
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-emerald-500 text-slate-950 shadow-sm'
                  : isLowerTier
                  ? 'text-sky-800'
                  : 'text-slate-400'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>โหมดโจทย์ (Practice)</span>
            </button>
          </div>
        </div>

        {/* Center: Animated Lesson Progress Bar */}
        <div className="flex-1 max-w-xs mx-2 hidden sm:flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-bold px-1">
            <span className={isLowerTier ? 'text-slate-600' : 'text-slate-300'}>
              ด่านที่ {currentProblemIndex + 1} / {PROBLEMS.length}
            </span>
            <span className={isLowerTier ? 'text-amber-600' : 'text-cyan-400'}>
              {currentProblem.topicTH}
            </span>
          </div>
          <div
            className={`w-full h-3.5 rounded-full overflow-hidden p-0.5 border ${
              isLowerTier ? 'bg-slate-200 border-slate-300' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLowerTier
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
              }`}
              style={{ width: `${((currentProblemIndex + 1) / PROBLEMS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: Language Toggle (TH / EP / Bilingual) & Real-time Reward Counter */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bilingual Engine Switcher */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isLowerTier ? 'bg-slate-100 border-slate-300' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {[
              { id: 'TH', label: '🇹🇭 TH' },
              { id: 'EP', label: '🇬🇧 EP' },
              { id: 'BILINGUAL', label: '⚡ TH+EP' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  playSound('pop');
                  setLangMode(item.id);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  langMode === item.id
                    ? isLowerTier
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-indigo-500 text-white shadow-sm'
                    : isLowerTier
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Reward Counter (Stars & Gems) */}
          <div
            className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-2xl font-extrabold border ${
              isLowerTier
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                : 'bg-slate-800/90 border-indigo-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span className="text-sm">{stars}</span>
            </div>
            <div className="w-px h-4 bg-current opacity-20" />
            <div className="flex items-center gap-1">
              <Gem className="w-4 h-4 fill-pink-400 text-pink-500" />
              <span className="text-sm">{gems}</span>
            </div>

            {/* Floating +10 Star Burst Animation */}
            {rewardBurst && (
              <div className="absolute -bottom-8 right-0 bg-emerald-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-lg animate-bounce whitespace-nowrap">
                +10 ⭐ +1 💎
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================
          ZONE 2: MAIN INTERACTIVE STAGE (70-75% HEIGHT)
         ========================================================= */}
      <main className="relative flex-1 overflow-hidden flex items-center justify-center px-3 sm:px-8 py-3">
        {/* Main Stage Container */}
        <div
          className={`relative w-full max-w-6xl h-full flex flex-col justify-between overflow-y-auto sm:overflow-hidden p-4 sm:p-6 transition-all border-2 ${
            isLowerTier
              ? 'bg-white/95 border-amber-300 rounded-[28px] shadow-[0_10px_30px_rgba(245,158,11,0.15)]'
              : 'bg-slate-900/90 border-indigo-500/40 rounded-2xl shadow-[0_10px_40px_rgba(6,182,212,0.12)]'
          }`}
        >
          {/* =====================================================
              MODE A: CONCEPT MICRO-STEPS (โหมดสอนแบบมีส่วนร่วมทีละขั้น)
             ===================================================== */}
          {lessonMode === 'concept' ? (
            <div className="h-full flex flex-col justify-between items-center text-center py-2 px-4">
              <div className="w-full flex items-center justify-between border-b pb-3 border-current/10">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      isLowerTier ? 'bg-sky-100 text-sky-800' : 'bg-indigo-950 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    💡 Interactive Concept Micro-Steps (โหมดสอนทีละสเต็ป)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setConceptStep(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        conceptStep === idx
                          ? 'w-8 bg-emerald-500'
                          : 'w-2.5 bg-slate-400/40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Micro-Step Interactive Visual Card */}
              <div className="my-auto max-w-2xl w-full flex flex-col items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md ${
                    isLowerTier ? 'bg-amber-100 border-2 border-amber-300' : 'bg-indigo-950 border border-cyan-400/40'
                  }`}
                >
                  {conceptStep === 0 ? '🧩' : conceptStep === 1 ? '⚡' : '🏆'}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold">
                  {langMode === 'EP'
                    ? currentProblem.conceptMicroSteps[conceptStep].titleEN
                    : currentProblem.conceptMicroSteps[conceptStep].titleTH}
                </h2>
                {langMode === 'BILINGUAL' && (
                  <p className="text-sm font-bold opacity-75 -mt-2">
                    {currentProblem.conceptMicroSteps[conceptStep].titleEN}
                  </p>
                )}

                <p className="text-base sm:text-lg max-w-xl leading-relaxed opacity-90">
                  {langMode === 'EP'
                    ? currentProblem.conceptMicroSteps[conceptStep].bodyEN
                    : currentProblem.conceptMicroSteps[conceptStep].bodyTH}
                </p>

                {/* Interactive Micro-Step Visual Preview Box */}
                <div
                  className={`w-full p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 ${
                    isLowerTier
                      ? 'bg-sky-50/90 border-sky-200'
                      : 'bg-slate-950/80 border-indigo-500/30'
                  }`}
                >
                  <div className="text-lg sm:text-xl font-extrabold tracking-wide">
                    {currentProblem.steps[conceptStep]?.visual}
                  </div>
                  <div className="text-xs sm:text-sm opacity-80">
                    {langMode === 'EP'
                      ? currentProblem.steps[conceptStep]?.descEN
                      : currentProblem.steps[conceptStep]?.descTH}
                  </div>
                </div>

                <button
                  onClick={() => {
                    playSound('pop');
                    if (conceptStep < 2) {
                      setConceptStep(conceptStep + 1);
                    } else {
                      setLessonMode('practice');
                    }
                  }}
                  className={`mt-2 px-6 py-3.5 rounded-2xl font-extrabold text-base flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
                    isLowerTier
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_0_#059669]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <span>
                    {langMode === 'EP'
                      ? currentProblem.conceptMicroSteps[conceptStep].actionLabelEN
                      : currentProblem.conceptMicroSteps[conceptStep].actionLabelTH}
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs opacity-60">
                เด็กๆ จะได้กดมีส่วนร่วมทีละขั้น (Active Micro-learning) แทนการนั่งดูคลิปวิดีโอยาวๆ
              </div>
            </div>
          ) : (
            /* =====================================================
               MODE B: PROBLEM ZONE + INTERACTIVE WORKSPACE
               ===================================================== */
            <div className="h-full flex flex-col justify-between gap-3">
              {/* TOP SECTION: PROBLEM STATEMENT + BILINGUAL TOOLS (TTS, PEEK, GLOSSARY) */}
              <div
                className={`relative p-3.5 sm:p-5 rounded-2xl border transition-all ${
                  isLowerTier
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-slate-950/70 border-indigo-500/30'
                }`}
              >
                {/* Header Badges & Bilingual Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                        isLowerTier
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-indigo-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {langMode === 'EP' ? currentProblem.gradeLabelEN : currentProblem.gradeLabelTH}
                    </span>
                    <span className="text-xs font-bold opacity-75">
                      • แตะคำที่มีเส้นประเพื่อดูคลังศัพท์ภาพ (Visual Glossary)
                    </span>
                  </div>

                  {/* Dual-Voice TTS & Peek Translation Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => speakQuestion('TH')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        isLowerTier
                          ? 'bg-white border border-amber-300 text-slate-700 hover:bg-amber-100'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                      title="อ่านโจทย์ภาษาไทย (Thai TTS)"
                    >
                      <Volume2 className={`w-3.5 h-3.5 text-orange-500 ${isSpeaking ? 'animate-ping' : ''}`} />
                      <span>ฟัง TH</span>
                    </button>

                    <button
                      onClick={() => speakQuestion('EN')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        isLowerTier
                          ? 'bg-white border border-amber-300 text-slate-700 hover:bg-amber-100'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                      title="Listen in English (EP TTS)"
                    >
                      <Volume2 className={`w-3.5 h-3.5 text-blue-500 ${isSpeaking ? 'animate-ping' : ''}`} />
                      <span>Listen EP</span>
                    </button>

                    {langMode !== 'BILINGUAL' && (
                      <button
                        onMouseDown={() => setIsPeekingTranslation(true)}
                        onMouseUp={() => setIsPeekingTranslation(false)}
                        onMouseLeave={() => setIsPeekingTranslation(false)}
                        onClick={() => setIsPeekingTranslation(!isPeekingTranslation)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                          isPeekingTranslation
                            ? 'bg-emerald-500 text-white'
                            : isLowerTier
                            ? 'bg-sky-100 text-sky-900 border border-sky-300'
                            : 'bg-indigo-950 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>แอบดูคำแปล (Peek)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Problem Text Display (Adaptive Font Size for Lower vs Upper Primary) */}
                <div className="space-y-1.5">
                  {(langMode === 'EP' || langMode === 'BILINGUAL' || (langMode === 'TH' && isPeekingTranslation)) && (
                    <div
                      className={`font-bold tracking-tight ${
                        isLowerTier ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'
                      }`}
                    >
                      {renderTokenizedLine(currentProblem.questionEN, false)}
                    </div>
                  )}

                  {(langMode === 'TH' || langMode === 'BILINGUAL' || (langMode === 'EP' && isPeekingTranslation)) && (
                    <div
                      className={`font-bold ${
                        langMode === 'BILINGUAL'
                          ? isLowerTier
                            ? 'text-base sm:text-xl text-slate-700'
                            : 'text-sm sm:text-lg text-slate-300'
                          : isLowerTier
                          ? 'text-lg sm:text-2xl'
                          : 'text-base sm:text-xl'
                      }`}
                    >
                      {renderTokenizedLine(currentProblem.questionTH, true)}
                    </div>
                  )}
                </div>

                {/* Interactive Math Glossary Popover Card */}
                {activeGlossaryTerm && GLOSSARY_DB[activeGlossaryTerm] && (
                  <div
                    className={`mt-3 p-3.5 rounded-2xl border-2 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 z-20 animate-fadeIn ${
                      isLowerTier
                        ? 'bg-white border-amber-400 text-slate-800'
                        : 'bg-slate-900 border-cyan-400 text-slate-100'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-xs font-extrabold">
                          EP Math Glossary
                        </span>
                        <span className="font-extrabold text-base sm:text-lg">
                          {GLOSSARY_DB[activeGlossaryTerm].en} = {GLOSSARY_DB[activeGlossaryTerm].th}
                        </span>
                        <span className="text-xs opacity-60 font-mono">
                          {GLOSSARY_DB[activeGlossaryTerm].phonetic}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm opacity-90">
                        🇹🇭 {GLOSSARY_DB[activeGlossaryTerm].descTH}
                      </p>
                      <p className="text-xs opacity-75">
                        🇬🇧 {GLOSSARY_DB[activeGlossaryTerm].descEN}
                      </p>
                    </div>
                    <div className="w-48 shrink-0">
                      <GlossaryDiagram type={GLOSSARY_DB[activeGlossaryTerm].diagram} />
                    </div>
                    <button
                      onClick={() => setActiveGlossaryTerm(null)}
                      className="p-1.5 rounded-lg opacity-60 hover:opacity-100 self-start"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* =====================================================
                  MIDDLE SECTION: INTERACTIVE VISUAL WORKSPACE
                  (Base-10 Blocks for P.1-P.3 | Singapore Bar Model for P.4-P.6)
                 ===================================================== */}
              <div
                className={`flex-1 min-h-[210px] rounded-2xl border-2 p-3 sm:p-5 flex flex-col justify-between relative overflow-hidden ${
                  isLowerTier
                    ? 'bg-gradient-to-b from-sky-50/70 to-white border-sky-200'
                    : 'bg-slate-950/90 border-indigo-500/30'
                }`}
              >
                {isLowerTier ? (
                  /* -----------------------------------------------------
                     LOWER PRIMARY WORKSPACE: VIRTUAL BASE-10 BLOCKS & APPLES
                     ----------------------------------------------------- */
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-sky-900 bg-sky-100 px-3 py-1 rounded-xl border border-sky-200">
                          🧮 กระดานบล็อกฐานสิบ (Interactive Base-10 Manipulatives)
                        </span>
                        <span className="text-xs text-slate-500 hidden md:inline">
                          ลองกดเพิ่ม/ลด แท่งสิบ และ หน่วยย่อย เพื่อนับจำนวนรวมกัน!
                        </span>
                      </div>

                      {/* Live Value Counter Badge */}
                      <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 px-3.5 py-1 rounded-2xl">
                        <span className="text-xs font-bold text-amber-900">ค่าบนกระดาน (Total on Board):</span>
                        <span className="text-xl font-extrabold text-orange-600">
                          {tensCount * 10 + onesCount}
                        </span>
                        <span className="text-xs font-bold text-amber-700">
                          ({tensCount * 10} + {onesCount})
                        </span>
                      </div>
                    </div>

                    {/* Visual Manipulatives Stage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto py-2">
                      {/* Tens Rods Zone */}
                      <div className="bg-sky-100/60 border-2 border-sky-200 rounded-2xl p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-sm text-sky-900">
                            🟦 แท่งหลักสิบ (Tens Rods = {tensCount * 10})
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                playSound('pop');
                                setTensCount(Math.max(0, tensCount - 1));
                              }}
                              className="w-8 h-8 rounded-xl bg-white border border-sky-300 flex items-center justify-center font-bold text-sky-800 hover:bg-sky-200 active:scale-95 shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                playSound('pop');
                                setTensCount(Math.min(6, tensCount + 1));
                              }}
                              className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold hover:bg-sky-600 active:scale-95 shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Render Tens Rods */}
                        <div className="flex items-center justify-center gap-3 min-h-[88px] flex-wrap">
                          {Array.from({ length: tensCount }).map((_, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                playSound('pop');
                                setTensCount(Math.max(0, tensCount - 1));
                              }}
                              className="cursor-pointer group flex flex-col items-center"
                              title="คลิกเพื่อเอาออก 1 แท่งสิบ"
                            >
                              <div className="w-7 h-20 bg-sky-500 rounded-md border-2 border-sky-700 shadow-md flex flex-col justify-between p-0.5 group-hover:scale-105 transition-transform">
                                {Array.from({ length: 10 }).map((__, segIdx) => (
                                  <div key={segIdx} className="w-full h-1.5 bg-sky-300/80 rounded-[1px]" />
                                ))}
                              </div>
                              <span className="text-[11px] font-extrabold text-sky-800 mt-1">+10</span>
                            </div>
                          ))}
                          {tensCount === 0 && (
                            <span className="text-xs text-slate-400">กดปุ่ม + เพื่อวางแท่งสิบ</span>
                          )}
                        </div>
                      </div>

                      {/* Ones Cubes Zone */}
                      <div className="bg-orange-100/60 border-2 border-orange-200 rounded-2xl p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-sm text-orange-900">
                            🟧 บล็อกหลักหน่วย (Ones Cubes = {onesCount})
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onesCount >= 10 && (
                              <button
                                onClick={() => {
                                  playSound('success');
                                  setOnesCount(onesCount - 10);
                                  setTensCount(tensCount + 1);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-xs font-extrabold animate-pulse shadow-sm"
                              >
                                ✨ มัดรวม 10 เป็น 1 แท่งสิบ!
                              </button>
                            )}
                            <button
                              onClick={() => {
                                playSound('pop');
                                setOnesCount(Math.max(0, onesCount - 1));
                              }}
                              className="w-8 h-8 rounded-xl bg-white border border-orange-300 flex items-center justify-center font-bold text-orange-800 hover:bg-orange-200 active:scale-95 shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                playSound('pop');
                                setOnesCount(Math.min(15, onesCount + 1));
                              }}
                              className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold hover:bg-orange-600 active:scale-95 shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Render Ten-Frame Grid of Ones Cubes / Apples */}
                        <div className="flex items-center justify-center gap-2 min-h-[88px] flex-wrap px-2">
                          {Array.from({ length: onesCount }).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                playSound('pop');
                                setOnesCount(Math.max(0, onesCount - 1));
                              }}
                              className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 border-2 border-orange-600 text-white font-extrabold text-xs flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                              title="คลิกเพื่อเอาออก 1 หน่วย"
                            >
                              {currentProblem.id === 'p1' ? '🍎' : '⭐'}
                            </button>
                          ))}
                          {onesCount === 0 && (
                            <span className="text-xs text-slate-400">กดปุ่ม + เพื่อเพิ่มหลักหน่วย</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Preset Button to match target problem */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>💡 เคล็ดลับ: ถ้านับหน่วยได้ครบ 10 ชิ้น สามารถกดปุ่ม "มัดรวมเป็นแท่งสิบ" ได้เลย!</span>
                      <button
                        onClick={() => {
                          playSound('pop');
                          setTensCount(currentProblem.targetTens);
                          setOnesCount(currentProblem.targetOnes);
                        }}
                        className="font-bold text-sky-700 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>จัดเรียงบล็อกตามคำตอบ ({currentProblem.correctAnswer})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* -----------------------------------------------------
                     UPPER PRIMARY WORKSPACE: SINGAPORE MATH BAR MODEL BUILDER
                     ----------------------------------------------------- */
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-cyan-300 bg-indigo-950/90 px-3 py-1 rounded-xl border border-cyan-500/30">
                          📊 เครื่องมือสร้างบาร์โมเดล (Singapore Math Bar Model Builder)
                        </span>
                      </div>

                      {/* Interactive Bar Model Toggles */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playSound('pop');
                            setShowUnitValues(!showUnitValues);
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                            showUnitValues
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {showUnitValues
                            ? `✅ แสดงค่า 1 ส่วน = ${currentProblem.barModelConfig?.unitValue}`
                            : '👁️ แสดงค่าต่อช่อง (Show 1 Unit Value)'}
                        </button>

                        <button
                          onClick={() => {
                            playSound('pop');
                            setShowBrackets(!showBrackets);
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                            showBrackets
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          📐 เส้นปีกกาข้อมูลโจทย์
                        </button>
                      </div>
                    </div>

                    {/* Bar Model Visual Canvas */}
                    <div className="my-auto py-3 px-2 sm:px-6 flex flex-col gap-4">
                      {/* Bar A */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="w-40 shrink-0 flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-extrabold text-cyan-300">
                            {langMode === 'EP'
                              ? currentProblem.barModelConfig?.labelA_EN
                              : currentProblem.barModelConfig?.labelA_TH}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                playSound('pop');
                                setBarPartsA(Math.max(1, barPartsA - 1));
                              }}
                              className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                            >
                              -
                            </button>
                            <span className="text-xs font-mono w-4 text-center">{barPartsA}</span>
                            <button
                              onClick={() => {
                                playSound('pop');
                                setBarPartsA(Math.min(6, barPartsA + 1));
                              }}
                              className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-1.5">
                          {Array.from({ length: barPartsA }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-11 w-16 sm:w-24 rounded-lg bg-gradient-to-b from-cyan-500 to-blue-600 border-2 border-cyan-300 flex items-center justify-center font-extrabold text-slate-950 shadow-md transition-all"
                            >
                              {showUnitValues ? currentProblem.barModelConfig?.unitValue : '1 unit'}
                            </div>
                          ))}
                          {showBrackets && (
                            <span className="ml-2 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-extrabold">
                              ? (สิ่งที่โจทย์ถาม = {barPartsA} ส่วน)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar B */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="w-40 shrink-0 flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-extrabold text-indigo-300">
                            {langMode === 'EP'
                              ? currentProblem.barModelConfig?.labelB_EN
                              : currentProblem.barModelConfig?.labelB_TH}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                playSound('pop');
                                setBarPartsB(Math.max(1, barPartsB - 1));
                              }}
                              className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                            >
                              -
                            </button>
                            <span className="text-xs font-mono w-4 text-center">{barPartsB}</span>
                            <button
                              onClick={() => {
                                playSound('pop');
                                setBarPartsB(Math.min(6, barPartsB + 1));
                              }}
                              className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-1.5">
                          {Array.from({ length: barPartsB }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-11 w-16 sm:w-24 rounded-lg bg-gradient-to-b from-indigo-500 to-purple-600 border-2 border-indigo-300 flex items-center justify-center font-extrabold text-white shadow-md transition-all"
                            >
                              {showUnitValues ? currentProblem.barModelConfig?.unitValue : '1 unit'}
                            </div>
                          ))}

                          {/* Difference Bracket for Problem 4 */}
                          {showBrackets && currentProblem.barModelConfig?.differenceValue && barPartsA > barPartsB && (
                            <div className="ml-2 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-300 text-xs font-extrabold flex items-center gap-1.5">
                              <span>
                                ◄ ผลต่าง (Difference) {barPartsA - barPartsB} ส่วน ={' '}
                                {currentProblem.barModelConfig.differenceValue} ซม. ►
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bar Model Summary Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-500/20 text-xs text-slate-300">
                      <div>
                        อัตราส่วนปัจจุบัน (Current Ratio):{' '}
                        <span className="font-extrabold text-cyan-300">
                          {barPartsA} : {barPartsB}
                        </span>{' '}
                        | จำนวนส่วนรวม:{' '}
                        <span className="font-extrabold text-emerald-400">
                          {barPartsA + barPartsB} ส่วน (Units)
                        </span>
                      </div>
                      {currentProblem.id === 'p3' && (
                        <div className="font-extrabold text-amber-300">
                          รวมทั้งหมด (Total Altogether) = 45 คน
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* =====================================================
                    TRANSPARENT SCRATCHPAD OVERLAY (กระดานทดเลขบนจอ)
                   ===================================================== */}
                {scratchpadOpen && (
                  <div className="absolute inset-0 z-30 bg-slate-900/10 backdrop-blur-[1px] flex flex-col justify-between pointer-events-auto">
                    {/* Scratchpad Floating Toolbar */}
                    <div className="m-2 p-2 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-xl flex items-center justify-between gap-3 self-center">
                      <span className="text-xs font-extrabold px-2 text-amber-300 flex items-center gap-1">
                        <Pencil className="w-3.5 h-3.5" /> กระดานทดเลข (Scratchpad)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {['#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map((col) => (
                          <button
                            key={col}
                            onClick={() => {
                              setIsEraser(false);
                              setPenColor(col);
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              !isEraser && penColor === col ? 'scale-125 border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                        <button
                          onClick={() => setIsEraser(!isEraser)}
                          className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            isEraser ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Eraser className="w-3.5 h-3.5" /> ยางลบ
                        </button>
                        <button
                          onClick={clearCanvas}
                          className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> ล้างกระดาน
                        </button>
                        <button
                          onClick={() => setScratchpadOpen(false)}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
                        >
                          ปิด
                        </button>
                      </div>
                    </div>

                    {/* Interactive HTML5 Drawing Canvas */}
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full cursor-crosshair touch-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            ZONE 3: RIGHT FLOATING UTILITY DOCK (แถบเครื่องมือช่วยคิด)
           ========================================================= */}
        <aside
          className={`ml-2 sm:ml-4 flex flex-col items-center gap-2.5 p-2 rounded-3xl border-2 z-30 shadow-xl ${
            isLowerTier
              ? 'bg-sky-500/95 border-sky-300 text-white'
              : 'bg-slate-900/95 border-indigo-500/40 text-slate-100'
          }`}
        >
          {/* Scratchpad Toggle Button */}
          <button
            onClick={() => {
              playSound('pop');
              setScratchpadOpen(!scratchpadOpen);
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
              scratchpadOpen
                ? 'bg-amber-400 text-slate-950 ring-4 ring-white'
                : isLowerTier
                ? 'bg-amber-400 hover:bg-amber-300 text-amber-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
            }`}
            title="กระดานทดเลข (Scratchpad)"
          >
            <Pencil className="w-5 h-5" />
            <span className="text-[10px]">ทดเลข</span>
          </button>

          {/* Vocabulary Bank Button */}
          <button
            onClick={() => {
              playSound('pop');
              setVocabDrawerOpen(!vocabDrawerOpen);
              setHintDrawerOpen(false);
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
              vocabDrawerOpen
                ? 'bg-emerald-400 text-slate-950 ring-4 ring-white'
                : isLowerTier
                ? 'bg-white/95 hover:bg-white text-sky-900'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
            }`}
            title="คลังศัพท์คณิต TH/EP (Math Glossary)"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">คลังศัพท์</span>
          </button>

          {/* Mascot Progressive Hint Button */}
          <button
            onClick={() => {
              playSound('pop');
              setHintDrawerOpen(!hintDrawerOpen);
              setVocabDrawerOpen(false);
            }}
            className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
              hintDrawerOpen
                ? 'bg-pink-500 text-white ring-4 ring-white'
                : isLowerTier
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
            title="ขอคำใบ้จากมาสคอต (Progressive Hint)"
          >
            <span className="text-xl leading-none">🤖</span>
            <span className="text-[10px]">คำใบ้</span>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
              ?
            </span>
          </button>
        </aside>

        {/* FLOATING PROGRESSIVE HINT POPOVER */}
        {hintDrawerOpen && (
          <div
            className={`absolute right-20 sm:right-28 bottom-6 w-80 sm:w-96 p-4 rounded-3xl border-2 shadow-2xl z-40 ${
              isLowerTier
                ? 'bg-white border-amber-400 text-slate-800'
                : 'bg-slate-900 border-cyan-400 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <h4 className="font-extrabold text-sm">Robo-Buddy Hint (คำใบ้ทีละขั้น)</h4>
                  <p className="text-[11px] opacity-70">ไม่เฉลยคำตอบตรงๆ แต่ช่วยแนะวิธีคิด!</p>
                </div>
              </div>
              <button onClick={() => setHintDrawerOpen(false)} className="p-1 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-3 rounded-2xl text-xs sm:text-sm font-bold mb-3 ${
                isLowerTier ? 'bg-amber-50 border border-amber-200' : 'bg-slate-800 border border-slate-700'
              }`}
            >
              {hintLevel === 1 ? (
                <>
                  <div className="text-amber-500 font-extrabold mb-1">💡 คำใบ้ขั้นที่ 1 (แนวคิด):</div>
                  <p>{langMode === 'EP' ? currentProblem.hint1EN : currentProblem.hint1TH}</p>
                </>
              ) : (
                <>
                  <div className="text-emerald-500 font-extrabold mb-1">✨ คำใบ้ขั้นที่ 2 (วิธีตั้งต้น):</div>
                  <p>{langMode === 'EP' ? currentProblem.hint2EN : currentProblem.hint2TH}</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setHintLevel(hintLevel === 1 ? 2 : 1)}
                className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
              >
                {hintLevel === 1 ? 'ดูคำใบ้ขั้นที่ 2 ถัดไป →' : '← กลับไปคำใบ้ขั้นที่ 1'}
              </button>
              <button
                onClick={() => {
                  setHintDrawerOpen(false);
                  setFeedbackState('solution_modal');
                }}
                className="text-xs font-bold underline opacity-75 hover:opacity-100"
              >
                ดูวิธีทำแบบภาพทีละขั้น
              </button>
            </div>
          </div>
        )}

        {/* FLOATING VOCABULARY BANK DRAWER */}
        {vocabDrawerOpen && (
          <div
            className={`absolute right-20 sm:right-28 top-6 w-80 sm:w-96 p-4 rounded-3xl border-2 shadow-2xl z-40 max-h-[80%] overflow-y-auto ${
              isLowerTier
                ? 'bg-white border-sky-400 text-slate-800'
                : 'bg-slate-900 border-cyan-400 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-500" />
                <h4 className="font-extrabold text-sm">คลังศัพท์คณิตศาสตร์ EP / TH</h4>
              </div>
              <button onClick={() => setVocabDrawerOpen(false)} className="p-1 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {Object.entries(GLOSSARY_DB).map(([key, item]) => (
                <div
                  key={key}
                  className={`p-2.5 rounded-2xl border ${
                    isLowerTier ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/90 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-extrabold text-sm">
                    <span className="text-amber-500">{item.en}</span>
                    <span>{item.th}</span>
                  </div>
                  <p className="text-xs opacity-80 mt-1">{item.descTH}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          ZONE 4: BOTTOM ACTION & INPUT BAR + EMPATHETIC FEEDBACK LOOP
         ========================================================= */}
      <footer
        className={`px-3 sm:px-8 py-3 border-t-2 z-30 transition-colors duration-300 ${
          feedbackState === 'correct'
            ? 'bg-emerald-500 border-emerald-600 text-white'
            : feedbackState === 'nudge'
            ? 'bg-amber-400 border-amber-500 text-slate-950 animate-gentle-shake'
            : isLowerTier
            ? 'bg-sky-600 border-sky-700 text-white'
            : 'bg-slate-900 border-indigo-500/40 text-slate-100'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {/* Empathetic Nudge Banner (Attempt 1 - No Red Cross!) */}
          {feedbackState === 'nudge' && (
            <div className="flex items-center justify-between bg-white/90 text-slate-900 px-4 py-2 rounded-2xl shadow-md">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold">
                <span className="text-xl">🤖</span>
                <span>
                  {langMode === 'EP' ? currentProblem.nudgeEN : currentProblem.nudgeTH}
                </span>
              </div>
              <button
                onClick={() => setFeedbackState('solution_modal')}
                className="text-xs font-extrabold px-3 py-1 rounded-xl bg-amber-500 text-white shrink-0 ml-2"
              >
                ดูวิธีคิดทีละขั้น
              </button>
            </div>
          )}

          {/* Celebratory Correct Banner */}
          {feedbackState === 'correct' && (
            <div className="flex items-center justify-between bg-white/20 px-4 py-1.5 rounded-2xl">
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                <CheckCircle2 className="w-6 h-6 text-white" />
                <span>
                  ยอดเยี่ยมมาก! คำตอบที่ถูกต้องคือ {currentProblem.correctAnswer} (รับเพิ่ม +10 ⭐ และ +1 💎)
                </span>
              </div>
              <button
                onClick={() => setFeedbackState('solution_modal')}
                className="text-xs font-extrabold underline text-white"
              >
                ดูคำอธิบายวิธีคิด
              </button>
            </div>
          )}

          {/* Main Input Row: Input Mode Toggle + Choices/Keypad + Check Answer CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Input Switcher (Multiple Choice vs Custom Number Pad) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  playSound('pop');
                  setInputMode(inputMode === 'choices' ? 'keypad' : 'choices');
                }}
                className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-xs font-extrabold flex items-center gap-1.5"
                title="สลับโหมดตัวเลือก A,B,C,D หรือ แป้นพิมพ์ตัวเลข"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden md:inline">
                  {inputMode === 'choices' ? 'สลับเป็นแป้นตัวเลข' : 'สลับเป็นตัวเลือก A-D'}
                </span>
              </button>
            </div>

            {/* CENTER: MULTIPLE CHOICE BUTTONS OR CUSTOM NUMBER KEYPAD */}
            {inputMode === 'choices' ? (
              <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 max-w-2xl">
                {currentProblem.choices.map((choice, idx) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isSelected = selectedAnswer === choice;
                  const choiceColors = [
                    'from-rose-500 to-orange-500 border-rose-700',
                    'from-amber-400 to-orange-500 border-amber-600',
                    'from-cyan-400 to-teal-500 border-teal-700',
                    'from-purple-500 to-indigo-600 border-indigo-800'
                  ];

                  return (
                    <button
                      key={choice}
                      onClick={() => {
                        playSound('pop');
                        if (feedbackState === 'nudge') setFeedbackState('idle');
                        setSelectedAnswer(choice);
                      }}
                      className={`flex-1 py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-b ${
                        choiceColors[idx]
                      } border-b-4 text-white font-extrabold transition-all active:translate-y-0.5 flex items-center justify-center gap-2 shadow-lg ${
                        isSelected
                          ? 'ring-4 ring-white scale-105 brightness-110'
                          : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-black/25 text-xs flex items-center justify-center">
                        {letters[idx]}
                      </span>
                      <span className="text-lg sm:text-2xl">{choice}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Custom On-Screen Number Keypad (Zero OS Keyboard Obstruction) */
              <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap max-w-2xl">
                <div className="px-4 py-2 rounded-xl bg-white text-slate-900 font-extrabold text-xl min-w-[72px] text-center mr-2 shadow-inner">
                  {selectedAnswer || '?'}
                </div>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      playSound('pop');
                      if (feedbackState === 'nudge') setFeedbackState('idle');
                      setSelectedAnswer((prev) => (prev.length < 3 ? prev + num : prev));
                    }}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/95 hover:bg-white text-slate-900 font-extrabold text-base shadow active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedAnswer('')}
                  className="px-2.5 h-9 sm:h-10 rounded-xl bg-rose-500 text-white font-extrabold text-xs"
                >
                  ลบ
                </button>
              </div>
            )}

            {/* RIGHT: PROMINENT CHECK / NEXT BUTTON */}
            <div>
              {feedbackState === 'correct' ? (
                <button
                  onClick={handleNextProblem}
                  className="px-6 py-3 rounded-2xl bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-base sm:text-lg shadow-[0_4px_0_#047857] flex items-center gap-2 animate-bounce"
                >
                  <span>ข้อต่อไป (Next)</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleCheckAnswer}
                  disabled={!selectedAnswer}
                  className={`px-6 py-3 rounded-2xl font-extrabold text-base sm:text-lg transition-all flex items-center gap-2 ${
                    selectedAnswer
                      ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white border-b-4 border-emerald-800 shadow-xl active:translate-y-0.5 cursor-pointer'
                      : 'bg-slate-400/40 text-white/60 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <div className="text-left leading-tight">
                    <div className="text-sm sm:text-base">ตรวจคำตอบ</div>
                    <div className="text-[10px] opacity-85 font-semibold">Check Answer</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================
          MODAL 1: VISUAL STEP-BY-STEP SOLUTION (หลังตอบผิดครั้งที่ 2 หรือกดดูเฉลย)
         ========================================================= */}
      {feedbackState === 'solution_modal' && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl p-6 rounded-3xl border-2 shadow-2xl ${
              isLowerTier
                ? 'bg-white border-amber-400 text-slate-800'
                : 'bg-slate-900 border-cyan-400 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-current/10">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">🦉</span>
                <div>
                  <h3 className="font-extrabold text-lg">
                    วิธีคิดทีละขั้นด้วยภาพ (Visual Step-by-Step Solution)
                  </h3>
                  <p className="text-xs opacity-75">
                    ไม่เป็นไรเลย! มาดูวิธีแยกส่วนคิดทีละสเต็ปไปด้วยกันนะ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFeedbackState('idle')}
                className="p-1.5 rounded-xl opacity-60 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {currentProblem.steps.map((st, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isLowerTier
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-slate-800/90 border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-sm text-amber-500">
                      {langMode === 'EP' ? st.titleEN : st.titleTH}
                    </div>
                    <div className="text-xs sm:text-sm mt-0.5">
                      {langMode === 'EP' ? st.descEN : st.descTH}
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl font-mono font-extrabold text-xs sm:text-sm shrink-0 ${
                      isLowerTier ? 'bg-white border border-amber-300 text-slate-900' : 'bg-slate-950 text-cyan-300'
                    }`}
                  >
                    {st.visual}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold">
                คำตอบที่ถูกต้องคือ:{' '}
                <span className="px-3 py-1 rounded-xl bg-emerald-500 text-white text-lg">
                  {currentProblem.correctAnswer}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedAnswer(currentProblem.correctAnswer);
                    setFeedbackState('idle');
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm"
                >
                  ลองตอบอีกครั้ง
                </button>
                <button
                  onClick={handleNextProblem}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center gap-1"
                >
                  <span>ไปข้อต่อไป</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: GENTLE EXIT CONFIRMATION (ป้องกันเด็กเผลอกดออก)
         ========================================================= */}
      {exitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border-2 text-center shadow-2xl ${
              isLowerTier
                ? 'bg-white border-amber-400 text-slate-800'
                : 'bg-slate-900 border-indigo-500 text-slate-100'
            }`}
          >
            <div className="text-5xl mb-3">🗺️</div>
            <h3 className="text-xl font-extrabold mb-1">
              ต้องการกลับไปที่แผนที่บทเรียนใช่ไหม?
            </h3>
            <p className="text-sm opacity-75 mb-5">
              Wait! Do you want to exit this lesson? อีกนิดเดียวก็จะจบด่านและได้รับเพชรโบนัสแล้วนะ!
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setExitModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold shadow-md"
              >
                เรียนต่อเลย! (Stay)
              </button>
              <button
                onClick={() => setExitModalOpen(false)}
                className="px-4 py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm"
              >
                ออกชั่วคราว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}