with open(r"C:\Users\marmo\.gemini\antigravity-ide\brain\14ed6041-f693-42ce-9d71-2fb31d38b811\.system_generated\steps\659\content.md", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

import re
titles = re.findall(r'<title[^>]*>(.*?)</title>', text)
og_titles = re.findall(r'<meta property="og:title" content="([^"]+)"', text)
og_descs = re.findall(r'<meta property="og:description" content="([^"]+)"', text)
print("Title:", titles)
print("OG Title:", og_titles)
print("OG Desc:", og_descs)
