#!/usr/bin/env python3
"""
Carretes Valpo - Instagram Scraper
Busca posts por hashtag y guarda eventos en Supabase.
"""

import os, re, time, logging, json, urllib.request, urllib.error
from datetime import datetime, timezone
from typing import Optional
from instagrapi import Client
from instagrapi.exceptions import RateLimitError, ChallengeRequired, BadPassword, TwoFactorRequired

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# Variables limpias de comillas o espacios accidentales
IG_USERNAME  = os.environ.get("IG_USERNAME", "").strip().strip("\"'")
IG_PASSWORD  = os.environ.get("IG_PASSWORD", "").strip().strip("\"'")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().strip("\"'").rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or "").strip().strip("\"'")
SESSION_FILE = "/tmp/ig_session.json"

HASHTAGS = [
    "carretesvalpo", "carretesvalparaiso", "fiestasvalparaiso",
    "carretesviña", "fiestasviña", "carretesreñaca",
    "carretequilpue", "fiestasquintaregion", "undervalpo",
    "bolichesvalpo", "clubesvalparaiso", "nochevalpo",
]

EVENT_KEYWORDS = [
    "carrete", "fiesta", "party", "evento", "baile", "club",
    "boliche", "after", "previo", "entrada", "ticket", "cover",
    "gratis", "jueves", "viernes", "sabado", "domingo", "tonight",
]

DATE_PATTERNS = [
    r"\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b",
    r"\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b",
    r"\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b",
]

LOCATIONS = ["Valparaiso", "Vina del Mar", "Renaca", "Quilpue", "Villa Alemana"]
LOCATION_ALIASES = {
    "valpo": "Valparaiso", "valparaiso": "Valparaiso", "valparaíso": "Valparaiso",
    "viña": "Vina del Mar", "vina": "Vina del Mar", "reñaca": "Renaca",
    "renaca": "Renaca", "quilpue": "Quilpue", "quilpué": "Quilpue",
}

def save_event_to_supabase(event_dict: dict) -> bool:
    """Guarda o actualiza un evento en Supabase via PostgREST API nativa."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Faltan SUPABASE_URL o SUPABASE_KEY en variables de entorno.")
        return False

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
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        log.error(f"Error HTTP guardando en Supabase: {e.code} - {body}")
        return False
    except Exception as e:
        log.error(f"Error de conexión con Supabase: {e}")
        return False


def test_supabase_connection():
    """Verifica la conexión a Supabase antes de iniciar el scraper."""
    log.info(f"Verificando conexion con Supabase en {SUPABASE_URL}...")
    url = f"{SUPABASE_URL}/rest/v1/events?select=count"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            log.info(f"Conexión con Supabase verificada exitosamente! Status: {resp.status}")
            return True
    except Exception as e:
        log.error(f"Fallo al conectar con Supabase: {e}")
        return False


def login(cl: Client) -> bool:
    if not IG_USERNAME or not IG_PASSWORD:
        log.warning("IG_USERNAME o IG_PASSWORD no configurados.")
        return False

    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(IG_USERNAME, IG_PASSWORD)
            log.info("Sesión de Instagram cargada desde caché.")
            return True
        except Exception:
            log.warning("Sesión cacheada inválida, realizando login fresco...")

    try:
        cl.login(IG_USERNAME, IG_PASSWORD)
        cl.dump_settings(SESSION_FILE)
        log.info("Login en Instagram exitoso.")
        return True
    except BadPassword:
        log.error("Contraseña de Instagram incorrecta.")
        return False
    except (TwoFactorRequired, ChallengeRequired) as e:
        log.error(f"Instagram requiere verificación adicional (2FA o Challenge): {e}")
        return False
    except Exception as e:
        log.error(f"Error durante el login de Instagram: {e}")
        return False


def is_event(caption: str) -> bool:
    if not caption:
        return False
    low = caption.lower()
    return sum(1 for kw in EVENT_KEYWORDS if kw in low) >= 2


def extract_date(caption: str) -> Optional[str]:
    for p in DATE_PATTERNS:
        m = re.search(p, caption, re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def extract_location(caption: str) -> str:
    low = caption.lower()
    for alias, loc in LOCATION_ALIASES.items():
        if alias in low:
            return loc
    return "V Region"


def to_event(media) -> Optional[dict]:
    caption = media.caption_text or ""
    if not is_event(caption):
        return None
    lines = [l.strip() for l in caption.split("\n") if l.strip()]
    title = lines[0][:120] if lines else "Evento"
    img = str(media.thumbnail_url) if media.thumbnail_url else None
    return {
        "instagram_id": str(media.pk),
        "title": title,
        "description": caption[:1000],
        "date_text": extract_date(caption),
        "location": extract_location(caption),
        "image_url": img,
        "instagram_url": f"https://www.instagram.com/p/{media.code}/",
        "username": media.user.username,
        "likes": media.like_count or 0,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "instagram_hashtag",
    }


def main():
    log.info("=== Carretes Scraper start ===")
    test_supabase_connection()

    cl = Client()
    cl.delay_range = [1, 3]
    if not login(cl):
        log.warning("No se pudo iniciar sesion en Instagram. El servicio esperara al proximo ciclo.")
        return

    all_events = []
    for tag in HASHTAGS:
        try:
            log.info(f"Scraping #{tag}...")
            medias = cl.hashtag_medias_recent(tag, amount=15)
            for m in medias:
                ev = to_event(m)
                if ev:
                    all_events.append(ev)
                    log.info(f"  + {ev['title'][:60]}")
            time.sleep(3)
        except RateLimitError:
            log.warning("Rate limit alcanzado, esperando 90s...")
            time.sleep(90)
        except Exception as e:
            log.error(f"Error en hashtag #{tag}: {e}")

    log.info(f"Eventos encontrados: {len(all_events)}")

    saved = 0
    for ev in all_events:
        if save_event_to_supabase(ev):
            saved += 1

    log.info(f"Eventos guardados/actualizados en Supabase: {saved}")
    log.info("=== Done ===")


if __name__ == "__main__":
    main()
