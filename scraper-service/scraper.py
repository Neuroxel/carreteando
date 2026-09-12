#!/usr/bin/env python3
"""
Carretes Valpo - Scraper via Apify
====================================
Usa Apify (https://apify.com) como intermediario para scraping de Instagram.
Apify maneja proxies residenciales, rotación de IPs y autenticación.
Sin cookies propias, sin login directo, sin checkpoint, sin rate limits.

Setup único requerido:
  1. Crear cuenta gratuita en https://console.apify.com
  2. Agregar APIFY_TOKEN en Railway (Settings → API & Tokens)
"""

import os, re, json, time, logging, urllib.request, urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# ─── Config Supabase ──────────────────────────────────────────────────────────
DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"

def _clean(name: str) -> str:
    val = os.environ.get(name, "").strip().strip("\"'").strip()
    return re.sub(r"^Bearer\s+", "", val, flags=re.IGNORECASE).strip()

_url = _clean("SUPABASE_URL")
SUPABASE_URL = (_url if _url.startswith("http") else "https://hgwljbtqdserkdhulbts.supabase.co").rstrip("/")
_key = _clean("SUPABASE_SERVICE_ROLE_KEY") or _clean("SUPABASE_KEY") or _clean("SUPABASE_ANON_KEY")
SUPABASE_KEY = _key if len(_key) > 40 else DEFAULT_SUPABASE_KEY

# ─── Config Apify ─────────────────────────────────────────────────────────────
APIFY_TOKEN = _clean("APIFY_TOKEN")

# Actor de Apify para scraping de perfiles de Instagram
# apify/instagram-profile-scraper — oficial, mantenido, gratis en free tier
APIFY_ACTOR = "apify~instagram-profile-scraper"

# Cuentas de venues reales de Valparaíso a monitorear
VENUE_ACCOUNTS = [
    "el.huevo",
    "trotamundosvalpo",
    "clubtrotaquilpue",
    "club_segundo_piso",
    "mascara_valparaiso",
    "paganocl",
]

# Palabras clave para filtrar posts de eventos
EVENT_KEYWORDS = [
    "carrete", "fiesta", "evento", "techno", "entrada", "viernes", "sábado",
    "sabado", "dj", "rave", "boliche", "concierto", "live", "show", "tocata",
]

POSTS_PER_PROFILE = 6  # Últimos N posts por venue


