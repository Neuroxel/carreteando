#!/usr/bin/env python3
"""
Carretes Valpo - Araña Agresiva de Joyitas & Eventos Under
===========================================================
Scraper de alta agresividad para cazar:
- Joyitas ocultas y spots secretos en Valparaíso y alrededores
- Raves clandestinas, ciclos de techno oscuro y microclubbing
- Tocatas punk/rock/post-punk autogestionadas y acústicos
- Eventos queer, drag, casonas culturales y ferias nocturnas
- Graph expansion: extrae y descubre nuevas productoras y DJs vía menciones
"""

import os
import re
import json
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("arana-agresiva")

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
APIFY_TOKEN = _clean("APIFY_TOKEN")
APIFY_ACTOR = "apify~instagram-profile-scraper"

# ─── Circuitos de Monitoreo: Masivos, Under, Raves y Casonas ─────────────────
VENUE_INFO = {
    # Tier 1: Multiespacios y Clubes Míticos
    "el.huevo": {"name": "El Huevo Valparaíso", "location": "Valparaíso (Blanco 1386)", "tier": "mainstream"},
    "barelhuevo": {"name": "El Huevo Bar", "location": "Valparaíso (Blanco 1386)", "tier": "mainstream"},
    "trotamundosvalpo": {"name": "Trotamundos Terraza", "location": "Valparaíso", "tier": "mainstream"},
    "clubtrotaquilpue": {"name": "Trotamundos Quilpué", "location": "Quilpué", "tier": "mainstream"},
    "terraza_bellavista_valpo": {"name": "Terraza Bellavista", "location": "Valparaíso (Blanco 1285)", "tier": "mainstream"},

    # Tier 2: Underground, Post-Punk, Queer & Microclubbing
    "club_segundo_piso": {"name": "Club Segundo Piso", "location": "Valparaíso (Av. Brasil 1395)", "tier": "under"},
    "mascara_valparaiso": {"name": "Máscara Valparaíso", "location": "Valparaíso (Plaza Aníbal Pinto)", "tier": "under"},
    "paganocl": {"name": "Pagano Club Lounge", "location": "Valparaíso (Errázuriz 396)", "tier": "under"},
    "espaciowarhola": {"name": "Espacio Warhola", "location": "Valparaíso (Esmeralda)", "tier": "under"},
    "sala_rivoli": {"name": "Sala Rívoli", "location": "Valparaíso (Condell)", "tier": "under"},
    "canchavalpo": {"name": "Cancha Valparaíso", "location": "Valparaíso", "tier": "under"},
    "barcivico": {"name": "Bar Cívico", "location": "Valparaíso (Blanco)", "tier": "under"},
    "barlaplaya": {"name": "Bar La Playa", "location": "Valparaíso (Serrano)", "tier": "under"},
    "elrincondelasguitarras": {"name": "El Rincón de las Guitarras", "location": "Valparaíso", "tier": "under"},

    # Tier 3: Colectivos Rave, Darkwave, Techno & Tocatas Ocultas
    "valparaiso_techno": {"name": "Valparaíso Techno Clandestino", "location": "Spot Secreto / Valparaíso", "tier": "joyita"},
    "baptism_producciones": {"name": "Baptism Producciones Under", "location": "Valparaíso Under", "tier": "joyita"},
    "distorsionsonora": {"name": "Distorsión Sonora Raves", "location": "Rave Clandestina / Valparaíso", "tier": "joyita"},
    "the.house._": {"name": "The House Underground", "location": "Spot Secreto / Valpo", "tier": "joyita"},
    "club.voyager": {"name": "Club Voyager Electrónica", "location": "Valparaíso", "tier": "joyita"},
    "insomnia_teatro_condell": {"name": "Teatro Condell Insomnia", "location": "Condell 1585, Valparaíso", "tier": "cultura"},
    "parqueculturaldevalparaiso": {"name": "Parque Cultural ex Cárcel", "location": "Cárcel 471, Cerro Cárcel", "tier": "cultura"},
}

VENUE_ACCOUNTS = list(VENUE_INFO.keys())


# ─── Supabase Helpers ─────────────────────────────────────────────────────────
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
        with urllib.request.urlopen(req, timeout=25) as r:
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
    r = _sb_request("GET", "events?select=count")
    return bool(r and r.get("status") == 200)


def save_to_supabase(event: dict) -> bool:
    r = _sb_request("POST", "events?on_conflict=instagram_id", event)
    return bool(r and r.get("status") in (200, 201))


