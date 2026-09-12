#!/usr/bin/env python3
"""
Carretes Valpo - Instagram Scraper
Extrae eventos reales desde Instagram y los guarda en Supabase.
Si no encuentra nada, no guarda nada. Sin datos por defecto.
"""

import os, re, time, logging, json, urllib.request, urllib.error
from datetime import datetime, timezone
from typing import List, Dict
from instagrapi import Client
from instagrapi.exceptions import RateLimitError, ChallengeRequired, BadPassword, TwoFactorRequired

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# ─── Configuración Supabase ───────────────────────────────────────────────────
DEFAULT_SUPABASE_URL = "https://hgwljbtqdserkdhulbts.supabase.co"
DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"

def clean_value(val):
    if not val:
        return ""
    v = val.strip().strip("\"'").strip()
    return re.sub(r"^Bearer\s+", "", v, flags=re.IGNORECASE).strip()

raw_url = clean_value(os.environ.get("SUPABASE_URL", "")).rstrip("/")
SUPABASE_URL = raw_url if raw_url.startswith("http") else DEFAULT_SUPABASE_URL

detected_key = ""
for var_name in ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]:
    val = clean_value(os.environ.get(var_name))
    if val and not val.startswith("your-") and len(val) > 40:
        detected_key = val
        break
SUPABASE_KEY = detected_key if detected_key else DEFAULT_SUPABASE_KEY

IG_USERNAME = clean_value(os.environ.get("IG_USERNAME", ""))
IG_PASSWORD = clean_value(os.environ.get("IG_PASSWORD", ""))
IG_SESSIONID = clean_value(os.environ.get("IG_SESSIONID", ""))

# Hashtags a rastrear para encontrar eventos reales
HASHTAGS = [
    "carretesvalpo",
    "carretesvalparaiso",
    "fiestasvalparaiso",
    "carretesviña",
    "fiestasviña",
    "carretesreñaca",
    "carretequilpue",
    "fiestasquintaregion",
    "undervalpo",
]

# Palabras clave que indican que un post es sobre un evento
EVENT_KEYWORDS = [
    "carrete", "fiesta", "evento", "techno", "entrada", "viernes", "sábado",
    "sabado", "tonight", "club", "dj", "set", "rave", "boliche", "antro",
    "concierto", "live", "show", "presentación",
]

# ─── Supabase helpers ─────────────────────────────────────────────────────────
def test_supabase_connection() -> bool:
    url = f"{SUPABASE_URL}/rest/v1/events?select=count"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            log.info(f"Conexión con Supabase exitosa! Status: {resp.status}")
            return True
    except Exception as e:
        log.error(f"Error conectando a Supabase: {e}")
        return False


