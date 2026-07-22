import json
import os
import time
from deep_translator import GoogleTranslator

TERMS = ["First-Party", "Server-Side", "Consent Mode", "GTM", "Bypass ITP", "Cloud Run", "GFE", "First-Party Data"]

def protect_terms(text):
    for i, term in enumerate(TERMS):
        text = text.replace(term, f"___{i}___")
    return text

def restore_terms(text):
    for i, term in enumerate(TERMS):
        text = text.replace(f"___{i}___", term)
    return text

os.makedirs('scratch', exist_ok=True)

with open('scratch_it/untranslated_kept.json', 'r', encoding='utf-8') as f:
    untranslated_kept = json.load(f)

translated = {}
translator = GoogleTranslator(source='fr', target='it')

def translate_val(val):
    if isinstance(val, str):
        if not val.strip():
            return val
        protected_text = protect_terms(val)
        for attempt in range(3):
            try:
                it_text = translator.translate(protected_text)
                if it_text is None:
                    continue
                return restore_terms(it_text)
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(2)
        return val
    elif isinstance(val, dict):
        return {k: translate_val(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [translate_val(v) for v in val]
    else:
        return val

for i in range(5):
    with open(f'scratch_it/chunk_{i}.json', 'r', encoding='utf-8') as f:
        chunk = json.load(f)
    print(f"Translating chunk {i} with {len(chunk)} keys...")
    for key, val in chunk.items():
        translated[key] = translate_val(val)

# Merge all
final_it = {**translated, **untranslated_kept}

# Save final
with open('scratch/translated_it.json', 'w', encoding='utf-8') as f:
    json.dump(final_it, f, indent=2, ensure_ascii=False)
    
print(f"Done! Translated keys: {len(translated)}, Untranslated kept: {len(untranslated_kept)}")
