const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\anton\\Downloads\\windsurf-main (2)\\windsurf-main\\fessekapete\\functions\\index.js', 'utf8');
const lines = content.split('\n');
for (let i = 25; i < 100; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
