#!/usr/bin/env python3
"""
Carretes Valpo - Scraper con Instaloader
========================================
Extrae posts reales de Instagram usando Instaloader (open source, v4.13+).
- Login via usuario/contraseña con sesión persistida en disco
- Scrapea hashtags de eventos + cuentas de venues de Valparaíso
- Guarda en Supabase solo lo que encuentra realmente
- Sin datos inventados, sin fallbacks, sin mocks
"""

import os, re, time, logging, json, urllib.request, itertools
from datetime import datetime, timezone
from typing import List, Dict, Optional
from pathlib import Path
from urllib.parse import unquote

import instaloader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# ─── Config Supabase ──────────────────────────────────────────────────────────
DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"

def clean_env(name: str) -> str:
    """Lee variable de entorno y limpia comillas, espacios y prefijo Bearer."""
    val = os.environ.get(name, "").strip().strip("\"'").strip()
    return re.sub(r"^Bearer\s+", "", val, flags=re.IGNORECASE).strip()

_raw_url = clean_env("SUPABASE_URL")
SUPABASE_URL = (_raw_url if _raw_url.startswith("http") else "https://hgwljbtqdserkdhulbts.supabase.co").rstrip("/")

_key = (
    clean_env("SUPABASE_SERVICE_ROLE_KEY")
    or clean_env("SUPABASE_KEY")
    or clean_env("SUPABASE_ANON_KEY")
    or clean_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
SUPABASE_KEY = _key if len(_key) > 40 else DEFAULT_SUPABASE_KEY

# ─── Config Instagram ─────────────────────────────────────────────────────────
IG_USERNAME  = clean_env("IG_USERNAME")
IG_PASSWORD  = clean_env("IG_PASSWORD")
# Cookie de sesión (URL-encoded o raw) — se decodifica automáticamente
_raw_sid = clean_env("IG_SESSIONID")
IG_SESSIONID = unquote(_raw_sid) if _raw_sid else ""


# Ruta donde se persiste la sesión para no re-loguear cada vez
SESSION_FILE = Path("/tmp/instaloader_session") if os.path.exists("/tmp") else Path("./instaloader_session")

# Hashtags de eventos en Valparaíso y V Región
HASHTAGS = [
    "carretesvalpo",
    "carretesvalparaiso",
    "fiestasvalparaiso",
    "carretesviña",
    "fiestasviña",
    "undervalpo",
    "carretequilpue",
]

# Cuentas de venues reales de Valparaíso a monitorear
VENUE_ACCOUNTS = [
    "el.huevo",
    "trotamundosvalpo",
    "clubtrotaquilpue",
    "club_segundo_piso",
    "mascara_valparaiso",
    "paganocl",
]

# Palabras que indican que un post es sobre un evento/carrete
EVENT_KEYWORDS = [
    "carrete", "fiesta", "evento", "techno", "entrada", "viernes", "sábado",
    "sabado", "tonight", "club", "dj set", "rave", "boliche", "concierto",
    "live", "show", "presentación", "tocata", "baile",
]

MAX_POSTS_PER_HASHTAG = 10
MAX_POSTS_PER_VENUE = 5


# ─── Supabase ─────────────────────────────────────────────────────────────────
def test_supabase() -> bool:
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info(f"Supabase Key: longitud={len(SUPABASE_KEY)}, inicio={SUPABASE_KEY[:12]}...")
    url = f"{SUPABASE_URL}/rest/v1/events?select=count"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as r:
            log.info(f"Supabase OK — status {r.status}")
            return True
    except Exception as e:
        log.error(f"Supabase error: {e}")
        return False


def save_to_supabase(event: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/events?on_conflict=instagram_id"
    payload = json.dumps(event).encode()
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 201)
    except Exception as e:
        log.error(f"Error guardando {event.get('instagram_id')}: {e}")
        return False


# ─── Instaloader helpers ──────────────────────────────────────────────────────
def build_loader() -> instaloader.Instaloader:
    """Crea instancia de Instaloader sin descargar archivos innecesarios."""
    return instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )


def login(L: instaloader.Instaloader) -> bool:
    """
    Orden de intentos:
    1. Cookie sessionid (IG_SESSIONID) — mas confiable, evita checkpoints
    2. Sesion guardada en disco — reutiliza logins previos
    3. Usuario + contrasena — fallback, puede pedir checkpoint desde IPs nuevos
    """

    # 1. Cargar via cookie sessionid
    if IG_SESSIONID:
        try:
            log.info(f"Intentando login con sessionid cookie (len={len(IG_SESSIONID)})...")
            # Injectar cookie directamente en la sesion de requests
            L.context._session.cookies.set(
                "sessionid", IG_SESSIONID, domain=".instagram.com", path="/"
            )
            if IG_USERNAME:
                L.context.username = IG_USERNAME
            # Verificar que la sesion es valida haciendo una peticion real
            test_profile = IG_USERNAME or "instagram"
            instaloader.Profile.from_username(L.context, test_profile)
            log.info(f"Login exitoso via sessionid cookie")
            return True
        except Exception as e:
            log.warning(f"Sessionid invalida o expirada: {e}")

    # 2. Sesion guardada en disco
    if IG_USERNAME and SESSION_FILE.exists():
        try:
            L.load_session_from_file(IG_USERNAME, str(SESSION_FILE))
            instaloader.Profile.from_username(L.context, IG_USERNAME)
            log.info(f"Sesion cargada desde disco para @{IG_USERNAME}")
            return True
        except Exception as e:
            log.warning(f"Sesion en disco invalida: {e}")

    # 3. Login con usuario/contrasena (puede pedir checkpoint desde IPs nuevas)
    if IG_USERNAME and IG_PASSWORD:
        try:
            log.info(f"Login con usuario/contrasena para @{IG_USERNAME}...")
            L.login(IG_USERNAME, IG_PASSWORD)
            L.save_session_to_file(str(SESSION_FILE))
            log.info(f"Login exitoso como @{IG_USERNAME}. Sesion guardada en disco.")
            return True
        except instaloader.exceptions.BadCredentialsException:
            log.error("Credenciales incorrectas.")
        except instaloader.exceptions.TwoFactorAuthRequiredException:
            log.error("2FA activo. Desactivalo en la cuenta de Instagram.")
        except Exception as e:
            log.error(f"Error en login: {e}")

    log.error("No se pudo iniciar sesion por ningun metodo.")
    return False