# ─── Apify Helpers ────────────────────────────────────────────────────────────
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


def run_apify_batch(usernames: List[str]) -> List[dict]:
    """
    Ejecuta un lote de perfiles a través del actor de Apify con proxies residenciales.
    """
    log.info(f"🕷️ Araña lanzando rastreo para {len(usernames)} perfiles...")
    run = _apify_request(
        "POST",
        f"acts/{APIFY_ACTOR}/runs?token={APIFY_TOKEN}",
        {"usernames": usernames},
    )
    if not run or "data" not in run:
        log.error("No se pudo iniciar el actor de Apify.")
        return []

    run_id = run["data"]["id"]
    dataset_id = run["data"]["defaultDatasetId"]
    log.info(f"Rastreo iniciado en Apify. Run ID: {run_id}")

    for attempt in range(40):
        time.sleep(7)
        status_resp = _apify_request("GET", f"actor-runs/{run_id}?token={APIFY_TOKEN}")
        if not status_resp:
            continue
        status = status_resp.get("data", {}).get("status", "")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break

    if status != "SUCCEEDED":
        log.error(f"Actor terminó con estado: {status}")
        return []

    items_resp = _apify_request("GET", f"datasets/{dataset_id}/items?token={APIFY_TOKEN}&format=json&clean=true")
    if not items_resp:
        return []

    items = items_resp if isinstance(items_resp, list) else items_resp.get("items", [])
    log.info(f"Apify extrajo datos de {len(items)} cuentas.")
    return items


# ─── Detector de Joyitas, Rareza y Clandestinidad ──────────────────────────────
def analyze_gem_and_source(caption: str, username: str, tier: str) -> Tuple[str, int]:
    text = f"{caption} {username}".lower()
    score = 0

    # Factores de secretismo y exclusividad under
    secret_triggers = [
        "spot secreto", "ubicación por dm", "por interno", "dirección por interno",
        "aporte voluntario", "al sobre", "galpón", "casona", "capacidad limitada",
        "preventa por dm", "feria gráfica", "barra popular", "reserva al interno",
        "clandestin", "after"
    ]
    for st in secret_triggers:
        if st in text:
            score += 25

    # Estilos musicales under / contracultura
    under_genres = [
        "darkwave", "post punk", "post-punk", "ebm", "industrial", "hard techno",
        "acid", "dark techno", "psytrance", "psytribe", "vinilos", "live act",
        "b2b", "tocata", "punk", "hardcore", "drag", "queer", "disidente",
        "fonda dark", "performance"
    ]
    for ug in under_genres:
        if ug in text:
            score += 20

    if tier in ("joyita", "under"):
        score += 30

    if score >= 45 or tier == "joyita":
        source = "joyita_under"
    elif any(k in text for k in ["techno", "rave", "house", "acid"]):
        source = "rave_techno"
    elif any(k in text for k in ["tocata", "punk", "rock", "banda", "tributo"]):
        source = "tocata_porteña"
    else:
        source = "apify_instagram"

    return source, min(score, 100)


def extract_discovered_mentions(raw_items: List[dict]) -> List[str]:
    """
    Graph Expansion: Descubre nuevas cuentas colaboradoras mencionadas en los flyers y captions.
    """
    discovered = set()
    keywords = [
        "productora", "techno", "club", "espacio", "tributo", "rave",
        "fonda", "dark", "house", "under", "dj", "banda", "colectivo"
    ]
    for it in raw_items:
        for p in it.get("latestPosts", []):
            cap = p.get("caption") or ""
            mentions = re.findall(r"@([a-zA-Z0-9_\.]{3,30})", cap)
            for m in mentions:
                m_low = m.lower().rstrip(".")
                if any(k in m_low for k in keywords) and m_low not in VENUE_INFO:
                    discovered.add(m_low)

    return sorted(list(discovered))


