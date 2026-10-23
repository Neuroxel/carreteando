import { CATEGORIAS, CIUDADES, FiltrosEvento, TIPOS_EVENTO } from './types';
import { ESCENAS } from './escenas';
import { zonaValida } from './territorios';
import { intencionPorSlug } from './intenciones';
/** Topes de presupuesto, en CLP, tal como van en la URL (?precio=5000). */
export const PRESUPUESTOS = ['5000', '10000', '15000'] as const;
export function parseFilters(params: URLSearchParams, defaultDate = 'futuro'): FiltrosEvento {
  params = new URLSearchParams(params);
  const cityAliases: Record<string, string> = {
    valparaiso: 'Valparaíso',
    'vina-del-mar': 'Viña del Mar',
    renaca: 'Reñaca',
    quilpue: 'Quilpué',
    'villa-alemana': 'Villa Alemana',
    concon: 'Concón',
    limache: 'Limache',
    olmue: 'Olmué',
    quillota: 'Quillota',
    'la-calera': 'La Calera',
    quintero: 'Quintero',
    puchuncavi: 'Puchuncaví',
    maitencillo: 'Maitencillo',
  };
  const city = params.get('ciudad') || '';
  if (cityAliases[city]) params.set('ciudad', cityAliases[city]);
  const value = (key: string, allowed: string[], fallback: string) => {
    const v = params.get(key);
    return v && allowed.includes(v) ? v : fallback;
  };
  const ciudad = value('ciudad', ['todos', ...CIUDADES], 'todos');
  return {
    zona: zonaValida(params.get('zona'), ciudad),
    plan: intencionPorSlug(params.get('plan'))?.slug ?? null,
    // Comuna manual manda sobre "Cerca de mí".
    cerca: params.get('cerca') === '1' && ciudad === 'todos',
    busqueda: (params.get('q') || '').trim().slice(0, 120),
    categoria: value(
      'categoria',
      ['todos', ...CATEGORIAS.map((c) => c.value)],
      'todos',
    ) as FiltrosEvento['categoria'],
    ciudad,
    tipo: value(
      'tipo',
      ['todos', ...TIPOS_EVENTO.map((t) => t.value)],
      'todos',
    ) as FiltrosEvento['tipo'],
    fecha: value(
      'fecha',
      ['hoy', 'manana', 'finde', 'futuro', 'semana', 'todos'],
      defaultDate,
    ) as FiltrosEvento['fecha'],
    precio: value('precio', ['gratis', 'pago', 'todos', ...PRESUPUESTOS], 'todos') as FiltrosEvento['precio'],
    escena: value('escena', ['todos', ...ESCENAS.map((e) => e.slug)], 'todos'),
  };
}
