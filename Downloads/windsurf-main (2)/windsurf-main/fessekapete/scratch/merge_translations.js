const fs = require('fs');
const _ = require('lodash'); // Using lodash if available, or write custom deep merge

const scratchDir = 'C:/Users/anton/Downloads/windsurf-main (2)/windsurf-main/fessekapete/scratch';

// Read all translated chunks
let translated = {};
for (let i = 0; i <= 6; i++) {
    const data = JSON.parse(fs.readFileSync(`${scratchDir}/chunk_${i}_de.json`, 'utf8'));
    Object.assign(translated, data);
}

// Read keys to keep
const keysToKeep = JSON.parse(fs.readFileSync(`${scratchDir}/keys_to_keep_de.json`, 'utf8'));
Object.assign(translated, keysToKeep);

// Save the full flat translated JSON
fs.writeFileSync(`${scratchDir}/translated_de.json`, JSON.stringify(translated, null, 2));

// Helper to set nested keys from flat string "a.b.c" = value
function setDeep(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

// Deep merge into de.json
const deJsonPath = 'C:/Users/anton/Downloads/windsurf-main (2)/windsurf-main/fessekapete/stratads/stratads-dashboard/public/locales/de.json';
let deJson = {};
if (fs.existsSync(deJsonPath)) {
    deJson = JSON.parse(fs.readFileSync(deJsonPath, 'utf8'));
}

for (const [key, value] of Object.entries(translated)) {
    setDeep(deJson, key, value);
}

fs.writeFileSync(deJsonPath, JSON.stringify(deJson, null, 2));

// Log 10 translated and 5 kept for the report
const reportTranslated = Object.entries(translated).filter(([k]) => !keysToKeep[k]).slice(0, 10);
const reportKept = Object.entries(keysToKeep).slice(0, 5);

fs.writeFileSync(`${scratchDir}/report_data.json`, JSON.stringify({
    translated: reportTranslated,
    kept: reportKept,
    totalCount: Object.keys(translated).length
}, null, 2));

console.log('Merged translations and updated de.json successfully.');
