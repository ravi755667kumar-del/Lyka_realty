with open('src/components/BrowserCallModal.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'(engineCombination|combination|earsEngine|brainEngine|voiceEngine)', text, re.IGNORECASE)]
lines = text.split('\n')
seen = set()
for idx in matches:
    line_no = text[:idx].count('\n') + 1
    if line_no not in seen:
        seen.add(line_no)
        print(f"L{line_no}: {lines[line_no-1].encode('ascii', 'ignore').decode()[:110]}")
