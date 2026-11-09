import type { GlossaryDiagramKind, GlossaryEntry } from './types'

/**
 * Visual maths glossary.
 *
 * Every entry carries the English word, the Thai word, a phonetic hint and a
 * short description in both languages, plus the key of an SVG diagram that
 * makes the idea visible.
 */
export const GLOSSARY_DB: Record<string, GlossaryEntry> = {
  altogether: {
    en: 'Altogether',
    th: 'รวมกันทั้งหมด',
    phonetic: '/ˌɔːl.təˈɡeð.ər/',
    descEN: 'Combine two or more amounts into one total.',
    descTH: 'การนำจำนวนตั้งแต่ 2 กลุ่มมารวมกันเป็นจำนวนเดียว (ใช้การบวก +)',
    diagram: 'addition',
  },
  tens: {
    en: 'Tens',
    th: 'หลักสิบ',
    phonetic: '/tenz/',
    descEN: 'A group of 10 single units bundled together.',
    descTH: 'กลุ่มของจำนวน 10 หน่วยที่มัดรวมกันเป็น 1 แท่งสิบ',
    diagram: 'tens',
  },
  difference: {
    en: 'Difference',
    th: 'ผลต่าง',
    phonetic: '/ˈdɪf.ər.əns/',
    descEN: 'How much more or less one amount is compared to another.',
    descTH: 'ส่วนที่ต่างกันเมื่อนำสองจำนวนมาเปรียบเทียบกัน (ใช้การลบ -)',
    diagram: 'difference',
  },
  ratio: {
    en: 'Ratio',
    th: 'อัตราส่วน',
    phonetic: '/ˈreɪ.ʃi.oʊ/',
    descEN: 'Comparison of two quantities showing how many times one value contains another.',
    descTH: 'การเปรียบเทียบปริมาณสองปริมาณเป็นส่วนๆ ที่เท่ากัน เช่น 2 : 3',
    diagram: 'ratio',
  },
  perimeter: {
    en: 'Perimeter',
    th: 'ความยาวรอบรูป',
    phonetic: '/pəˈrɪm.ɪ.tər/',
    descEN: 'Total distance around the outside edge of a 2D shape.',
    descTH: 'ผลรวมความยาวของด้านทุกด้านที่ล้อมรอบรูปเรขาคณิต',
    diagram: 'perimeter',
  },
  equal_parts: {
    en: 'Equal parts',
    th: 'ส่วนที่เท่ากัน',
    phonetic: '/ˈiː.kwəl pɑːrts/',
    descEN: 'Sections or blocks that have the exact same size and value.',
    descTH: 'การแบ่งบาร์โมเดลหรือรูปภาพออกเป็นช่องที่มีขนาดและค่าเท่ากันทุกช่อง',
    diagram: 'equal_parts',
  },
}

export function getGlossaryEntry(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return GLOSSARY_DB[term] ?? null
}

export function GlossaryDiagram({ type }: { type?: GlossaryDiagramKind }) {
  switch (type) {
    case 'addition':
      return (
        <svg viewBox="0 0 220 70" className="h-16 w-full rounded-xl border border-amber-200 bg-amber-50 p-1">
          <rect x="15" y="18" width="55" height="24" rx="6" fill="#f97316" />
          <text x="42" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
            Part A
          </text>
          <text x="82" y="35" textAnchor="middle" fill="#ea580c" fontSize="16" fontWeight="bold">
            +
          </text>
          <rect x="95" y="18" width="45" height="24" rx="6" fill="#3b82f6" />
          <text x="117" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
            Part B
          </text>
          <path d="M15 48 Q77 62 140 48" stroke="#16a34a" strokeWidth="2.5" fill="none" />
          <text x="178" y="36" textAnchor="middle" fill="#15803d" fontSize="12" fontWeight="bold">
            = Total!
          </text>
        </svg>
      )
    case 'tens':
      return (
        <svg viewBox="0 0 220 70" className="h-16 w-full rounded-xl border border-sky-200 bg-sky-50 p-1">
          {[...Array(10)].map((_, i) => (
            <rect
              key={i}
              x={14 + i * 18}
              y="22"
              width="15"
              height="26"
              rx="2"
              fill="#0284c7"
              stroke="#e0f2fe"
              strokeWidth="1"
            />
          ))}
          <text x="110" y="62" textAnchor="middle" fill="#0369a1" fontSize="10" fontWeight="bold">
            10 Ones = 1 Ten Rod (1 แท่งสิบ)
          </text>
        </svg>
      )
    case 'difference':
      return (
        <svg viewBox="0 0 220 70" className="h-16 w-full rounded-xl border border-rose-200 bg-rose-50 p-1">
          <rect x="15" y="12" width="130" height="20" rx="4" fill="#6366f1" />
          <rect x="15" y="38" width="75" height="20" rx="4" fill="#94a3b8" />
          <line x1="92" y1="38" x2="145" y2="38" stroke="#e11d48" strokeWidth="2" strokeDasharray="3 3" />
          <rect
            x="92"
            y="36"
            width="53"
            height="22"
            rx="4"
            fill="#ffe4e6"
            stroke="#e11d48"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <text x="118" y="51" textAnchor="middle" fill="#be123c" fontSize="10" fontWeight="bold">
            Diff (?)
          </text>
        </svg>
      )
    case 'ratio':
    case 'equal_parts':
      return (
        <svg viewBox="0 0 220 70" className="h-16 w-full rounded-xl border border-indigo-200 bg-indigo-50 p-1">
          {[0, 1, 2].map((i) => (
            <rect key={i} x={20 + i * 36} y="14" width="33" height="20" rx="4" fill="#4f46e5" />
          ))}
          {[0, 1].map((i) => (
            <rect key={i} x={20 + i * 36} y="38" width="33" height="20" rx="4" fill="#06b6d4" />
          ))}
          <text x="165" y="28" textAnchor="middle" fill="#3730a3" fontSize="11" fontWeight="bold">
            3 Units
          </text>
          <text x="165" y="52" textAnchor="middle" fill="#0e7490" fontSize="11" fontWeight="bold">
            2 Units
          </text>
        </svg>
      )
    case 'perimeter':
      return (
        <svg viewBox="0 0 220 70" className="h-16 w-full rounded-xl border border-emerald-200 bg-emerald-50 p-1">
          <rect
            x="55"
            y="14"
            width="110"
            height="42"
            rx="4"
            fill="#d1fae5"
            stroke="#059669"
            strokeWidth="3"
            strokeDasharray="6 3"
          />
          <text x="110" y="39" textAnchor="middle" fill="#065f46" fontSize="11" fontWeight="bold">
            All 4 Sides = Perimeter
          </text>
        </svg>
      )
    default:
      return null
  }
}
