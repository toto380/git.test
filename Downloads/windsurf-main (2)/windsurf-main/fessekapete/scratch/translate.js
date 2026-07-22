const fs = require('fs');
const { translate } = require('@vitalets/google-translate-api');

async function main() {
    const toTranslatePath = 'C:\\Users\\anton\\.gemini\\antigravity\\brain\\130c8eff-37b5-496d-b370-527c150812e7\\scratch\\to_translate_pt.json';
    const untranslatedEsPath = 'C:\\Users\\anton\\.gemini\\antigravity\\brain\\130c8eff-37b5-496d-b370-527c150812e7\\scratch\\untranslated_es.json';
    const outputPath = 'C:\\Users\\anton\\.gemini\\antigravity\\brain\\12a30f67-4585-454c-b318-37973488c835\\scratch\\translated_pt.json';

    if (!fs.existsSync('C:\\Users\\anton\\.gemini\\antigravity\\brain\\12a30f67-4585-454c-b318-37973488c835\\scratch')) {
        fs.mkdirSync('C:\\Users\\anton\\.gemini\\antigravity\\brain\\12a30f67-4585-454c-b318-37973488c835\\scratch', { recursive: true });
    }

    const toTranslate = JSON.parse(fs.readFileSync(toTranslatePath, 'utf8'));
    const untranslatedEs = JSON.parse(fs.readFileSync(untranslatedEsPath, 'utf8'));

    const terms = [
        "First-Party", "Server-Side", "Consent Mode", "GTM", "Bypass ITP", 
        "Cloud Run", "Google Tag Manager", "Adblockers", "ITP", "ETP", "CDN", 
        "Stripe", "Stripe Connect", "First-Party Data", "GFE"
    ];

    const protectTerm = (text) => {
        let res = text;
        terms.forEach((t, i) => {
            const regex = new (RegExp)(t, 'gi');
            res = res.replace(regex, `__TERM${i}__`);
        });
        return res;
    };

    const restoreTerm = (text) => {
        let res = text;
        terms.forEach((t, i) => {
            const regex = new RegExp(`__TERM${i}__`, 'g');
            res = res.replace(regex, t);
        });
        return res;
    };

    const translatedPt = {};
    const keys = Object.keys(toTranslate);
    console.log(`Starting translation of ${keys.length} keys...`);

    // We can do it in batches to avoid API rate limits
    const batchSize = 50;
    
    for (let i = 0; i < keys.length; i += batchSize) {
        const batchKeys = keys.slice(i, i + batchSize);
        console.log(`Processing batch ${i} to ${i + batchSize}...`);
        
        await Promise.all(batchKeys.map(async (key) => {
            if (untranslatedEs.includes(key)) {
                translatedPt[key] = toTranslate[key];
                return;
            }
            
            let val = toTranslate[key];
            if (typeof val !== 'string') {
                translatedPt[key] = val;
                return;
            }
            if (!val.trim()) {
                translatedPt[key] = val;
                return;
            }

            try {
                let protectedText = protectTerm(val);
                const { text } = await translate(protectedText, { to: 'pt' });
                translatedPt[key] = restoreTerm(text);
            } catch (e) {
                console.error(`Error translating key ${key}: ${e.message}`);
                // fallback to original if API fails
                translatedPt[key] = toTranslate[key];
            }
        }));
        
        // Wait 2s between batches
        await new Promise(r => setTimeout(r, 2000));
    }

    fs.writeFileSync(outputPath, JSON.stringify(translatedPt, null, 2));
    console.log(`Translations saved to ${outputPath}`);
    
    // Now merge into pt.json
    const ptJsonPath = 'C:\\Users\\anton\\Downloads\\windsurf-main (2)\\windsurf-main\\fessekapete\\stratads\\stratads-dashboard\\public\\locales\\pt.json';
    let ptJson = {};
    if (fs.existsSync(ptJsonPath)) {
        ptJson = JSON.parse(fs.readFileSync(ptJsonPath, 'utf8'));
    }
    
    // Helper to deeply set value
    const setDeep = (obj, path, value) => {
        const parts = path.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    };

    Object.keys(translatedPt).forEach(k => {
        setDeep(ptJson, k, translatedPt[k]);
    });

    fs.writeFileSync(ptJsonPath, JSON.stringify(ptJson, null, 2));
    console.log('Successfully merged into stratads-dashboard/public/locales/pt.json');
}

main().catch(console.error);
