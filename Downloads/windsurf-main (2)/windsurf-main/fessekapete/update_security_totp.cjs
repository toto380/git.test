const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'components', 'SecuritySettings.jsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('sendEmailVerification')) {
    content = content.replace("import { multiFactor, TotpMultiFactorGenerator } from 'firebase/auth';", "import { multiFactor, TotpMultiFactorGenerator, sendEmailVerification } from 'firebase/auth';\nimport { auth } from '../firebase';");
}

const oldStart = `const handleStartEnrollment = async () => {
    setLoading(true);
    setError('');
    try {`;
const newStart = `const handleStartEnrollment = async () => {
    setLoading(true);
    setError('');
    try {
      if (!auth.currentUser.emailVerified) {
        setError('unverified');
        setLoading(false);
        return;
      }`;
content = content.replace(oldStart, newStart);

const oldFunc = `const handleVerifyAndEnroll = async (e) => {`;
const newFuncs = `const handleSendVerification = async () => {
    setLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess('E-mail de vérification envoyé. Veuillez consulter votre boîte de réception, puis recharger cette page.');
      setError('');
    } catch (err) {
      console.error(err);
      setError('Erreur lors de lenvoi de le-mail de vérification.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnroll = async (e) => {`;
content = content.replace(oldFunc, newFuncs);

const findErrorDiv = `{error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}`;
const newErrorDiv = `{error === 'unverified' ? (
        <div className="mb-4 bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-lg text-sm flex flex-col items-start gap-3">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <p><strong>Vérification requise :</strong> Vous devez vérifier votre adresse e-mail avant de pouvoir activer l'authentification à deux facteurs.</p>
          </div>
          <button onClick={handleSendVerification} disabled={loading} className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-md font-medium transition-colors">
            M'envoyer le lien de vérification
          </button>
        </div>
      ) : error ? (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}`;
content = content.replace(findErrorDiv, newErrorDiv);

const qrCodeBlock = `<QRCodeSVG value={qrCodeUrl} size={180} level="M" includeMargin={false} />
              )}`;
const newQrCodeBlock = `<QRCodeSVG value={qrCodeUrl} size={180} level="M" includeMargin={false} />
              )}
              {secret && (
                <div className="mt-4 p-2 bg-slate-100 rounded text-center max-w-[180px] mx-auto">
                  <p className="text-xs text-slate-500 mb-1">Clé secrète (saisie manuelle) :</p>
                  <code className="text-sm font-mono font-bold text-slate-800 break-all">{secret.secretKey}</code>
                </div>
              )}`;
content = content.replace(qrCodeBlock, newQrCodeBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log("SecuritySettings.jsx successfully updated with verification and secret key display.");
