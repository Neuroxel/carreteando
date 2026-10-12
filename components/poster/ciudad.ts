/**
 * Ciudad regional en capas, como un collage serigráfico: cerros lejanos,
 * cerro con casas apiladas y ascensor, edificios cercanos traslúcidos con
 * ventanas caladas, y tendido eléctrico al frente. Todo es vector original,
 * generado una vez en el servidor con una semilla fija (mismo dibujo siempre).
 *
 * Espacio: viewBox 1000 × 600, anclado arriba (xMidYMin slice). En escritorio
 * se ve toda la franja superior; en un teléfono, el centro (x ≈ 280–720).
 *
 * Preparado para comunas: `ciudadPara(comuna)` podría devolver otro trazado
 * (Viña: torres bajas costeras; Reñaca: torres en pendiente). Por ahora hay una
 * sola composición regional.
 */
type Rng = () => number;
function semilla(n: number): Rng {
  let s = n >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Polígono con los vértices un poco corridos: papel cortado a mano. */
function poligono(puntos: [number, number][], rng: Rng, temblor = 1.2) {
  return (
    puntos
      .map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x + (rng() - 0.5) * temblor)} ${r1(y + (rng() - 0.5) * temblor)}`)
      .join('') + 'Z'
  );
}
function rect(x: number, y: number, w: number, h: number, rng: Rng, temblor = 1) {
  return poligono(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    rng,
    temblor,
  );
}
/** Perfil de cerro: suma de senos, determinista. */
function perfil(x: number, base: number, alto: number, fase: number) {
  return base - alto * (0.55 + 0.25 * Math.sin(x / 90 + fase) + 0.2 * Math.sin(x / 37 + fase * 2.3));
}
function cerro(base: number, alto: number, fase: number, desde = -20, hasta = 1020, fondo = 600) {
  const pts: string[] = [];
  for (let x = desde; x <= hasta; x += 10) pts.push(`${x} ${r1(perfil(x, base, alto, fase))}`);
  return `M${desde} ${fondo}L${pts.join('L')}L${hasta} ${fondo}Z`;
}

export type Ciudad = ReturnType<typeof ciudadRegional>;

export function ciudadRegional() {
  const rng = semilla(20261012);

  // Z1 · cerros lejanos y torres bajas de la costa (Viña) a la derecha.
  const lejos1 = cerro(250, 120, 0.4);
  const lejos2 = cerro(300, 90, 2.1);
  let lucesLejos = '';
  for (let i = 0; i < 70; i++) {
    const x = rng() * 1000;
    const y = perfil(x, 300, 90, 2.1) + 6 + rng() * 40;
    lucesLejos += rect(x, y, 2.4, 2.4, rng, 0.2);
  }
  let torresLejos = '';
  for (let x = 690; x < 1000; x += 22 + rng() * 18) {
    const h = 50 + rng() * 80;
    torresLejos += rect(x, 235 - h, 14 + rng() * 10, h + 40, rng, 0.8);
  }

  // Z2 · el cerro: casas apiladas en la pendiente, ascensor e iglesia.
  const cerroMedio = cerro(345, 150, 5.2, 200, 820);
  const casas: Record<'violeta' | 'lila' | 'coral' | 'crema', string> = { violeta: '', lila: '', coral: '', crema: '' };
  const colores = ['violeta', 'violeta', 'lila', 'coral', 'crema', 'violeta', 'lila'] as const;
  let ventanas = '';
  for (let x = 225; x < 790; x += 15 + rng() * 14) {
    const suelo = perfil(x, 345, 150, 5.2);
    const pisos = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < pisos; p++) {
      const w = 15 + rng() * 14;
      const h = 13 + rng() * 11;
      const y = suelo + 4 + p * (h + 4) + rng() * 6;
      if (y > 340) break;
      const c = colores[Math.floor(rng() * colores.length)];
      // Techo a dos aguas o plano, como las casas de cerro.
      const techo = rng() < 0.5 ? 0 : 5 + rng() * 5;
      casas[c] += poligono(
        [
          [x, y + techo],
          [x + w / 2, y],
          [x + w, y + techo],
          [x + w, y + techo + h],
          [x, y + techo + h],
        ],
        rng,
        1.4,
      );
      const vw = 3.4;
      for (let v = 0; v < (w > 22 ? 2 : 1); v++) ventanas += rect(x + 4 + v * 9, y + techo + 4, vw, 4.6, rng, 0.3);
    }
  }
  // Ascensor: riel diagonal, dos estaciones y el carro.
  const ascensor = {
    riel: 'M418 338L566 190M428 342L576 194',
    estaciones: rect(400, 330, 40, 22, rng) + rect(560, 176, 34, 22, rng),
    carro: 'M486 262l18 -18l14 14l-18 18z',
  };
  // Iglesia con torre y aguja.
  const iglesia = poligono(
    [
      [640, 300],
      [640, 210],
      [648, 196],
      [654, 160],
      [660, 196],
      [668, 210],
      [668, 300],
    ],
    rng,
    0.8,
  );

  // Z3 · edificios cercanos traslúcidos: trama + ventanas caladas (evenodd).
  type Edificio = { contorno: string; huecos: string };
  const edificio = (x: number, y: number, w: number, fondo: number, cols: number, filas: number, tanque = false): Edificio => {
    const contorno =
      rect(x, y, w, fondo - y, rng, 1.6) +
      (tanque ? rect(x + w * 0.55, y - 26, w * 0.26, 26, rng, 1) + `M${r1(x + w * 0.6)} ${y - 26}l${r1(w * 0.08)} -10l${r1(w * 0.08)} 10z` : '');
    let huecos = '';
    const mx = 10;
    const cw = (w - mx * 2) / cols;
    const fh = 34;
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.18) continue; // alguna ventana tapiada
        huecos += rect(x + mx + c * cw + 3, y + 14 + f * fh, cw - 7, fh - 12, rng, 1.2);
      }
    }
    return { contorno, huecos };
  };
  const cerca = [
    edificio(-30, 60, 200, 600, 4, 12, true),
    edificio(318, 250, 64, 600, 1, 9),
    edificio(600, 120, 118, 600, 2, 14),
    edificio(820, 40, 210, 600, 4, 16, true),
  ];

  // Z4 · tendido eléctrico (catenarias), aves y un poste.
  const cable = (y0: number, y1: number, comba: number) =>
    `M-20 ${y0}Q500 ${r1((y0 + y1) / 2 + comba)} 1020 ${y1}`;
  const cables = [cable(50, 92, 72), cable(64, 108, 70), cable(84, 126, 66)];
  let aves = '';
  for (const x of [452, 470, 503, 536]) {
    // y sobre el segundo cable (curva cuadrática en t = (x+20)/1040)
    const t = (x + 20) / 1040;
    const y = (1 - t) ** 2 * 64 + 2 * (1 - t) * t * (86 + 70) + t ** 2 * 108;
    aves += `M${x} ${r1(y - 1)}c-2 -9 4 -12 8 -9c3 -7 9 -6 9 0c-1 6 -8 9 -17 9z`;
  }
  const poste = rect(902, 20, 9, 360, rng, 0.6) + rect(872, 44, 70, 6, rng, 0.6) + rect(878, 76, 58, 5, rng, 0.6);

  return { lejos1, lejos2, lucesLejos, torresLejos, cerroMedio, casas, ventanas, ascensor, iglesia, cerca, cables, aves, poste };
}
