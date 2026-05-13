const fs = require('fs');
const contentDir = 'D:/web app/4-craft.com/apps/api/app/content/math';
const p = contentDir + '/grade_3/lessons/g3_fractions_intro.json';
const raw = fs.readFileSync(p);
const content = raw.toString('utf8');
const idx = content.indexOf('\ufffd');
console.log('UFFFD at:', idx);
if (idx >= 0) {
  const start = Math.max(0, idx - 30);
  const end = Math.min(raw.length, idx + 30);
  console.log('Around FFFD (hex):', raw.slice(start, end).toString('hex'));
  console.log('Around FFFD (latin1):', Buffer.from(raw.slice(start, end)).toString('latin1'));
  const before = content.slice(idx - 10, idx);
  const after = content.slice(idx + 1, idx + 11);
  console.log('Before:', JSON.stringify(before));
  console.log('After:', JSON.stringify(after));
}
