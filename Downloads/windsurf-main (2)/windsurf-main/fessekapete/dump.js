// Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ Ã¢â€¢ 
exports.getMetricsByClient = require('./monitoring').getMetricsByClient;
exports.getCookieLifespan = require('./monitoring').getCookieLifespan;
exports.forceSetupLogSinkV2 = require('./monitoring').forceSetupLogSinkV2;

        const defaultTranslations = {
            fr: {
                cookie: {
                    bannerTitle: "Gestion des cookies",
                    bannerText: "Nous et nos partenaires utilisons des traceurs (cookies) pour assurer le bon fonctionnement du site, analyser notre trafic et vous proposer des expÃ©riences personnalisÃ©es. Vous pouvez accepter, refuser ou paramÃ©trer vos choix. Vous pouvez modifier vos prÃ©fÃ©rences Ã  tout moment.",
                    privacyLink: "Pour en savoir plus, consultez notre <a href='${privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Politique de confidentialitÃ©</a>.",
                    customize: "Choisir mes cookies",
                    accept: "J'accepte",
                    decline: "Continuer sans accepter",
                    preferencesTitle: "Vos prÃ©fÃ©rences",
                    preferencesDesc: "Personnalisez vos choix ci-dessous. Les cookies strictement nÃ©cessaires au fonctionnement du site ne peuvent pas Ãªtre dÃ©sactivÃ©s.",
                    necessaryTitle: "Strictement nÃ©cessaires",
                    necessaryDesc: "Requis pour le fonctionnement du site (sÃ©curitÃ©, session).",
                    analyticsTitle: "Statistiques",
                    analyticsDesc: "Nous aident Ã  mesurer l'audience et amÃ©liorer nos services.",
                    marketingTitle: "Marketing",
                    marketingDesc: "Permettent d'afficher des publicitÃ©s ciblÃ©es.",
                    savePreferences: "Enregistrer mes choix",
                    acceptAll: "Tout accepter",
                    poweredBy: "PropulsÃ© par"
                },
                buttons: { accept: "Tout accepter", decline: "Continuer sans accepter" }
            },
            en: {
                cookie: {
                    bannerTitle: "Manage your cookies",
                    bannerText: "We and our partners use trackers (cookies) to ensure the site works properly, analyze our traffic, and offer personalized experiences. You can accept, reject, or customize your choices. You can modify your preferences at any time.",
                    privacyLink: "To learn more, check our <a href='${privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Privacy Policy</a>.",
                    customize: "Manage cookies",
                    accept: "I Accept",
                    decline: "Continue without accepting",
                    preferencesTitle: "Your preferences",
                    preferencesDesc: "Customize your choices below. Strictly necessary cookies cannot be disabled.",
                    necessaryTitle: "Strictly necessary",
                    necessaryDesc: "Required for site operation (security, session).",
const defaultTranslations = {
    fr: {
        cookie: {
            bannerTitle: "Gestion des cookies",
            bannerText: "Nous et nos partenaires utilisons des traceurs (cookies) pour assurer le bon fonctionnement du site, analyser notre trafic et vous proposer des expÃ©riences personnalisÃ©es. Vous pouvez accepter, refuser ou paramÃ©trer vos choix. Vous pouvez modifier vos prÃ©fÃ©rences Ã  tout moment.",
            privacyLink: "Pour en savoir plus, consultez notre <a href='${privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Politique de confidentialitÃ©</a>.",
            customize: "Choisir mes cookies",
            accept: "J'accepte",
            decline: "Continuer sans accepter",
            preferencesTitle: "Vos prÃ©fÃ©rences",
            preferencesDesc: "Personnalisez vos choix ci-dessous. Les cookies strictement nÃ©cessaires au fonctionnement du site ne peuvent pas Ãªtre dÃ©sactivÃ©s.",
            necessaryTitle: "Strictement nÃ©cessaires",
            necessaryDesc: "Requis pour le fonctionnement du site (sÃ©curitÃ©, session).",
            analyticsTitle: "Statistiques",
            analyticsDesc: "Nous aident Ã  mesurer l'audience et amÃ©liorer nos services.",
            marketingTitle: "Marketing",
            marketingDesc: "Permettent d'afficher des publicitÃ©s ciblÃ©es.",
            savePreferences: "Enregistrer mes choix",
            acceptAll: "Tout accepter",
            poweredBy: "PropulsÃ© par"
        },
        buttons: { accept: "Tout accepter", decline: "Continuer sans accepter" }
    },
    en: {
        cookie: {
            bannerTitle: "Manage your cookies",
            bannerText: "We and our partners use trackers (cookies) to ensure the site works properly, analyze our traffic, and offer personalized experiences. You can accept, reject, or customize your choices. You can modify your preferences at any time.",
            privacyLink: "To learn more, check our <a href='${privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Privacy Policy</a>.",
            customize: "Manage cookies",
            accept: "I Accept",
            decline: "Continue without accepting",
            preferencesTitle: "Your preferences",
            preferencesDesc: "Customize your choices below. Strictly necessary cookies cannot be disabled.",
            necessaryTitle: "Strictly necessary",
            necessaryDesc: "Required for site operation (security, session).",
            analyticsTitle: "Analytics",
            analyticsDesc: "Help us measure audience and improve our services.",
            marketingTitle: "Marketing",
            marketingDesc: "Allow the display of targeted advertisements.",
            savePreferences: "Save my choices",
            acceptAll: "Accept all",
            poweredBy: "Powered by"
        },
        buttons: { accept: "Accept all", decline: "Continue without accepting" }
    }
};

// -------------------------------------------------------------------------------------------------------------------------
// 18. DOMAINE PERSONNALISÃ‰ (CDN)
// -------------------------------------------------------------------------------------------------------------------------
exports.verifyCustomDomain = functions.region('europe-west3').runWith({ memory: '2GB', timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const uid = context.auth.uid;
    const { serverId, domain } = data;

    if (!serverId || !domain) {
        throw new functions.https.HttpsError('invalid-argument', 'ParamÃƒÂ¨tres manquants.');
    }

    try {
        const cleanDomain = domain.toLowerCase().trim();
        // 1. VÃƒÂ©rifier que le serveur appartient bien ÃƒÂ  l'utilisateur
        const serverRef = admin.firestore().collection('clients').doc(uid).collection('servers').doc(serverId);
        const serverDoc = await serverRef.get();
        
        if (!serverDoc.exists) {
            // VÃƒÂ©rifier si c'est un serveur gÃƒÂ©rÃƒÂ© par l'agence
            const clientDoc = await admin.firestore().collection('clients').doc(uid).get();
            if (clientDoc.data()?.account_type !== 'partner') {
                throw new functions.https.HttpsError('permission-denied', 'Serveur introuvable.');
            }
        }

        const serverData = serverDoc.exists ? serverDoc.data() : null;
        // Pour les partenaires, on devrait normalement faire une requÃƒÂªte pour trouver le serveur parmi les clients...
        // Pour faire simple dans cette V1, on assume que le serverData a ÃƒÂ©tÃƒÂ© trouvÃƒÂ© (sinon on dÃƒÂ©lÃƒÂ¨gue ÃƒÂ  cloudRunManager qui a besoin de l'ID)

        // 2. Appeler le manager Cloud Run pour binder le domaine
        await cloudRunManager.mapCustomDomain(serverId, cleanDomain);
        
        // 3. Mettre ÃƒÂ  jour Firestore
        if (serverDoc.exists) {
            await serverRef.update({
                custom_domain: cleanDomain,
                ssl_active: false // SSL sera actif une fois propagÃƒÂ© par Cloud Run
            });
        }

        return { success: true, message: 'Domaine associÃƒÂ© avec succÃƒÂ¨s.' };
    } catch (err) {
        console.error('Ã¢ÂÅ’ Erreur verifyCustomDomain:', err);
        throw new functions.https.HttpsError('internal', err.message);
    }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// NEW: CONFIGURER ET DEPLOYER UN SERVEUR POST-ACHAT
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
exports.configureAndDeployServer = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Vous devez ÃƒÂªtre connectÃƒÂ©.');
    
    const { serverId, serverName, domain, containerConfig, region, isMultiRegion } = data;
    const uid = context.auth.uid;
    
    if (!serverId || !serverName || !domain || !containerConfig) {
        throw new functions.https.HttpsError('invalid-argument', 'Tous les champs sont requis.');
    }
    
    const serverRef = admin.firestore().collection('clients').doc(uid).collection('servers').doc(serverId);
    const serverDoc = await serverRef.get();
    
    if (!serverDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Serveur introuvable.');
    }
    
    const serverData = serverDoc.data();
    
    if (serverData.status !== 'pending_configuration') {
        throw new functions.https.HttpsError('failed-precondition', 'Ce serveur est dÃƒÂ©jÃƒÂ  configurÃƒÂ©.');
    }
    
    // Extraction du GTM ID
    let gtmPublicId = 'GTM-UNKNOWN';
    try {
        const decoded = Buffer.from(containerConfig, 'base64').toString('utf8');
        const match = decoded.match(/id=(GTM-[A-Z0-9]+)/);
        if (match) gtmPublicId = match[1];
    } catch (e) { /* ignore */ }
    
    const fullDomain = domain;

    // Mise ÃƒÂ  jour de Firestore avec les informations choisies
    await serverRef.update({
        status: 'active',
        server_name: serverName,
        domain: fullDomain,
        gtm_public_id: gtmPublicId,
        container_config: containerConfig,
        region: region || 'europe-west3',
        is_multi_region: !!isMultiRegion,
        updated_at: require('firebase-admin/firestore').Timestamp.now()
    });
    
    // Lancement du dÃƒÂ©ploiement Cloud Run en background
    cloudRunManager.deployGTMContainer(
        uid,
        serverId,
        containerConfig,
        serverData.plan,
        { region: region || 'europe-west3', isMultiRegion: !!isMultiRegion }
    ).then(async (cloudRunResult) => {
        await serverRef.update({
            server_host: 'Google Cloud Run (Serverless)',
            cloud_run_url: cloudRunResult.url,
            cloud_run_service_id: cloudRunResult.service_id
        });

        await admin.firestore().collection('clients').doc(uid).collection('notifications').add({
            title: "Instance DÃƒÂ©ployÃƒÂ©e Ã°Å¸Å½â€°",
            message: `Votre serveur de tracking pour ${fullDomain || serverName || serverId} a ÃƒÂ©tÃƒÂ© dÃƒÂ©ployÃƒÂ© avec succÃƒÂ¨s sur Google Cloud et est opÃƒÂ©rationnel.`,
            type: "server_deployed",
            severity: "info",
            server_id: serverId,
            read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        try {
            await cloudRunManager.mapCustomDomain(serverId, fullDomain);
        } catch (domainErr) {
            console.error(`Ã¢Å¡Â Ã¯Â¸Â Erreur mapping domaine auto ${fullDomain}:`, domainErr.message);
        }
    }).catch(async (err) => {
        console.error('Erreur lors du dÃƒÂ©ploiement asynchrone Cloud Run:', err);

        await admin.firestore().collection('clients').doc(uid).collection('notifications').add({
            title: "Ãƒâ€°chec du dÃƒÂ©ploiement Ã¢ÂÅ’",
            message: `Le dÃƒÂ©ploiement du serveur de tracking pour ${fullDomain || serverName || serverId} a ÃƒÂ©chouÃƒÂ©. Erreur : ${err.message || 'Erreur lors du dÃƒÂ©ploiement Cloud Run.'}`,
            type: "server_deploy_failed",
            severity: "critical",
            server_id: serverId,
            read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return { success: true, message: 'Configuration enregistrÃƒÂ©e, dÃƒÂ©ploiement en cours.' };
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 16. ENREGISTREMENT DE LA SIGNATURE DES CONDITIONS GÃƒâ€°NÃƒâ€°RALES / CONTRAT PARTENAIRE
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
exports.acceptTerms = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const uid = context.auth.uid;
    const version = data.version || '1.0';
    
    // Extraction de l'adresse IP et du User Agent
    const rawRequest = context.rawRequest;
    let userIp = rawRequest.headers['x-forwarded-for'] || rawRequest.connection.remoteAddress || 'unknown';
    if (userIp && userIp !== 'unknown') {
        userIp = userIp.split(',')[0].trim();
    }
    const userAgent = data.userAgent || rawRequest.headers['user-agent'] || 'unknown';

    const clientRef = admin.firestore().collection('clients').doc(uid);

    await clientRef.set({
        terms_accepted: true,
        terms_accepted_at: admin.firestore.FieldValue.serverTimestamp(),
        terms_version: version,
        terms_user_ip: userIp,
        terms_user_agent: userAgent
    }, { merge: true });

    return { 
        success: true, 
        message: 'Conditions acceptÃƒÂ©es et bloc de preuve juridique enregistrÃƒÂ©.'
    };
});

exports.checkPartnerTier = checkPartnerTier;








exports.verifyBanner = functions.region('europe-west3').https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { return res.status(204).send(''); }
    if (req.method !== 'GET') { return res.status(405).send('Method Not Allowed'); }

    const clientId = req.query.client_id;
    if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ active: false, error: 'Invalid client_id' });
    }

    try {
        const db = admin.firestore();
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) { return res.status(403).json({ active: false, error: 'Client not found' }); }
        const clientData = clientDoc.data();
        if (clientData.account_type === 'admin' || clientData.account_type === 'partner') {
            res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
            return res.status(200).json({ active: true });
        }
        const serversSnap = await db.collection('clients').doc(clientId).collection('servers')
            .where('status', 'in', ['active', 'trial', 'deployed', 'running'])
            .limit(1).get();
        if (serversSnap.empty) { return res.status(403).json({ active: false, error: 'No active subscription found' }); }
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.status(200).json({ active: true });
    } catch (error) {
        console.error(`VerifyBanner Error for client ${clientId}:`, error);
        return res.status(200).json({ active: true, error: 'Internal Error - Fail Open' });
    }
});

exports.getBannerConfig = functions.region('europe-west3').https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { return res.status(204).send(''); }
    if (req.method !== 'GET') { return res.status(405).send('Method Not Allowed'); }

    const projectId = req.query.id;
    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid id parameter' });
    }

    try {
        const db = admin.firestore();
        const serversSnap = await db.collectionGroup('servers').get();
        const serverDoc = serversSnap.docs.find(doc => doc.id === projectId);

        if (!serverDoc) { return res.status(404).json({ error: 'Server not found' }); }
        
        const serverData = serverDoc.data();
        if (serverData.status !== 'active' && serverData.status !== 'running' && serverData.status !== 'deployed' && serverData.status !== 'trial') {
            return res.status(403).json({ error: 'Server inactive' });
        }

        const defaultTranslations = {
            fr: {
                cookie: {
                    title: "Gestion des cookies",
                    desc: "Nous et nos partenaires utilisons des traceurs (cookies) pour assurer le bon fonctionnement du site, analyser notre trafic et vous proposer des expÃ©riences personnalisÃ©es. Vous pouvez accepter, refuser ou paramÃ©trer vos choix. Vous pouvez modifier vos prÃ©fÃ©rences Ã  tout moment."
                },
                buttons: { accept: "Tout accepter", decline: "Continuer sans accepter" }
            },
            en: {
                cookie: {
                    title: "Manage your preferences",
                    desc: "We use cookies to enhance your experience, analyze our traffic, and serve relevant advertisements."
                },
                buttons: { accept: "Accept all", decline: "Continue without accepting" }
            }
        };

        const plan = (serverData.plan || '').toLowerCase();
        const isStandalone = !(['free', 'cookie_free', 'starter', 'pro', 'pro_plan', 'unlimited', 'unlimited_plan', 'business', 'agency', 'agence', 'partner', 'cookie_standard', 'cookie_gold', 'cookie_unlimited'].includes(plan));

        return res.status(200).json({
            visuals: serverData.bannerConfig?.visuals || {},
            integrations: serverData.bannerConfig?.integrations || {},
            translations: defaultTranslations,
            isStandalone: isStandalone,
            transportUrl: serverData.domain ? `https://${serverData.domain}` : (serverData.cloud_run_url || 'https://api.stratads.fr')
        });
    } catch (error) {
        console.error('getBannerConfig Error:', error);
        return res.status(500).json({ error: 'Internal Error' });
    }
});

exports.updateBannerConfig = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifiÃ©');
    }

    const { serverId, visuals, integrations } = data;
    if (!serverId) {
        throw new functions.https.HttpsError('invalid-argument', 'Identifiant du serveur manquant');
    }

