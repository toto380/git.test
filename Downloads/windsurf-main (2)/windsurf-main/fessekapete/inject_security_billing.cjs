const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Billing.jsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import SecuritySettings')) {
    content = content.replace("import { useTranslation } from 'react-i18next';", "import { useTranslation } from 'react-i18next';\nimport SecuritySettings from '../components/SecuritySettings';");
}

const findStr = 'onClick={handleResetPassword}';
const idx = content.indexOf(findStr);
if (idx !== -1) {
    const endDiv1 = content.indexOf('</div>', idx);
    const endDiv2 = content.indexOf('</div>', endDiv1 + 6);
    
    if (endDiv2 !== -1) {
        const injection = "\n\n          {/* 2FA Security Settings */}\n          <SecuritySettings />\n";
        content = content.substring(0, endDiv2 + 6) + injection + content.substring(endDiv2 + 6);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Successfully injected SecuritySettings into Billing.jsx");
    }
}
