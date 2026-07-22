const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'components', 'PhoneVerificationModal.jsx');

const newContent = `import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { ShieldCheck, Lock, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PhoneVerificationModal = () => {

  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  
  const [verificationCode, setVerificationCode] = useState('');
  // step 1 = Email Input
  // step 2 = Email Code Input
  const [step, setStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendEmailCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setError(t("auth.invalidEmail", "Veuillez entrer une adresse e-mail valide."));
      return;
    }
    if (cooldown > 0) {
      setError(t("auth.cooldownError", \`Veuillez patienter \${cooldown} secondes.\`));
      return;
    }
    
    setLoading(true);
    try {
      const sendRecoveryEmailCode = httpsCallable(functions, 'sendRecoveryEmailCode');
      await sendRecoveryEmailCode({ email: recoveryEmail });
      
      setMessage(t("auth.emailCodeSent", "Un code à 6 chiffres a été envoyé à votre e-mail."));
      setCooldown(59);
      setVerificationCode('');
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(t("auth.emailError", "Erreur lors de l'envoi de l'e-mail. Vérifiez l'adresse."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!verificationCode || verificationCode.length !== 6) return;
    
    setLoading(true);
    try {
      const verifyRecoveryEmailCode = httpsCallable(functions, 'verifyRecoveryEmailCode');
      await verifyRecoveryEmailCode({ code: verificationCode });
      
      setMessage(t("auth.emailSuccess", "E-mail de récupération validé avec succès !"));
      
      setTimeout(() => {
        refreshUser();
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setError(t("auth.invalidCode", "Code incorrect ou expiré."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0F17]/90 backdrop-blur-md px-4 font-['Montserrat',sans-serif]">
      <div className="w-full max-w-md relative z-10 p-8 rounded-3xl" style={{
        backgroundColor: "rgba(11, 15, 23, 0.95)",
        border: "1px solid rgba(16, 185, 129, 0.3)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(16, 185, 129, 0.2)"
      }}>
        
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-[40px] pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-[40px] pointer-events-none"></div>

        <div className="relative text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/30">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ color: "#ffffff" }}>
            {t("auth.secureTitle", "Sécurisation du Compte")}
          </h2>
          <p className="text-white text-sm" style={{ color: "#ffffff" }}>
            {t("auth.secureDesc", "Pour protéger votre compte, veuillez renseigner un e-mail de récupération.")}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-200">{message}</p>
          </div>
        )}

        {/* STEP 1: EMAIL INPUT */}
        {step === 1 && (
          <form onSubmit={handleSendEmailCode} className="space-y-6">
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
                Vous recevrez un code à 6 chiffres sur cette adresse e-mail.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !recoveryEmail.includes('@') || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all"
              style={{
                backgroundColor: loading || !recoveryEmail.includes('@') || cooldown > 0 ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                cursor: loading || !recoveryEmail.includes('@') || cooldown > 0 ? "not-allowed" : "pointer", color: "#ffffff"}}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Mail size={20} />}
              {cooldown > 0 ? t("auth.waitCooldown", \`Patientez (\${cooldown}s)\`) : t("auth.sendEmailCode", "Recevoir le code par e-mail")}
            </button>
          </form>
        )}

        {/* STEP 2: EMAIL CODE INPUT */}
        {step === 2 && (
          <form onSubmit={handleVerifyEmailCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2" style={{ color: "#ffffff" }}>
                {t("auth.codeLabel", "Code reçu par e-mail (6 chiffres)")}
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-4 text-white text-center text-xl tracking-[0.5em] font-bold focus:border-emerald-500 focus:outline-none"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all"
              style={{
                backgroundColor: loading || verificationCode.length !== 6 ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                cursor: loading || verificationCode.length !== 6 ? "not-allowed" : "pointer", color: "#ffffff"}}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
              {t("auth.verifyCode", "Valider le code")}
            </button>
            <button 
              type="button"
              onClick={() => { setStep(1); setVerificationCode(''); setError(''); }}
              className="w-full text-sm transition-colors mt-4" style={{ color: "#ffffff" }}
            >
              {t("auth.backToEmail", "Changer d'e-mail")}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default PhoneVerificationModal;
`;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('PhoneVerificationModal.jsx updated successfully for email-only recovery!');
