const fs = require('fs');

const inputPath = 'C:/Users/anton/.gemini/antigravity/brain/130c8eff-37b5-496d-b370-527c150812e7/scratch/to_translate_de.json';
const untranslatedEsPath = 'C:/Users/anton/.gemini/antigravity/brain/130c8eff-37b5-496d-b370-527c150812e7/scratch/untranslated_es.json';

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const untranslatedEs = JSON.parse(fs.readFileSync(untranslatedEsPath, 'utf8'));

// Filter out keys that should not be translated
const keysToTranslate = {};
const keysToKeep = {};

for (const [key, value] of Object.entries(data)) {
    if (untranslatedEs.includes(key)) {
        keysToKeep[key] = value;
    } else {
        keysToTranslate[key] = value;
    }
}

// Save keys to keep
fs.writeFileSync('C:/Users/anton/Downloads/windsurf-main (2)/windsurf-main/fessekapete/scratch/keys_to_keep_de.json', JSON.stringify(keysToKeep, null, 2));

// Split keys to translate into chunks of 150
const entriesToTranslate = Object.entries(keysToTranslate);
const chunkSize = 150;
let chunkIndex = 0;

for (let i = 0; i < entriesToTranslate.length; i += chunkSize) {
    const chunk = Object.fromEntries(entriesToTranslate.slice(i, i + chunkSize));
    fs.writeFileSync(`C:/Users/anton/Downloads/windsurf-main (2)/windsurf-main/fessekapete/scratch/chunk_${chunkIndex}.json`, JSON.stringify(chunk, null, 2));
    chunkIndex++;
}

console.log(`Generated ${chunkIndex} chunks. Total kept: ${Object.keys(keysToKeep).length}, Total to translate: ${entriesToTranslate.length}`);
