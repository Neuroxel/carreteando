"""Genera las texturas de papel e imprenta de Dónde Salgo (una sola vez, offline).
Ruido filtrado en frecuencia (FFT): los tiles son periódicos por construcción, así
que se repiten sin costura; los parches macro llevan caída radial y no se repiten."""
import numpy as np, sys, os
from PIL import Image
out = sys.argv[1]
def ruido(n, f_lo, f_hi, seed, aniso=1.0):
    r = np.random.default_rng(seed).standard_normal((n, n))
    F = np.fft.fft2(r)
    fy = np.fft.fftfreq(n)[:, None] * aniso; fx = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx**2 + fy**2) * n
    band = (f >= f_lo) & (f <= f_hi)
    v = np.real(np.fft.ifft2(F * band * (1 / np.maximum(f, 1))))
    v = (v - v.min()) / (v.max() - v.min())
    return v
def guardar(nombre, rgb, alpha, q=80):
    h, w = alpha.shape
    a = np.clip(alpha, 0, 1)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = np.array(rgb, np.uint8)
    img[..., 3] = (a * 255).astype(np.uint8)
    p = os.path.join(out, nombre)
    Image.fromarray(img, 'RGBA').save(p, 'WEBP', quality=q, method=6)
    print(nombre, os.path.getsize(p))
# MICRO: fibra clara (tile de 256 px, se muestra a 128 CSS px: nítida en pantallas 2x)
v = ruido(256, 36, 128, 4); guardar('fibra.webp', (242, 230, 222), np.clip((v - .55) * 1.1, 0, .22))
# MICRO: grano oscuro para tarjetas de papel (256 px mostrado a 128, suave)
v = ruido(256, 48, 128, 7); guardar('grano-papel.webp', (51, 41, 64), np.clip((v - .55) * .8, 0, .12))
# MACRO: parches de densidad de tinta (no se repiten), caída radial
yy, xx = np.mgrid[0:256, 0:256] / 255.0
caida = np.clip(1 - np.sqrt((xx - .5)**2 + (yy - .5)**2) / .5, 0, 1) ** 1.4
for nombre, seed, rgb in [('tinta-a.webp', 31, (10, 10, 22)), ('tinta-b.webp', 57, (30, 31, 58)), ('tinta-c.webp', 83, (10, 10, 22))]:
    v = ruido(256, 2, 14, seed, aniso=1.3)
    guardar(nombre, rgb, np.clip((v - .38) * 1.6, 0, .75) * caida, q=70)
# MACRO del hero: manchas de tinta + motas, un solo uso a tamaño cover
v = ruido(768, 3, 22, 9); m = np.clip((v - .45) * 1.6, 0, .55)
s = ruido(768, 180, 384, 21); mot = np.clip((s - .82) * 4, 0, .6)
alpha = np.maximum(m, mot)
rgb = np.where(mot[..., None] > m[..., None], np.array([242, 226, 220]), np.array([10, 10, 23])).astype(np.uint8)
img = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
Image.fromarray(img, 'RGBA').save(os.path.join(out, 'hero.webp'), 'WEBP', quality=55, method=6); print('hero.webp', os.path.getsize(os.path.join(out, 'hero.webp')))
# Máscara de borde gastado del afiche (alfa; se estira, el borde es fino)
n = 512; e = ruido(n, 20, 80, 2); yy, xx = np.mgrid[0:n, 0:n]
d = np.minimum.reduce([xx, yy, n - 1 - xx, n - 1 - yy]).astype(float)
borde = np.clip((d - 3 - e * 6) / 2, 0, 1)
Image.fromarray((borde * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, 'borde.webp'), 'WEBP', quality=80)
im = Image.open(os.path.join(out, 'borde.webp')); a = np.array(Image.fromarray((borde*255).astype(np.uint8),'L'))
rgba = np.zeros((n, n, 4), np.uint8); rgba[..., 3] = a
Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'borde.webp'), 'WEBP', quality=80); print('borde.webp', os.path.getsize(os.path.join(out, 'borde.webp')))

# --- Pasada "afiche de Carlos": fibras blancas, motas de fotocopia y poros de tinta ---
from PIL import ImageDraw
def fibras(nombre, n_px, cantidad, seed, rgb, alfa):
    """Fibras cortas y curvas, dibujadas al 3x y reducidas (antialias). Tile periódico:
    cada fibra se dibuja también desplazada ±n para que cruce el borde sin costura."""
    rng = np.random.default_rng(seed); S = 3; N = n_px * S
    im = Image.new('L', (N, N), 0); d = ImageDraw.Draw(im)
    for _ in range(cantidad):
        x, y = rng.uniform(0, N, 2); ang = rng.uniform(0, np.pi); largo = rng.uniform(10, 34) * S
        curva = rng.uniform(-.5, .5); pts = []
        for t in np.linspace(0, 1, 8):
            a = ang + curva * t
            pts.append((x + np.cos(a) * largo * t, y + np.sin(a) * largo * t))
        w = max(1, int(rng.uniform(.8, 1.5) * S))
        for dx in (-N, 0, N):
            for dy in (-N, 0, N):
                d.line([(px + dx, py + dy) for px, py in pts], fill=int(255 * rng.uniform(.45, 1)), width=w)
    a = np.array(im.resize((n_px, n_px), Image.LANCZOS)).astype(float) / 255 * alfa
    guardar(nombre, rgb, a, q=82)
fibras('fibras.webp', 768, 140, 12, (246, 238, 228), .55)
def motas(nombre, n_px, cantidad, seed, rgb, alfa):
    rng = np.random.default_rng(seed); S = 3; N = n_px * S
    im = Image.new('L', (N, N), 0); d = ImageDraw.Draw(im)
    for _ in range(cantidad):
        x, y = rng.uniform(0, N, 2); r = rng.choice([.6, .8, 1, 1.4, 2.2], p=[.35, .3, .2, .1, .05]) * S
        v = int(255 * rng.uniform(.4, 1))
        for dx in (-N, 0, N):
            for dy in (-N, 0, N):
                d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r], fill=v)
    a = np.array(im.resize((n_px, n_px), Image.LANCZOS)).astype(float) / 255 * alfa
    guardar(nombre, rgb, a, q=82)
motas('motas-claras.webp', 538, 260, 31, (240, 228, 218), .8)
motas('motas-oscuras.webp', 538, 220, 32, (16, 14, 24), .7)
# Poros de tinta (máscara alfa): 1 = tinta, 0 = papel. Para títulos grandes.
v = ruido(256, 30, 100, 41); huecos = np.clip((v - .62) * 9, 0, 1)
borde = ruido(256, 4, 15, 42); claros = np.clip((borde - .7) * 3, 0, .35)
alpha = np.clip(1 - huecos - claros, 0, 1)
rgba = np.zeros((256, 256, 4), np.uint8); rgba[..., :3] = 0; rgba[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'poros.webp'), 'WEBP', quality=80, method=6); print('poros.webp', os.path.getsize(os.path.join(out, 'poros.webp')))
fibras('fibras-suaves.webp', 768, 110, 13, (246, 238, 228), .24)