def post_to_dict(post: instaloader.Post, source: str) -> Optional[Dict]:
    """Convierte un Post de Instaloader a dict para Supabase."""
    caption = post.caption or ""
    title = caption.split("\n")[0][:120].strip()
    if not title:
        title = f"Post de @{post.owner_username}"

    # URL de imagen: preferir display_url (thumbnail pública)
    image_url = None
    try:
        image_url = post.url  # URL de la imagen/thumbnail
    except Exception:
        pass

    return {
        "instagram_id": str(post.shortcode),  # shortcode es más estable que mediaid
        "title": title,
        "description": caption[:1000],
        "date_text": post.date_local.strftime("%Y-%m-%d") if post.date_local else datetime.now().strftime("%Y-%m-%d"),
        "location": "Valparaíso",
        "image_url": image_url,
        "instagram_url": f"https://www.instagram.com/p/{post.shortcode}/",
        "username": post.owner_username,
        "likes": post.likes,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "is_active": True,
    }


def is_event_related(caption: str) -> bool:
    text = (caption or "").lower()
    return any(kw in text for kw in EVENT_KEYWORDS)


# ─── Scraping functions ───────────────────────────────────────────────────────
def scrape_hashtags(L: instaloader.Instaloader) -> List[Dict]:
    results = []
    for tag in HASHTAGS:
        try:
            log.info(f"  Scrapeando #{tag}...")
            hashtag = instaloader.Hashtag.from_name(L.context, tag)
            count = 0
            for post in hashtag.get_posts():
                if count >= MAX_POSTS_PER_HASHTAG:
                    break
                if not is_event_related(post.caption):
                    count += 1
                    continue
                d = post_to_dict(post, f"hashtag_{tag}")
                if d:
                    results.append(d)
                count += 1
                time.sleep(1.5)  # respetar rate limits
            log.info(f"    → {len([r for r in results if f'hashtag_{tag}' in r.get('source','')])} posts relevantes")
            time.sleep(3)
        except instaloader.exceptions.QueryReturnedNotFoundException:
            log.warning(f"  Hashtag #{tag} no encontrado.")
        except instaloader.exceptions.TooManyRequestsException:
            log.warning(f"  Rate limit en #{tag}. Esperando 60s...")
            time.sleep(60)
        except Exception as e:
            log.warning(f"  Error en #{tag}: {e}")
            time.sleep(5)
    return results


def scrape_venues(L: instaloader.Instaloader) -> List[Dict]:
    results = []
    for handle in VENUE_ACCOUNTS:
        try:
            log.info(f"  Scrapeando @{handle}...")
            profile = instaloader.Profile.from_username(L.context, handle)
            count = 0
            for post in profile.get_posts():
                if count >= MAX_POSTS_PER_VENUE:
                    break
                d = post_to_dict(post, "venue_profile")
                if d:
                    results.append(d)
                count += 1
                time.sleep(2)
            log.info(f"    → {count} posts de @{handle}")
            time.sleep(5)
        except instaloader.exceptions.ProfileNotExistsException:
            log.warning(f"  Perfil @{handle} no existe o es privado.")
        except instaloader.exceptions.TooManyRequestsException:
            log.warning(f"  Rate limit en @{handle}. Esperando 60s...")
            time.sleep(60)
        except Exception as e:
            log.warning(f"  Error en @{handle}: {e}")
            time.sleep(5)
    return results


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    log.info("=== Carretes Scraper (modo público, sin login) ===")
    log.info(f"Supabase: {SUPABASE_URL}")

    if not test_supabase():
        log.error("Sin conexión a Supabase. Abortando.")
        return

    # Sin login — solo perfiles públicos. Sin cookie, sin usuario, sin checkpoint.
    L = build_loader()
    log.info("Leyendo perfiles públicos de venues (sin autenticación)...")

    venue_events = scrape_venues(L)
    log.info(f"Posts extraídos: {len(venue_events)}")

    if not venue_events:
        log.info("No se encontraron posts. Supabase no se modifica.")
        return

    # Deduplicar por instagram_id
    seen: set = set()
    unique = []
    for ev in venue_events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique.append(ev)

    log.info(f"Guardando {len(unique)} eventos únicos en Supabase...")
    saved = sum(1 for ev in unique if save_to_supabase(ev))
    log.info(f"Guardados: {saved}/{len(unique)}")
    log.info("=== Scraping completado ===")


if __name__ == "__main__":
    main()
