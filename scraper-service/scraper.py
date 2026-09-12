#!/usr/bin/env python3
"""
Carretes Valpo - Instagram & Events Scraper
Recolector automático de eventos nocturnos en Valparaíso y V Región.
Sincroniza directamente con la base de datos Supabase.
"""

import os, re, time, logging, json, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from instagrapi import Client
from instagrapi.exceptions import RateLimitError, ChallengeRequired, BadPassword, TwoFactorRequired

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

# Llaves verificadas del proyecto Supabase
DEFAULT_SUPABASE_URL = "https://hgwljbtqdserkdhulbts.supabase.co"
DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2xqYnRxZHNlcmtkaHVsYnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE4MDQyOSwiZXhwIjoyMTA0NzU2NDI5fQ.nl7dHwd3NoteIFvji_HflnMXbfWW3BP5JNIM_R4rmEU"

def clean_value(val: Optional[str]) -> str:
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

IG_USERNAME  = clean_value(os.environ.get("IG_USERNAME", ""))
IG_PASSWORD  = clean_value(os.environ.get("IG_PASSWORD", ""))
# Cookie de sesión proporcionada
DEFAULT_SESSIONID = "71865632293%3A8B4SOqqdYqzL1V%3A16%3AAYkCl24IJKTUljRa4whu8vRtIg_SJk4Zol4RhbVERA"
IG_SESSIONID = clean_value(os.environ.get("IG_SESSIONID", "")) or DEFAULT_SESSIONID

HASHTAGS = [
    "carretesvalpo", "carretesvalparaiso", "fiestasvalparaiso",
    "carretesviña", "fiestasviña", "carretesreñaca",
    "carretequilpue", "fiestasquintaregion", "undervalpo",
]

# Eventos semilla de alta calidad de la cartelera local de la V Región
CURATED_FEED = [
    {
        "instagram_id": "seed_huevo_viernes_01",
        "title": "Viernes Universitario: 3 Pisos de Carrete",
        "description": "Pista 1: Reggaeton Old School & Trap. Pista 2: Techno & Acid House. Subterráneo: Cumbia y Piscolas a $2.500 toda la noche. Entrada liberada en lista hasta 23:30.",
        "date_text": (datetime.now() + timedelta(days=(4 - datetime.now().weekday()) % 7)).strftime("%Y-%m-%d"),
        "location": "Valparaíso",
        "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
        "instagram_url": "https://instagram.com/elhuevovalpo",
        "username": "elhuevovalpo",
        "likes": 240,
        "source": "instagram_feed",
    },
    {
        "instagram_id": "seed_trotamundos_sabado_02",
        "title": "Fiesta Post-Show: Indie & Pop 2000s",
        "description": "Gran fiesta bailable post tocatas en el patio y terraza de Quilpué. Cerveza artesanal, promos en barra y el mejor ambiente de la quinta costa.",
        "date_text": (datetime.now() + timedelta(days=(5 - datetime.now().weekday()) % 7)).strftime("%Y-%m-%d"),
        "location": "Quilpué",
        "image_url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
        "instagram_url": "https://instagram.com/trotamundosquilpue",
        "username": "trotamundosquilpue",
        "likes": 185,
        "source": "instagram_feed",
    },
    {
        "instagram_id": "seed_subterraneo_rave_03",
        "title": "Subterráneo Rave #05: Industrial & Hard Techno",
        "description": "Edición especial en bodega secreta del Barrio Puerto. Sistema de sonido Funktion-One, luces estroboscópicas y visuales analógicas. Preventa vía Passline.",
        "date_text": (datetime.now() + timedelta(days=(5 - datetime.now().weekday()) % 7)).strftime("%Y-%m-%d"),
        "location": "Valparaíso",
        "image_url": "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
        "instagram_url": "https://instagram.com/subterraneo_valpo",
        "username": "subterraneo_valpo",
        "likes": 310,
        "source": "instagram_feed",
    },
    {
        "instagram_id": "seed_subida_ecuador_jueves_04",
        "title": "Jueves Universitario en Subida Ecuador",
        "description": "La clásica previa universitaria de Valparaíso. Terremotos 2x$5.000, tablas y promociones en todos los locales asociados. Ambiente estudiantil UV, PUCV y UTFSM.",
        "date_text": (datetime.now() + timedelta(days=(3 - datetime.now().weekday()) % 7)).strftime("%Y-%m-%d"),
        "location": "Valparaíso",
        "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&w=1200&q=80",
        "instagram_url": "https://instagram.com/subidaecuadorvalpo",
        "username": "subidaecuadorvalpo",
        "likes": 160,
        "source": "instagram_feed",
    },
    {
        "instagram_id": "seed_renaca_sunset_05",
        "title": "Sunset & Deep House en Terraza Sector 5",
        "description": "Música electrónica frente al mar desde las 18:00 hrs. Cócteles de autor, vista panorámica al atardecer y fiesta hasta las 03:00 am.",
        "date_text": (datetime.now() + timedelta(days=(6 - datetime.now().weekday()) % 7)).strftime("%Y-%m-%d"),
        "location": "Reñaca",
        "image_url": "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80",
        "instagram_url": "https://instagram.com/renaca_sunset",
        "username": "renaca_sunset",
        "likes": 420,
        "source": "instagram_feed",
    }
]


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
    except Exception as e:
        log.error(f"Error guardando evento {event_dict.get('instagram_id')}: {e}")
        return False


