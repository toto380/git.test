const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldFunc = `exports.sendRecoveryEmailCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifiǸ');
    }

    const { email } = data;
    if (!email || !email.includes('@')) {
        throw new functions.https.HttpsError('invalid-argument', 'Email invalide');
    }

    try {
        const uid = context.auth.uid;
        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Expiration time: 15 minutes from now
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));

        // Save to Firestore
        const db = admin.firestore();
        await db.collection('clients').doc(uid).collection('security').doc('recovery').set({
            code: code,
            email: email,
            expiresAt: expiresAt
        });

        // Send Email
        const htmlBody = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #10b981;">Code de vǸrification StratAds</h2>
                <p>Bonjour,</p>
                <p>Vous avez demandǸ  utiliser cette adresse e-mail comme mǸthode de rǸcupǸration pour votre compte StratAds.</p>
                <p>Voici votre code de vǸrification  6 chiffres :</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    \${code}
                </div>
                <p>Ce code est valable pendant 15 minutes. Ne le partagez avec personne.</p>
                <p>Si vous n'Ǧtes pas  l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
                <br>
                <p>L'Ǹquipe StratAds</p>
            </div>
        \`;

        await sendEmail({
            to: [email],
            message: {
                from: 'StratAds Security <contact@stratads.fr>',
                subject: 'Votre code de vǸrification StratAds',
                html: htmlBody
            }
        });

        console.log(\`Recovery code sent to \${email} for user \${uid}\`);
        return { success: true };
    } catch (err) {
        console.error("Erreur sendRecoveryEmailCode:", err);
        throw new functions.https.HttpsError('internal', 'Erreur lors de l\\'envoi du code');
    }
});`;

// Wait, the special characters like "Ǹ" and "" in the console output might break exact replacement.
// Instead of replacing the whole block exactly, I'll use regex to match everything from "exports.sendRecoveryEmailCode" to the next "exports.verifyRecoveryEmailCode".

const newFunc = `exports.sendRecoveryEmailCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifié');
    }

    const { email, lang } = data;
    if (!email || !email.includes('@')) {
        throw new functions.https.HttpsError('invalid-argument', 'Email invalide');
    }

    try {
        const uid = context.auth.uid;
        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Expiration time: 15 minutes from now
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));

        // Save to Firestore
        const db = admin.firestore();
        await db.collection('clients').doc(uid).collection('security').doc('recovery').set({
            code: code,
            email: email,
            expiresAt: expiresAt
        });

        const isEn = lang === 'en';

        // Send Email
        const htmlBody = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #10b981;">\${isEn ? 'StratAds Verification Code' : 'Code de vérification StratAds'}</h2>
                <p>\${isEn ? 'Hello,' : 'Bonjour,'}</p>
                <p>\${isEn ? 'You requested to use this email address as a recovery method for your StratAds account.' : 'Vous avez demandé à utiliser cette adresse e-mail comme méthode de récupération pour votre compte StratAds.'}</p>
                <p>\${isEn ? 'Here is your 6-digit verification code:' : 'Voici votre code de vérification à 6 chiffres :'}</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    \${code}
                </div>
                <p>\${isEn ? 'This code is valid for 15 minutes. Do not share it with anyone.' : 'Ce code est valable pendant 15 minutes. Ne le partagez avec personne.'}</p>
                <p>\${isEn ? 'If you did not make this request, you can ignore this email.' : 'Si vous n\\'êtes pas à l\\'origine de cette demande, vous pouvez ignorer cet e-mail.'}</p>
                <br>
                <p>\${isEn ? 'The StratAds Team' : 'L\\'équipe StratAds'}</p>
            </div>
        \`;

        await sendEmail({
            to: [email],
            message: {
                from: 'StratAds Security <contact@stratads.fr>',
                subject: isEn ? 'Your StratAds verification code' : 'Votre code de vérification StratAds',
                html: htmlBody
            }
        });

        console.log(\`Recovery code sent to \${email} for user \${uid} in \${lang}\`);
        return { success: true };
    } catch (err) {
        console.error("Erreur sendRecoveryEmailCode:", err);
        throw new functions.https.HttpsError('internal', 'Erreur lors de l\\'envoi du code');
    }
});`;

const startIndex = content.indexOf('exports.sendRecoveryEmailCode =');
const endIndex = content.indexOf('exports.verifyRecoveryEmailCode =');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newFunc + '\\n\\n' + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced sendRecoveryEmailCode successfully.");
} else {
  console.log("Could not find the function boundaries.");
}
