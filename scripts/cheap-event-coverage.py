"""CHEAP_EVENT_COVERAGE: ¿estamos encontrando lo barato y lo under?

Compara un benchmark externo verificado (data/qa/cheap-benchmark-*.json) con la
cartelera pública (snapshot). Métrica interna de QA, no un puntaje público.

Uso: python3 scripts/cheap-event-coverage.py BENCHMARK.json [SNAPSHOT.json|URL]
"""
import json, sys, unicodedata, urllib.request

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return ''.join(c if c.isalnum() else ' ' for c in s).split()

bench = json.load(open(sys.argv[1], encoding='utf-8'))
fuente = sys.argv[2] if len(sys.argv) > 2 else 'https://carreteando.vercel.app/api/snapshot'
snap = json.load(urllib.request.urlopen(fuente) if fuente.startswith('http') else open(fuente, encoding='utf-8'))
del_dia = [e for e in snap['events'] if e['fecha'] == bench['fecha']]

def presente(b):
    lugar, titulo = set(norm(b['lugar'])), set(norm(b['titulo'])) - {'en', 'de', 'la', 'el', 'a', 'y'}
    for e in del_dia:
        if lugar <= set(norm(e.get('lugar'))) and (not titulo or titulo & set(norm(e['nombre']))):
            return e
        if titulo and len(titulo & set(norm(e['nombre']))) >= min(2, len(titulo)) and lugar & set(norm(e.get('lugar'))):
            return e
    return None

tramos = {
    'gratis': lambda b: b['acceso'] == 'gratis',
    'gratis_condicional': lambda b: b['acceso'] == 'gratis_condicional',
    'hasta_5000': lambda b: b['precio_min'] is not None and b['precio_min'] <= 5000,
    'hasta_10000': lambda b: b['precio_min'] is not None and b['precio_min'] <= 10000,
    'precio_desconocido': lambda b: b['precio_min'] is None,
}
print(f"CHEAP_EVENT_COVERAGE {bench['fecha']} · snapshot {snap.get('generatedAt')}")
print(f"{'tramo':20} {'externos':>8} {'públicos':>8} {'con precio':>10}")
for nombre, f in tramos.items():
    grupo = [b for b in bench['eventos'] if f(b)]
    pub = [(b, presente(b)) for b in grupo]
    con = [1 for b, e in pub if e and e.get('precio_conocido')]
    print(f"{nombre:20} {len(grupo):8} {sum(1 for _, e in pub if e):8} {len(con):10}")
faltan = [b['titulo'] + ' · ' + b['lugar'] for b in bench['eventos'] if not presente(b)]
print('faltan:', '; '.join(faltan) if faltan else 'ninguno')
