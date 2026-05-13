const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const base = 'D:/web app/4-craft.com';
const contentPath = base + '/apps/api/app/content/math';

// Walk all JSON files
const allFiles = [];
function walk(dir) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (e.name.endsWith('.json')) allFiles.push(fp);
  }
}
walk(contentPath);

// Scan each file
const results = [];
const withProblems = [];

for (const fp of allFiles) {
  const rel = fp.replace(base.replace(/\//g, '/'), '').replace(/\\/g, '/');
  const buf = fs.readFileSync(fp);
  const text = buf.toString('utf8');
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const stat = fs.statSync(fp);

  // Count U+FFFD and EF BF BD
  const fffdChar = (text.match(/\uFFFD/g) || []).length;
  let efbfbd = 0;
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0xEF && buf[i+1] === 0xBF && buf[i+2] === 0xBD) efbfbd++;
  }
  const total = fffdChar + efbfbd;

  // Get example context
  let exampleContext = '';
  if (total > 0) {
    const idx = text.indexOf('\uFFFD');
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(text.length, idx + 60);
      exampleContext = text.substring(start, end);
    }
  }

  const entry = {
    file: rel,
    sha256_before: sha256,
    sha256_after: sha256,
    replacement_count_before: total,
    replacement_count_after: total,
    replacements_made: 0,
    backup_file: '',
    example_context: exampleContext
  };
  results.push(entry);
  if (total > 0) withProblems.push(entry);
}

const totalBefore = withProblems.reduce((s, r) => s + r.replacement_count_before, 0);

// Output summary
console.log('Total files:', allFiles.length);
console.log('Files with problems:', withProblems.length);
console.log('Total replacement chars:', totalBefore);

fs.writeFileSync(base + '/docs/scan_results.json', JSON.stringify({
  files: results,
  withProblems: withProblems,
  summary: { total: allFiles.length, withProblems: withProblems.length, totalBefore }
}, null, 2));
console.log('Done');