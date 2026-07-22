const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Login.jsx');
const modalPath = path.join(__dirname, 'new_modal.jsx.txt');
let content = fs.readFileSync(filePath, 'utf8');
const newRecoveryModal = fs.readFileSync(modalPath, 'utf8');

const startStr = '{isRecoveryMode && (';
const endStr = '{!isRecoveryMode && (';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newRecoveryModal + '\n\n' + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Login.jsx recovery UI successfully injected!");
} else {
  console.log("Could not find blocks in Login.jsx");
}
