import requests, re, urllib.parse

r = requests.get("https://www.google.com/search?q=el+huevo+valparaiso+instagram", headers={"User-Agent": "Mozilla/5.0"})
urls = re.findall(r'/url\?q=(https://[^&]+)', r.text)
for u in urls:
    decoded = urllib.parse.unquote(u)
    if "instagram.com" in decoded:
        print("Real Instagram URL:", decoded)
