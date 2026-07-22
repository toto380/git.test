const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const newFunctions = `
// ============================================================================
// 19. SECURITY: EMAIL RECOVERY VERIFICATION
// ============================================================================

exports.sendRecoveryEmailCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifié');
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
                <h2 style="color: #10b981;">Code de vérification StratAds</h2>
                <p>Bonjour,</p>
                <p>Vous avez demandé à utiliser cette adresse e-mail comme méthode de récupération pour votre compte StratAds.</p>
                <p>Voici votre code de vérification à 6 chiffres :</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    \${code}
                </div>
                <p>Ce code est valable pendant 15 minutes. Ne le partagez avec personne.</p>
                <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
                <br>
                <p>L'équipe StratAds</p>
            </div>
        \`;

        await sendEmail({
            to: [email],
            message: {
                from: 'StratAds Security <contact@stratads.fr>',
                subject: 'Votre code de vérification StratAds',
                html: htmlBody
            }
        });

        console.log(\`Recovery code sent to \${email} for user \${uid}\`);
        return { success: true };
    } catch (err) {
        console.error("Erreur sendRecoveryEmailCode:", err);
        throw new functions.https.HttpsError('internal', 'Erreur lors de l\\'envoi du code');
    }
});

exports.verifyRecoveryEmailCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifié');
    }

    const { code } = data;
    if (!code || code.length !== 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Code invalide');
    }

    try {
        const uid = context.auth.uid;
        const db = admin.firestore();
        const recoveryRef = db.collection('clients').doc(uid).collection('security').doc('recovery');
        const docSnap = await recoveryRef.get();

        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Aucune demande en cours');
        }

        const recoveryData = docSnap.data();

        // Check expiration
        if (recoveryData.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError('failed-precondition', 'Le code a expiré');
        }

        // Check code match
        if (recoveryData.code !== code) {
            throw new functions.https.HttpsError('invalid-argument', 'Code incorrect');
        }

        // Code is valid! Save the email to the main client doc
        await db.collection('clients').doc(uid).update({
            recovery_email: recoveryData.email
        });

        // Cleanup the security doc
        await recoveryRef.delete();

        console.log(\`Recovery email \${recoveryData.email} verified for user \${uid}\`);
        return { success: true };
    } catch (err) {
        console.error("Erreur verifyRecoveryEmailCode:", err);
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', 'Erreur de vérification');
    }
});
`;

content += "\\n" + newFunctions;
fs.writeFileSync(filePath, content, 'utf8');
console.log('functions/index.js updated successfully!');
