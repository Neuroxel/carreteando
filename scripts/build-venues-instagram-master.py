"""Arma el maestro de Instagram de lugares a partir de la base exportada
(snapshot público + needs_evidence) y la verificación manual de perfiles.

Uso: python3 scripts/build-venues-instagram-master.py BASE.json CAPTURA.json
Escribe data/exports/venues_instagram_master.{json,csv} y docs/data/VENUES_INSTAGRAM_MASTER.md.
Nunca deduce un handle desde el nombre: solo clasifica los que ya están en la base.
"""
import csv, json, sys
from datetime import date
from pathlib import Path

HOY = date(2026, 10, 16)
base = json.load(open(sys.argv[1], encoding='utf-8'))
cap = json.load(open(sys.argv[2], encoding='utf-8'))
previa = set(cap.pop('_previa')['handles'])
RENOMBRADAS = {'barelhuevo': 'el.huevo'}
# Un handle que no es la cuenta propia del lugar o que cubre otro local.
AMBIGUAS = {
    'hollywood-renaca': 'La cuenta de marca solo cita el local de Viña (Merino 57); no confirma Reñaca.',
    'sala-negra-uv': 'Es la cuenta de la Escuela de Teatro UV; la sala tiene cuenta propia (@salanegrajbc, sin verificar).',
}
FECHA_PREVIA = {'matizvalpo.oficial': '2024-11-01'}

def valor(ultima):
    if not ultima:
        return 'desconocido'
    d = (HOY - date.fromisoformat(ultima)).days
    return 'alto' if d <= 14 else 'medio' if d <= 90 else 'bajo'

filas = []
for v in sorted(base, key=lambda r: (r['ciudad'], r['nombre'])):
    h = v['handle']
    f = dict(venue_id=None, slug=v['slug'], canonical_name=v['nombre'], aliases=';'.join(v.get('alias') or []),
             city=v['ciudad'], zone=v.get('zona') or '', disposition=v['disposition'],
             instagram_handle=h or '', instagram_url=f'https://www.instagram.com/{h}/' if h else '',
             handle_status='NONE', last_activity_at='', programming_value='n/a',
             verification_source='', confidence='', notes='')
    if not h:
        f['notes'] = 'Sin handle en la base; no se infiere desde el nombre.'
    elif h in cap:
        existe, ultima, nota = cap[h]
        f['verification_source'] = 'perfil público de Instagram (vista sin sesión, 2026-10-16)'
        f['notes'] = nota
        if not existe:
            f.update(handle_status='NOT_FOUND', confidence='alta')
        else:
            f['last_activity_at'] = ultima or ''
            f['programming_value'] = valor(ultima)
            if h in RENOMBRADAS:
                f.update(handle_status='RENAMED', confidence='alta', notes=f"{nota}. Reemplazar por @{RENOMBRADAS[h]}.")
            elif v['slug'] in AMBIGUAS:
                f.update(handle_status='AMBIGUOUS', confidence='media', notes=AMBIGUAS[v['slug']])
            elif ultima and (HOY - date.fromisoformat(ultima)).days > 365:
                f.update(handle_status='INACTIVE', confidence='alta')
            else:
                f.update(handle_status='VERIFIED', confidence='alta' if 'Bio:' in nota else 'media')
    elif h in previa:
        ultima = FECHA_PREVIA.get(h, '')
        f.update(verification_source='perfil público visto en la pasada anterior (2026-10-16)',
                 last_activity_at=ultima, programming_value=valor(ultima) if ultima else 'desconocido',
                 handle_status='INACTIVE' if ultima and (HOY - date.fromisoformat(ultima)).days > 365 else 'VERIFIED',
                 confidence='media', notes='Existencia y nombre confirmados; fecha de última publicación no registrada.' if not ultima else 'Sin publicaciones desde 2024-11.')
    else:
        f.update(handle_status='UNVERIFIED', notes='Pendiente: la revisión manual de perfiles se detuvo; verificar con la corrida de Apify (perfil, no posts).')
    filas.append(f)

