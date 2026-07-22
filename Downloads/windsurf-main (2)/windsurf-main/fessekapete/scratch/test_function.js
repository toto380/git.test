const https = require('https');

const data = JSON.stringify({
  data: {
    domain: "statistiques.stratads.fr"
  }
});

const options = {
  hostname: 'europe-west3-crm-stratads.cloudfunctions.net',
  port: 443,
  path: '/getMetricsByClientV1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  let body = '';
  res.on('data', d => {
    body += d;
  });
  res.on('end', () => {
    console.log(body);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
