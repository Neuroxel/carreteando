#!/usr/bin/env python3
"""
Carretes Valpo - Scraper via Apify
====================================
Usa Apify (https://apify.com) como intermediario para scraping de Instagram.
Apify maneja proxies residenciales, rotación de IPs y autenticación de Instagram.
Sin cookies propias, sin login directo, sin checkpoint, sin rate limits (429).
"""

import os
import re
import json
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("carretes-scraper")

# ─── Config Supabase ──────────────────────────────────────────────────────────
DEFAULT_SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ."
    "nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"
)

def _clean(name: str) -> str:
    val = os.environ.get(name, "").strip().strip("\"'").strip()
    return re.sub(r"^Bearer\s+", "", val, flags=re.IGNORECASE).strip()

_url = _clean("SUPABASE_URL")
SUPABASE_URL = (_url if _url.startswith("http") else "https://hgwljbtqdserkdhulbts.supabase.co").rstrip("/")
_key = _clean("SUPABASE_SERVICE_ROLE_KEY") or _clean("SUPABASE_KEY") or _clean("SUPABASE_ANON_KEY")
SUPABASE_KEY = _key if len(_key) > 40 else DEFAULT_SUPABASE_KEY

# ─── Config Apify ─────────────────────────────────────────────────────────────
# Token seguro: se obtiene desde variable de entorno APIFY_TOKEN (Railway o .env)
APIFY_TOKEN = _clean("APIFY_TOKEN")

# Actor oficial de Apify para perfiles de Instagram
APIFY_ACTOR = "apify~instagram-profile-scraper"

# Cuentas de venues y discotecas reales de Valparaíso y alrededores
VENUE_INFO = {
    "el.huevo": {"name": "El Huevo Valparaíso", "location": "Valparaíso (Blanco 1386)"},
    "barelhuevo": {"name": "El Huevo Bar", "location": "Valparaíso (Blanco 1386)"},
    "trotamundosvalpo": {"name": "Trotamundos Terraza", "location": "Valparaíso"},
    "clubtrotaquilpue": {"name": "Trotamundos Quilpué", "location": "Quilpué"},
    "club_segundo_piso": {"name": "Club Segundo Piso", "location": "Valparaíso (Av. Brasil 1395)"},
    "mascara_valparaiso": {"name": "Máscara Valparaíso", "location": "Valparaíso (Plaza Aníbal Pinto)"},
    "paganocl": {"name": "Pagano Club Lounge", "location": "Valparaíso (Errázuriz 396)"},
    "terraza_bellavista_valpo": {"name": "Terraza Bellavista", "location": "Valparaíso (Blanco 1285)"},
}
VENUE_ACCOUNTS = list(VENUE_INFO.keys())


