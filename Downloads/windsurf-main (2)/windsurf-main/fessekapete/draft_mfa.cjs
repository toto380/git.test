const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Login.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports for MFA
if (!content.includes('getMultiFactorResolver')) {
    content = content.replace("import { auth } from '../firebase';", "import { auth } from '../firebase';\nimport { getMultiFactorResolver, TotpMultiFactorGenerator } from 'firebase/auth';");
}

// 2. Add state for MFA
if (!content.includes('mfaResolver')) {
    content = content.replace('const [error, setError] = useState("");', 'const [error, setError] = useState("");\n    const [mfaResolver, setMfaResolver] = useState(null);\n    const [mfaCode, setMfaCode] = useState("");');
}

// 3. Catch MFA error
const catchBlockRegex = /} catch \\(err\\) \\{\\s+console\\.error\\(err\\);\\s+if \\(err\\.code === "auth\\/user-not-found"/;
const newCatchBlock = `} catch (err) {
        console.error(err);
        if (err.code === "auth/multi-factor-auth-required") {
          try {
            const resolver = getMultiFactorResolver(auth, err);
            setMfaResolver(resolver);
            return;
          } catch(e) {
             setError("Erreur 2FA.");
          }
        }
        if (err.code === "auth/user-not-found"`;
content = content.replace(catchBlockRegex, newCatchBlock);

// 4. Add MFA verification function inside Login component
const handleSubmitRegex = /const handleSubmit = async e => \\{/;
const handleMfaSubmit = `const handleMfaSubmit = async (e) => {
      e.preventDefault();
      setError("");
      if (!mfaCode || mfaCode.length !== 6) return;
      setLoading(true);
      try {
        const hint = mfaResolver.hints[0];
        const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode);
        await mfaResolver.resolveSignIn(multiFactorAssertion);
        setMfaResolver(null);
      } catch (err) {
        console.error(err);
        setError("Code 2FA invalide ou expiré.");
      } finally {
        setLoading(false);
      }
    };
    
    const handleSubmit = async e => {`;
content = content.replace(handleSubmitRegex, handleMfaSubmit);

// 5. Render MFA UI
// Instead of rendering the whole login form, if mfaResolver exists, render MFA input.
// Find the <form onSubmit={handleSubmit}> ... </form> and wrap it in {!mfaResolver ? (...) : (<form onSubmit={handleMfaSubmit}>...</form>)}
// It's tricky to replace the exact form. I will look for `<form onSubmit={handleSubmit}` and add `{mfaResolver && (<form...>)}` right above it, and `{ !mfaResolver && (` before the login form.

const formStartIdx = content.indexOf('<form onSubmit={handleSubmit} className="space-y-4">');
if (formStartIdx !== -1) {
    const mfaFormUI = `
          {mfaResolver && (
            <div className="relative overflow-hidden" style={{
              backgroundColor: "rgba(11, 15, 23, 0.7)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "24px",
              padding: "40px 32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)"
            }}>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#fff", marginBottom: "8px", textAlign: "center" }}>
                Authentification 2FA
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "24px", textAlign: "center" }}>
                Ouvrez Google Authenticator et entrez le code à 6 chiffres.
              </p>
              
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    maxLength={6}
                    required
                    style={{ width: "100%", backgroundColor: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(51, 65, 85, 0.8)", borderRadius: "10px", padding: "14px 16px", color: "#fff", fontSize: "1.5rem", textAlign: "center", letterSpacing: "5px" }}
                  />
                </div>
                <button type="submit" disabled={loading || mfaCode.length !== 6} style={{ width: "100%", padding: "16px", marginTop: "16px", backgroundColor: "#10b981", color: "#fff", fontSize: "0.875rem", fontWeight: 700, borderRadius: "6px", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Vérification..." : "Valider"}
                </button>
                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <button type="button" onClick={() => { setMfaResolver(null); setMfaCode(''); }} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.9rem", cursor: "pointer" }}>
                    &larr; Retour
                  </button>
                </div>
              </form>
            </div>
          )}

          {!mfaResolver && !isRecoveryMode && (
  <>
`;

    // Also need to find where to close the `</>` for the `{!mfaResolver && !isRecoveryMode && (` block.
    // Right now, I can see `{!isRecoveryMode && (` already exists.
    // Let me check Login.jsx `!isRecoveryMode`.
}
