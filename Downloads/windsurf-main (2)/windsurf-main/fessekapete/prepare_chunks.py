import json
import os
import math

input_to_translate = r"C:\Users\anton\.gemini\antigravity\brain\130c8eff-37b5-496d-b370-527c150812e7\scratch\to_translate_it.json"
input_untranslated = r"C:\Users\anton\.gemini\antigravity\brain\130c8eff-37b5-496d-b370-527c150812e7\scratch\untranslated_es.json"

with open(input_to_translate, 'r', encoding='utf-8') as f:
    to_translate = json.load(f)

with open(input_untranslated, 'r', encoding='utf-8') as f:
    untranslated_keys = set(json.load(f))

# Filter out untranslated keys
filtered_keys = {k: v for k, v in to_translate.items() if k not in untranslated_keys}

# Also keep the untranslated ones so we can merge them later
untranslated_dict = {k: v for k, v in to_translate.items() if k in untranslated_keys}

os.makedirs('scratch_it', exist_ok=True)

with open('scratch_it/untranslated_kept.json', 'w', encoding='utf-8') as f:
    json.dump(untranslated_dict, f, indent=2, ensure_ascii=False)

# Split into 5 chunks
items = list(filtered_keys.items())
chunk_size = math.ceil(len(items) / 5)

for i in range(5):
    chunk = dict(items[i*chunk_size : (i+1)*chunk_size])
    with open(f'scratch_it/chunk_{i}.json', 'w', encoding='utf-8') as f:
        json.dump(chunk, f, indent=2, ensure_ascii=False)

print(f"Total original keys: {len(to_translate)}")
print(f"Untranslated keys kept: {len(untranslated_dict)}")
print(f"Keys to translate: {len(items)}")
print(f"Chunk size: {chunk_size}")
