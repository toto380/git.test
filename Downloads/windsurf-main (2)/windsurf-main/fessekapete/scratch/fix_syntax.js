const fs = require('fs');
let code = fs.readFileSync('functions/index.js', 'utf8');

const junk = `            }

            if (action === 'GET_ADMIN_STATS') {
                if (!isAdmin) return res.status(403).json({ error: 'Acc\\u011fs restreint.' });
                response = await axios.get(\`\${BRIDGE_URL}/api/stats/\${client_id}\`, config);
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
                    return res.status(403).json({ error: 'Acc\\u011fs non autoris\\u011f' });
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
                        `;

const cleanJunk = code.replace(junk, "");

if (cleanJunk.length !== code.length) {
    fs.writeFileSync('functions/index.js', cleanJunk);
    console.log("Junk removed successfully!");
} else {
    console.log("Could not find the exact junk block!");
    
    // Fallback: search with regex
    const regex = /\s*}\s*if\s*\(action === 'GET_ADMIN_STATS'\) {[\s\S]*?const cancelAtDate = subscription\.cancel_at \? new Date\(subscription\.cancel_at \* 1000\)\.toLocaleDateString\('fr-FR'\) : 'inconnue';\s*/m;
    const cleanJunk2 = code.replace(regex, "");
    if (cleanJunk2.length !== code.length) {
        fs.writeFileSync('functions/index.js', cleanJunk2);
        console.log("Junk removed successfully with regex!");
    } else {
        console.log("Regex also failed to find the junk block!");
    }
}