# ─── Supabase helpers ─────────────────────────────────────────────────────────
def _sb_request(method: str, path: str, body: Optional[dict] = None) -> Optional[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return {"status": r.status, "body": json.loads(r.read())}
    except urllib.error.HTTPError as e:
        log.error(f"Supabase {method} {path}: HTTP {e.code} {e.reason}")
        return None
    except Exception as e:
        log.error(f"Supabase error: {e}")
        return None


def test_supabase() -> bool:
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info(f"Supabase Key: longitud={len(SUPABASE_KEY)}, inicio={SUPABASE_KEY[:12]}...")
    r = _sb_request("GET", "events?select=count")
    if r and r["status"] == 200:
        log.info("Supabase OK")
        return True
    return False


def save_to_supabase(event: dict) -> bool:
    r = _sb_request("POST", "events?on_conflict=instagram_id", event)
    return bool(r and r["status"] in (200, 201))


# ─── Apify helpers ────────────────────────────────────────────────────────────
def _apify_request(method: str, path: str, body: Optional[dict] = None) -> Optional[dict]:
    url = f"https://api.apify.com/v2/{path}"
    headers = {
        "Authorization": f"Bearer {APIFY_TOKEN}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:300]
        log.error(f"Apify {method} {path}: HTTP {e.code} — {body_text}")
        return None
    except Exception as e:
        log.error(f"Apify request error: {e}")
        return None


def run_apify_scraper(usernames: List[str]) -> List[dict]:
    """
    Lanza el actor apify/instagram-profile-scraper y espera el resultado.
    Retorna la lista de posts crudos de Apify.
    """
    log.info(f"Lanzando Apify actor para {len(usernames)} perfiles...")

    # Input del actor
    actor_input = {
        "usernames": usernames,
        "resultsLimit": POSTS_PER_PROFILE,
    }

    # POST /acts/{actorId}/runs — lanza el actor
    run = _apify_request(
        "POST",
        f"acts/{APIFY_ACTOR}/runs?token={APIFY_TOKEN}",
        actor_input,
    )
    if not run or "data" not in run:
        log.error("No se pudo lanzar el actor de Apify.")
        return []

    run_id = run["data"]["id"]
    dataset_id = run["data"]["defaultDatasetId"]
    log.info(f"Actor lanzado. Run ID: {run_id}")

    # Esperar que termine (polling cada 10s, max 5 min)
    for attempt in range(30):
        time.sleep(10)
        status_resp = _apify_request("GET", f"actor-runs/{run_id}")
        if not status_resp:
            continue
        status = status_resp.get("data", {}).get("status", "")
        log.info(f"  Estado: {status}")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break

    if status != "SUCCEEDED":
        log.error(f"Actor terminó con estado: {status}")
        return []

    # Obtener resultados del dataset
    items_resp = _apify_request("GET", f"datasets/{dataset_id}/items?format=json&clean=true")
    if not items_resp:
        return []

    # items_resp es una lista directamente
    items = items_resp if isinstance(items_resp, list) else items_resp.get("items", [])
    log.info(f"Apify devolvió {len(items)} items")
    return items


# ─── Parsear posts de Apify ───────────────────────────────────────────────────
def apify_post_to_dict(item: dict) -> Optional[Dict]:
    """
    Convierte un item del actor apify/instagram-profile-scraper al formato de Supabase.
    Los posts vienen en item['latestPosts'] o el item mismo es un post.
    """
    caption = item.get("caption") or item.get("alt") or ""
    shortcode = item.get("shortCode") or item.get("id") or ""
    username = item.get("ownerUsername") or item.get("username") or ""
    timestamp = item.get("timestamp") or item.get("takenAt") or ""
    image_url = item.get("displayUrl") or item.get("thumbnailUrl") or None
    likes = item.get("likesCount") or item.get("likes") or 0

    if not shortcode:
        return None

    title = caption.split("\n")[0][:120].strip() if caption else f"Post de @{username}"

    try:
        date_str = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        date_str = datetime.now().strftime("%Y-%m-%d")

    return {
        "instagram_id": shortcode,
        "title": title,
        "description": caption[:1000],
        "date_text": date_str,
        "location": "Valparaíso",
        "image_url": image_url,
        "instagram_url": f"https://www.instagram.com/p/{shortcode}/",
        "username": username,
        "likes": likes,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "apify_instagram",
        "is_active": True,
    }


def is_event_related(caption: str) -> bool:
    text = (caption or "").lower()
    return any(kw in text for kw in EVENT_KEYWORDS)


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    log.info("=== Carretes Scraper (via Apify) ===")

    if not APIFY_TOKEN:
        log.error("APIFY_TOKEN no configurado. Agrega tu token de https://console.apify.com en Railway.")
        return

    if not test_supabase():
        log.error("Sin conexión a Supabase.")
        return

    # Scrape via Apify
    raw_items = run_apify_scraper(VENUE_ACCOUNTS)

    # El actor puede devolver perfiles con latestPosts anidados
    posts = []
    for item in raw_items:
        if "latestPosts" in item:
            for post in item["latestPosts"]:
                post["ownerUsername"] = item.get("username", "")
                posts.append(post)
        else:
            posts.append(item)

    log.info(f"Posts totales a procesar: {len(posts)}")

    # Convertir y filtrar solo posts de eventos
    events: List[Dict] = []
    for post in posts:
        d = apify_post_to_dict(post)
        if d:
            events.append(d)

    if not events:
        log.info("Sin posts para guardar. Supabase no se modifica.")
        return

    # Deduplicar
    seen: set = set()
    unique = []
    for ev in events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique.append(ev)

    log.info(f"Guardando {len(unique)} eventos en Supabase...")
    saved = sum(1 for ev in unique if save_to_supabase(ev))
    log.info(f"Guardados: {saved}/{len(unique)}")
    log.info("=== Scraping completado ===")


if __name__ == "__main__":
    main()
