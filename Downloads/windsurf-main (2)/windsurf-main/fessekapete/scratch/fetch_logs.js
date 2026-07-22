const { Logging } = require('@google-cloud/logging');
const path = require('path');

async function fetchLogs() {
    try {
        // Since we are running locally without ADC, we can't easily authenticate unless we have the service-account.json.
        // Wait, does fessekapete/functions have a service-account.json?
        // Let's check if there is an env variable or something.
        console.log("We need ADC. I'll just use the default Logging instance and see if it works.");
        
        const logging = new Logging();
        const projectId = 'crm-stratads';
        
        const filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="getmetricsbyclient"`;
        
        const [entries] = await logging.getEntries({
            filter: filter,
            pageSize: 20,
            orderBy: 'timestamp desc'
        });
        
        console.log("Logs found:", entries.length);
        entries.forEach(entry => {
            console.log(`[${entry.metadata.timestamp}] ${entry.metadata.severity}:`, entry.data);
        });
        
    } catch (e) {
        console.error("Error fetching logs:", e);
    }
}
fetchLogs();
