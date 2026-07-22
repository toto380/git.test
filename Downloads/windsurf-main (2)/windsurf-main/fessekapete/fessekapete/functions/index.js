const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });
const cloudRunManager = require('./cloudRunManager');

admin.initializeApp();

const BRIDGE_URL = 'http://34.10.126.108:3000';
const API_SECRET_KEY = '246810zryip';
const ADMIN_EMAIL = 'stratads.france@gmail.com';

// Clé secrète Webhook Stripe
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_4NfNsKqKUgxHVIN3YiduJN5rt9tDyPJB';

// Identifiants OAuth Google (via Google Cloud Secret Manager)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = 'https://stratads.fr/dashboard';

// Limites de serveurs par type de compte
const SERVER_LIMITS = {
    free: 1,
    partner: 999, // Illimité en pratique
};

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRE: ENVOI DIRECT D'EMAILS VIA SMTP (Nodemailer) & BACKUP
// ═══════════════════════════════════════════════════════════════════
async function sendEmail({ to, message, language }) {
    const toEmails = Array.isArray(to) ? to.join(', ') : to;
    const fromEmail = message.from || process.env.SMTP_USER || 'contact@stratads.fr';
    const subject = message.subject;
    const html = message.html;
    const text = message.text || html.replace(/<[^>]*>/g, ''); // Extraction simple du texte brut

    let sentDirectly = false;
    let smtpError = null;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '465', 10),
                secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: fromEmail.includes('<') ? fromEmail : `StratAds <${fromEmail}>`,
                to: toEmails,
                subject: subject,
                text: text,
                html: html
            });

            console.log(`✅ Email envoyé avec succès via SMTP One.com à ${toEmails}`);
            sentDirectly = true;
        } catch (err) {
            console.error('❌ Erreur lors de l\'envoi de l\'email via SMTP:', err.message);
            smtpError = err.message;
        }
    } else {
        console.warn('⚠️ Le serveur SMTP n\'est pas configuré. L\'envoi direct est désactivé.');
    }

    // Sauvegarde historique / Fallback dans la collection "mail" de Firestore
    try {
        await admin.firestore().collection('mail').add({
            to: Array.isArray(to) ? to : [to],
            message: message,
            language: language || 'fr',
            delivery: {
                state: sentDirectly ? 'SUCCESS' : (smtpError ? 'ERROR' : 'PENDING'),
                sentAt: require('firebase-admin/firestore').Timestamp.now(),
                error: smtpError || null,
                info: sentDirectly ? 'Direct SMTP' : 'No SMTP config, pending extension'
            }
        });
    } catch (dbErr) {
        console.error('❌ Impossible d\'enregistrer l\'email dans Firestore:', dbErr.message);
    }

    return sentDirectly;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRE: GESTION DES PALIERS PARTENAIRES (Gamification)
