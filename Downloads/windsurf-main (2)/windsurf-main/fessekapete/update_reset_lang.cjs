const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldFunc = `exports.sendPasswordResetCode = functions.region('europe-west3').https.onCall(async (data, context) => {`;

// Let's do a similar regex replacement for sendPasswordResetCode
const startIndex = content.indexOf("exports.sendPasswordResetCode =");
const endIndex = content.indexOf("exports.verifyPasswordResetCode =");

const newFunc = `exports.sendPasswordResetCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    const { recoveryEmail, lang } = data;
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
        throw new functions.https.HttpsError('invalid-argument', 'Email invalide');
    }

    try {
        const db = admin.firestore();
        // 1. Trouver le client avec cet email de récupération
        const snapshot = await db.collection('clients').where('recovery_email', '==', recoveryEmail).limit(1).get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Aucun compte associé à cet e-mail de récupération.');
        }

        const clientDoc = snapshot.docs[0];
        const uid = clientDoc.id;

        // 2. Générer le code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));
        const resetId = db.collection('password_resets').doc().id;

        // 3. Sauvegarder dans Firestore
        await db.collection('password_resets').doc(resetId).set({
            uid: uid,
            code: code,
            expiresAt: expiresAt,
            recoveryEmail: recoveryEmail
        });

        const isEn = lang === 'en';

        // 4. Envoyer l'e-mail
        const htmlBody = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #10b981;">\${isEn ? 'StratAds Password Reset' : 'Code de réinitialisation StratAds'}</h2>
                <p>\${isEn ? 'Hello,' : 'Bonjour,'}</p>
                <p>\${isEn ? 'You requested to reset your StratAds account password via this recovery email.' : 'Vous avez demandé à réinitialiser le mot de passe de votre compte StratAds via cet e-mail de récupération.'}</p>
                <p>\${isEn ? 'Here is your 6-digit security code:' : 'Voici votre code de sécurité à 6 chiffres :'}</p>
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
            to: [recoveryEmail],
            message: {
                from: 'StratAds Security <contact@stratads.fr>',
                subject: isEn ? 'Reset your password' : 'Réinitialisation de votre mot de passe',
                html: htmlBody
            }
        });

        return { success: true, resetId: resetId };
    } catch (err) {
        console.error("Erreur sendPasswordResetCode:", err);
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', 'Erreur lors de lenvoi du code');
    }
});`;

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newFunc + '\\n\\n' + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced sendPasswordResetCode successfully.");
} else {
  console.log("Could not find the function boundaries.");
}
