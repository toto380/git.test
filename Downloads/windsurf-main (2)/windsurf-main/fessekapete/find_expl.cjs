const fs = require('fs');
const path = require('path');

const cookiePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'CookieMonitoring.jsx');
let content = fs.readFileSync(cookiePath, 'utf8');

// The explanations are basically blocks of code starting with `{/* EXPLICATION` and ending at the end of their `</div>`
// Since I don't know the exact HTML structure, I will find them using regex or string splits.

const exp1Start = content.indexOf('{/* EXPLICATION DUREE DE VIE COOKIES */}');
if (exp1Start === -1) {
  console.log("No expl found");
  process.exit(0);
}

// Find all ` {/* EXPLICATION ` tags? Let's just find the first one.
// Let's print out the structure first to be safe.
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('EXPLICATION')) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
}

