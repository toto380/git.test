const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../stratads/functions/index.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add enforceSubscriptionAccess
if (!content.includes("const { enforceSubscriptionAccess } = require('./utils/permissions');")) {
    content = content.replace(
        "const cloudRunManager = require('./cloudRunManager');",
        "const cloudRunManager = require('./cloudRunManager');\nconst { enforceSubscriptionAccess } = require('./utils/permissions');"
    );
}

// 2. Replace verifyCustomDomain completely
const verifyCustomDomainRegex = /exports\.verifyCustomDomain = functions\.region\('europe-west3'\)\.runWith\(\{ memory: '2GB', timeoutSeconds: 540 \}\)\.https\.onCall\(async \(data, context\) => \{[\s\S]*?\}\);/g;
const newVerifyCustomDomain = `exports.verifyCustomDomain = functions.region('europe-west3').runWith({ memory: '2GB', timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    const { serverId, domain } = data;

    if (!serverId || !domain) {
        throw new functions.https.HttpsError('invalid-argument', 'Paramètres manquants.');
    }

    try {
        const cleanDomain = domain.toLowerCase().trim();
        const serverData = await enforceSubscriptionAccess(
            context.auth,
            { serverId },
            ['hosting'],
            { requireSSL: false, useCache: false }
        );

        // 2. Appeler le manager Cloud Run pour binder le domaine
        await cloudRunManager.mapCustomDomain(serverId, cleanDomain);
        
        // 3. Mettre à jour Firestore
        if (serverData && serverData._ref) {
            await serverData._ref.update({
                custom_domain: cleanDomain,
                ssl_active: false // SSL sera actif une fois propagé par Cloud Run
            });
        } else {
            const serverRef = admin.firestore().collection('clients').doc(context.auth.uid).collection('servers').doc(serverId);
            await serverRef.update({ custom_domain: cleanDomain, ssl_active: false });
        }

        return { success: true, message: 'Domaine associé avec succès.' };
    } catch (err) {
        console.error('Erreur verifyCustomDomain:', err);
        throw new functions.https.HttpsError(err.code || 'internal', err.message);
    }
});`;
content = content.replace(verifyCustomDomainRegex, newVerifyCustomDomain);

// 3. Replace configureAndDeployServer completely
const configureAndDeployRegex = /exports\.configureAndDeployServer = functions\.region\('europe-west3'\)\.https\.onCall\(async \(data, context\) => \{[\s\S]*?\}\);(?=\n\n|\n\/\/)/g;
// Wait, the regex might be tricky if there's no clear ending for configureAndDeployServer.
// Let's replace just the beginning of configureAndDeployServer.
const configureStartRegex = /exports\.configureAndDeployServer = functions\.region\('europe-west3'\)\.https\.onCall\(async \(data, context\) => \{[\s\S]*?if \(!serverDoc\.exists\) \{[\s\S]*?\}[\s\S]*?const serverData = serverDoc\.data\(\);[\s\S]*?if \(serverData\.status !== 'pending_configuration'\) \{[\s\S]*?\}/;
const newConfigureStart = `exports.configureAndDeployServer = functions.region('europe-west3').https.onCall(async (data, context) => {
    const { serverId, serverName, domain, containerConfig, region, isMultiRegion } = data;
    
    if (!serverId || !serverName || !domain || !containerConfig) {
        throw new functions.https.HttpsError('invalid-argument', 'Tous les champs sont requis.');
    }

    let serverData;
    let uid = context.auth ? context.auth.uid : null;
    let serverRef;

    try {
        serverData = await enforceSubscriptionAccess(
            context.auth,
            { serverId },
            ['hosting'],
            { requireSSL: false, useCache: false }
        );
        
        if (serverData.status !== 'pending_configuration') {
            throw new functions.https.HttpsError('failed-precondition', 'Ce serveur est déjà configuré.');
        }

        serverRef = serverData._ref || admin.firestore().collection('clients').doc(uid).collection('servers').doc(serverId);`;
content = content.replace(configureStartRegex, newConfigureStart);

// We need to close the try-catch block in configureAndDeployServer.
const configureEndRegex = /        await serverRef\.update\(\{[\s\S]*?status: 'error_configuration',[\s\S]*?error_message: err\.message,[\s\S]*?updated_at: require\('firebase-admin\/firestore'\)\.Timestamp\.now\(\)[\s\S]*?\}\);\n    \}\);\n    \n    return \{ success: true, message: 'Configuration enregistrée. Déploiement en cours\.\.\.' \};\n\}\);/;
const newConfigureEnd = `        await serverRef.update({
            status: 'error_configuration',
            error_message: err.message,
            updated_at: require('firebase-admin/firestore').Timestamp.now()
        });
    });
    
    return { success: true, message: 'Configuration enregistrée. Déploiement en cours...' };
    } catch (err) {
        console.error('Erreur configureAndDeployServer:', err);
        throw new functions.https.HttpsError(err.code || 'internal', err.message);
    }
});`;
content = content.replace(configureEndRegex, newConfigureEnd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Modified index.js');
