const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'components', 'PhoneVerificationModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  "import { auth } from '../firebase';",
  "import { auth, db } from '../firebase';\nimport { doc, updateDoc } from 'firebase/firestore';"
);
content = content.replace(
  "import { ShieldCheck, Lock, AlertCircle, RefreshCw } from 'lucide-react';",
  "import { ShieldCheck, Lock, AlertCircle, RefreshCw, Mail } from 'lucide-react';"
);

// 2. Add new state for the method and email
content = content.replace(
  "const [step, setStep] = useState(1);",
  "const [step, setStep] = useState(1);\n  const [method, setMethod] = useState('phone'); // 'phone' or 'email'\n  const [recoveryEmail, setRecoveryEmail] = useState('');"
);

// 3. Add handleSaveEmail function
const handleSaveEmail = `
  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setError(t("auth.invalidEmail", "Veuillez entrer une adresse e-mail valide."));
      return;
    }
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'clients', auth.currentUser.uid), {
        recovery_email: recoveryEmail
      });
      setMessage(t("auth.emailSuccess", "E-mail de récupération enregistré avec succès !"));
      
      setTimeout(() => {
        refreshUser();
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setError(t("auth.emailError", "Erreur lors de l'enregistrement de l'e-mail."));
    } finally {
      setLoading(false);
    }
  };
`;

content = content.replace(
  "const handleVerifyCode = async (e) => {",
  handleSaveEmail + "\n  const handleVerifyCode = async (e) => {"
);

// 4. Update the UI description
content = content.replace(
  '{t("auth.secureDesc", "Pour protéger votre compte, vous devez obligatoirement lier et vérifier un numéro de téléphone.")}',
  '{t("auth.secureDesc", "Pour protéger votre compte, veuillez choisir une méthode de récupération. Cela renforcera la sécurité de vos accès.")}'
);

// 5. Add Method Selector and Email Form
const methodSelector = `
        {step === 1 && (
          <div className="flex bg-slate-900/50 rounded-xl p-1 mb-6 border border-slate-700/50">
            <button
              onClick={() => setMethod('phone')}
              className={\`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all \${method === 'phone' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}\`}
            >
              Par Téléphone
            </button>
            <button
              onClick={() => setMethod('email')}
              className={\`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all \${method === 'email' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}\`}
            >
              Par E-mail
            </button>
          </div>
        )}
`;

content = content.replace(
  "{error && (",
  methodSelector + "\n        {error && ("
);

// 6. Conditionally render the forms based on the selected method
content = content.replace(
  "{step === 1 && (",
  "{step === 1 && method === 'phone' && ("
);

const emailForm = `
        {step === 1 && method === 'email' && (
          <form onSubmit={handleSaveEmail} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2" style={{ color: "#ffffff" }}>
                {t("auth.recoveryEmailLabel", "E-mail de Récupération")}
              </label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-4 text-white focus:border-emerald-500 focus:outline-none"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Cet e-mail sera utilisé uniquement en cas de perte d'accès à votre compte.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !recoveryEmail.includes('@')}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all"
              style={{
                backgroundColor: loading || !recoveryEmail.includes('@') ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                cursor: loading || !recoveryEmail.includes('@') ? "not-allowed" : "pointer", color: "#ffffff"}}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Mail size={20} />}
              {t("auth.saveEmail", "Enregistrer l'e-mail")}
            </button>
          </form>
        )}
`;

content = content.replace(
  "{step === 2 && (",
  emailForm + "\n\n        {step === 2 && ("
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('PhoneVerificationModal.jsx updated successfully!');
