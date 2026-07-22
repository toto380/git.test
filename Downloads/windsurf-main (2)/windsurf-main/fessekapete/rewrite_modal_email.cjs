const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'components', 'PhoneVerificationModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// We will overwrite the file cleanly using the previous structure but with the new requirements.
const newContent = `import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import PhoneInput, { getCountryCallingCode, isValidPhoneNumber } from 'react-phone-number-input';
import fr from 'react-phone-number-input/locale/fr.json';
import { getExampleNumber } from 'libphonenumber-js';
import mobileExamples from 'libphonenumber-js/examples.mobile.json';
import en from 'react-phone-number-input/locale/en.json';
import 'react-phone-number-input/style.css';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { linkWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { ShieldCheck, Lock, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PhoneVerificationModal = () => {

  const { t, i18n } = useTranslation();
  
  const customLabels = React.useMemo(() => {
    const localeLabels = i18n.language === 'en' ? en : fr;
    const labels = { ...localeLabels };
    for (const country in labels) {
      if (country.length === 2 && country !== 'ZZ') {
        try {
          const code = getCountryCallingCode(country);
          if (code) {
            labels[country] = \`\${localeLabels[country]} (+\${code})\`;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return labels;
  }, [i18n.language]);

  const { refreshUser, user } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('FR');

  const phonePlaceholder = React.useMemo(() => {
    try {
      const ex = getExampleNumber(selectedCountry, mobileExamples);
      return ex ? ex.formatInternational() : '+33 6 12 34 56 78';
    } catch(e) { return '+33 6 12 34 56 78'; }
  }, [selectedCountry]);
  
  const [verificationCode, setVerificationCode] = useState('');
  // step 1 = Phone Input
  // step 2 = Phone Code Input
  // step 3 = Email Input
  // step 4 = Email Code Input
  const [step, setStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    return () => {
      if (window.phoneModalRecaptcha) {
        window.phoneModalRecaptcha.clear();
        window.phoneModalRecaptcha = null;
      }
    };
  }, []);

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

  const handleSendSms = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      setError(t("auth.phoneRequired", "Veuillez entrer un numéro valide."));
      return;
    }
    if (cooldown > 0) {
      setError(t("auth.cooldownError", \`Veuillez patienter \${cooldown} secondes avant de renvoyer un SMS.\`));
      return;
    }

    setLoading(true);
    try {
      if (!window.phoneModalRecaptcha) {
        window.phoneModalRecaptcha = new RecaptchaVerifier(auth, 'phone-modal-recaptcha', {
          size: 'invisible'
        });
      }

      const confirmation = await linkWithPhoneNumber(auth.currentUser, phoneNumber, window.phoneModalRecaptcha);
      setConfirmationResult(confirmation);
      setMessage(t("auth.codeSent", "Un code vous a été envoyé par SMS."));
      setCooldown(59);
      setStep(2);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/credential-already-in-use') {
        setError(t("auth.phoneInUse", "Ce numéro de téléphone est déjà lié à un autre compte."));
      } else if (err.code === 'auth/invalid-phone-number') {
        setError(t("auth.invalidPhone", "Format de numéro de téléphone invalide."));
      } else if (err.code === 'auth/too-many-requests') {
        setError(t("auth.tooManyRequests", "Trop de tentatives. Veuillez réessayer plus tard."));
      } else {
        setError(t("auth.smsError", "Erreur lors de l'envoi du SMS. Veuillez réessayer. Détails: " + err.message));
      }
      
      if (window.phoneModalRecaptcha) {
        window.phoneModalRecaptcha.clear();
        window.phoneModalRecaptcha = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySmsCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!verificationCode) return;
    
    setLoading(true);
    try {
      await confirmationResult.confirm(verificationCode);
      setMessage(t("auth.phoneSuccess", "Numéro vérifié avec succès !"));
      
      setTimeout(() => {
        refreshUser();
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setError(t("auth.invalidCode", "Code SMS incorrect ou expiré."));
    } finally {
      setLoading(false);
    }
  };

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
      setStep(4);
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
            {t("auth.secureDesc", "Pour protéger votre compte, veuillez choisir une méthode de récupération. Cela renforcera la sécurité de vos accès.")}
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

        {/* STEP 1: PHONE INPUT */}
        {step === 1 && (
          <form onSubmit={handleSendSms} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2" style={{ color: "#ffffff" }}>
                {t("auth.phoneLabel", "Votre Numéro de Téléphone")}
              </label>
              <div className="phone-input-wrapper">
                <style dangerouslySetInnerHTML={{__html: \`
                  .PhoneInput { display: flex; align-items: center; gap: 12px; }
                  .PhoneInputCountry { background: rgba(2, 6, 23, 0.5); padding: 12px; border-radius: 12px; border: 1px solid rgba(51, 65, 85, 0.8); }
                  .PhoneInputInput { flex: 1; background: rgba(2, 6, 23, 0.5); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 12px; padding: 14px 16px; color: #ffffff !important; font-size: 1rem; outline: none; }
                  .PhoneInputInput:focus { border-color: #10b981; }
                \`}} />
                <PhoneInput
                  international
                  defaultCountry="FR"
                  onCountryChange={setSelectedCountry}
                  placeholder={phonePlaceholder}
                  labels={customLabels}
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  className="w-full"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || (!phoneNumber || !isValidPhoneNumber(phoneNumber)) || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all"
              style={{
                backgroundColor: loading || (!phoneNumber || !isValidPhoneNumber(phoneNumber)) || cooldown > 0 ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                cursor: loading || (!phoneNumber || !isValidPhoneNumber(phoneNumber)) || cooldown > 0 ? "not-allowed" : "pointer", color: "#ffffff"}}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Lock size={20} />}
              {cooldown > 0 ? t("auth.waitCooldown", \`Patientez (\${cooldown}s)\`) : t("auth.sendCode", "Recevoir le code SMS")}
            </button>
            <div className="text-center mt-4">
              <button 
                type="button"
                onClick={() => { setStep(3); setError(''); setMessage(''); }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline"
              >
                Passer à l'e-mail de récupération
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PHONE CODE INPUT */}
        {step === 2 && (
          <form onSubmit={handleVerifySmsCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2" style={{ color: "#ffffff" }}>
                {t("auth.codeLabel", "Code de vérification (6 chiffres)")}
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
              {t("auth.backToPhone", "Changer de numéro")}
            </button>
          </form>
        )}

        {/* STEP 3: EMAIL INPUT */}
        {step === 3 && (
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
            <div className="text-center mt-4">
              <button 
                type="button"
                onClick={() => { setStep(1); setError(''); setMessage(''); }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline"
              >
                Passer au numéro de téléphone
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: EMAIL CODE INPUT */}
        {step === 4 && (
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
              onClick={() => { setStep(3); setVerificationCode(''); setError(''); }}
              className="w-full text-sm transition-colors mt-4" style={{ color: "#ffffff" }}
            >
              {t("auth.backToEmail", "Changer d'e-mail")}
            </button>
          </form>
        )}

        <div id="phone-modal-recaptcha"></div>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;
`;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('PhoneVerificationModal.jsx updated successfully!');
