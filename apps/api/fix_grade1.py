const fs = require('fs');
const path = require('path');

const contentDir = 'D:/web app/4-craft.com/apps/api/app/content/math';
const fname = 'curriculum/grade_1/curriculum_map.json';
const fp = path.join(contentDir, fname);

const content = fs.readFileSync(fp, 'utf8');
const lines = content.split('\n');

// The issue: line 620 has ["ลายกระเบื้อง ลายผ้า ลายปูน",] but should be ["ลายกระเบื้อง ลายผ้า ลายปูน"]
// and line 621 is "quest_ideas" which is a sibling property
// Fix: change line 620 to close the array, and line 621 to continue the object
lines[619] = '          "real_life_contexts": ["ลายกระเบื้อง ลายผ้า ลายปูน"],';
lines[620] = '          "quest_ideas": ["daily: สร้างแบบรูปด้วยสิ่งของในบ้าน"]';

console.log('Fixed line 620:', JSON.stringify(lines[619]));
console.log('Fixed line 621:', JSON.stringify(lines[620]));

const fixed = lines.join('\n');
fs.writeFileSync(fp, fixed, 'utf8');

try {
  JSON.parse(fixed);
  console.log('VERIFIED: valid JSON');
} catch(e) {
  console.log('Still invalid:', e.message);
}
