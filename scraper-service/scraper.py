#!/usr/bin/env python3
"""
Carretes Valpo - Instagram Scraper
Busca posts por hashtag y guarda eventos en Supabase.
"""

import os, re, time, logging
from datetime import datetime, timezone
from typing import Optional
from instagrapi import Client
from instagrapi.exceptions import RateLimitError
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("carretes-scraper")

IG_USERNAME  = os.environ["IG_USERNAME"]
IG_PASSWORD  = os.environ["IG_PASSWORD"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
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


def login(cl: Client) -> None:
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(IG_USERNAME, IG_PASSWORD)
            log.info("Session loaded from cache.")
            return
        except Exception:
            log.warning("Cached session invalid, fresh login...")
    cl.login(IG_USERNAME, IG_PASSWORD)
    cl.dump_settings(SESSION_FILE)
    log.info("Login OK.")


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
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    cl = Client()
    cl.delay_range = [1, 3]
    login(cl)

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
            log.warning("Rate limited, sleeping 90s...")
            time.sleep(90)
        except Exception as e:
            log.error(f"Error #{tag}: {e}")

    log.info(f"Events found: {len(all_events)}")

    saved = 0
    for ev in all_events:
        try:
            sb.table("events").upsert(ev, on_conflict="instagram_id").execute()
            saved += 1
        except Exception as e:
            log.error(f"Save error: {e}")

    log.info(f"Saved to Supabase: {saved}")
    log.info("=== Done ===")


if __name__ == "__main__":
    main()
