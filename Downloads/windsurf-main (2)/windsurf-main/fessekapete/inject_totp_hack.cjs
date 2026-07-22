const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const injection = `
exports.enableTOTPHack = functions.region('europe-west3').https.onRequest(async (req, res) => {
    try {
        const auth = admin.auth();
        await auth.projectConfigManager().updateProjectConfig({
            multiFactorConfig: {
                state: 'ENABLED',
                providerConfigs: [{
                    state: 'ENABLED',
                    totpProviderConfig: { adjacentIntervals: 5 }
                }]
            }
        });
        res.send("TOTP Enabled Successfully!");
    } catch (err) {
        res.status(500).send(err.toString());
    }
});
`;

if (!content.includes('enableTOTPHack')) {
    content += injection;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Injected enableTOTPHack function");
}
