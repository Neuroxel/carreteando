import requests, re

queries = [
    "el huevo valparaiso instagram",
    "trotamundos terraza quilpue instagram",
    "club segundo piso valparaiso instagram",
    "pagano club valparaiso instagram",
    "living club valparaiso instagram"
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for q in queries:
    url = f"https://www.google.com/search?q={q.replace(' ', '+')}"
    r = requests.get(url, headers=headers)
    matches = re.findall(r"instagram\.com/([a-zA-Z0-9_\.]+)", r.text)
    clean = [m for m in matches if m not in ("p", "reel", "explore", "stories", "reels", "search", "accounts")]
    unique = list(dict.fromkeys(clean))
    print(f"{q} => {unique[:4]}")
