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

# Llave maestra real de Supabase (garantiza funcionamiento si Railway tiene el placeholder "your-service-role-key")
DEFAULT_SUPABASE_URL = "https://hgwljbtqdserkdhulbts.supabase.co"
DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"

def clean_value(val: Optional[str]) -> str:
    if not val:
        return ""
    v = val.strip().strip("\"'").strip()
    return re.sub(r"^Bearer\s+", "", v, flags=re.IGNORECASE).strip()

# 1. Obtener y validar SUPABASE_URL
raw_url = clean_value(os.environ.get("SUPABASE_URL", "")).rstrip("/")
SUPABASE_URL = raw_url if raw_url.startswith("http") else DEFAULT_SUPABASE_URL

# 2. Obtener y validar SUPABASE_KEY
detected_key = ""
for var_name in ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]:
    val = clean_value(os.environ.get(var_name))
    if val and not val.startswith("your-") and len(val) > 40:
        detected_key = val
        log.info(f"Supabase Key valida encontrada en {var_name}")
        break

SUPABASE_KEY = detected_key if detected_key else DEFAULT_SUPABASE_KEY
if not detected_key:
    log.info("Usando SUPABASE_KEY predeterminada verificada del proyecto.")

IG_USERNAME  = clean_value(os.environ.get("IG_USERNAME", ""))
IG_PASSWORD  = clean_value(os.environ.get("IG_PASSWORD", ""))
IG_SESSIONID = clean_value(os.environ.get("IG_SESSIONID", ""))
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


def test_supabase_connection() -> bool:
    """Verifica la conexión a Supabase antes de iniciar el scraper."""
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info(f"Supabase Key activa (longitud: {len(SUPABASE_KEY)}, inicio: {SUPABASE_KEY[:6]}..., fin: ...{SUPABASE_KEY[-4:]})")
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
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        log.error(f"Fallo al conectar con Supabase: HTTP {e.code} - {body}")
        return False
    except Exception as e:
        log.error(f"Fallo al conectar con Supabase: {e}")
        return False


def setup_client() -> Client:
    """Configura el cliente con parámetros reales de Samsung Galaxy S23."""
    cl = Client()
    cl.delay_range = [2, 5]
    
    # Configurar dispositivo realista de Instagram Android v385 (versión estable oficial)
    try:
        cl.set_device({
            "app_version": "385.0.0.47.74",
            "android_version": 33,
            "android_release": "13.0",
            "dpi": "480dpi",
            "resolution": "1080x2340",
            "manufacturer": "Samsung",
            "device": "SM-S911B",
            "model": "Galaxy S23",
            "cpu": "qcom",
            "version_code": "378906843",
            "bloks_versioning_id": "a8973d49a9cc6a6f65a4997c10216ce2a06f65a517010e64885e92029bb19221",
        })
        cl.set_user_agent("Instagram 385.0.0.47.74 Android (33/13.0; 480dpi; 1080x2340; Samsung; SM-S911B; kalama; qcom; es_ES; 378906843)")
    except Exception as e:
        log.warning(f"No se pudo personalizar el dispositivo en Client: {e}")

    return cl


def login(cl: Client) -> bool:
    # 1. Opción preferida y más segura: Login directo por sessionid (sin contraseña, bypass de checkpoint)
    if IG_SESSIONID:
        try:
            log.info("Intentando login mediante sessionid cookie...")
            cl.login_by_sessionid(IG_SESSIONID)
            log.info("Login mediante sessionid exitoso!")
            return True
        except Exception as e:
            log.error(f"Fallo en login_by_sessionid: {e}")

    # 2. Sesión guardada en caché local
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            if IG_USERNAME and IG_PASSWORD:
                cl.login(IG_USERNAME, IG_PASSWORD)
            log.info("Sesión de Instagram cargada desde caché exitosamente.")
            return True
        except Exception as e:
            log.warning(f"Sesión cacheada inválida ({e}), realizando intento fresco...")

    # 3. Login convencional con usuario y contraseña
    if not IG_USERNAME or not IG_PASSWORD:
        log.warning("IG_USERNAME o IG_PASSWORD no configurados.")
        return False

    log.info(f"Iniciando sesión con usuario: {IG_USERNAME}")
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
        log.info("TIP: Para evitar desafíos y checkpoints, configura la variable IG_SESSIONID con tu cookie de sesión de Instagram.")
        return False
    except Exception as e:
        log.error(f"Error durante el login de Instagram: {e}")
        log.info("TIP: Puedes omitir el login por contraseña configurando IG_SESSIONID en Railway.")
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
    if not test_supabase_connection():
        log.error("No se pudo establecer conexión con Supabase. Finalizando ejecución.")
        return

    cl = setup_client()
    if not login(cl):
        log.warning("No se pudo iniciar sesión en Instagram. El servicio esperará al próximo ciclo.")
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
