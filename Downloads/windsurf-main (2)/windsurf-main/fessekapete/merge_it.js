const fs = require('fs');
const path = require('path');

const translatedPath = 'scratch/translated_it.json';
const itLocalePath = 'stratads/stratads-dashboard/public/locales/it.json';

// Utility to set nested key
function setNested(obj, keys, val) {
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
            current[k] = {};
        }
        current = current[k];
    }
    current[keys[keys.length - 1]] = val;
}

// Deep merge
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
}

const flatTranslated = JSON.parse(fs.readFileSync(translatedPath, 'utf8'));

let currentIt = {};
if (fs.existsSync(itLocalePath)) {
    currentIt = JSON.parse(fs.readFileSync(itLocalePath, 'utf8'));
}

const unflattenedTranslated = {};

for (const [key, val] of Object.entries(flatTranslated)) {
    const parts = key.split('.');
    setNested(unflattenedTranslated, parts, val);
}

const merged = deepMerge(currentIt, unflattenedTranslated);

fs.writeFileSync(itLocalePath, JSON.stringify(merged, null, 2), 'utf8');
console.log('Successfully merged translated keys into it.json!');