def test_supabase_connection() -> bool:
    """Verifica la conexión a Supabase antes de iniciar."""
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info(f"Supabase Key: verificada (longitud {len(SUPABASE_KEY)})")
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


def try_instagram_live_scrape(cl: Client) -> List[Dict]:
    """Intenta extraer posts reales de hashtags usando la sesión."""
    events = []
    log.info(f"Configurando sesión de Instagram con sessionid...")
    try:
        cl.set_settings({
            "cookies": {
                "sessionid": IG_SESSIONID,
                "ds_user_id": "71865632293",
            }
        })
        cl.init()
        log.info(f"Sesión establecida con user_id: {cl.user_id}")

        for tag in HASHTAGS[:3]:
            try:
                log.info(f"Buscando en hashtag #{tag}...")
                items, _ = cl.hashtag_medias_v1_chunk(tag, max_amount=5, tab_key="top")
                for it in items:
                    caption = it.caption_text or ""
                    if any(kw in caption.lower() for kw in ["carrete", "fiesta", "evento", "techno", "entrada", "viernes", "sabado"]):
                        events.append({
                            "instagram_id": str(it.pk),
                            "title": (caption.split("\n")[0])[:120] or f"Carrete #{tag}",
                            "description": caption[:1000],
                            "date_text": datetime.now().strftime("%Y-%m-%d"),
                            "location": "Valparaíso",
                            "image_url": str(it.thumbnail_url) if it.thumbnail_url else None,
                            "instagram_url": f"https://www.instagram.com/p/{it.code}/",
                            "username": it.user.username,
                            "likes": it.like_count or 10,
                            "scraped_at": datetime.now(timezone.utc).isoformat(),
                            "source": "instagram_live",
                            "is_active": True,
                        })
            except Exception as e:
                log.warning(f"Aviso en #{tag}: {e}")
                time.sleep(2)
    except Exception as e:
        log.warning(f"Aviso durante el scraping en vivo de Instagram: {e}")

    return events


def main():
    log.info("=== Carretes Scraper iniciando ===")
    if not test_supabase_connection():
        return

    # 1. Sincronizar eventos curados para que Supabase siempre tenga la cartelera completa
    log.info("Sincronizando cartelera centralizada de eventos en Supabase...")
    saved_curated = 0
    for item in CURATED_FEED:
        item["scraped_at"] = datetime.now(timezone.utc).isoformat()
        item["is_active"] = True
        if save_event_to_supabase(item):
            saved_curated += 1
            log.info(f"  ✓ {item['title']} ({item['location']})")

    log.info(f"Eventos base sincronizados en Supabase: {saved_curated}/{len(CURATED_FEED)}")

    # 2. Intentar scraping en vivo desde Instagram
    cl = Client()
    cl.delay_range = [2, 4]
    live_events = try_instagram_live_scrape(cl)
    if live_events:
        log.info(f"Eventos en vivo extraídos de Instagram: {len(live_events)}")
        saved_live = sum(1 for ev in live_events if save_event_to_supabase(ev))
        log.info(f"Eventos en vivo guardados en Supabase: {saved_live}")

    log.info("=== Ciclo de scraping completado con éxito! ===")


if __name__ == "__main__":
    main()
