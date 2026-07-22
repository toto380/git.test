const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Login.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add confirmPassword state
if (!content.includes('const [confirmPassword, setConfirmPassword]')) {
    content = content.replace('const [newPassword, setNewPassword] = useState("");', 'const [newPassword, setNewPassword] = useState("");\\n  const [confirmPassword, setConfirmPassword] = useState("");');
}

// 2. Add lang to sendPasswordResetCode
const sendResetCodeRegex = /const res = await sendPasswordResetCode\\(\\{ recoveryEmail: email \\}\\);/g;
content = content.replace(sendResetCodeRegex, "const res = await sendPasswordResetCode({ recoveryEmail: email, lang: i18n?.language || 'fr' });");

// 3. Add confirmPassword field to recovery UI
const passwordInputBlock = `<div style={{ marginBottom: "20px" }}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" minLength={6} required style={{ width: "100%", backgroundColor: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(51, 65, 85, 0.8)", borderRadius: "10px", padding: "14px 16px", color: "#fff", fontSize: "1rem" }} />
            </div>`;
const newPasswordInputs = `<div style={{ marginBottom: "12px" }}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" minLength={6} required style={{ width: "100%", backgroundColor: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(51, 65, 85, 0.8)", borderRadius: "10px", padding: "14px 16px", color: "#fff", fontSize: "1rem" }} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe" minLength={6} required style={{ width: "100%", backgroundColor: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(51, 65, 85, 0.8)", borderRadius: "10px", padding: "14px 16px", color: "#fff", fontSize: "1rem" }} />
            </div>`;
content = content.replace(passwordInputBlock, newPasswordInputs);

// 4. Update the submit handler in recovery_code form to check if passwords match
const oldSubmitCondition = `if (verificationCode.length !== 6 || newPassword.length < 6) return;`;
const newSubmitCondition = `if (verificationCode.length !== 6 || newPassword.length < 6) return;
            if (newPassword !== confirmPassword) {
              setError("Les mots de passe ne correspondent pas.");
              return;
            }`;
content = content.replace(oldSubmitCondition, newSubmitCondition);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Login.jsx recovery UI successfully updated with confirm password and lang.");
