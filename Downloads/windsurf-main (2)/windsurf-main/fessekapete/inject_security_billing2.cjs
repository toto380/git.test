const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Billing.jsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import SecuritySettings')) {
    content = content.replace("import { useTranslation } from 'react-i18next';", "import { useTranslation } from 'react-i18next';\nimport SecuritySettings from '../components/SecuritySettings';");
}

const findStr = 'M\'envoyer un e-mail de réinitialisation")}';
// Note: Due to unicode issues in the string match from console (rǸinitialisation), I'll match `onClick={handleForgotPassword}`
const matchIdx = content.indexOf('onClick={handleForgotPassword}');

if (matchIdx !== -1) {
    // Find the end of the button
    const btnEndIdx = content.indexOf('</button>', matchIdx);
    if (btnEndIdx !== -1) {
        // Find the end of the div containing the button
        const divEndIdx = content.indexOf('</div>', btnEndIdx);
        if (divEndIdx !== -1) {
            const injection = "\n\n          {/* 2FA Security Settings */}\n          <SecuritySettings />\n";
            content = content.substring(0, divEndIdx + 6) + injection + content.substring(divEndIdx + 6);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log("Successfully injected SecuritySettings into Billing.jsx");
        }
    }
}
