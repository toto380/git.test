const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const newFunctions = `

// ============================================================================
// 20. SECURITY: PASSWORD RESET VIA RECOVERY EMAIL
// ============================================================================

exports.sendPasswordResetCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    const { recoveryEmail } = data;
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
        throw new functions.https.HttpsError('invalid-argument', 'Email invalide');
    }

    try {
        const db = admin.firestore();
        // 1. Trouver le client avec cet email de récupération
        const snapshot = await db.collection('clients').where('recovery_email', '==', recoveryEmail).limit(1).get();
        if (snapshot.empty) {
            // Pour des raisons de sécurité, on ne dit pas si l'email existe ou non (prévention d'énumération)
            // Mais pour une meilleure UX interne, on peut lancer une erreur ou juste simuler un succès.
            // Optons pour une erreur claire ici pour aider l'utilisateur :
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

        // 4. Envoyer l'e-mail
        const htmlBody = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #10b981;">Code de réinitialisation StratAds</h2>
                <p>Bonjour,</p>
                <p>Vous avez demandé à réinitialiser le mot de passe de votre compte StratAds via cet e-mail de récupération.</p>
                <p>Voici votre code de sécurité à 6 chiffres :</p>
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
            to: [recoveryEmail],
            message: {
                from: 'StratAds Security <contact@stratads.fr>',
                subject: 'Réinitialisation de votre mot de passe',
                html: htmlBody
            }
        });

        return { success: true, resetId: resetId };
    } catch (err) {
        console.error("Erreur sendPasswordResetCode:", err);
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', 'Erreur lors de lenvoi du code');
    }
});

exports.verifyPasswordResetCode = functions.region('europe-west3').https.onCall(async (data, context) => {
    const { resetId, code, newPassword } = data;
    
    if (!resetId || !code || code.length !== 6 || !newPassword || newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Données invalides');
    }

    try {
        const db = admin.firestore();
        const resetRef = db.collection('password_resets').doc(resetId);
        const docSnap = await resetRef.get();

        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Demande invalide ou expirée');
        }

        const resetData = docSnap.data();

        // Check expiration
        if (resetData.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError('failed-precondition', 'Le code a expiré');
        }

        // Check code
        if (resetData.code !== code) {
            throw new functions.https.HttpsError('invalid-argument', 'Code incorrect');
        }

        // Update User Password via Admin SDK
        await admin.auth().updateUser(resetData.uid, {
            password: newPassword
        });

        // Cleanup
        await resetRef.delete();

        return { success: true };
    } catch (err) {
        console.error("Erreur verifyPasswordResetCode:", err);
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', 'Erreur lors de la réinitialisation');
    }
});
`;

if (!content.includes('sendPasswordResetCode')) {
  // Insert before exports.getMetricsByClientV1 = require('./monitoring_v1').getMetricsByClientV1;
  content = content.replace("exports.getMetricsByClientV1 = require('./monitoring_v1').getMetricsByClientV1;", newFunctions + "\nexports.getMetricsByClientV1 = require('./monitoring_v1').getMetricsByClientV1;");
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully injected reset password functions!');
} else {
  console.log('Functions already exist!');
}