# ─── Supabase helpers ─────────────────────────────────────────────────────────
def _sb_request(method: str, path: str, body: Optional[dict] = None) -> Optional[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            content = r.read().decode("utf-8")
            body_json = json.loads(content) if content else {}
            return {"status": r.status, "body": body_json}
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8", errors="replace")[:200]
        log.error(f"Supabase {method} {path}: HTTP {e.code} {e.reason} — {err_text}")
        return None
    except Exception as e:
        log.error(f"Supabase error: {e}")
        return None


def test_supabase() -> bool:
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info(f"Supabase Key OK: longitud={len(SUPABASE_KEY)}")
    r = _sb_request("GET", "events?select=count")
    if r and r["status"] == 200:
        log.info("Supabase conectado OK")
        return True
    return False


def save_to_supabase(event: dict) -> bool:
    r = _sb_request("POST", "events?on_conflict=instagram_id", event)
    return bool(r and r.get("status") in (200, 201))


# ─── Apify helpers ────────────────────────────────────────────────────────────
def _apify_request(method: str, path: str, body: Optional[dict] = None) -> Optional[dict]:
    url = f"https://api.apify.com/v2/{path}"
    headers = {
        "Authorization": f"Bearer {APIFY_TOKEN}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")[:300]
        log.error(f"Apify {method} {path}: HTTP {e.code} — {body_text}")
        return None
    except Exception as e:
        log.error(f"Apify request error: {e}")
        return None


def run_apify_scraper(usernames: List[str]) -> List[dict]:
    """
    Lanza el actor apify/instagram-profile-scraper con proxies residenciales rotativos.
    """
    log.info(f"Lanzando Apify actor para {len(usernames)} perfiles: {', '.join(usernames)}")

    actor_input = {
        "usernames": usernames,
    }

    run = _apify_request(
        "POST",
        f"acts/{APIFY_ACTOR}/runs?token={APIFY_TOKEN}",
        actor_input,
    )
    if not run or "data" not in run:
        log.error("No se pudo iniciar el actor de Apify.")
        return []

    run_id = run["data"]["id"]
    dataset_id = run["data"]["defaultDatasetId"]
    log.info(f"Actor iniciado en Apify. Run ID: {run_id}")

    status = "RUNNING"
    for attempt in range(40):
        time.sleep(8)
        status_resp = _apify_request("GET", f"actor-runs/{run_id}?token={APIFY_TOKEN}")
        if not status_resp:
            continue
        status = status_resp.get("data", {}).get("status", "")
        log.info(f"  Estado Apify [{attempt+1}/40]: {status}")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break

    if status != "SUCCEEDED":
        log.error(f"Actor de Apify terminó con estado no exitoso: {status}")
        return []

    items_resp = _apify_request("GET", f"datasets/{dataset_id}/items?token={APIFY_TOKEN}&format=json&clean=true")
    if not items_resp:
        return []

    items = items_resp if isinstance(items_resp, list) else items_resp.get("items", [])
    log.info(f"Apify devolvió {len(items)} perfiles exitosamente.")
    return items


# ─── Parsear posts a formato de BD ────────────────────────────────────────────
def apify_post_to_dict(item: dict) -> Optional[Dict]:
    caption = (item.get("caption") or item.get("alt") or "").strip()
    shortcode = item.get("shortCode") or item.get("id") or ""
    username = item.get("ownerUsername") or item.get("username") or ""
    venue_name = item.get("venueName") or (f"@{username}" if username else "Valparaíso")
    venue_loc = item.get("venueLocation") or "Valparaíso"
    timestamp = item.get("timestamp") or item.get("takenAt") or ""
    image_url = item.get("displayUrl") or item.get("thumbnailUrl") or None
    likes = item.get("likesCount") or item.get("likes") or 0

    if not shortcode:
        return None

    # Título limpio a partir de la primera línea con texto
    if caption:
        lines = [l.strip() for l in caption.split("\n") if l.strip()]
        first_meaningful_line = lines[0] if lines else f"Evento en {venue_name}"
        title = first_meaningful_line[:100]
    else:
        title = f"Evento en {venue_name}"

    try:
        date_str = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        date_str = datetime.now().strftime("%Y-%m-%d")

    return {
        "instagram_id": shortcode,
        "title": title,
        "description": caption[:1000] if caption else f"Publicación oficial de {venue_name} en Instagram.",
        "date_text": date_str,
        "location": venue_loc,
        "image_url": image_url,
        "instagram_url": f"https://www.instagram.com/p/{shortcode}/",
        "username": username,
        "likes": int(likes) if likes else 0,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "apify_instagram",
        "is_active": True,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    log.info("=== Carretes Valpo Scraper (Apify Residential Backend) ===")

    if not APIFY_TOKEN:
        log.error("Error: APIFY_TOKEN no está configurado.")
        return

    if not test_supabase():
        log.error("Error: Sin conexión a Supabase.")
        return

    # Ejecutar scraping a través de la infraestructura residencial de Apify
    raw_items = run_apify_scraper(VENUE_ACCOUNTS)

    posts = []
    for item in raw_items:
        username = item.get("username", "")
        venue_meta = VENUE_INFO.get(username.lower(), {})
        venue_name = venue_meta.get("name", f"@{username}")
        venue_loc = venue_meta.get("location", "Valparaíso")

        if "latestPosts" in item and item["latestPosts"]:
            for post in item["latestPosts"]:
                post["ownerUsername"] = username
                post["venueName"] = venue_name
                post["venueLocation"] = venue_loc
                posts.append(post)
        elif item.get("shortCode") or item.get("id"):
            item["ownerUsername"] = username or item.get("ownerUsername", "")
            item["venueName"] = venue_name
            item["venueLocation"] = venue_loc
            posts.append(item)

    log.info(f"Posts extraídos en total: {len(posts)}")

    events: List[Dict] = []
    for post in posts:
        d = apify_post_to_dict(post)
        if d:
            events.append(d)

    if not events:
        log.warning("No se encontraron publicaciones para procesar.")
        return

    # Deduplicar por instagram_id
    seen = set()
    unique = []
    for ev in events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique.append(ev)

    log.info(f"Guardando/actualizando {len(unique)} eventos reales en Supabase...")
    saved = sum(1 for ev in unique if save_to_supabase(ev))
    log.info(f"Completado exitosamente: {saved}/{len(unique)} eventos guardados en Supabase.")
    log.info("=== Fin del scraping ===")


if __name__ == "__main__":
    main()
