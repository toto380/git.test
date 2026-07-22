const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  try {
    const listUsers = await admin.auth().listUsers(10);
    console.log("Auth users:");
    for (const u of listUsers.users) {
      console.log(`Email: ${u.email}, UID: ${u.uid}`);
    }
    
    const emails = ["antoniobft.pro@gmail.com", "stratads.france@gmail.com"];
    for (const email of emails) {
      try {
        const u = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(u.uid, { password: 'Password123' });
        console.log(`Password reset successfully for ${email} to 'Password123'`);
      } catch (e) {
        console.error(`Could not reset ${email}:`, e.message);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
