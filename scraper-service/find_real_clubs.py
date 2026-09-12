import requests, re

locales = [
    "el huevo valparaiso",
    "trotamundos terrazo quilpue",
    "club segundo piso valparaiso",
    "mascara valparaiso discoteca",
    "pagano club valparaiso",
    "terraza bellavista valparaiso"
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for loc in locales:
    url = f"https://www.google.com/search?q={loc.replace(' ', '+')}+instagram"
    try:
        r = requests.get(url, headers=headers, timeout=8)
        found = re.findall(r"instagram\.com/([a-zA-Z0-9_\.]+)", r.text)
        clean = [h for h in found if h not in ("p", "reel", "explore", "stories", "reels", "search", "accounts")]
        print(f"{loc}: {list(dict.fromkeys(clean))[:3]}")
    except Exception as e:
        print(f"{loc}: Error {e}")
