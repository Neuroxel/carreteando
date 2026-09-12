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

import instaloader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# ─── Config Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hgwljbtqdserkdhulbts.supabase.co").rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"
)

# ─── Config Instagram ─────────────────────────────────────────────────────────
IG_USERNAME = os.environ.get("IG_USERNAME", "").strip()
IG_PASSWORD = os.environ.get("IG_PASSWORD", "").strip()

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
    Inicia sesión intentando primero cargar una sesión guardada.
    Si no existe o expiró, hace login con usuario/contraseña y persiste la sesión.
    """
    if not IG_USERNAME or not IG_PASSWORD:
        log.error("IG_USERNAME o IG_PASSWORD no configurados en variables de entorno.")
        return False

    # Intentar cargar sesión guardada (evita re-login innecesario)
    if SESSION_FILE.exists():
        try:
            L.load_session_from_file(IG_USERNAME, str(SESSION_FILE))
            # Verificar que la sesión sigue activa
            _ = instaloader.Profile.from_username(L.context, IG_USERNAME)
            log.info(f"Sesión cargada desde archivo para @{IG_USERNAME}")
            return True
        except Exception as e:
            log.warning(f"Sesión guardada inválida o expirada: {e}. Re-logueando...")

    # Login con usuario/contraseña
    try:
        L.login(IG_USERNAME, IG_PASSWORD)
        L.save_session_to_file(str(SESSION_FILE))
        log.info(f"Login exitoso como @{IG_USERNAME}. Sesión guardada.")
        return True
    except instaloader.exceptions.BadCredentialsException:
        log.error("Usuario o contraseña incorrectos.")
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        log.error("Esta cuenta tiene 2FA. Desactívalo o usa una cuenta sin 2FA.")
    except Exception as e:
        log.error(f"Error en login: {e}")

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
    log.info("=== Carretes Scraper (Instaloader) iniciando ===")
    log.info(f"Supabase: {SUPABASE_URL}")

    if not test_supabase():
        log.error("Sin conexión a Supabase. Abortando.")
        return

    L = build_loader()

    if not login(L):
        log.error("Sin sesión de Instagram. Abortando.")
        return

    all_events: List[Dict] = []

    log.info("Scrapeando hashtags de eventos...")
    hashtag_events = scrape_hashtags(L)
    log.info(f"Hashtags: {len(hashtag_events)} posts con keywords de evento")
    all_events.extend(hashtag_events)

    log.info("Scrapeando cuentas de venues...")
    venue_events = scrape_venues(L)
    log.info(f"Venues: {len(venue_events)} posts")
    all_events.extend(venue_events)

    if not all_events:
        log.info("No se encontraron posts. Supabase no se modifica.")
        return

    # Deduplicar por instagram_id
    seen = set()
    unique = []
    for ev in all_events:
        if ev["instagram_id"] not in seen:
            seen.add(ev["instagram_id"])
            unique.append(ev)

    log.info(f"Total únicos a guardar: {len(unique)}")
    saved = sum(1 for ev in unique if save_to_supabase(ev))
    log.info(f"Guardados en Supabase: {saved}/{len(unique)}")
    log.info("=== Scraping completado ===")


if __name__ == "__main__":
    main()
