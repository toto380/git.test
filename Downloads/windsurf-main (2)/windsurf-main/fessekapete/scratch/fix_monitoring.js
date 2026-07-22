const fs = require('fs');

let code = fs.readFileSync('functions/monitoring.js', 'utf8');

const target = `if (!serverDoc && userEmail) {
            const managedSnap = await admin.firestore().collectionGroup('servers')
                .where('client_email', '==', userEmail)
                .get();
            serverDoc = managedSnap.docs.find(doc =>
                (service_name && doc.data().cloud_run_service_id === service_name) ||
                (domain && doc.data().domain === domain)
            );
        }`;

const repl = `if (!serverDoc && userEmail) {
            const managedSnap = await admin.firestore().collectionGroup('servers')
                .where('client_email', '==', userEmail)
                .get();
            serverDoc = managedSnap.docs.find(doc =>
                (service_name && doc.data().cloud_run_service_id === service_name) ||
                (domain && doc.data().domain === domain)
            );
        }
        if (!serverDoc && uid) {
            const partnerSnap = await admin.firestore().collectionGroup('servers')
                .where('managed_by_partner_id', '==', uid)
                .get();
            serverDoc = partnerSnap.docs.find(doc =>
                (service_name && doc.data().cloud_run_service_id === service_name) ||
                (domain && doc.data().domain === domain)
            );
        }`;

if (code.includes(target)) {
    code = code.replace(target, repl);
    fs.writeFileSync('functions/monitoring.js', code);
    console.log("Done monitoring.js");
} else {
    console.log("Target not found in monitoring.js");
}