# ─── Parsear Post a Evento de Supabase ─────────────────────────────────────────
def apify_post_to_event(item: dict) -> Optional[Dict]:
    caption = (item.get("caption") or item.get("alt") or "").strip()
    shortcode = item.get("shortCode") or item.get("id") or ""
    username = item.get("ownerUsername") or item.get("username") or ""
    venue_name = item.get("venueName") or (f"@{username}" if username else "Valparaíso")
    venue_loc = item.get("venueLocation") or "Valparaíso"
    tier = item.get("venueTier") or "mainstream"
    timestamp = item.get("timestamp") or item.get("takenAt") or ""
    image_url = item.get("displayUrl") or item.get("thumbnailUrl") or None
    likes = item.get("likesCount") or item.get("likes") or 0

    if not shortcode:
        return None

    # Detectar nivel de joyita y categorización agresiva
    source, gem_score = analyze_gem_and_source(caption, username, tier)

    # Título limpio a partir de la primera línea representativa
    if caption:
        lines = [l.strip() for l in caption.split("\n") if l.strip()]
        first_line = lines[0] if lines else f"Evento en {venue_name}"
        title = first_line[:110]
    else:
        title = f"Evento en {venue_name}"

    # Prefix estético si es Joyita Under
    if source == "joyita_under" and not any(title.startswith(prefix) for prefix in ["💎", "🔥", "🔊"]):
        title = f"💎 {title}"

    try:
        date_str = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        date_str = datetime.now().strftime("%Y-%m-%d")

    return {
        "instagram_id": shortcode,
        "title": title[:130],
        "description": caption[:1000] if caption else f"Publicación oficial de {venue_name} en Instagram.",
        "date_text": date_str,
        "location": venue_loc,
        "image_url": image_url,
        "instagram_url": f"https://www.instagram.com/p/{shortcode}/",
        "username": username,
        "likes": int(likes) if likes else 0,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "is_active": True,
    }


# ─── Main Araña Agresiva ───────────────────────────────────────────────────────
def main():
    log.info("=== 🕷️ Carretes Valpo: Araña Agresiva de Joyitas & Under ===")

    if not APIFY_TOKEN:
        log.error("Error: APIFY_TOKEN no configurado en Railway ni en .env.")
        return

    if not test_supabase():
        log.error("Error: Sin conexión a Supabase.")
        return

    # Dividir cuentas en lotes para máxima estabilidad
    accounts = VENUE_ACCOUNTS
    batch_size = 12
    batches = [accounts[i:i + batch_size] for i in range(0, len(accounts), batch_size)]

    all_raw_items = []
    for idx, batch in enumerate(batches, 1):
        log.info(f"Ejecutando lote {idx}/{len(batches)} ({len(batch)} cuentas)...")
        items = run_apify_batch(batch)
        all_raw_items.extend(items)

    log.info(f"Total perfiles procesados por la araña: {len(all_raw_items)}")

    # Graph expansion: descubrir colaboraciones
    discovered = extract_discovered_mentions(all_raw_items)
    if discovered:
        log.info(f"🕸️ Nodos under descubiertos para futuro rastreo: {discovered}")

    # Extraer publicaciones
    posts = []
    for item in all_raw_items:
        username = item.get("username", "")
        meta = VENUE_INFO.get(username.lower(), {})
        venue_name = meta.get("name", f"@{username}")
        venue_loc = meta.get("location", "Valparaíso")
        venue_tier = meta.get("tier", "mainstream")

        if "latestPosts" in item and item["latestPosts"]:
            for post in item["latestPosts"]:
                post["ownerUsername"] = username
                post["venueName"] = venue_name
                post["venueLocation"] = venue_loc
                post["venueTier"] = venue_tier
                posts.append(post)
        elif item.get("shortCode") or item.get("id"):
            item["ownerUsername"] = username or item.get("ownerUsername", "")
            item["venueName"] = venue_name
            item["venueLocation"] = venue_loc
            item["venueTier"] = venue_tier
            posts.append(item)

    log.info(f"Publicaciones totales extraídas: {len(posts)}")

    events: List[Dict] = []
    for post in posts:
        ev = apify_post_to_event(post)
        if ev:
            events.append(ev)

    if not events:
        log.warning("No se encontraron publicaciones para guardar.")
        return

    # Deduplicar por instagram_id
    seen = set()
    unique = []
    for ev in events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique.append(ev)

    joyitas_count = sum(1 for e in unique if e.get("source") == "joyita_under")
    log.info(f"💎 Joyitas y eventos under detectados: {joyitas_count}/{len(unique)}")

    log.info(f"Guardando/actualizando {len(unique)} eventos en Supabase...")
    saved = sum(1 for ev in unique if save_to_supabase(ev))
    log.info(f"Sincronización completa: {saved}/{len(unique)} eventos guardados.")
    log.info("=== Fin del rastreo agresivo ===")


if __name__ == "__main__":
    main()