def save_event_to_supabase(event_dict: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/events?on_conflict=instagram_id"
    payload = json.dumps(event_dict).encode("utf-8")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        log.error(f"Error guardando evento {event_dict.get('instagram_id')}: {e}")
        return False


# ─── Instagram scraping ───────────────────────────────────────────────────────
def build_client() -> Client:
    cl = Client()
    cl.delay_range = [2, 5]
    return cl


def login(cl: Client) -> bool:
    """Intenta iniciar sesión por cualquier método disponible."""
    # 1. Session ID cookie
    if IG_SESSIONID:
        try:
            cl.login_by_sessionid(IG_SESSIONID)
            log.info("Sesión iniciada via sessionid")
            return True
        except Exception as e:
            log.warning(f"sessionid falló: {e}")

    # 2. Usuario + contraseña
    if IG_USERNAME and IG_PASSWORD:
        try:
            cl.login(IG_USERNAME, IG_PASSWORD)
            log.info(f"Sesión iniciada como {IG_USERNAME}")
            return True
        except (BadPassword, TwoFactorRequired, ChallengeRequired) as e:
            log.error(f"Login fallido: {e}")
        except Exception as e:
            log.warning(f"Login error: {e}")

    log.error("No se pudo iniciar sesión en Instagram. Configura IG_SESSIONID o IG_USERNAME/IG_PASSWORD.")
    return False


def is_event_post(caption: str) -> bool:
    text = caption.lower()
    return any(kw in text for kw in EVENT_KEYWORDS)


def scrape_hashtags(cl: Client) -> List[Dict]:
    """Extrae posts reales de hashtags de eventos en Valparaíso."""
    results = []
    for tag in HASHTAGS:
        try:
            log.info(f"Rastreando #{tag}...")
            items, _ = cl.hashtag_medias_v1_chunk(tag, max_amount=8, tab_key="top")
            for it in items:
                caption = it.caption_text or ""
                if not is_event_post(caption):
                    continue
                title = caption.split("\n")[0][:120].strip()
                if not title:
                    title = f"Evento #{tag}"
                results.append({
                    "instagram_id": str(it.pk),
                    "title": title,
                    "description": caption[:1000],
                    "date_text": datetime.now().strftime("%Y-%m-%d"),
                    "location": "Valparaíso",
                    "image_url": str(it.thumbnail_url) if it.thumbnail_url else None,
                    "instagram_url": f"https://www.instagram.com/p/{it.code}/",
                    "username": it.user.username,
                    "likes": it.like_count or 0,
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "source": "instagram_hashtag",
                    "is_active": True,
                })
            time.sleep(2)
        except RateLimitError:
            log.warning(f"Rate limit en #{tag}. Esperando 60s...")
            time.sleep(60)
        except Exception as e:
            log.warning(f"Error en #{tag}: {e}")
            time.sleep(3)
    return results


def scrape_venue_accounts(cl: Client) -> List[Dict]:
    """
    Extrae posts recientes de cuentas de locales reales en Valparaíso.
    Solo incluye cuentas que efectivamente existan y tengan posts públicos.
    """
    # Handles de locales de Valparaíso y V Región que se pueden verificar
    venue_handles = [
        "el.huevo",
        "trotamundosvalpo",
        "clubtrotaquilpue",
        "club_segundo_piso",
        "mascara_valparaiso",
        "paganocl",
    ]

    results = []
    for handle in venue_handles:
        try:
            log.info(f"Revisando perfil @{handle}...")
            user_id = cl.user_id_from_username(handle)
            medias = cl.user_medias(user_id, amount=3)
            for media in medias:
                caption = media.caption_text or ""
                title = caption.split("\n")[0][:120].strip()
                if not title:
                    title = f"Evento en @{handle}"
                results.append({
                    "instagram_id": str(media.pk),
                    "title": title,
                    "description": caption[:1000],
                    "date_text": media.taken_at.strftime("%Y-%m-%d") if media.taken_at else datetime.now().strftime("%Y-%m-%d"),
                    "location": "Valparaíso",
                    "image_url": str(media.thumbnail_url) if media.thumbnail_url else None,
                    "instagram_url": f"https://www.instagram.com/p/{media.code}/",
                    "username": handle,
                    "likes": media.like_count or 0,
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "source": "instagram_venue",
                    "is_active": True,
                })
            time.sleep(3)
        except Exception as e:
            log.warning(f"No se pudo obtener posts de @{handle}: {e}")
            time.sleep(2)

    return results


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    log.info("=== Carretes Scraper iniciando ===")
    log.info(f"Supabase URL: {SUPABASE_URL}")

    if not test_supabase_connection():
        log.error("Abortando: sin conexión a Supabase.")
        return

    cl = build_client()
    if not login(cl):
        log.error("Abortando: sin sesión de Instagram.")
        return

    all_events: List[Dict] = []

    # Extraer de hashtags
    hashtag_events = scrape_hashtags(cl)
    log.info(f"Encontrados {len(hashtag_events)} posts en hashtags.")
    all_events.extend(hashtag_events)

    # Extraer de cuentas de venues
    venue_events = scrape_venue_accounts(cl)
    log.info(f"Encontrados {len(venue_events)} posts en cuentas de venues.")
    all_events.extend(venue_events)

    if not all_events:
        log.info("No se encontraron eventos. Supabase no se modifica.")
        return

    # Deduplicar por instagram_id
    seen = set()
    unique_events = []
    for ev in all_events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique_events.append(ev)

    log.info(f"Total eventos únicos a guardar: {len(unique_events)}")
    saved = sum(1 for ev in unique_events if save_event_to_supabase(ev))
    log.info(f"Guardados en Supabase: {saved}/{len(unique_events)}")
    log.info("=== Ciclo de scraping completado ===")


if __name__ == "__main__":
    main()
