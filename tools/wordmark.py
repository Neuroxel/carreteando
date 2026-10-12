"""Genera components/poster/marca.ts: "DÓNDE / SALGO?" en Ultra (Apache 2.0,
Astigmatic) convertido a trazos SVG. Cada letra lleva un giro y un salto de
línea base fijos, como tipos de madera compuestos a mano. El "?" va aparte (coral).
Uso: python3 tools/wordmark.py ruta/a/Ultra.ttf > components/poster/marca.ts"""
import sys, math, re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
f = TTFont(sys.argv[1]); gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f['hmtx']
S = 1000 / f['head'].unitsPerEm
TRACK = -30
LINEA2 = 805
KX, KY = 0.9, 1.1  # letras algo más altas y angostas, como tipos de madera condensados  # línea base de SALGO (la primera está en 0)
# (giro°, salto) por letra: fijo, el logo siempre es el mismo
JIT = [(-2.0, 6), (1.5, -8), (-1.0, 4), (2.0, -4), (-1.5, 6)], [(2.0, -6), (-1.5, 4), (1.0, -2), (-2.0, 6), (1.5, -4)]
caja = [math.inf, math.inf, -math.inf, -math.inf]
def glifo(ch, x, base, rot, dy, k=1.0, ky=None):
    ky = ky or k
    name = cmap[ord(ch)]; adv = hmtx[name][0] * S * k
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    cx, cy = x + adv / 2, base - 330 * ky
    # (u, v) del glifo → X = x + u·S, Y = base + dy − v·S → giro alrededor de (cx, cy)
    e = c * (x - cx) - s * (base + dy - cy) + cx
    fy = s * (x - cx) + c * (base + dy - cy) + cy
    m = (c * S * k, s * S * k, s * S * ky, -c * S * ky, e, fy)
    pen = SVGPathPen(gs); gs[name].draw(TransformPen(pen, m))
    bp = BoundsPen(gs); gs[name].draw(TransformPen(bp, m))
    if bp.bounds:
        b = bp.bounds; caja[0] = min(caja[0], b[0]); caja[1] = min(caja[1], b[1]); caja[2] = max(caja[2], b[2]); caja[3] = max(caja[3], b[3])
    return pen.getCommands(), adv
def linea(texto, base, jit):
    x = 0; d = ''
    for ch, (rot, dy) in zip(texto, jit):
        p, adv = glifo(ch, x, base, rot, dy, KX, KY); d += p; x += adv + TRACK
    return d, x - TRACK
l1, w1 = linea('DÓNDE', 0, JIT[0])
l2, w2 = linea('SALGO', LINEA2, JIT[1])
# El "?" alto, de la cima de DÓNDE al pie de SALGO, a la derecha de ambas líneas.
q, _ = glifo('?', max(w1, w2) - 60, LINEA2 + 45, 8, 0, 1.55, 2.2)
r = lambda s: re.sub(r'-?\d+\.\d+', lambda m: str(round(float(m.group()), 1)), s)
vb = [round(caja[0] - 20), round(caja[1] - 20), round(caja[2] - caja[0] + 40), round(caja[3] - caja[1] + 40)]
print('// Generado por tools/wordmark.py a partir de Ultra (Apache 2.0, Astigmatic). No editar a mano.')
print(f"export const MARCA = {{ viewBox: '{' '.join(map(str, vb))}', palabra: '{r(l1 + l2)}', pregunta: '{r(q)}' }};")
