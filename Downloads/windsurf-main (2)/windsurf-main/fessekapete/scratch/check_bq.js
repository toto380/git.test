const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function testBQ() {
    try {
        const bigquery = new BigQuery({
            keyFilename: path.join(__dirname, '../functions/service-account.json') // Assumes a service account file is present, or defaults to ADC
        });
        
        const query = `SELECT COUNT(*) FROM \`crm-stratads.gtm_logs.run_googleapis_com_requests\``;
        console.log("Running query:", query);
        
        // Wait, if we are local, ADC might not work for that project if I am not logged in.
        // Let's just catch the error and print it.
        const [rows] = await bigquery.query(query);
        console.log("Success! Rows:", rows);
    } catch (e) {
        console.error("Error connecting to BigQuery:", e.message);
    }
}
testBQ();
