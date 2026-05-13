const fs = require('fs');
const text = fs.readFileSync('D:/web app/4-craft.com/apps/api/app/content/math/grade_2/lessons/g2_add_two_digit.json', 'utf8');

let depth = 0;
let maxDepth = 0;
let maxDepthPos = 0;
let charPos = 0;
let maxDepthChar = 0;

for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') { 
        depth++; 
        if (depth > maxDepth) { 
            maxDepth = depth; 
            maxDepthChar = i;
            maxDepthPos = charPos;
        } 
    }
    if (c === '}') depth--;
    if (c === '\n') charPos = 0;
    else charPos++;
}

console.log('Max depth:', maxDepth, 'at char position', maxDepthChar);
console.log('Context around max depth:');
console.log(text.substring(maxDepthChar - 100, maxDepthChar + 200));

// Now try to find where JSON parse fails
// Let's validate using try-catch around different sections
const lines = text.split('\n');
let lineDepth = 0;
let depthByLine = [];

for (let i = 0; i < lines.length; i++) {
    let lineDepth = 0;
    for (const c of lines[i]) {
        if (c === '{') lineDepth++;
        if (c === '}') lineDepth--;
    }
    depthByLine.push(lineDepth);
}

// Find where depth doesn't return to 0 after the file
console.log('\nFirst 10 lines depth:', depthByLine.slice(0, 10));
console.log('Last 10 lines depth:', depthByLine.slice(-10));
console.log('Total lines:', lines.length);

// Find any line with negative depth
let negDepthLines = [];
for (let i = 0; i < depthByLine.length; i++) {
    if (depthByLine[i] < 0) {
        negDepthLines.push({ line: i + 1, depth: depthByLine[i] });
    }
}
console.log('\nLines with negative depth:', negDepthLines);

// Find where depth doesn't end at 0
console.log('\nFinal depth after file:', depthByLine[depthByLine.length - 1]);

// Let's try to find the JSON error more precisely
// Look for the error position 32323 mentioned in the error
const aroundError = text.substring(32300, 32400);
console.log('\nAround position 32300:');
console.log(aroundError);