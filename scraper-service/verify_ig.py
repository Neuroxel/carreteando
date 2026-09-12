import requests, re

cuentas = [
    "elhuevovalpo", "elhuevovalparaiso", "trotamundosquilpue", "trotamundosterraza",
    "clubsegundopiso", "mascaravalpo", "paganoclubvalpo", "elrinconartesanal",
    "subidaecuador", "livingclubvalpo"
]

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
})

for c in cuentas:
    try:
        r = s.get(f"https://www.instagram.com/{c}/", timeout=8)
        og_title = re.search(r'<meta property="og:title" content="([^"]+)"', r.text)
        og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', r.text)
        title = og_title.group(1) if og_title else "No og:title"
        desc = og_desc.group(1) if og_desc else ""
        if "Page Not Found" in r.text or "La pagina no esta disponible" in r.text or "isn't available" in r.text:
            print(f"[NO EXISTE] @{c}")
        else:
            clean_title = title.encode('ascii', 'ignore').decode('ascii')
            clean_desc = desc[:60].encode('ascii', 'ignore').decode('ascii')
            print(f"[OK] @{c}: {clean_title} | {clean_desc}")
    except Exception as e:
        print(f"[ERROR] @{c}: {e}")
