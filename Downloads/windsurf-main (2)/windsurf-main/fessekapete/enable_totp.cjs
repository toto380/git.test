const admin = require('firebase-admin');

// Initialize with default credentials
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'crm-stratads'
});

async function enableTOTP() {
  try {
    const auth = admin.auth();
    
    // Try to update MFA configuration
    await auth.projectConfigManager().updateProjectConfig({
      multiFactorConfig: {
        state: 'ENABLED',
        providerConfigs: [
          {
            state: 'ENABLED',
            totpProviderConfig: {
              adjacentIntervals: 5
            }
          }
        ]
      }
    });
    console.log("MFA TOTP Successfully Enabled via Admin SDK!");
  } catch (error) {
    console.error("Error updating config:", error);
  }
}

enableTOTP();
