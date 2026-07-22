const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  try {
    console.log("Reading clients...");
    const snapshot = await db.collection('clients').limit(10).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`Client ID: ${doc.id}, Name: ${data.name || data.owner_email || 'No name'}, Account Type: ${data.account_type}`);
      
      const serversSnap = await doc.ref.collection('servers').get();
      if (!serversSnap.empty) {
        console.log("  Servers:");
        for (const sDoc of serversSnap.docs) {
          console.log(`    Server ID: ${sDoc.id}, Name: ${sDoc.data().server_name}, Status: ${sDoc.data().status}`);
          console.log("    Fields:", Object.keys(sDoc.data()));
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