raiz = Path('.')
(raiz / 'data/exports').mkdir(parents=True, exist_ok=True)
(raiz / 'docs/data').mkdir(parents=True, exist_ok=True)
json.dump(filas, open('data/exports/venues_instagram_master.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open('data/exports/venues_instagram_master.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=list(filas[0]))
    w.writeheader(); w.writerows(filas)

from collections import Counter, defaultdict
est = Counter(f['handle_status'] for f in filas)
disp = Counter(f['disposition'] for f in filas)
porc = defaultdict(Counter)
for f in filas:
    porc[f['city']][f['handle_status']] += 1
    porc[f['city']]['total'] += 1
ESTADOS = ['VERIFIED', 'INACTIVE', 'RENAMED', 'AMBIGUOUS', 'NOT_FOUND', 'UNVERIFIED', 'NONE']
md = ['# Maestro de Instagram de lugares', '',
      f'Corte: 2026-10-16. {len(filas)} lugares ({disp["published"]} publicados, {disp["needs_evidence"]} needs_evidence). '
      'Fuente de lugares: snapshot público + needs_evidence; `venue_id` queda vacío porque la base no estaba accesible al generar el corte (se cruza por `slug`).', '',
      'Regla: ningún handle se deduce del nombre. Solo se clasifican los handles que ya estaban en la base; los lugares sin handle quedan `NONE`.', '',
      '## Estados', '',
      '| Estado | Lugares | Significado |', '|---|---:|---|']
SIG = {'VERIFIED': 'Perfil existe, nombre y ciudad coinciden, publicó en los últimos 12 meses',
       'INACTIVE': 'Perfil existe pero sin publicaciones hace más de 12 meses (handle viejo: no sirve como fuente)',
       'RENAMED': 'El handle de la base es una cuenta antigua; el lugar publica en otra',
       'AMBIGUOUS': 'El handle no es claramente la cuenta propia de este lugar',
       'NOT_FOUND': 'Instagram responde que el perfil no está disponible',
       'UNVERIFIED': 'Handle en la base sin revisar todavía',
       'NONE': 'Sin handle en la base'}
for e in ESTADOS:
    md.append(f'| `{e}` | {est.get(e, 0)} | {SIG[e]} |')
md += ['', '## Por ciudad', '', '| Ciudad | Lugares | ' + ' | '.join(ESTADOS) + ' |', '|---|---:|' + '---:|' * len(ESTADOS)]
for c in sorted(porc, key=lambda c: -porc[c]['total']):
    md.append(f'| {c} | {porc[c]["total"]} | ' + ' | '.join(str(porc[c].get(e, 0)) for e in ESTADOS) + ' |')
md += ['', '## Casos que requieren acción', '']
for f in filas:
    if f['handle_status'] in ('RENAMED', 'AMBIGUOUS', 'NOT_FOUND', 'INACTIVE'):
        md.append(f'- **{f["canonical_name"]}** ({f["city"]}, `{f["slug"]}`) — `@{f["instagram_handle"]}` → `{f["handle_status"]}`'
                  + (f' (última publicación {f["last_activity_at"]})' if f['last_activity_at'] else '') + f'. {f["notes"]}')
md += ['', '## Pendientes de verificación', '',
       ', '.join(f'`@{f["instagram_handle"]}`' for f in filas if f['handle_status'] == 'UNVERIFIED'), '',
       '## Método y límites', '',
       '- Verificación de 2026-10-16 abriendo el perfil público de cada handle sin iniciar sesión, a ritmo de consulta humana. Solo se leyó el encabezado del perfil (título y bio) y la fecha de la publicación más reciente, que se obtiene del código del post. No se leyeron seguidores, comentarios ni medios, y no se guardó nada fuera de este maestro.',
       '- La revisión se detuvo con 18 handles pendientes. La adquisición de contenido de Instagram va siempre por Apify; esta revisión no es una fuente de eventos.',
       '- `last_activity_at` es la fecha de la publicación propia más reciente visible en la grilla y excluye las fijadas antiguas cuando se distinguen.',
       '- `programming_value`: `alto` si publicó en los últimos 14 días, `medio` si fue en los últimos 90, `bajo` si es más antiguo. Mide frecuencia de publicación, no calidad de la agenda.',
       '- Archivos: `data/exports/venues_instagram_master.csv` y `.json`, generados con `scripts/build-venues-instagram-master.py`.', '']
Path('docs/data/VENUES_INSTAGRAM_MASTER.md').write_text('\n'.join(md), encoding='utf-8')
print(est, disp)