// ═══════════════════════════════════════════════════════════════════
async function checkPartnerTier(partnerId) {
    if (!partnerId) return;
    try {
        const activeServersSnap = await admin.firestore().collectionGroup('servers')
            .where('managed_by_partner_id', '==', partnerId)
            .where('status', 'in', ['active', 'trial'])
            .get();
        
        const activeServersCount = activeServersSnap.size;
        
        const TIERS = [
            { name: 'Bronze', min: 0, rate: 15, index: 0 },
            { name: 'Argent', min: 5, rate: 20, index: 1 },
            { name: 'Or', min: 15, rate: 25, index: 2 },
            { name: 'Émeraude', min: 30, rate: 30, index: 3 },
            { name: 'Diamant', min: 50, rate: 35, index: 4 },
            { name: 'Maître', min: 80, rate: 38, index: 5 },
            { name: 'Légende', min: 125, rate: 40, index: 6 }
        ];
        
        // 1. Calculer le palier naturel basé sur le nombre de serveurs
        let naturalTier = TIERS[0];
        for (let i = TIERS.length - 1; i >= 0; i--) {
            if (activeServersCount >= TIERS[i].min) {
                naturalTier = TIERS[i];
                break;
            }
        }
        
        const partnerDoc = await admin.firestore().collection('clients').doc(partnerId).get();
        if (!partnerDoc.exists) return;
        
        const partnerData = partnerDoc.data();
        const previousTierIndex = partnerData.current_tier_index || 0;
        
        // Calculate monthly cost of managed servers
        let totalMonthlyCost = 0;
        activeServersSnap.forEach(sDoc => {
            const plan = sDoc.data().plan;
            if (plan === 'starter') totalMonthlyCost += 20;
            else if (plan === 'pro') totalMonthlyCost += 60;
            else if (plan === 'business') totalMonthlyCost += 100;
            else if (plan === 'agency') totalMonthlyCost += 220;
        });
        
        const fastPassActiveVal = partnerData.fast_pass_active != null ? Number(partnerData.fast_pass_active) : 0;
        const customCommissionRateVal = partnerData.custom_commission_rate != null ? Number(partnerData.custom_commission_rate) : 0;
        const effectiveRatePct = Math.max(customCommissionRateVal, naturalTier.rate, fastPassActiveVal);
        const partnerMonthlyRevenue = totalMonthlyCost * (effectiveRatePct / 100);

        // 2. Déterminer le palier effectif correspondant à la commission (Fast Pass ou custom)
        let effectiveTierIndex = naturalTier.index;
        for (let i = TIERS.length - 1; i >= 0; i--) {
            if (effectiveRatePct >= TIERS[i].rate) {
                effectiveTierIndex = Math.max(effectiveTierIndex, TIERS[i].index);
                break;
            }
        }
        const currentTier = TIERS[effectiveTierIndex];
        
        // Update partner metadata, server count and monthly revenue in Firestore
        const partnerUpdates = {
            current_tier_index: currentTier.index,
            current_tier_name: currentTier.name,
            active_servers_count: activeServersCount,
            monthly_revenue: partnerMonthlyRevenue,
            updated_at: require('firebase-admin/firestore').Timestamp.now()
        };
        
        await admin.firestore().collection('clients').doc(partnerId).update(partnerUpdates);
        
        // Only notify if it's an UPGRADE
        if (currentTier.index > previousTierIndex) {
            await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                type: 'tier_unlocked',
                tier_name: currentTier.name,
                message: `Tu viens de débloquer le palier supérieur avec le niveau ${currentTier.name}. Tu es le boss 💯`,
                read: false,
                created_at: require('firebase-admin/firestore').Timestamp.now()
            });
            console.log(`🎉 Notification: Palier ${currentTier.name} débloqué pour le partenaire ${partnerId}`);
        }

        // --- AUTOMATED CANCELLATION FOR FAST PASS PARTNERS ---
        const fastPassActive = partnerData.fast_pass_active || null;
        const stripeSubscriptionId = partnerData.stripe_subscription_id || null;
        
        if (fastPassActive) {
            const cond1 = (fastPassActive === 30 && activeServersCount >= 30);
            const cond2 = (fastPassActive === 40 && activeServersCount >= 125);
            
            if (cond1 || cond2) {
                console.log(`🚀 [PARTNER] Condition de suppression du Fast Pass atteinte pour le partenaire ${partnerId}. Serveurs actifs: ${activeServersCount}, Fast Pass: ${fastPassActive}%.`);
                
                let didAutoCancel = false;
                if (stripeSubscriptionId && !stripeSubscriptionId.startsWith('test_')) {
                    const stripeApiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_REMPLACEZ_MOI';
                    const stripeInstance = require('stripe')(stripeApiKey);
                    try {
                        await stripeInstance.subscriptions.update(stripeSubscriptionId, {
                            cancel_at_period_end: true
                        });
                        console.log(`✅ Abonnement Fast Pass Stripe ${stripeSubscriptionId} pour le partenaire programmé pour s'arrêter.`);
                        didAutoCancel = true;
                    } catch (stripeErr) {
                        console.error(`❌ Impossible d'annuler Stripe ${stripeSubscriptionId} pour le partenaire :`, stripeErr.message);
                    }
                } else {
                    console.log(`ℹ️ Abonnement Fast Pass de test ${stripeSubscriptionId || 'aucun'} pour le partenaire.`);
                    didAutoCancel = true;
                }
                
                if (didAutoCancel) {
                    // Recalculate monthly revenue based on standard rate (since Fast Pass is cancelled)
                    const newEffectiveRatePct = Math.max(customCommissionRateVal, currentTier.rate);
                    const newMonthlyRevenue = totalMonthlyCost * (newEffectiveRatePct / 100);
                    
                    // Mettre à jour Firestore
                    await admin.firestore().collection('clients').doc(partnerId).update({
                        fast_pass_active: null,
                        fast_pass_auto_cancelled: true,
                        monthly_revenue: newMonthlyRevenue,
                        updated_at: require('firebase-admin/firestore').Timestamp.now()
                    });
                    
                    // Notification dashboard
                    try {
                        await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                            type: 'fast_pass_auto_cancelled',
                            title: 'Abonnement Fast Pass arrêté',
                            message: `Félicitations ! Vous avez atteint le palier de commission de ${fastPassActive}% naturellement grâce à vos ${activeServersCount} serveurs actifs. Votre abonnement Fast Pass a été arrêté pour vous éviter des frais inutiles.`,
                            severity: 'info',
                            read: false,
                            created_at: require('firebase-admin/firestore').Timestamp.now()
                        });
                        console.log(`✅ Notification dashboard ajoutée pour le partenaire ${partnerId}`);
                    } catch (nErr) {
                        console.error('❌ Erreur notification partenaire:', nErr.message);
                    }
                    
                    // Notification Email
                    const partnerEmail = partnerData.owner_email || partnerData.email;
                    const partnerLang = partnerData.language || 'fr';
                    if (partnerEmail) {
                        try {
                            await sendEmail({
                                to: [partnerEmail],
                                message: {
                                    from: 'StratAds <contact@stratads.fr>',
                                    subject: partnerLang === 'fr' 
                                        ? '🏆 Félicitations ! Votre palier de commission StratAds est atteint' 
                                        : '🏆 Congratulations! Your StratAds commission tier has been reached',
                                    html: `<p>Bonjour,</p>
                                           <p>Félicitations ! Grâce au nombre de vos serveurs gérés (actuellement <strong>${activeServersCount}</strong>), vous venez d'atteindre naturellement le palier de commission de <strong>${fastPassActive}%</strong> sur StratAds.</p>
                                           <p>Pour vous éviter des frais inutiles, votre abonnement Fast Pass a été programmé pour s'arrêter et ne vous sera plus facturé. Vos serveurs et votre commission restent au maximum, sans surcoût.</p>
                                           <p>L'équipe StratAds</p>`
                                },
                                language: partnerLang
                            });
                            console.log(`📧 Email de résiliation envoyé au partenaire ${partnerEmail}`);
                        } catch (emailErr) {
                            console.error('❌ Erreur email partenaire:', emailErr.message);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("⚠️ Erreur dans checkPartnerTier:", e);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 1. WEBHOOK STRIPE (onRequest — point d'entrée pour Stripe)
// ═══════════════════════════════════════════════════════════════════
exports.stripeWebhook = functions.region('europe-west3').https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    // Déterminer le mode (Test vs Live) à partir du corps de la requête
    let isLive = true;
    try {
        const bodyObj = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (bodyObj && bodyObj.livemode === false) {
            isLive = false;
        }
    } catch (e) {
        console.warn("⚠️ Impossible de déterminer le livemode du corps de la requête:", e.message);
    }

    const eventType = req.body.type || (event && event.type);
    console.log(`📩 Stripe Webhook reçu [${isLive ? 'LIVE' : 'TEST'}]: ${eventType}`);

    // Sélectionner les clés et secrets appropriés
    const stripeSecretKey = isLive
        ? (process.env.STRIPE_SECRET_KEY || 'sk_test_REMPLACEZ_MOI')
        : (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || 'sk_test_REMPLACEZ_MOI');

    const webhookSecret = isLive
        ? (process.env.STRIPE_WEBHOOK_SECRET || 'whsec_4NfNsKqKUgxHVIN3YiduJN5rt9tDyPJB')
        : (process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'whsec_4NfNsKqKUgxHVIN3YiduJN5rt9tDyPJB');

    if (!isLive && (!process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY.startsWith('sk_live'))) {
        console.warn("⚠️ ATTENTION : Traitement d'un événement de TEST, mais la clé STRIPE_TEST_SECRET_KEY est manquante ou configurée avec une clé Live. Les appels API vers Stripe risquent d'échouer.");
    }

    const stripe = require('stripe')(stripeSecretKey);

    try {
        // En mode local avec l'émulateur, on bypass la signature pour le script de test
        if (process.env.FUNCTIONS_EMULATOR === 'true' && req.headers['stripe-signature'] === 't=1620000000,v1=simulated_signature') {
            console.log('⚠️ [DÉVELOPPEMENT] Bypass de la vérification de signature Stripe');
            event = req.body;
        } else {
            // VÉRIFICATION STRICTE DE LA SIGNATURE (Hackers bloqués)
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
        }
    } catch (err) {
        console.error('❌ Erreur de vérification Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // ─── INTERCEPTION ABONNEMENTS FAST PASS ───
        if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
            const subscription = event.data.object;
            const stripeSubscriptionId = subscription.id;
            const customerId = subscription.customer;
            
            // On cherche à identifier si c'est un Fast Pass
            let passValue = null;
            if (subscription.metadata?.partner === 'pass30') passValue = 30;
            else if (subscription.metadata?.partner === 'pass40') passValue = 40;
            else if (subscription.items?.data?.[0]?.price?.metadata?.partner === 'pass30') passValue = 30;
            else if (subscription.items?.data?.[0]?.price?.metadata?.partner === 'pass40') passValue = 40;
            
            const priceId = subscription.items?.data?.[0]?.price?.id;
            if (!passValue) {
                if (priceId === 'price_fast_pass_30' || priceId?.includes('fast_pass_30') || priceId?.includes('pass30')) {
                    passValue = 30;
                } else if (priceId === 'price_fast_pass_40' || priceId?.includes('fast_pass_40') || priceId?.includes('pass40')) {
                    passValue = 40;
                }
            }
            
            if (passValue) {
                console.log(`🎫 Webhook Fast Pass détecté (Pass ${passValue}%) pour la souscription ${stripeSubscriptionId}`);
                
                // Trouver le client dans Firestore
                let clientId = null;
                
                // 1. Essayer de récupérer le clientId à partir des Checkout Sessions Stripe liées à cette souscription
                try {
                    const sessions = await stripe.checkout.sessions.list({
                        subscription: stripeSubscriptionId,
                        limit: 1
                    });
                    const session = sessions.data?.[0];
                    clientId = session?.client_reference_id || session?.metadata?.client_id;
                } catch (err) {
                    console.warn(`⚠️ Impossible de récupérer la Checkout Session pour la souscription ${stripeSubscriptionId}:`, err.message);
                }
                
                // 2. Si non trouvé, chercher le client dans Firestore par stripe_customer_id
                if (!clientId) {
                    const clientSnap = await admin.firestore().collection('clients')
                        .where('stripe_customer_id', '==', customerId)
                        .limit(1)
                        .get();
                    if (!clientSnap.empty) {
                        clientId = clientSnap.docs[0].id;
                    }
                }
                
                // 3. Si toujours non trouvé, récupérer le customer de Stripe pour chercher par e-mail
                if (!clientId) {
                    try {
                        const customer = await stripe.customers.retrieve(customerId);
                        const customerEmail = customer.email;
                        if (customerEmail) {
                            const emailSnap = await admin.firestore().collection('clients')
                                .where('owner_email', '==', customerEmail)
                                .limit(1)
                                .get();
                            if (!emailSnap.empty) {
                                clientId = emailSnap.docs[0].id;
                            }
                        }
                    } catch (stripeErr) {
                        console.error(`⚠️ Erreur lors de la récupération du client Stripe ou Firestore:`, stripeErr.message);
                    }
                }
                
                if (clientId) {
                    const clientRef = admin.firestore().collection('clients').doc(clientId);
                    const clientDoc = await clientRef.get();
                    const clientData = clientDoc.data();
                    const naturalPalier = clientData?.natural_palier || 0;
                    
                    const isCancelled = subscription.cancel_at_period_end === true;
                    const fastPassActive = isCancelled ? null : passValue;
                    const effectiveSpeed = Math.max(naturalPalier, fastPassActive || 0);
                    
                    let updateData = {
                        stripe_subscription_id: stripeSubscriptionId,
                        fast_pass_active: fastPassActive,
                        effective_speed_percent: effectiveSpeed,
                        updated_at: require('firebase-admin/firestore').Timestamp.now()
                    };
                    
                    if (customerId) {
                        updateData.stripe_customer_id = customerId;
                    }
                    
                    if (!isCancelled) {
                        updateData.fast_pass_auto_cancelled = admin.firestore.FieldValue.delete();
                    }
                    
                    await clientRef.update(updateData);
                    console.log(`✅ Fast Pass mis à jour pour le client ${clientId} : pass_active=${fastPassActive}, speed=${effectiveSpeed}%`);
                    await checkPartnerTier(clientId);
                    return res.status(200).json({ received: true, action: 'fast_pass_updated', clientId });
                } else {
                    console.warn(`⚠️ Aucun client Firestore trouvé pour le stripe_customer_id ${customerId}`);
                    return res.status(404).send('Client Firestore introuvable pour ce Fast Pass.');
                }
            }
        }
        
        if (eventType === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const stripeSubscriptionId = subscription.id;
            
            // Vérifier s'il s'agit d'une souscription Fast Pass d'un client
            const clientsRef = admin.firestore().collection('clients');
            const clientSnap = await clientsRef.where('stripe_subscription_id', '==', stripeSubscriptionId).limit(1).get();
            
            if (!clientSnap.empty) {
                const clientDoc = clientSnap.docs[0];
                const clientRef = clientDoc.ref;
                const clientData = clientDoc.data();
                const naturalPalier = clientData.natural_palier || 0;
                
                await clientRef.update({
                    fast_pass_active: null,
                    stripe_subscription_id: null,
                    fast_pass_auto_cancelled: admin.firestore.FieldValue.delete(),
                    effective_speed_percent: naturalPalier,
                    updated_at: require('firebase-admin/firestore').Timestamp.now()
                });
                
                console.log(`🟢 Fast Pass supprimé/terminé pour le client ${clientDoc.id}. Remise à la vitesse naturelle: ${naturalPalier}%`);
                await checkPartnerTier(clientDoc.id);
                return res.status(200).json({ received: true, action: 'fast_pass_deleted', clientId: clientDoc.id });
            }
        }

        // ─── PAIEMENT RÉUSSI ───
        if (eventType === 'checkout.session.completed') {
            const session = event.data.object;
            const customerEmail = session.customer_email || session.customer_details?.email;
            const stripeCustomerId = session.customer;
            const stripeSubscriptionId = session.subscription;
            const planFromMetadata = session.metadata?.plan || 'starter';
            
            // DǸduction de la langue
            const rawLocale = session.customer_details?.preferred_locales?.[0] || 'en';
            const parsedLocale = rawLocale.split('-')[0].toLowerCase();
            const supportedLocales = ['fr', 'en', 'es', 'pt', 'de'];
            const stripeLocale = supportedLocales.includes(parsedLocale) ? parsedLocale : 'en';

            if (!customerEmail) {
                console.error('❌ Pas d\'email client dans la session Stripe');
                return res.status(400).send('Email client manquant');
            }

            // Trouver l'utilisateur Firebase par email
            let firebaseUser;
            const customerName = session.customer_details?.name || customerEmail.split('@')[0];

            try {
                firebaseUser = await admin.auth().getUserByEmail(customerEmail);
                
                // Envoi d'un email de confirmation de nouveau serveur pour un utilisateur existant
                await sendEmail({
                    to: [customerEmail],
                    message: {
                        from: 'StratAds <contact@stratads.fr>',
                        subject: '🚀 Votre nouveau serveur StratAds est actif !',
                        html: `Bonjour ${customerName},<br><br>Votre nouveau serveur cloud de tracking StratAds est prêt et opérationnel !<br><br>Vous pouvez y accéder et le configurer directement depuis votre espace personnel en vous connectant avec vos identifiants existants :<br>- <b>Email</b> : ${customerEmail}<br>- <b>Lien de connexion</b> : <a href="https://stratads.fr/dashboard">https://stratads.fr/dashboard</a><br><br>*(Si vous avez oublié votre mot de passe, vous pouvez utiliser la fonction "Mot de passe oublié" sur la page de connexion).<br><br>Vous pourrez y suivre vos statistiques de tracking, configurer votre domaine et gérer votre abonnement en toute autonomie.<br><br>L'équipe StratAds`
                    },
                    language: stripeLocale
                });
                console.log(`✅ Compte existant : e-mail de confirmation de serveur envoyé à ${customerEmail}.`);
            } catch (authErr) {
                console.log(`ℹ️ Utilisateur introuvable pour ${customerEmail}. Création automatique du compte client...`);
                const crypto = require('crypto');
                // Générer un mot de passe robuste de 12 caractères (au moins 1 minuscule, 1 majuscule, 1 chiffre, 1 caractère spécial)
                const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$*';
                let generatedPassword = '';
                generatedPassword += 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(0, 26)];
                generatedPassword += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(0, 26)];
                generatedPassword += '0123456789'[crypto.randomInt(0, 10)];
                generatedPassword += '!@#$*'[crypto.randomInt(0, 5)];
                for (let i = 0; i < 8; i++) {
                    generatedPassword += chars[crypto.randomInt(0, chars.length)];
                }
                // Mélanger les caractères
                generatedPassword = generatedPassword.split('').sort(() => crypto.randomInt(-1, 2)).join('');
                
                try {
                    firebaseUser = await admin.auth().createUser({
                        email: customerEmail,
                        password: generatedPassword,
                        displayName: customerName
                    });
                    
                    // Envoi de l'email direct de bienvenue (avec identifiants temporaires)
                    await sendEmail({
                        to: [customerEmail],
                        message: {
                            from: 'StratAds <contact@stratads.fr>',
                            subject: '🚀 Vos accès à votre Dashboard StratAds',
                            text: `Bonjour,\n\nvoici vos identifiants pour pouvoir gérer votre serveur et votre abonnement sur StratAds :\n\nE-mail : ${customerEmail}\n\nMot de passe : ${generatedPassword}\n\nRendez-vous sur https://stratads.fr/dashboard pour configurer votre serveur.`,
                            html: `Bonjour,<br><br>voici vos identifiants pour pouvoir gérer votre serveur et votre abonnement sur StratAds :<br><br><b>E-mail</b> : ${customerEmail}<br><br><b>Mot de passe</b> : ${generatedPassword}<br><br>Rendez-vous sur <a href="https://stratads.fr/dashboard">https://stratads.fr/dashboard</a> pour configurer votre serveur.`
                        },
                        language: stripeLocale
                    });
                    console.log(`✅ Compte créé avec succès et e-mail de bienvenue envoyé en direct pour ${customerEmail}.`);
                } catch (createErr) {
                    if (createErr.code === 'auth/email-already-exists') {
                        console.log(`ℹ️ Le compte existe déjà pour ${customerEmail} (détecté lors du createUser). Récupération du compte...`);
                        firebaseUser = await admin.auth().getUserByEmail(customerEmail);
                    } else {
                        console.error(`❌ Erreur lors de la création du compte automatique:`, createErr.message);
                        return res.status(500).send('Erreur lors de la création du compte client');
                    }
                }
            }

            const uid = firebaseUser.uid;
            const now = require('firebase-admin/firestore').Timestamp.now();
            const in30Days = require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
            const in7Days = require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

            // Récupérer ou créer le profil client (Toujours initialiser pour les flux partenaires et direct)
            const clientRef = admin.firestore().collection('clients').doc(uid);
            let clientDoc = await clientRef.get();
            if (!clientDoc.exists) {
                await clientRef.set({
                    account_type: 'free',
                    owner_email: customerEmail,
                    owner_uid: uid,
                    role: 'client',
                    language: stripeLocale,
                    created_at: now,
                    updated_at: now
                });
                clientDoc = await clientRef.get();
            }
            const currentAccountType = clientDoc.exists ? (clientDoc.data().account_type || 'free') : 'free';

            // Déterminer le type de compte effectif
            // Sécurité : ne jamais rétrograder d'admin ou de partenaire.
            let effectiveAccountType = currentAccountType;
            if (currentAccountType === 'admin') {
                effectiveAccountType = 'admin';
            } else if (currentAccountType === 'partner') {
                effectiveAccountType = 'partner';
            } else if (planFromMetadata === 'partner') {
                effectiveAccountType = 'partner';
            } else {
                effectiveAccountType = currentAccountType;
            }

            // Vérifier la limite de serveurs pour les comptes free
            if (effectiveAccountType === 'free' || (effectiveAccountType !== 'partner' && effectiveAccountType !== 'admin')) {
                const serversSnap = await clientRef.collection('servers').where('status', 'in', ['active', 'trial']).get();
                const limit = SERVER_LIMITS.free;
                if (serversSnap.size >= limit) {
                    console.warn(`⚠️ Limite de ${limit} serveur(s) atteinte pour le compte free ${uid}`);
                    return res.status(403).json({
                        error: `Limite de ${limit} serveur(s) atteinte. Passez en compte Partenaire pour ajouter plus de serveurs.`
                    });
                }
            }

            // Seul le plan 'partner' bénéficie potentiellement d'un essai, ou selon votre logique
            const isTrial = (planFromMetadata === 'partner');

            // Vérifier si c'est un UPGRADE d'un serveur existant OU l'activation d'un serveur Partenaire en attente
            const clientReferenceId = session.client_reference_id;
            
            let targetUid = uid;
            let targetServerId = clientReferenceId;
            let isPartnerFlow = false;

            if (clientReferenceId && clientReferenceId.includes('__')) {
                const parts = clientReferenceId.split('__');
                targetUid = parts[0];     // L'ID du partenaire qui a créé le serveur
                targetServerId = parts[1]; // L'ID du serveur
                isPartnerFlow = true;
            } else if (clientReferenceId && clientReferenceId.includes(':::')) {
                const parts = clientReferenceId.split(':::');
                targetUid = parts[0];     // L'ID du partenaire qui a créé le serveur
                targetServerId = parts[1]; // L'ID du serveur
                isPartnerFlow = true;
            }
            
            if (targetServerId) {
                // Recherche dans l'espace approprié (client lui-même, ou partenaire)
                const existingServerRef = admin.firestore().collection('clients').doc(targetUid).collection('servers').doc(targetServerId);
                const existingServerDoc = await existingServerRef.get();
                
                if (existingServerDoc.exists) {
                    const serverData = existingServerDoc.data();
                    const oldSubscriptionId = serverData.stripe_subscription_id;
                    const previousStatus = serverData.status;
                    
                    // 1. Annuler l'ancien abonnement sur Stripe pour éviter le double paiement (Upgrade uniquement)
                    if (oldSubscriptionId && previousStatus !== 'pending_payment') {
                        try {
                            await stripe.subscriptions.cancel(oldSubscriptionId);
                            console.log(`✅ Ancien abonnement Stripe (${oldSubscriptionId}) annulé avec succès suite à l'upgrade.`);
                        } catch (stripeErr) {
                            console.error(`⚠️ Erreur lors de l'annulation de l'ancien abonnement ${oldSubscriptionId}:`, stripeErr.message);
                        }
                    }

                    // Injection Post-Paiement Stripe Connect : Si flux partenaire ou compte partenaire global
                    const partnerToCredit = isPartnerFlow ? targetUid : ((effectiveAccountType === 'partner') ? uid : null);
                    if (stripeSubscriptionId && partnerToCredit) {
                        try {
                            await stripe.subscriptions.update(stripeSubscriptionId, {
                                metadata: { partner_id: partnerToCredit }
                            });
                            console.log(`✅ Metadata partner_id:${partnerToCredit} injectée dans l'abonnement Stripe ${stripeSubscriptionId}`);
                        } catch (err) {
                            console.error(`⚠️ Impossible d'injecter la metadata partner_id:`, err.message);
                        }
                    }

                    // 2. Mettre à jour la base de données avec le nouveau statut
                    await existingServerRef.update({
                        plan: planFromMetadata,
                        stripe_subscription_id: stripeSubscriptionId || null,
                        stripe_customer_id: stripeCustomerId || null,
                        subscription_start: now,
                        subscription_end: (planFromMetadata === 'partner') ? null : in30Days,
                        status: isTrial ? 'trial' : 'active',
                        managed_by_partner_id: partnerToCredit,
                        client_email: customerEmail,
                        updated_at: now
                    });
                    
                    console.log(`✅ Serveur ${targetServerId} payé/upgradé par ${customerEmail} (Propriétaire: ${targetUid}) — Plan: ${planFromMetadata}`);

                    // 2.5. Si le serveur était déjà actif (Upgrade), on ajuste la RAM Cloud Run
                    if (previousStatus === 'active' || previousStatus === 'trial') {
                        try {
                            console.log(`🚀 Upgrade détecté. Mise à jour de la RAM Cloud Run pour ${targetServerId}...`);
                            await cloudRunManager.updateServiceRAM(targetServerId, planFromMetadata);
                        } catch (ramErr) {
                            console.error(`⚠️ Erreur lors de la mise à jour de la RAM pour ${targetServerId}:`, ramErr.message);
                        }
                    }

                    // 3. Déploiement automatique Cloud Run si le serveur était en attente et configuré
                    if (previousStatus === 'pending_payment' && serverData.container_config) {
                        console.log(`🚀 Serveur en pending_payment validé. Lancement automatique du DEPLOY pour ${targetServerId}...`);
                        try {
                            // On déploie avec les infos saisies à la création par le partenaire
                            const cloudRunResult = await cloudRunManager.deployGTMContainer(
                                targetUid,
                                targetServerId,
                                serverData.container_config || serverData.gtm_id || 'GTM-UNKNOWN',
                                planFromMetadata,
                                { region: serverData.region, isMultiRegion: serverData.is_multi_region }
                            );

                            const updateData = {
                                server_host: 'Google Cloud Run (Serverless)',
                                cloud_run_url: cloudRunResult.url,
                                cloud_run_service_id: cloudRunResult.service_id
                            };

                            await existingServerRef.update(updateData);
                            console.log(`✅ Déploiement Cloud Run réussi pour ${targetServerId}: ${cloudRunResult.url}`);

                            await admin.firestore().collection('clients').doc(targetUid).collection('notifications').add({
                                title: "Instance Déployée 🎉",
                                message: `Votre serveur de tracking pour ${serverData.domain || serverData.server_name || targetServerId} a été déployé avec succès sur Google Cloud et est opérationnel.`,
                                type: "server_deployed",
                                severity: "info",
                                server_id: targetServerId,
                                read: false,
                                created_at: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // Map Custom Domain s'il était renseigné
                            if (serverData.domain) {
                                try {
                                    await cloudRunManager.mapCustomDomain(targetServerId, serverData.domain);
                                    console.log(`✅ Mapping du domaine ${serverData.domain} demandé pour ${targetServerId}`);
                                } catch (domainErr) {
                                    console.error(`⚠️ Erreur mapping domaine auto ${serverData.domain}:`, domainErr.message);
                                }
                            }
                        } catch (deployErr) {
                            console.error(`❌ Erreur lors du déploiement auto Cloud Run pour ${targetServerId}:`, deployErr.message);
                            
                            await admin.firestore().collection('clients').doc(targetUid).collection('notifications').add({
                                title: "Échec du déploiement ❌",
                                message: `Le déploiement automatique du serveur de tracking pour ${serverData.domain || serverData.server_name || targetServerId} a échoué. Erreur : ${deployErr.message || 'Erreur lors du déploiement Cloud Run.'}`,
                                type: "server_deploy_failed",
                                severity: "critical",
                                server_id: targetServerId,
                                read: false,
                                created_at: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    }

                    if (partnerToCredit) await checkPartnerTier(partnerToCredit);
                    return res.status(200).json({ received: true, action: 'server_upgraded', uid, serverId: targetServerId });
                } else {
                    console.warn(`⚠️ Le serveur cible ${targetServerId} n'existe pas (lien obsolète ou supprimé). Paiement ignoré.`);
                    return res.status(400).send('Serveur cible introuvable ou lien obsolète.');
                }
            }

            // Sinon, c'est la CRÉATION d'un NOUVEAU serveur
            // Compter les serveurs existants pour générer un nom par défaut
            const allServersSnap = await clientRef.collection('servers').get();
            const serverNumber = allServersSnap.size + 1;

            // 1) Mettre à jour le profil client (document parent)
            await clientRef.set({
                account_type: effectiveAccountType,
                stripe_customer_id: stripeCustomerId,
                owner_email: customerEmail,
                owner_uid: uid,
                role: clientDoc.exists ? (clientDoc.data().role || 'client') : 'client',
                language: clientDoc.exists ? (clientDoc.data().language || stripeLocale) : stripeLocale,
                updated_at: now,
            }, { merge: true });

            // Injection Post-Paiement Stripe Connect
            if (stripeSubscriptionId && effectiveAccountType === 'partner') {
                try {
                    await stripe.subscriptions.update(stripeSubscriptionId, {
                        metadata: { partner_id: uid }
                    });
                    console.log(`✅ Metadata partner_id:${uid} injectée dans l'abonnement Stripe ${stripeSubscriptionId}`);
                } catch (err) {
                    console.error(`⚠️ Impossible d'injecter la metadata partner_id:`, err.message);
                }
            }

            // 2) Créer le document serveur dans la sous-collection
            // Si pas d'ID d'abonnement (ex: paiement unique pour partenaire), générer un ID unique
            const serverId = stripeSubscriptionId || `srv_${Date.now()}`;
            await clientRef.collection('servers').doc(serverId).set({
                status: isTrial ? 'trial' : 'pending_configuration',
                plan: planFromMetadata,
                server_name: `Serveur ${serverNumber}`,
                domain: null,
                client_email: customerEmail,
                stripe_subscription_id: stripeSubscriptionId || null,
                stripe_customer_id: stripeCustomerId || null,
                subscription_start: now,
                subscription_end: (planFromMetadata === 'partner') ? null : in30Days,
                trial_end: isTrial ? in7Days : null,
                cancel_requested: false,
                cancel_at: null,
                updated_at: now,
                current_requests: 0,
                email_50_sent: false,
                email_80_sent: false,
                email_100_sent: false,
                managed_by_partner_id: (effectiveAccountType === 'partner') ? uid : null
            });

            const pCredit = (effectiveAccountType === 'partner') ? uid : null;
            if (pCredit) await checkPartnerTier(pCredit);

            console.log(`✅ Serveur ${serverId} créé pour ${customerEmail} (${uid}) — Plan: ${planFromMetadata}, Trial: ${isTrial}`);
            return res.status(200).json({ received: true, action: 'server_created', uid, serverId });
        }

        // ─── PAIEMENT DE FACTURE REUSSI (Commissions Partenaire) ───
        if (eventType === 'invoice.paid') {
            const invoice = event.data.object;
            const amountPaid = invoice.amount_paid; // en centimes
            const currency = invoice.currency; // ex: 'eur', 'usd'
            const stripeSubscriptionId = invoice.subscription;
            
            if (stripeSubscriptionId && amountPaid > 0) {
                try {
                    // Récupérer la souscription pour lire la metadata partner_id
                    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                    const partnerId = subscription.metadata?.partner_id;
                    
                    if (partnerId) {
                        const partnerDoc = await admin.firestore().collection('clients').doc(partnerId).get();
                        if (partnerDoc.exists) {
                            const partnerData = partnerDoc.data();
                            const stripeConnectId = partnerData.stripe_connect_id;
                            if (stripeConnectId) {
                                // Calcul dynamique du taux basé sur le nombre de serveurs actifs
                                const activeServersSnap = await admin.firestore().collectionGroup('servers')
                                    .where('managed_by_partner_id', '==', partnerId)
                                    .where('status', 'in', ['active', 'trial'])
                                    .get();
                                
                                const activeServersCount = activeServersSnap.size;
                                
                                const TIERS = [
                                    { name: 'Bronze', min: 0, rate: 15 },
                                    { name: 'Argent', min: 5, rate: 20 },
                                    { name: 'Or', min: 15, rate: 25 },
                                    { name: 'Émeraude', min: 30, rate: 30 },
                                    { name: 'Diamant', min: 50, rate: 35 },
                                    { name: 'Maître', min: 80, rate: 38 },
                                    { name: 'Légende', min: 125, rate: 40 }
                                ];
                                
                                let currentTier = TIERS[0];
                                for (let i = TIERS.length - 1; i >= 0; i--) {
                                    if (activeServersCount >= TIERS[i].min) {
                                        currentTier = TIERS[i];
                                        break;
                                    }
                                }
                                
                                const earnedRateVal = currentTier.rate;
                                const customCommissionRateVal = partnerData.custom_commission_rate != null ? Number(partnerData.custom_commission_rate) : 0;
                                const fastPassActiveVal = partnerData.fast_pass_active != null ? Number(partnerData.fast_pass_active) : 0;
                                const effectiveRatePct = Math.max(customCommissionRateVal, earnedRateVal, fastPassActiveVal);
                                const commissionRate = effectiveRatePct / 100;

                                const commissionAmount = Math.round(amountPaid * commissionRate);
                                
                                const transfer = await stripe.transfers.create({
                                    amount: commissionAmount,
                                    currency: currency,
                                    destination: stripeConnectId,
                                    description: `Commission ${(commissionRate * 100).toFixed(0)}% sur l'abonnement ${stripeSubscriptionId}`
                                });
                                
                                console.log(`💸 Commission de ${commissionAmount/100} ${currency} (${(commissionRate * 100).toFixed(0)}%) transférée au partenaire ${partnerId} (${stripeConnectId})`);
                                
                                // Log dans Firestore pour le Dashboard Partenaire
                                await admin.firestore().collection('clients').doc(partnerId).collection('commissions').add({
                                    amount: commissionAmount,
                                    currency: currency,
                                    rate: commissionRate,
                                    source_invoice: invoice.id,
                                    subscription_id: stripeSubscriptionId,
                                    transfer_id: transfer.id,
                                    created_at: require('firebase-admin/firestore').Timestamp.now()
                                });
                            } else {
                                console.log(`ℹ️ Partenaire ${partnerId} sans compte Stripe Connect configuré (Transfert ignoré).`);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`⚠️ Erreur de commissionnement invoice.paid:`, err.message);
                }
            }
            return res.status(200).json({ received: true, action: 'invoice_processed' });
        }

        // ─── ABONNEMENT ANNULÉ (suppression individuelle) ───
        if (eventType === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const stripeSubscriptionId = subscription.id;

            // Recherche dans TOUS les servers via collectionGroup
            const serversRef = admin.firestore().collectionGroup('servers');
            const snapshot = await serversRef.where('stripe_subscription_id', '==', stripeSubscriptionId).limit(1).get();

            if (snapshot.empty) {
                console.warn(`⚠️ Aucun serveur trouvé pour subscription: ${stripeSubscriptionId}`);
                return res.status(404).send('Serveur Firestore introuvable');
            }

            const serverDoc = snapshot.docs[0];
            await serverDoc.ref.update({
                status: 'deleted',
                cancel_requested: false,
                cancel_at: null,
                updated_at: require('firebase-admin/firestore').Timestamp.now(),
            });

            // Suppression définitive du Cloud Run
            try {
                await cloudRunManager.deleteService(serverDoc.id);
            } catch (err) {
                console.error(`⚠️ Erreur deleteService pour ${serverDoc.id}:`, err.message);
            }

            console.log(`🔴 Serveur ${serverDoc.id} supprimé définitivement (subscription: ${stripeSubscriptionId})`);
            
            const serverData = serverDoc.data();
            const clientUid = serverDoc.ref.parent.parent.id;
            
            // Notify Client
            await admin.firestore().collection('clients').doc(clientUid).collection('notifications').add({
                title: "Abonnement terminé 🔴",
                message: `Votre abonnement pour le serveur "${serverData.server_name || serverDoc.id}" est maintenant terminé. Le serveur a été désactivé.`,
                type: "subscription_ended",
                severity: "critical",
                server_id: serverDoc.id,
                read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            const partnerId = serverData.managed_by_partner_id;
            if (partnerId) {
                await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                    title: "Abonnement terminé",
                    message: `L'abonnement du serveur "${serverData.server_name || serverDoc.id}" est maintenant terminé et le serveur a été désactivé.`,
                    type: "subscription_ended",
                    severity: "warning",
                    server_id: serverDoc.id,
                    read: false,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`📨 Notification envoyée au partenaire ${partnerId} pour la fin de l'abonnement du serveur ${serverDoc.id}`);
            }

            if (partnerId) {
                await checkPartnerTier(partnerId);
            }
            
            return res.status(200).json({ received: true, action: 'server_deleted', serverId: serverDoc.id });
        }

        // ─── RENOUVELLEMENT RÉUSSI ───
        if (eventType === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            const stripeSubscriptionId = invoice.subscription;

            if (invoice.billing_reason === 'subscription_cycle' && stripeSubscriptionId) {
                const serversRef = admin.firestore().collectionGroup('servers');
                const snapshot = await serversRef.where('stripe_subscription_id', '==', stripeSubscriptionId).limit(1).get();

                if (!snapshot.empty) {
                    const serverDoc = snapshot.docs[0];
                    const serverData = serverDoc.data();
                    const now = require('firebase-admin/firestore').Timestamp.now();
                    const in30Days = require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

                    await serverDoc.ref.update({
                        status: 'active',
                        subscription_end: in30Days,
                        trial_end: null,
                        updated_at: now,
                    });

                    // Si c'était suspendu, on restaure l'accès public Cloud Run
                    try {
                        await cloudRunManager.resumeService(serverDoc.id);
                    } catch (err) {
                        console.error(`⚠️ Erreur resumeService pour ${serverDoc.id}:`, err.message);
                    }

                    console.log(`🔄 Renouvellement confirmé et accès public restauré pour le serveur ${serverDoc.id}`);

                    const clientUid = serverDoc.ref.parent.parent.id;
                    await admin.firestore().collection('clients').doc(clientUid).collection('notifications').add({
                        title: "Abonnement renouvelé 🔄",
                        message: `Le paiement de renouvellement pour votre serveur "${serverData.server_name || serverDoc.id}" a été traité avec succès.`,
                        type: "subscription_renewed",
                        severity: "info",
                        server_id: serverDoc.id,
                        read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (serverDoc.data().managed_by_partner_id) {
                        await checkPartnerTier(serverDoc.data().managed_by_partner_id);
                    }
                }
            }

            return res.status(200).json({ received: true, action: 'renewal_processed' });
        }

        // ─── MISE À JOUR D'ABONNEMENT (upgrade/downgrade) ───
        if (eventType === 'customer.subscription.updated') {
            const subscription = event.data.object;
            const stripeSubscriptionId = subscription.id;
            
            // Si le client change via le portail, on peut récupérer le plan via metadata ou via les items
            let newPlan = subscription.metadata?.plan;
            if (!newPlan && subscription.items?.data?.length > 0) {
                newPlan = subscription.items.data[0].price?.metadata?.plan;
            }

            const serversRef = admin.firestore().collectionGroup('servers');
            const snapshot = await serversRef.where('stripe_subscription_id', '==', stripeSubscriptionId).limit(1).get();

            if (!snapshot.empty) {
                const serverDoc = snapshot.docs[0];
                const updateData = {
                    updated_at: require('firebase-admin/firestore').Timestamp.now()
                };
                if (newPlan) {
                    updateData.plan = newPlan;
                }
                
                // Gérer cancel_at_period_end
                const isCancelling = subscription.cancel_at_period_end === true;
                const cancelAt = subscription.cancel_at ? admin.firestore.Timestamp.fromMillis(subscription.cancel_at * 1000) : null;
                
                const serverData = serverDoc.data();
                const wasCancelling = serverData.cancel_requested || false;
                
                updateData.cancel_requested = isCancelling;
                updateData.cancel_at = cancelAt;

                await serverDoc.ref.update(updateData);
                
                if (newPlan && serverData.plan !== newPlan) {
                    // Mise à jour de la RAM sur Cloud Run
                    try {
                        await cloudRunManager.updateServiceRAM(serverDoc.id, newPlan);
                    } catch (err) {
                        console.error(`⚠️ Erreur updateServiceRAM pour ${serverDoc.id}:`, err.message);
                    }
                    console.log(`📝 Plan mis à jour vers ${newPlan} et RAM Cloud Run ajustée pour le serveur ${serverDoc.id}`);
                }

                // Si le statut d'annulation a changé pour devenir "vrai", on notifie le client et le partenaire
                if (isCancelling && !wasCancelling) {
                    const clientUid = serverDoc.ref.parent.parent.id;
                    const cancelAtDate = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toLocaleDateString('fr-FR') : 'inconnue';
                    
                    // Notify Client
                    await admin.firestore().collection('clients').doc(clientUid).collection('notifications').add({
                        title: "Désabonnement planifié ⚠️",
                        message: `Votre abonnement pour le serveur "${serverData.server_name || serverDoc.id}" a été annulé et prendra fin le ${cancelAtDate}.`,
                        type: "subscription_cancelling",
                        severity: "warning",
                        server_id: serverDoc.id,
                        read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    const partnerId = serverData.managed_by_partner_id;
                    if (partnerId) {
                        await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                            title: "Désabonnement planifié",
                            message: `L'abonnement du serveur "${serverData.server_name || serverDoc.id}" a été annulé par le client et prendra fin le ${cancelAtDate}.`,
                            type: "subscription_cancelling",
                            severity: "warning",
                            server_id: serverDoc.id,
                            read: false,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`📨 Notification envoyée au partenaire ${partnerId} pour l'annulation planifiée du serveur ${serverDoc.id}`);
                    }
                }
            }

            return res.status(200).json({ received: true, action: 'subscription_updated' });
        }

        // ─── ÉCHEC DE PAIEMENT (suspension IAM) ───
        if (eventType === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const stripeSubscriptionId = invoice.subscription;

            if (stripeSubscriptionId) {
                const serversRef = admin.firestore().collectionGroup('servers');
                const snapshot = await serversRef.where('stripe_subscription_id', '==', stripeSubscriptionId).limit(1).get();

                if (!snapshot.empty) {
                    const serverDoc = snapshot.docs[0];
                    const serverData = serverDoc.data();
                    const clientUid = serverDoc.ref.parent.parent.id;
                    await serverDoc.ref.update({
                        status: 'payment_failed',
                        updated_at: require('firebase-admin/firestore').Timestamp.now(),
                    });

                    // Rétracte l'accès public Cloud Run
                    try {
                        await cloudRunManager.suspendService(serverDoc.id);
                    } catch (err) {
                        console.error(`⚠️ Erreur suspendService pour ${serverDoc.id}:`, err.message);
                    }

                    console.log(`🛑 Serveur ${serverDoc.id} suspendu (IAM 403) suite à un échec de paiement (subscription: ${stripeSubscriptionId})`);

                    // Notify Client
                    await admin.firestore().collection('clients').doc(clientUid).collection('notifications').add({
                        title: "Échec de paiement ⚠️",
                        message: `Le paiement de renouvellement pour votre serveur "${serverData.server_name || serverDoc.id}" a échoué. Votre instance a été temporairement suspendue.`,
                        type: "payment_failed",
                        severity: "critical",
                        server_id: serverDoc.id,
                        read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Notify Partner if managed by one
                    const partnerId = serverData.managed_by_partner_id;
                    if (partnerId) {
                        await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                            title: "Échec de paiement client ⚠️",
                            message: `Le paiement de l'abonnement du serveur "${serverData.server_name || serverDoc.id}" pour votre client a échoué. Le serveur a été suspendu.`,
                            type: "payment_failed",
                            severity: "critical",
                            server_id: serverDoc.id,
                            read: false,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }

            return res.status(200).json({ received: true, action: 'payment_failed_handled' });
        }

        // Événement non géré
        console.log(`ℹ️ Événement Stripe ignoré: ${eventType}`);
        return res.status(200).json({ received: true, action: 'ignored' });

    } catch (error) {
        console.error('❌ Erreur dans le traitement du Webhook Stripe:', error);
        return res.status(500).send('Erreur interne');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 2. PROXY SÉCURISÉ (onRequest + CORS + vérification manuelle token)
// ═══════════════════════════════════════════════════════════════════
exports.bridgeProxy = functions.region('europe-west3').https.onRequest((req, res) => {
    cors(req, res, async () => {
        // ── Vérification du token Firebase ──
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token d\'authentification manquant.' });
        }

        let decodedToken;
        try {
            const idToken = authHeader.split('Bearer ')[1];
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            console.error('❌ Token invalide:', authErr.message);
            return res.status(401).json({ error: 'Token invalide ou expiré.' });
        }

        const userEmail = decodedToken.email;
        const userId = decodedToken.uid;
        
        let isAdmin = (userEmail === ADMIN_EMAIL);
        if (!isAdmin) {
            const adminCheck = await admin.firestore().collection('clients').doc(userId).get();
            if (adminCheck.exists && adminCheck.data().account_type === 'admin') {
                isAdmin = true;
            }
        }

        // ── Extraction du body ──
        const { action, payload, client_id, partner_id, search_term, server_id } = req.body;

        try {
            let response;
            const config = {
                headers: {
                    'Authorization': `Bearer ${API_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            };

            // --- ACTIONS ADMIN (God Mode) ---
            if (action === 'ADMIN_SEARCH') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                
                // Fetch all Auth users (up to 1000)
                let authUsers = [];
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    authUsers = listUsersResult.users;
                } catch(e) {
                    console.error('Erreur listUsers:', e);
                }

                // Fetch all Firestore clients
                const clientsRef = admin.firestore().collection('clients');
                const snapshot = await clientsRef.get();
                const firestoreClients = new Map();
                for (const docSnap of snapshot.docs) {
                    const d = docSnap.data();
                    const serversSnap = await docSnap.ref.collection('servers').get();
                    const servers = serversSnap.docs.map(s => ({ id: s.id, ...s.data() }));
                    firestoreClients.set(docSnap.id, { ...d, servers });
                }

                const results = [];
                const processedIds = new Set();
                
                // Merge Auth users with their Firestore data
                for (const user of authUsers) {
                    processedIds.add(user.uid);
                    const fClient = firestoreClients.get(user.uid) || { servers: [], account_type: 'free' };
                    
                    const mergedUser = {
                        id: user.uid,
                        owner_email: user.email || fClient.owner_email,
                        name: user.displayName || fClient.name || '',
                        created_at: user.metadata?.creationTime || fClient.created_at,
                        ...fClient,
                    };
                    
                    if (!search_term ||
                        mergedUser.id.includes(search_term) ||
                        (mergedUser.owner_email && mergedUser.owner_email.toLowerCase().includes(search_term.toLowerCase())) ||
                        (mergedUser.servers && mergedUser.servers.some(s => s.domain && s.domain.toLowerCase().includes(search_term.toLowerCase())))) {
                        results.push(mergedUser);
                    }
                }
                
                // Add any Firestore clients that might not be in auth (orphans)
                for (const [uid, fClient] of firestoreClients.entries()) {
                    if (!processedIds.has(uid)) {
                        if (!search_term ||
                            uid.includes(search_term) ||
                            (fClient.owner_email && fClient.owner_email.toLowerCase().includes(search_term.toLowerCase())) ||
                            (fClient.servers && fClient.servers.some(s => s.domain && s.domain.toLowerCase().includes(search_term.toLowerCase())))) {
                            results.push({ id: uid, ...fClient });
                        }
                    }
                }

                return res.status(200).json({ result: results });
            }

            if (action === 'ADMIN_ADD_SERVER') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                const serverId = `srv-${Date.now()}`;
                await admin.firestore().collection('clients').doc(payload.id).collection('servers').doc(serverId).set({
                    plan: payload.plan || 'starter',
                    status: 'pending_configuration',
                    created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp()
                });
                return res.status(200).json({ result: { message: 'Slot serveur ajouté avec succès.', server_id: serverId } });
            }

            if (action === 'ADMIN_UPDATE') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                
                if (payload.server_id) {
                    if (payload.updates && payload.updates.plan) {
                        try {
                            await cloudRunManager.updateServiceRAM(payload.server_id, payload.updates.plan.toLowerCase());
                            console.log(`✅ RAM mise à jour sur Cloud Run pour le serveur ${payload.server_id}`);
                        } catch (err) {
                            console.error(`⚠️ Erreur update RAM Cloud Run :`, err.message);
                        }
                    }
                    if (payload.updates && payload.updates.status) {
                        try {
                            if (payload.updates.status === 'suspended') {
                                await cloudRunManager.suspendService(payload.server_id);
                                console.log(`🛑 Service Cloud Run suspendu pour le serveur ${payload.server_id}`);
                            } else if (payload.updates.status === 'active') {
                                await cloudRunManager.resumeService(payload.server_id);
                                console.log(`▶ Service Cloud Run réactivé pour le serveur ${payload.server_id}`);
                            }
                        } catch (err) {
                            console.error(`⚠️ Erreur update statut Cloud Run :`, err.message);
                        }
                    }
                    await admin.firestore()
                        .collection('clients').doc(payload.id)
                        .collection('servers').doc(payload.server_id)
                        .set(payload.updates, { merge: true });
                    return res.status(200).json({ result: { message: `Serveur ${payload.server_id} mis à jour.` } });
                }
                
                if (payload.updates && payload.updates.account_type === 'admin') {
                    const clientDoc = await admin.firestore().collection('clients').doc(payload.id).get();
                    if (clientDoc.exists && clientDoc.data().account_type !== 'admin') {
                        // Send notification about unlocking godmode and the image
                        await admin.firestore().collection('clients').doc(payload.id).collection('notifications').add({
                            type: 'godmode_unlocked',
                            title: 'Accès God Mode débloqué ! 👑',
                            message: 'Félicitations, tu viens de débloquer l\'accès God Mode. Tu as maintenant accès à toutes les fonctionnalités d\'administration ainsi qu\'à l\'avatar légendaire exclusif "Chèvre Légende" ! 🐐',
                            read: false,
                            severity: 'warning',
                            created_at: require('firebase-admin/firestore').Timestamp.now()
                        });
                        console.log(`🎉 Notification: God Mode débloqué pour le client ${payload.id}`);
                    }
                }

                await admin.firestore().collection('clients').doc(payload.id).set(payload.updates, { merge: true });
                return res.status(200).json({ result: { message: 'Client mis à jour avec succès dans Firestore.' } });
            }

            if (action === 'MIGRATE_SERVER') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                const serverDoc = await admin.firestore().collection('clients').doc(payload.client_id).collection('servers').doc(payload.server_id).get();
                if (!serverDoc.exists) return res.status(404).json({ error: 'Serveur introuvable.' });
                const serverData = serverDoc.data();
                
                // Forcer la recherche du meilleur noeud (l'auto-scaling s'occupera d'en provisionner un nouveau si tous sont pleins)
                const targetVM = await fleetManager.getBestVM('starter'); // Simule un besoin d'espace
                if (targetVM.id === serverData.vm_id) {
                    return res.status(400).json({ error: 'Le serveur est déjà sur le noeud le plus optimal de la flotte.' });
                }
                
                const clientDoc = await admin.firestore().collection('clients').doc(payload.client_id).get();
                const clientData = clientDoc.data();
                
                const deployPayload = {
                    client_id: payload.client_id,
                    name: clientData.name,
                    max_requests: serverData.max_requests,
                    account_type: clientData.account_type,
                    domain: serverData.domain,
                    gtm_id: serverData.gtm_id,
                    role: clientData.role,
                    parent_id: clientData.parent_id
                };
                
                console.log(`🚀 Migration de ${serverData.domain} vers ${targetVM.id}`);
                const deployResp = await axios.post(`${targetVM.url}/deploy`, deployPayload, config);
                const deployResult = deployResp.data;
                
                // Proxy
                await axios.post(`${fleetManager.PRIMARY_BRIDGE_URL}/api/nginx/proxy`, {
                    domain: serverData.domain,
                    target_ip: targetVM.internal_ip,
                    port: deployResult.port,
                    cluster_name: deployResult.cluster
                }, config);
                
                // Nettoyage de l'ancien container
                try {
                    await axios.delete(`${serverData.bridge_url}/api/container/${serverData.cluster_name}`, config);
                } catch (e) {
                    console.warn(`⚠️ Impossible de supprimer l'ancien container: ${e.message}`);
                }
                
                // Update Firestore
                await serverDoc.ref.update({
                    server_host: targetVM.ip,
                    bridge_url: targetVM.url,
                    vm_id: targetVM.id,
                    cluster_name: deployResult.cluster,
                    server_port: deployResult.port
                });
                
                return res.status(200).json({ result: { message: `Migration réussie vers ${targetVM.id}` } });
            }

            if (action === 'GET_FLEET_STATUS') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                const fleetSnap = await admin.firestore().collection('vm_fleet').where('status', '==', 'active').get();
                const fleet = fleetSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                return res.status(200).json({ result: fleet });
            }

            if (action === 'GET_ADMIN_STATS') {
                if (!isAdmin) return res.status(403).json({ error: 'Accès restreint.' });
                response = await axios.get(`${BRIDGE_URL}/api/stats/${client_id}`, config);
                return res.status(200).json({ result: response.data });
            }

            // --- ACTIONS UTILISATEURS STANDARDS ---

            if (action === 'CANCEL_SUBSCRIPTION') {
                const serverDocRef = admin.firestore()
                    .collection('clients').doc(payload.client_id)
                    .collection('servers').doc(payload.server_id);
                const serverDoc = await serverDocRef.get();
                
                if (!serverDoc.exists) return res.status(404).json({ error: 'Serveur introuvable.' });
                const serverData = serverDoc.data();

                const isClientOfServer = serverData.client_email === userEmail;
                const isOwner = payload.client_id === userId;

                if (!isOwner && !isAdmin && !isClientOfServer) {
                    return res.status(403).json({ error: 'Accès non autorisé' });
                }
                
                if (serverData.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
                    try {
                        const isSubTest = serverData.stripe_subscription_id.startsWith('test_') || serverData.stripe_subscription_id.startsWith('sub_test_');
                        const stripeApiKey = isSubTest 
                            ? (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
                            : process.env.STRIPE_SECRET_KEY;
                        const stripeApi = require('stripe')(stripeApiKey);
                        const subscription = await stripeApi.subscriptions.update(serverData.stripe_subscription_id, {
                            cancel_at_period_end: true
                        });
                        
                        await serverDocRef.update({
                            cancel_requested: true,
                            cancel_at: require('firebase-admin/firestore').Timestamp.fromMillis(subscription.cancel_at * 1000),
                            updated_at: require('firebase-admin/firestore').Timestamp.now()
                        });

                        const cancelAtDate = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toLocaleDateString('fr-FR') : 'inconnue';
                        
                        // Notify Client
                        await admin.firestore().collection('clients').doc(payload.client_id).collection('notifications').add({
                            title: "Désabonnement planifié ⚠️",
                            message: `L'abonnement du serveur "${serverData.server_name || payload.server_id}" a été annulé avec succès et prendra fin le ${cancelAtDate}.`,
                            type: "subscription_cancelling",
                            severity: "warning",
                            server_id: payload.server_id,
                            read: false,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });

                        // Notify Partner if managed by one
                        const partnerId = serverData.managed_by_partner_id;
                        if (partnerId && partnerId !== payload.client_id) {
                            await admin.firestore().collection('clients').doc(partnerId).collection('notifications').add({
                                title: "Désabonnement planifié par le client",
                                message: `L'abonnement du serveur "${serverData.server_name || payload.server_id}" géré pour votre client a été annulé par ce dernier.`,
                                type: "subscription_cancelling",
                                severity: "warning",
                                server_id: payload.server_id,
                                read: false,
                                created_at: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                        
                        return res.status(200).json({ result: { message: 'Abonnement annulé avec succès à la fin de la période.' } });
                    } catch (stripeErr) {
                        console.error('Erreur annulation Stripe:', stripeErr.message);
                        return res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'abonnement Stripe.' });
                    }
                } else {
                    return res.status(400).json({ error: 'Aucun abonnement Stripe actif trouvé pour ce serveur.' });
                }
            }

            if (action === 'GET_STATS') {
                const limitMap = {
                    starter: 500000,
                    pro: 2000000,
                    business: 10000000,
                    partner: 50000000
                };
                
                let plan = 'starter';
                let clusterName = 'En attente';
                let currentRequests = 0;
                
                if (server_id) {
                    let serverDoc = await admin.firestore()
                        .collection('clients').doc(client_id)
                        .collection('servers').doc(server_id)
                        .get();

                    if (!serverDoc.exists && client_id !== userId) {
                        const serversSnap = await admin.firestore().collectionGroup('servers')
                            .where('client_email', '==', userEmail)
                            .get();
                        const matchedDoc = serversSnap.docs.find(doc => doc.id === server_id);
                        if (matchedDoc) {
                            serverDoc = matchedDoc;
                        }
                    }

                    if (serverDoc.exists) {
                        const sData = serverDoc.data();
                        const isOwner = (serverDoc.ref.parent.parent.id === userId);
                        const isClientOfServer = (sData.client_email === userEmail);
                        
                        if (!isOwner && !isClientOfServer && !isAdmin) {
                            return res.status(403).json({ error: 'Accès non autorisé aux statistiques de ce serveur.' });
                        }

                        plan = sData.plan || 'starter';
                        clusterName = sData.cluster_name || 'En attente';
                        currentRequests = sData.current_requests || 0;
                    } else {
                        return res.status(404).json({ error: 'Serveur introuvable.' });
                    }
                } else {
                    if (client_id !== userId && !isAdmin) {
                        return res.status(403).json({ error: 'Accès non autorisé.' });
                    }
                    const clientDoc = await admin.firestore().collection('clients').doc(client_id).get();
                    plan = clientDoc.exists ? clientDoc.data().account_type : 'starter';
                }

                return res.status(200).json({ 
                    result: {
                        current_requests: currentRequests,
                        max_requests: limitMap[plan] || 150000,
                        infrastructure: {
                            cluster_name: clusterName,
                            server_port: '443 (HTTPS)'
                        }
                    } 
                });
            }

            // 🔒 SÉCURITÉ : Vérification du statut du serveur spécifique avant DEPLOY
            if (action === 'DEPLOY') {
                // Validation stricte du sous-domaine
                const domainToCheck = payload.domain || '';
                const subdomainToCheck = domainToCheck.split('.')[0];
                if (!subdomainToCheck || !/^[a-z0-9-]+$/.test(subdomainToCheck)) {
                    console.error(`❌ Validation DEPLOY rejetée : sous-domaine invalide "${subdomainToCheck}"`);
                    return res.status(400).json({ error: 'Format du sous-domaine invalide : uniquement des lettres minuscules, chiffres et tirets.' });
                }

                let targetUid = userId;
                let targetServerId = server_id;
                let targetGtmId = payload.gtm_id;
                let targetPlan = payload.account_type || 'starter';
                
                if (isAdmin) {
                    if (!payload.client_id || !payload.server_id) {
                        return res.status(400).json({ error: 'client_id et server_id requis pour l\'administrateur.' });
                    }
                    targetUid = payload.client_id;
                    targetServerId = payload.server_id;
                    
                    const serverDoc = await admin.firestore()
                        .collection('clients').doc(targetUid)
                        .collection('servers').doc(targetServerId)
                        .get();
                    if (!serverDoc.exists) {
                        return res.status(404).json({ error: 'Serveur introuvable.' });
                    }
                    const sData = serverDoc.data();
                    targetGtmId = sData.container_config || sData.gtm_id || 'GTM-UNKNOWN';
                    targetPlan = sData.plan || 'starter';
                } else {
                    if (!server_id) {
                        return res.status(400).json({ error: 'Identifiant du serveur manquant (server_id requis).' });
                    }
                    let serverDoc = await admin.firestore()
                        .collection('clients').doc(userId)
                        .collection('servers').doc(server_id)
                        .get();

                    if (!serverDoc.exists) {
                        const serversSnap = await admin.firestore().collectionGroup('servers')
                            .where('client_email', '==', userEmail)
                            .get();
                        
                        const matchedDoc = serversSnap.docs.find(doc => doc.id === server_id);
                        if (matchedDoc) {
                            serverDoc = matchedDoc;
                            targetUid = serverDoc.ref.parent.parent.id;
                        }
                    }

                    if (!serverDoc.exists) {
                        return res.status(403).json({ error: 'Aucun abonnement trouvé pour ce serveur.' });
                    }
                    
                    const sData = serverDoc.data();
                    targetGtmId = sData.container_config || sData.gtm_id || 'GTM-UNKNOWN';
                    targetPlan = sData.plan || 'starter';

                    const serverStatus = sData.status;
                    if (serverStatus !== 'active' && serverStatus !== 'trial') {
                        return res.status(403).json({ error: `Serveur inactif (statut: ${serverStatus}).` });
                    }
                }
                
                // Mettre à jour immédiatement Firestore à 'deploying' et effacer l'erreur précédente
                const serverRef = admin.firestore().collection('clients').doc(targetUid).collection('servers').doc(targetServerId);
                await serverRef.update({
                    status: 'deploying',
                    deploy_error: admin.firestore.FieldValue.delete(),
                    updated_at: require('firebase-admin/firestore').Timestamp.now()
                });

                // Lancement du déploiement Serverless en tâche de fond (sans bloquer avec await)
                cloudRunManager.deployGTMContainer(
                    targetUid, 
                    targetServerId, 
                    targetGtmId, 
                    targetPlan
                ).then(async (cloudRunResult) => {
                    console.log(`✅ [Cloud Run] Déploiement en tâche de fond réussi pour ${targetServerId}: ${cloudRunResult.url}`);
                    
                    const updateData = {
                        status: 'active',
                        server_host: 'Google Cloud Run (Serverless)',
                        cloud_run_url: cloudRunResult.url,
                        cloud_run_service_id: cloudRunResult.service_id,
                        cluster_name: cloudRunResult.service_id, // Indiquer au frontend que c'est prêt
                        updated_at: require('firebase-admin/firestore').Timestamp.now()
                    };
                    
                    if (payload.domain) {
                        updateData.domain = payload.domain;
                    }
                    
                    await serverRef.update(updateData);
                    
                    // Si un domaine est configuré, mapper le domaine
                    const serverDocAfter = await serverRef.get();
                    const serverData = serverDocAfter.exists ? serverDocAfter.data() : {};
                    const domainName = serverData.domain || serverData.server_name || targetServerId;
                    
                    await admin.firestore().collection('clients').doc(targetUid).collection('notifications').add({
                        title: "Instance Déployée 🎉",
                        message: `Votre serveur de tracking pour ${domainName} a été déployé avec succès sur Google Cloud et est opérationnel.`,
                        type: "server_deployed",
                        severity: "info",
                        server_id: targetServerId,
                        read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    if (serverDocAfter.exists && serverDocAfter.data().domain) {
                        try {
                            await cloudRunManager.mapCustomDomain(targetServerId, serverDocAfter.data().domain);
                        } catch (domainErr) {
                            console.error(`⚠️ Erreur mapping domaine ${serverDocAfter.data().domain}:`, domainErr.message);
                        }
                    }
                }).catch(async (err) => {
                    console.error(`❌ [Cloud Run] Échec du déploiement en tâche de fond pour ${targetServerId}:`, err);
                    
                    // Rétablir le statut à "active" et enregistrer le message d'erreur
                    await serverRef.update({
                        status: 'active',
                        deploy_error: err.message || 'Erreur lors du déploiement Cloud Run.'
                    });

                    try {
                        const serverDocAfter = await serverRef.get();
                        const serverData = serverDocAfter.exists ? serverDocAfter.data() : {};
                        const domainName = serverData.domain || serverData.server_name || targetServerId;

                        await admin.firestore().collection('clients').doc(targetUid).collection('notifications').add({
                            title: "Échec du déploiement ❌",
                            message: `Le déploiement du serveur de tracking pour ${domainName} a échoué. Erreur : ${err.message || 'Erreur lors du déploiement Cloud Run.'}`,
                            type: "server_deploy_failed",
                            severity: "critical",
                            server_id: targetServerId,
                            read: false,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (notifErr) {
                        console.error('Erreur lors de l\'envoi de la notification d\'échec:', notifErr);
                    }
                });
                
                return res.status(200).json({ result: { message: "Déploiement initié en tâche de fond.", status: "deploying" } });
            } else if (action === 'GET_LOGS') {
                if (!payload.cluster_name) {
                    return res.status(400).json({ error: 'cluster_name manquant.' });
                }
                const logs = await cloudRunManager.getLogs(payload.cluster_name, payload.lines || 50);
                return res.status(200).json({ result: { logs } });
            } else {
                return res.status(400).json({ error: 'Action obsolète ou non reconnue pour l\'architecture Cloud Run.' });
            }

            return res.status(200).json({ result: response ? response.data : null });
        } catch (error) {
            console.error('❌ Erreur Proxy Bridge:', error.response?.data || error.message);
            return res.status(500).json({
                error: error.response?.data?.error || error.message || 'Erreur lors de la communication avec le Bridge.'
            });
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3. AUTOMATE DE SYNCHRONISATION (Trigger sur sous-collection servers)
// ═══════════════════════════════════════════════════════════════════
exports.onServerUpdate = functions.region('europe-west3').firestore
    .document('clients/{clientId}/servers/{serverId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const previousData = change.before.data();

        if (
            newData.status !== previousData.status ||
            newData.plan !== previousData.plan ||
            newData.domain !== previousData.domain
        ) {
            console.log(`[Cloud Run] Synchronisation du serveur ${context.params.serverId} ignorée (architecture Serverless).`);
        }
        return null;
    });

// ═══════════════════════════════════════════════════════════════════
// 4. SAAS PERFORMANCE & ARRÊT AUTOMATIQUE FAST PASS (Trigger onWrite)
// ═══════════════════════════════════════════════════════════════════
exports.onServerLifecycleChange = functions.region('europe-west3')
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .firestore.document('clients/{clientId}/servers/{serverId}')
    .onWrite(async (change, context) => {
        const clientId = context.params.clientId;
        const serverId = context.params.serverId;
        
        console.log(`🔥 Trigger onServerLifecycleChange déclenché pour le serveur ${serverId} du client ${clientId}`);
        
        try {
            // 1. Compte le nombre de serveurs actifs pour ce client
            const serversSnap = await admin.firestore()
                .collection('clients')
                .doc(clientId)
                .collection('servers')
                .where('status', 'in', ['active', 'trial'])
                .get();
                
            const activeServersCount = serversSnap.size;
            
            // Détermine le natural_palier
            // 1 serv = 10%, 2 = 20%, 3 = 30%, 4+ = 40%
            let naturalPalier = 0;
            if (activeServersCount === 1) naturalPalier = 10;
            else if (activeServersCount === 2) naturalPalier = 20;
            else if (activeServersCount === 3) naturalPalier = 30;
            else if (activeServersCount >= 4) naturalPalier = 40;
            
            // Récupérer le document profil client
            const clientRef = admin.firestore().collection('clients').doc(clientId);
            const clientDoc = await clientRef.get();
            if (!clientDoc.exists) {
                console.warn(`⚠️ Profil client ${clientId} introuvable dans onServerLifecycleChange`);
                return null;
            }
            
            const clientData = clientDoc.data();
            const fastPassActive = clientData.fast_pass_active || null;
            const stripeSubscriptionId = clientData.stripe_subscription_id || null;
            
            // Calcule la vitesse effective
            const effectiveSpeed = Math.max(naturalPalier, fastPassActive || 0);
            
            // Préparer les mises à jour Firestore
            let updatePayload = {
                natural_palier: naturalPalier,
                effective_speed_percent: effectiveSpeed,
                updated_at: require('firebase-admin/firestore').Timestamp.now()
            };
            
            // Vérification du Trigger d'arrêt automatique
            let didAutoCancel = false;
            if (stripeSubscriptionId && !stripeSubscriptionId.startsWith('test_')) {
                const cond1 = (fastPassActive === 30 && naturalPalier >= 30);
                const cond2 = (fastPassActive === 40 && naturalPalier >= 40);
                
                if (cond1 || cond2) {
                    console.log(`🚀 Condition de suppression du Fast Pass atteinte pour le client ${clientId}. Palier naturel: ${naturalPalier}%, Fast Pass: ${fastPassActive}%.`);
                    
                    const stripeApiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_REMPLACEZ_MOI';
                    const stripeInstance = require('stripe')(stripeApiKey);
                    try {
                        await stripeInstance.subscriptions.update(stripeSubscriptionId, {
                            cancel_at_period_end: true
                        });
                        console.log(`✅ Abonnement Fast Pass Stripe ${stripeSubscriptionId} programmé pour s'arrêter à la fin de la période.`);
                        
                        // Repasse fast_pass_active à null et positionne fast_pass_auto_cancelled à true
                        updatePayload.fast_pass_active = null;
                        updatePayload.fast_pass_auto_cancelled = true;
                        didAutoCancel = true;
                    } catch (stripeErr) {
                        console.error(`❌ Impossible de programmer l'arrêt de la souscription Stripe ${stripeSubscriptionId}:`, stripeErr.message);
                    }
                }
            }
            
            await clientRef.update(updatePayload);
            console.log(`✅ natural_palier et effective_speed_percent mis à jour pour le client ${clientId}`);
            
            // Si le serveur appartient à un partenaire, on met à jour son palier
            const serverData = change.after.exists ? change.after.data() : (change.before.exists ? change.before.data() : null);
            const partnerId = serverData?.managed_by_partner_id || null;
            if (partnerId) {
                console.log(`🔄 Le serveur appartient à un partenaire (${partnerId}), mise à jour de son palier...`);
                await checkPartnerTier(partnerId);
            }
            
            // Envoyer l'email si l'annulation automatique a réussi
            if (didAutoCancel) {
                const clientEmail = clientData.owner_email;
                const clientLang = clientData.language || 'fr';
                if (clientEmail) {
                    try {
                        await sendEmail({
                            to: [clientEmail],
                            message: {
                                from: 'StratAds <contact@stratads.fr>',
                                subject: clientLang === 'fr' 
                                    ? '🏆 Félicitations ! Votre palier gratuit StratAds est atteint' 
                                    : '🏆 Congratulations! Your free StratAds tier has been reached',
                                html: `<p>Bonjour,</p>
                                       <p>Félicitations ! Grâce au nombre de vos serveurs, vous venez d'atteindre naturellement le palier supérieur sur StratAds.</p>
                                       <p>Pour vous éviter des frais inutiles, votre abonnement Fast Pass a été programmé pour s'arrêter et ne vous sera plus facturé. Vos serveurs et votre commission restent au maximum, sans surcoût.</p>
                                       <p>L'équipe StratAds</p>`
                            },
                            language: clientLang
                        });
                        console.log(`📧 Email de félicitations envoyé à ${clientEmail}`);
                    } catch (emailErr) {
                        console.error(`❌ Erreur lors de l'envoi de l'email de félicitations:`, emailErr.message);
                    }
                } else {
                    console.warn(`⚠️ owner_email absent du profil client ${clientId}, email de félicitations non envoyé`);
                }
            }
        } catch (err) {
            console.error(`❌ Erreur dans le trigger onServerLifecycleChange:`, err);
        }
        
        return null;
    });

// ═══════════════════════════════════════════════════════════════════
// 5. ÉCHANGE DE TOKEN GOOGLE OAUTH (Code → Access + Refresh Token)
// ═══════════════════════════════════════════════════════════════════
exports.googleTokenExchange = functions.region('europe-west3').runWith({ secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] }).https.onCall(async (data, context) => {
    // Vérification : l'utilisateur doit être authentifié
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError(
            'unauthenticated',
            'Vous devez être connecté pour lier votre compte Google.'
        );
    }

    const { authCode } = data;
    const userId = context.auth.uid;

    if (!authCode) {
        throw new functions.region('europe-west3').https.HttpsError(
            'invalid-argument',
            'Code d\'autorisation manquant.'
        );
    }

    try {
        // Échanger le code d'autorisation contre des tokens
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code: authCode,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: OAUTH_REDIRECT_URI,
            grant_type: 'authorization_code',
        });

        const { access_token, refresh_token, expires_in, token_type, scope } = tokenResponse.data;

        if (!refresh_token) {
            console.warn(`⚠️ Pas de refresh_token reçu pour ${userId}. Le consentement a peut-être déjà été donné.`);
        }

        // Stocker les tokens dans Firestore (sous-collection sécurisée)
        const tokenData = {
            access_token,
            refresh_token: refresh_token || null,
            token_type: token_type || 'Bearer',
            expires_in,
            expires_at: require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + expires_in * 1000)),
            scope: scope || '',
            updated_at: require('firebase-admin/firestore').Timestamp.now(),
        };

        await admin.firestore()
            .collection('clients').doc(userId)
            .collection('google_tokens').doc('oauth')
            .set(tokenData, { merge: true });

        console.log(`✅ Tokens Google stockés pour ${userId}`);

        return {
            success: true,
            has_refresh_token: !!refresh_token,
            scope,
        };
    } catch (error) {
        console.error('❌ Erreur échange token Google:', error.response?.data || error.message);
        throw new functions.region('europe-west3').https.HttpsError(
            'internal',
            error.response?.data?.error_description || 'Erreur lors de l\'échange du code OAuth.'
        );
    }
});

// ═══════════════════════════════════════════════════════════════════
// 6. RAFRAÎCHIR UN ACCESS TOKEN EXPIRÉ
// ═══════════════════════════════════════════════════════════════════
exports.refreshGoogleToken = functions.region('europe-west3').runWith({ secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;

    try {
        // Lire le refresh_token depuis Firestore
        const tokenDoc = await admin.firestore()
            .collection('clients').doc(userId)
            .collection('google_tokens').doc('oauth')
            .get();

        if (!tokenDoc.exists || !tokenDoc.data().refresh_token) {
            throw new functions.region('europe-west3').https.HttpsError(
                'failed-precondition',
                'Aucun refresh token trouvé. Veuillez reconnecter votre compte Google.'
            );
        }

        const refreshToken = tokenDoc.data().refresh_token;

        // Demander un nouveau access_token
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            refresh_token: refreshToken,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
        });

        const { access_token, expires_in } = tokenResponse.data;

        // Mettre à jour dans Firestore
        await admin.firestore()
            .collection('clients').doc(userId)
            .collection('google_tokens').doc('oauth')
            .update({
                access_token,
                expires_in,
                expires_at: require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + expires_in * 1000)),
                updated_at: require('firebase-admin/firestore').Timestamp.now(),
            });

        console.log(`🔄 Access token rafraîchi pour ${userId}`);
        return { success: true, access_token, expires_in };
    } catch (error) {
        console.error('❌ Erreur refresh token:', error.response?.data || error.message);
        throw new functions.region('europe-west3').https.HttpsError(
            'internal',
            error.response?.data?.error_description || 'Erreur lors du rafraîchissement du token.'
        );
    }
});


// ═══════════════════════════════════════════════════════════════════
// 8. LISTER LES COMPTES GTM DU CLIENT (via OAuth)
// ═══════════════════════════════════════════════════════════════════
exports.listGtmAccounts = functions.region('europe-west3').runWith({ secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;

    try {
        // Récupérer le token OAuth
        const tokenDoc = await admin.firestore()
            .collection('clients').doc(userId)
            .collection('google_tokens').doc('oauth')
            .get();

        if (!tokenDoc.exists || !tokenDoc.data().access_token) {
            throw new functions.region('europe-west3').https.HttpsError(
                'failed-precondition',
                'Veuillez d\'abord connecter votre compte Google.'
            );
        }

        let accessToken = tokenDoc.data().access_token;
        const expiresAt = tokenDoc.data().expires_at;

        // Vérifier si le token est expiré et le rafraîchir si nécessaire
        if (expiresAt && expiresAt.toDate() < new Date()) {
            const refreshToken = tokenDoc.data().refresh_token;
            if (!refreshToken) {
                throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Token expiré. Reconnectez votre compte Google.');
            }

            const refreshResponse = await axios.post('https://oauth2.googleapis.com/token', {
                refresh_token: refreshToken,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token',
            });

            accessToken = refreshResponse.data.access_token;

            // Mettre à jour le token
            await admin.firestore()
                .collection('clients').doc(userId)
                .collection('google_tokens').doc('oauth')
                .update({
                    access_token: accessToken,
                    expires_at: require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + refreshResponse.data.expires_in * 1000)),
                    updated_at: require('firebase-admin/firestore').Timestamp.now(),
                });
        }

        // Appeler l'API GTM
        const gtmResponse = await axios.get(
            'https://www.googleapis.com/tagmanager/v2/accounts',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const accounts = (gtmResponse.data.account || []).map(acc => ({
            accountId: acc.accountId,
            name: acc.name,
            path: acc.path,
        }));

        return { success: true, accounts };
    } catch (error) {
        console.error('❌ Erreur listGtmAccounts:', error.response?.data || error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', 'Erreur lors de la récupération des comptes GTM.');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 9. CRÉER UN CONTAINER GTM SERVER-SIDE
// ═══════════════════════════════════════════════════════════════════
exports.createGtmServerContainer = functions.region('europe-west3').runWith({ secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    const { accountPath, containerName, serverId } = data;

    if (!accountPath || !containerName) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'accountPath et containerName requis.');
    }

    try {
        // Récupérer le token
        const tokenDoc = await admin.firestore()
            .collection('clients').doc(userId)
            .collection('google_tokens').doc('oauth')
            .get();

        if (!tokenDoc.exists || !tokenDoc.data().access_token) {
            throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Connectez votre compte Google.');
        }

        const accessToken = tokenDoc.data().access_token;

        // Créer le container server-side via l'API GTM v2
        const createResponse = await axios.post(
            `https://www.googleapis.com/tagmanager/v2/${accountPath}/containers`,
            {
                name: containerName,
                usageContext: ['SERVER'],
            },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const container = createResponse.data;

        // Si un serverId est fourni, lier le container au serveur dans Firestore
        if (serverId) {
            await admin.firestore()
                .collection('clients').doc(userId)
                .collection('servers').doc(serverId)
                .update({
                    gtm_container_id: container.containerId,
                    gtm_container_name: container.name,
                    gtm_public_id: container.publicId,
                    updated_at: require('firebase-admin/firestore').Timestamp.now(),
                });
        }

        console.log(`✅ Container GTM SS créé: ${container.publicId} pour ${userId}`);
        return {
            success: true,
            containerId: container.containerId,
            publicId: container.publicId,
            name: container.name,
        };
    } catch (error) {
        console.error('❌ Erreur createGtmServerContainer:', error.response?.data || error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', error.response?.data?.error?.message || 'Erreur lors de la création du container GTM.');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 10. SIMULER UN ACHAT TEST (pas de Stripe, création directe)
// ═══════════════════════════════════════════════════════════════════
exports.simulateTestPurchase = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const { plan } = data;

    if (!plan) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'Plan manquant.');
    }

    const now = require('firebase-admin/firestore').Timestamp.now();
    const in30Days = require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const clientRef = admin.firestore().collection('clients').doc(userId);

    // Compter les serveurs existants
    const existingServers = await clientRef.collection('servers').get();
    const serverNumber = existingServers.size + 1;

    // Déterminer le type de compte effectif (sécurité : ne jamais rétrograder d'admin ou de partenaire)
    const clientDoc = await clientRef.get();
    const currentType = clientDoc.exists ? (clientDoc.data().account_type || 'free') : 'free';
    let effectiveAccountType = currentType;
    if (currentType === 'admin') {
        effectiveAccountType = 'admin';
    } else if (currentType === 'partner') {
        effectiveAccountType = 'partner';
    } else if (plan === 'partner') {
        effectiveAccountType = 'partner';
    } else {
        effectiveAccountType = currentType;
    }

    // Créer/mettre à jour le profil client
    await clientRef.set({
        account_type: effectiveAccountType,
        stripe_customer_id: `test_cus_${Date.now()}`,
        owner_email: userEmail,
        owner_uid: userId,
        updated_at: now,
    }, { merge: true });

    // Créer le document serveur
    const serverId = `test_srv_${Date.now()}`;
    await clientRef.collection('servers').doc(serverId).set({
        status: 'active',
        plan: plan,
        server_name: `Serveur ${serverNumber}`,
        domain: null,
        client_email: userEmail,
        stripe_subscription_id: serverId,
        subscription_start: now,
        subscription_end: in30Days,
        trial_end: null,
        cancel_requested: false,
        cancel_at: null,
        updated_at: now,
    });

    console.log(`🧪 Achat test simulé pour ${userEmail} — Plan: ${plan}, Server: ${serverId}`);
    return { success: true, serverId, plan };
});

// ═══════════════════════════════════════════════════════════════════
// 11. ANNULATION D'ABONNEMENT STRIPE (appel réel au SDK Stripe)
// ═══════════════════════════════════════════════════════════════════
exports.cancelSubscription = functions.region('europe-west3').runWith({ secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    const { serverId } = data;

    if (!serverId) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'ID du serveur manquant.');
    }

    try {
        // 1) Récupérer le document serveur
        let serverRef = admin.firestore()
            .collection('clients').doc(userId)
            .collection('servers').doc(serverId);
        let serverDoc = await serverRef.get();

        if (!serverDoc.exists) {
            const userEmail = context.auth.token.email;
            const serversSnap = await admin.firestore().collectionGroup('servers')
                .where('client_email', '==', userEmail)
                .get();
            const matchedDoc = serversSnap.docs.find(doc => doc.id === serverId);
            if (matchedDoc) {
                serverDoc = matchedDoc;
                serverRef = matchedDoc.ref;
            }
        }

        if (!serverDoc.exists) {
            throw new functions.region('europe-west3').https.HttpsError('not-found', 'Serveur introuvable.');
        }

        const serverData = serverDoc.data();
        const stripeSubscriptionId = serverData.stripe_subscription_id;
        const isTrial = serverData.status === 'trial';

        // 2) Annuler sur Stripe si c'est un vrai abonnement (pas un test)
        let stripeCancelled = false;
        if (stripeSubscriptionId && !stripeSubscriptionId.startsWith('test_') && process.env.STRIPE_SECRET_KEY) {
            let stripeApiKey = process.env.STRIPE_SECRET_KEY;
            let stripeInstance = require('stripe')(stripeApiKey);
            try {
                if (isTrial) {
                    // Annulation immédiate pour les essais
                    await stripeInstance.subscriptions.cancel(stripeSubscriptionId);
                    console.log(`✅ Abonnement Stripe ${stripeSubscriptionId} annulé immédiatement (trial).`);
                } else {
                    // Annulation à la fin de la période en cours
                    await stripeInstance.subscriptions.update(stripeSubscriptionId, {
                        cancel_at_period_end: true
                    });
                    console.log(`✅ Abonnement Stripe ${stripeSubscriptionId} annulé en fin de période.`);
                }
                stripeCancelled = true;
            } catch (stripeErr) {
                // Si l'abonnement n'existe pas en mode Live, on tente en mode Test
                if (stripeErr.message.includes('No such subscription') || stripeErr.code === 'resource_missing') {
                    console.log(`ℹ️ Souscription non trouvée en mode Live, tentative en mode Test pour ${stripeSubscriptionId}...`);
                    if (process.env.STRIPE_TEST_SECRET_KEY) {
                        try {
                            const testStripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
                            if (isTrial) {
                                await testStripe.subscriptions.cancel(stripeSubscriptionId);
                            } else {
                                await testStripe.subscriptions.update(stripeSubscriptionId, {
                                    cancel_at_period_end: true
                                });
                            }
                            stripeCancelled = true;
                            console.log(`✅ Abonnement Stripe de test ${stripeSubscriptionId} annulé.`);
                        } catch (testErr) {
                            if (testErr.code === 'resource_missing') {
                                stripeCancelled = true;
                            } else {
                                console.error(`❌ Échec de l'annulation en mode Test :`, testErr.message);
                                throw new functions.region('europe-west3').https.HttpsError('internal', `Erreur Stripe Test: ${testErr.message}`);
                            }
                        }
                    } else {
                        // Pas de clé test, on considère annulé pour Firestore
                        stripeCancelled = true;
                        console.warn("⚠️ Impossible de tenter en mode Test : STRIPE_TEST_SECRET_KEY non configurée.");
                    }
                } else {
                    throw new functions.region('europe-west3').https.HttpsError('internal', `Erreur Stripe: ${stripeErr.message}`);
                }
            }
        } else {
            // Abonnement test ou pas de clé Stripe → juste mettre à jour Firestore
            stripeCancelled = true;
            console.log(`ℹ️ Abonnement ${stripeSubscriptionId || 'inconnu'} — pas de Stripe réel, mise à jour Firestore uniquement.`);
        }

        // 3) Mettre à jour Firestore
        const cancelAt = isTrial
            ? (serverData.trial_end || require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
            : (serverData.subscription_end || require('firebase-admin/firestore').Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));

        await serverRef.update({
            cancel_requested: true,
            cancel_at: cancelAt,
            status: isTrial ? 'cancelling' : 'cancelling',
            updated_at: require('firebase-admin/firestore').Timestamp.now(),
        });

        // 4) Envoyer une notification au client
        try {
            await admin.firestore()
                .collection('clients').doc(userId)
                .collection('notifications').add({
                    title: `Annulation de ${serverData.server_name || 'votre serveur'}`,
                    message: isTrial
                        ? 'Votre essai sera désactivé à la fin de la période. Aucun débit ne sera effectué.'
                        : `Votre serveur restera actif jusqu'au terme de la période en cours. Aucun renouvellement.`,
                    severity: 'warning',
                    read: false,
                    created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
                });
        } catch (notifErr) {
            console.warn('⚠️ Notification non envoyée:', notifErr.message);
        }

        console.log(`🔴 Serveur ${serverId} annulé pour ${userId} — Stripe: ${stripeCancelled ? 'OK' : 'N/A'}`);
        return {
            success: true,
            stripe_cancelled: stripeCancelled,
            cancel_at: cancelAt.toDate().toISOString(),
        };

    } catch (error) {
        console.error('❌ Erreur cancelSubscription:', error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', error.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// 11.b ANNULATION D'ABONNEMENT FAST PASS
// ═══════════════════════════════════════════════════════════════════
exports.cancelFastPass = functions.region('europe-west3').runWith({ secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    console.log(`🔴 Demande de résiliation de Fast Pass reçue pour le client ${userId}`);

    try {
        const clientRef = admin.firestore().collection('clients').doc(userId);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists) {
            throw new functions.region('europe-west3').https.HttpsError('not-found', 'Profil client introuvable.');
        }

        const clientData = clientDoc.data();
        const stripeSubscriptionId = clientData.stripe_subscription_id;

        if (!stripeSubscriptionId) {
            throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Aucun abonnement Fast Pass actif trouvé sur ce profil.');
        }

        let stripeCancelled = false;
        if (!stripeSubscriptionId.startsWith('test_') && process.env.STRIPE_SECRET_KEY) {
            const stripeApiKey = process.env.STRIPE_SECRET_KEY;
            const stripeInstance = require('stripe')(stripeApiKey);
            try {
                // Annulation en fin de période
                await stripeInstance.subscriptions.update(stripeSubscriptionId, {
                    cancel_at_period_end: true
                });
                stripeCancelled = true;
                console.log(`✅ Abonnement Fast Pass Stripe ${stripeSubscriptionId} programmé pour s'arrêter en fin de période.`);
            } catch (stripeErr) {
                if (stripeErr.message.includes('No such subscription') || stripeErr.code === 'resource_missing') {
                    console.log(`ℹ️ Souscription non trouvée en mode Live, tentative en mode Test pour ${stripeSubscriptionId}...`);
                    if (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY) {
                        try {
                            const testStripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
                            await testStripe.subscriptions.update(stripeSubscriptionId, {
                                cancel_at_period_end: true
                            });
                            stripeCancelled = true;
                            console.log(`✅ Abonnement de test Fast Pass Stripe ${stripeSubscriptionId} programmé pour s'arrêter.`);
                        } catch (testErr) {
                            console.error(`❌ Échec de l'annulation du Fast Pass de test Stripe :`, testErr.message);
                        }
                    }
                } else {
                    throw new functions.region('europe-west3').https.HttpsError('internal', `Erreur Stripe: ${stripeErr.message}`);
                }
            }
        } else {
            stripeCancelled = true;
            console.log(`ℹ️ Abonnement Fast Pass ${stripeSubscriptionId || 'inconnu'} — pas de Stripe réel, mise à jour Firestore uniquement.`);
        }

        // Mettre à jour Firestore localement pour répercuter l'arrêt (remettre à la vitesse/commission naturelle)
        const naturalPalier = clientData.natural_palier || 0;
        await clientRef.update({
            fast_pass_active: null,
            stripe_subscription_id: null,
            effective_speed_percent: naturalPalier,
            updated_at: require('firebase-admin/firestore').Timestamp.now()
        });

        // Envoyer une notification au client dans son dashboard
        try {
            await admin.firestore()
                .collection('clients').doc(userId)
                .collection('notifications').add({
                    title: `Résiliation de votre Fast Pass`,
                    message: `Votre abonnement Fast Pass a été résilié. Votre commission a été réinitialisée à son taux naturel basé sur vos serveurs actifs (${naturalPalier}%).`,
                    severity: 'warning',
                    read: false,
                    created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
                });
        } catch (notifErr) {
            console.warn('⚠️ Notification non enregistrée:', notifErr.message);
        }

        return {
            success: true,
            stripe_cancelled: stripeCancelled
        };

    } catch (error) {
        console.error('❌ Erreur cancelFastPass:', error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', error.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// 12. ENVOI D'EMAIL DE SUPPORT (remplace mailto:)
// ═══════════════════════════════════════════════════════════════════
exports.sendSupportEmail = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const { name, email, subject, message } = data;

    if (!name || !email || !subject || !message) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'Tous les champs sont requis (nom, email, sujet, message).');
    }

    if (message.length > 5000) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'Le message est trop long (max 5000 caractères).');
    }

    try {
        // Stocker le ticket dans Firestore pour traçabilité
        const ticketRef = await admin.firestore().collection('support_tickets').add({
            user_id: userId,
            user_email: userEmail,
            contact_name: name,
            contact_email: email,
            subject: subject,
            message: message,
            status: 'open',
            created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
        });

        // Envoyer un email via l'API Mailgun / ou stocker pour consultation admin
        // Pour l'instant : on notifie l'admin via une notification Firestore dans sa collection
        // + on stocke le ticket (l'admin le verra dans le God Mode)

        // Trouver tous les admins pour les notifier
        const adminsSnap = await admin.firestore().collection('clients')
            .where('account_type', '==', 'admin').get();

        const notifPromises = [];

        // Notifier chaque admin
        for (const adminDoc of adminsSnap.docs) {
            notifPromises.push(
                admin.firestore()
                    .collection('clients').doc(adminDoc.id)
                    .collection('notifications').add({
                        title: `📨 Ticket Support: ${subject}`,
                        message: `De: ${name} (${email}) — "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
                        severity: 'info',
                        read: false,
                        ticket_id: ticketRef.id,
                        created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
                    })
            );
        }

        // Aussi notifier l'email admin principal par requête HTTP (webhook simple)
        // On utilise une requête vers un Google Apps Script ou un service SMTP
        // Pour le MVP, on stocke dans Firestore et on notifie via le dashboard admin
        notifPromises.push(
            admin.firestore().collection('admin_inbox').add({
                from_name: name,
                from_email: email,
                subject: `Support StratAds: ${subject}`,
                body: message,
                user_id: userId,
                user_email: userEmail,
                ticket_id: ticketRef.id,
                read: false,
                created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
            })
        );

        await Promise.all(notifPromises);

        // Envoyer une notification de confirmation au client
        await admin.firestore()
            .collection('clients').doc(userId)
            .collection('notifications').add({
                title: '✅ Ticket de support envoyé',
                message: `Votre demande "${subject}" a bien été transmise. Nous vous répondrons sous 24h à ${email}.`,
                severity: 'info',
                read: false,
                created_at: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
            });

        console.log(`📨 Ticket support #${ticketRef.id} créé par ${userEmail} — Sujet: ${subject}`);
        return { success: true, ticketId: ticketRef.id };

    } catch (error) {
        console.error('❌ Erreur sendSupportEmail:', error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', 'Erreur lors de l\'envoi du ticket de support.');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 13. GÉNÉRATION PORTAIL CLIENT STRIPE (Customer Portal)
// ═══════════════════════════════════════════════════════════════════
exports.createStripePortalSession = functions.region('europe-west3').runWith({ secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    }

    const userId = context.auth.uid;
    const requestedCustomerId = data?.customerId;

    try {
        let stripeCustomerId;

        if (requestedCustomerId) {
            // Sécurité : si un customerId spécifique est demandé
            if (userId === 'PS1VGzxMOsNgpCeaU2MAj4Wlsjn2') {
                // Admin has full access
                stripeCustomerId = requestedCustomerId;
            } else {
                // Vérifier si le partenaire possède un serveur géré avec ce stripe_customer_id
                const serversSnap = await admin.firestore()
                    .collection('clients')
                    .doc(userId)
                    .collection('servers')
                    .where('stripe_customer_id', '==', requestedCustomerId)
                    .limit(1)
                    .get();

                if (serversSnap.empty) {
                    throw new functions.region('europe-west3').https.HttpsError('permission-denied', 'Vous n\'êtes pas autorisé à accéder au portail Stripe pour ce client.');
                }
                stripeCustomerId = requestedCustomerId;
            }
        } else {
            // Par défaut : charger le propre portail Stripe de l'utilisateur connecté
            const clientDoc = await admin.firestore().collection('clients').doc(userId).get();

            if (!clientDoc.exists || !clientDoc.data().stripe_customer_id) {
                throw new functions.region('europe-west3').https.HttpsError('not-found', 'Aucun compte Stripe associé à ce profil.');
            }

            stripeCustomerId = clientDoc.data().stripe_customer_id;
        }

        // Si c'est un compte test (créé via le simulateur)
        if (stripeCustomerId.startsWith('test_cus_')) {
            throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Ceci est un compte test (simulateur). Pas de portail Stripe disponible.');
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            throw new functions.region('europe-west3').https.HttpsError('internal', 'La clé Stripe n\'est pas configurée sur le serveur.');
        }

        let stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        let session;
        try {
            // 2) Générer la session du portail
            session = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: 'https://stratads.fr/billing',
            });
        } catch (err) {
            // Si le client n'existe pas en mode Live, on tente en mode Test
            if ((err.message.includes('No such customer') || err.code === 'resource_missing') && process.env.STRIPE_TEST_SECRET_KEY) {
                console.log(`ℹ️ Client non trouvé en mode Live, tentative en mode Test pour ${stripeCustomerId}...`);
                const testStripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
                session = await testStripe.billingPortal.sessions.create({
                    customer: stripeCustomerId,
                    return_url: 'https://stratads.fr/billing',
                });
            } else {
                throw err;
            }
        }

        console.log(`🔗 Session Portail Stripe créée pour ${userId} (${stripeCustomerId})`);
        
        return { success: true, url: session.url };

    } catch (error) {
        console.error('❌ Erreur createStripePortalSession:', error.message);
        if (error instanceof functions.region('europe-west3').https.HttpsError) throw error;
        throw new functions.region('europe-west3').https.HttpsError('internal', error.message || 'Erreur lors de la création de la session Stripe Portal.');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 14. CRON : SUIVI DES QUOTAS CLOUD RUN ET ALERTES EMAILS
// ═══════════════════════════════════════════════════════════════════
exports.checkQuotasCron = functions.region('europe-west3').pubsub.schedule('0 * * * *').onRun(async (context) => {
    try {
        const { MetricServiceClient } = require('@google-cloud/monitoring');
        const monitoringClient = new MetricServiceClient();
        const projectId = process.env.GCLOUD_PROJECT || 'fessekapete';
        
        // 1. Récupérer tous les serveurs actifs
        const serversSnap = await admin.firestore().collectionGroup('servers')
            .where('status', 'in', ['active', 'trial'])
            .get();
            
        if (serversSnap.empty) {
            console.log('Aucun serveur actif à vérifier.');
            return null;
        }

        const limitMap = {
            starter: 150000,
            pro: 500000,
            business: 1000000,
            agency: 2500000,
            partner: 50000000 // Multi-instances / Illimité
        };

        const now = new Date();
        // On récupère les requêtes sur les 30 derniers jours (approx cycle mensuel)
        const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); 
        
        for (const doc of serversSnap.docs) {
            const serverData = doc.data();
            const serviceId = serverData.cloud_run_service_id;
            const plan = serverData.plan || 'starter';
            const maxReqs = limitMap[plan];
            
            if (!serviceId) continue; // Pas encore déployé
            
            // 2. Requête vers Google Cloud Monitoring API
            const request = {
                name: monitoringClient.projectPath(projectId),
                filter: `metric.type="run.googleapis.com/request_count" AND resource.labels.service_name="${serviceId}"`,
                interval: {
                    startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                    endTime: { seconds: Math.floor(now.getTime() / 1000) }
                },
                aggregation: {
                    alignmentPeriod: { seconds: 30 * 24 * 60 * 60 },
                    perSeriesAligner: 'ALIGN_SUM',
                    crossSeriesReducer: 'REDUCE_SUM'
                }
            };
            
            let totalRequests = 0;
            try {
                const [timeSeries] = await monitoringClient.listTimeSeries(request);
                if (timeSeries && timeSeries.length > 0 && timeSeries[0].points && timeSeries[0].points.length > 0) {
                    totalRequests = parseInt(timeSeries[0].points[0].value.int64Value, 10);
                }
            } catch (err) {
                console.error(`Erreur monitoring API pour ${serviceId}:`, err.message);
                continue;
            }

            // 2.5 Vérification SSL automatique
            let sslActive = serverData.ssl_active || false;
            if (serverData.domain && !sslActive) {
                try {
                    const axios = require('axios');
                    // Ping https://domain/healthy with a 5s timeout
                    const pingRes = await axios.get(`https://${serverData.domain}/healthy`, { timeout: 5000 });
                    if (pingRes.status === 200) {
                        console.log(`✅ [SSL Check] Certificat SSL valide détecté pour ${serverData.domain}. Passage de ssl_active à true.`);
                        sslActive = true;
                    }
                } catch (sslErr) {
                    console.log(`ℹ [SSL Check] Vérification SSL en attente pour ${serverData.domain}: ${sslErr.message}`);
                }
            }
            
            // 3. Mettre à jour en base
            await doc.ref.update({
                current_requests: totalRequests,
                ssl_active: sslActive,
                updated_at: require('firebase-admin/firestore').Timestamp.now()
            });
            
            // 4. Alertes par emails via Trigger Firebase Mail (sauf pour les comptes partenaires)
            const percent = (totalRequests / maxReqs) * 100;
            
            // Récupérer l'email du parent
            const clientDoc = await doc.ref.parent.parent.get();
            const clientData = clientDoc.exists ? clientDoc.data() : {};
            const isPartner = clientData.account_type === 'partner';
            
            if (!isPartner) {
                const ownerEmail = clientData.owner_email || 'client@stratads.fr';
                const serverName = serverData.server_name || serviceId;
                
                if (percent >= 100 && !serverData.email_100_sent) {
                    await sendQuotaEmail(ownerEmail, serverName, '100%', totalRequests, maxReqs);
                    await doc.ref.update({ email_100_sent: true });
                } else if (percent >= 80 && percent < 100 && !serverData.email_80_sent) {
                    await sendQuotaEmail(ownerEmail, serverName, '80%', totalRequests, maxReqs);
                    await doc.ref.update({ email_80_sent: true });
                } else if (percent >= 50 && percent < 80 && !serverData.email_50_sent) {
                    await sendQuotaEmail(ownerEmail, serverName, '50%', totalRequests, maxReqs);
                    await doc.ref.update({ email_50_sent: true });
                }
            } else {
                console.log(`ℹ️ Alerte quota ignorée pour le Partenaire (ID: ${clientDoc.id})`);
            }
        }
        console.log('✅ Vérification des quotas terminée.');
        return null;
    } catch (error) {
        console.error('❌ Erreur checkQuotasCron:', error);
        return null;
    }
});

// Helper Function pour envoyer les emails de quota
async function sendQuotaEmail(toEmail, serverName, threshold, current, max) {
    if (!toEmail) return;
    try {
        await sendEmail({
            to: [toEmail],
            message: {
                from: 'StratAds <contact@stratads.fr>',
                subject: `Alerte Quota StratAds - ${threshold} atteint`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                        <h2>Alerte d'utilisation : ${serverName}</h2>
                        <p>Votre serveur a atteint <strong>${threshold}</strong> de son quota mensuel de requêtes.</p>
                        <p>Requêtes actuelles : <strong>${current.toLocaleString('fr-FR')}</strong> / ${max.toLocaleString('fr-FR')}</p>
                        <p>Afin de garantir le bon fonctionnement de votre infrastructure, connectez-vous à votre tableau de bord pour mettre à niveau votre abonnement si nécessaire.</p>
                        <a href="https://stratads.fr/dashboard" style="display:inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Mettre à niveau</a>
                    </div>
                `
            },
            language: 'fr'
        });
        console.log(`📧 Email d'alerte ${threshold} envoyé en direct à ${toEmail} pour ${serverName}`);
    } catch (err) {
        console.error('Erreur sendQuotaEmail:', err);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 15. STRIPE CONNECT : ONBOARDING PARTENAIRE
// ═══════════════════════════════════════════════════════════════════
exports.createStripeConnectAccount = functions.region('europe-west3').runWith({ secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    const uid = context.auth.uid;

    try {
        const clientRef = admin.firestore().collection('clients').doc(uid);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists || clientDoc.data().account_type !== 'partner') {
            throw new functions.region('europe-west3').https.HttpsError('permission-denied', 'Réservé aux partenaires.');
        }

        const stripeApi = require('stripe')(process.env.STRIPE_SECRET_KEY);
        let stripeConnectId = clientDoc.data().stripe_connect_id;

        if (!stripeConnectId) {
            // Créer le compte Connect Standard
            const account = await stripeApi.accounts.create({
                type: 'standard',
                email: context.auth.token.email || clientDoc.data().owner_email,
            });
            stripeConnectId = account.id;
            await clientRef.update({ stripe_connect_id: stripeConnectId });
        }

        // Créer le lien d'onboarding
        const accountLink = await stripeApi.accountLinks.create({
            account: stripeConnectId,
            refresh_url: 'https://stratads.fr/dashboard?partner_refresh=true',
            return_url: 'https://stratads.fr/dashboard?partner_return=true',
            type: 'account_onboarding',
        });

        return { success: true, url: accountLink.url };
    } catch (err) {
        console.error('❌ Erreur createStripeConnectAccount:', err);
        throw new functions.region('europe-west3').https.HttpsError('internal', err.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// 16. STRIPE CONNECT : ACCOUNT SESSION (EMBEDDED COMPONENTS)
// ═══════════════════════════════════════════════════════════════════
exports.createStripeAccountSession = functions.region('europe-west3').runWith({ secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    const uid = context.auth.uid;

    try {
        const clientRef = admin.firestore().collection('clients').doc(uid);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists || clientDoc.data().account_type !== 'partner') {
            throw new functions.region('europe-west3').https.HttpsError('permission-denied', 'Réservé aux partenaires.');
        }

        const stripeConnectId = clientDoc.data().stripe_connect_id;
        if (!stripeConnectId) {
            throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Aucun compte Stripe Connect associé.');
        }

        const stripeApi = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Créer l'AccountSession pour les composants natifs
        const accountSession = await stripeApi.accountSessions.create({
            account: stripeConnectId,
            components: {
                payments: {
                    enabled: true,
                    features: { refund_management: true, dispute_management: true, capture_payments: true }
                },
                payouts: {
                    enabled: true,
                    features: { standard_payouts: true, edit_payout_schedule: true, instant_payouts: true }
                },
                account_management: {
                    enabled: true,
                    features: { external_account_collection: true }
                }
            }
        });

        return { success: true, client_secret: accountSession.client_secret };
    } catch (err) {
        console.error('❌ Erreur createStripeAccountSession:', err);
        throw new functions.region('europe-west3').https.HttpsError('internal', err.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// 17. MONITORING BIGQUERY
// ═══════════════════════════════════════════════════════════════════
exports.getMetricsByClient = require('./monitoring').getMetricsByClient;
exports.forceSetupLogSinkV2 = require('./monitoring').forceSetupLogSinkV2;

// ═══════════════════════════════════════════════════════════════════
// 18. DOMAINE PERSONNALISÉ (CDN)
// ═══════════════════════════════════════════════════════════════════
exports.verifyCustomDomain = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
    const uid = context.auth.uid;
    const { serverId, domain } = data;

    if (!serverId || !domain) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'Paramètres manquants.');
    }

    try {
        const cleanDomain = domain.toLowerCase().trim();
        // 1. Vérifier que le serveur appartient bien à l'utilisateur
        const serverRef = admin.firestore().collection('clients').doc(uid).collection('servers').doc(serverId);
        const serverDoc = await serverRef.get();
        
        if (!serverDoc.exists) {
            // Vérifier si c'est un serveur géré par l'agence
            const clientDoc = await admin.firestore().collection('clients').doc(uid).get();
            if (clientDoc.data()?.account_type !== 'partner') {
                throw new functions.region('europe-west3').https.HttpsError('permission-denied', 'Serveur introuvable.');
            }
        }

        const serverData = serverDoc.exists ? serverDoc.data() : null;
        // Pour les partenaires, on devrait normalement faire une requête pour trouver le serveur parmi les clients...
        // Pour faire simple dans cette V1, on assume que le serverData a été trouvé (sinon on délègue à cloudRunManager qui a besoin de l'ID)

        // 2. Appeler le manager Cloud Run pour binder le domaine
        await cloudRunManager.mapCustomDomain(serverId, cleanDomain);
        
        // 3. Mettre à jour Firestore
        if (serverDoc.exists) {
            await serverRef.update({
                custom_domain: cleanDomain,
                ssl_active: false // SSL sera actif une fois propagé par Cloud Run
            });
        }

        return { success: true, message: 'Domaine associé avec succès.' };
    } catch (err) {
        console.error('❌ Erreur verifyCustomDomain:', err);
        throw new functions.region('europe-west3').https.HttpsError('internal', err.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// NEW: CONFIGURER ET DEPLOYER UN SERVEUR POST-ACHAT
// ═══════════════════════════════════════════════════════════════════
exports.configureAndDeployServer = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Vous devez être connecté.');
    
    const { serverId, serverName, domain, containerConfig, region, isMultiRegion } = data;
    const uid = context.auth.uid;
    
    if (!serverId || !serverName || !domain || !containerConfig) {
        throw new functions.region('europe-west3').https.HttpsError('invalid-argument', 'Tous les champs sont requis.');
    }
    
    const serverRef = admin.firestore().collection('clients').doc(uid).collection('servers').doc(serverId);
    const serverDoc = await serverRef.get();
    
    if (!serverDoc.exists) {
        throw new functions.region('europe-west3').https.HttpsError('not-found', 'Serveur introuvable.');
    }
    
    const serverData = serverDoc.data();
    
    if (serverData.status !== 'pending_configuration') {
        throw new functions.region('europe-west3').https.HttpsError('failed-precondition', 'Ce serveur est déjà configuré.');
    }
    
    // Extraction du GTM ID
    let gtmPublicId = 'GTM-UNKNOWN';
    try {
        const decoded = Buffer.from(containerConfig, 'base64').toString('utf8');
        const match = decoded.match(/id=(GTM-[A-Z0-9]+)/);
        if (match) gtmPublicId = match[1];
    } catch (e) { /* ignore */ }
    
    const fullDomain = domain;

    // Mise à jour de Firestore avec les informations choisies
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
    
    // Lancement du déploiement Cloud Run en background
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
            title: "Instance Déployée 🎉",
            message: `Votre serveur de tracking pour ${fullDomain || serverName || serverId} a été déployé avec succès sur Google Cloud et est opérationnel.`,
            type: "server_deployed",
            severity: "info",
            server_id: serverId,
            read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        try {
            await cloudRunManager.mapCustomDomain(serverId, fullDomain);
        } catch (domainErr) {
            console.error(`⚠️ Erreur mapping domaine auto ${fullDomain}:`, domainErr.message);
        }
    }).catch(async (err) => {
        console.error('Erreur lors du déploiement asynchrone Cloud Run:', err);

        await admin.firestore().collection('clients').doc(uid).collection('notifications').add({
            title: "Échec du déploiement ❌",
            message: `Le déploiement du serveur de tracking pour ${fullDomain || serverName || serverId} a échoué. Erreur : ${err.message || 'Erreur lors du déploiement Cloud Run.'}`,
            type: "server_deploy_failed",
            severity: "critical",
            server_id: serverId,
            read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return { success: true, message: 'Configuration enregistrée, déploiement en cours.' };
});

// ═══════════════════════════════════════════════════════════════════
// 16. ENREGISTREMENT DE LA SIGNATURE DES CONDITIONS GÉNÉRALES / CONTRAT PARTENAIRE
// ═══════════════════════════════════════════════════════════════════
exports.acceptTerms = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.region('europe-west3').https.HttpsError('unauthenticated', 'Connexion requise.');
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
        message: 'Conditions acceptées et bloc de preuve juridique enregistré.'
    };
});

exports.checkPartnerTier = checkPartnerTier;
