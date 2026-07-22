const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'components', 'PhoneVerificationModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// I need to add `const { i18n } = useTranslation();` to get access to changeLanguage if it's not already there.
if (content.includes('const { t } = useTranslation();')) {
    content = content.replace('const { t } = useTranslation();', 'const { t, i18n } = useTranslation();');
}

// Update handleSendEmailCode
const sendEmailRegex = /await sendRecoveryEmailCode\({ email: recoveryEmail }\);/g;
content = content.replace(sendEmailRegex, "await sendRecoveryEmailCode({ email: recoveryEmail, lang: i18n.language || 'fr' });");

// Add language flags above the email input
const flagsUI = `
        {/* LANGUAGE SELECTOR */}
        {step === 1 && (
          <div className="flex justify-center gap-4 mb-6">
            <button 
              type="button" 
              onClick={() => i18n.changeLanguage('fr')} 
              className={\`w-12 h-12 rounded-full overflow-hidden border-2 transition-all \${i18n.language !== 'en' ? 'border-emerald-500 scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'border-transparent opacity-50'}\`}
              title="Français"
            >
              <img src="https://flagcdn.com/w80/fr.png" alt="FR" className="w-full h-full object-cover" />
            </button>
            <button 
              type="button" 
              onClick={() => i18n.changeLanguage('en')} 
              className={\`w-12 h-12 rounded-full overflow-hidden border-2 transition-all \${i18n.language === 'en' ? 'border-emerald-500 scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'border-transparent opacity-50'}\`}
              title="English"
            >
              <img src="https://flagcdn.com/w80/gb.png" alt="EN" className="w-full h-full object-cover" />
            </button>
          </div>
        )}

        {/* STEP 1: EMAIL INPUT */}`;

content = content.replace('{/* STEP 1: EMAIL INPUT */}', flagsUI);

fs.writeFileSync(filePath, content, 'utf8');
console.log("PhoneVerificationModal successfully updated with flags.");
