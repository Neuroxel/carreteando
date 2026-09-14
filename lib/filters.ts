import { CATEGORIAS, CIUDADES, FiltrosEvento, TIPOS_EVENTO } from './types';
export function parseFilters(params: URLSearchParams, defaultDate = 'futuro'): FiltrosEvento {
  params = new URLSearchParams(params);
  const cityAliases: Record<string, string> = {
    valparaiso: 'Valparaíso',
    'vina-del-mar': 'Viña del Mar',
    renaca: 'Reñaca',
    quilpue: 'Quilpué',
    'villa-alemana': 'Villa Alemana',
    concon: 'Concón',
  };
  const city = params.get('ciudad') || '';
  if (cityAliases[city]) params.set('ciudad', cityAliases[city]);
  const value = (key: string, allowed: string[], fallback: string) => {
    const v = params.get(key);
    return v && allowed.includes(v) ? v : fallback;
  };
  return {
    busqueda: (params.get('q') || '').trim().slice(0, 120),
    categoria: value(
      'categoria',
      ['todos', ...CATEGORIAS.map((c) => c.value)],
      'todos',
    ) as FiltrosEvento['categoria'],
    ciudad: value('ciudad', ['todos', ...CIUDADES], 'todos'),
    tipo: value(
      'tipo',
      ['todos', ...TIPOS_EVENTO.map((t) => t.value)],
      'todos',
    ) as FiltrosEvento['tipo'],
    fecha: value(
      'fecha',
      ['hoy', 'finde', 'futuro', 'semana', 'todos'],
      defaultDate,
    ) as FiltrosEvento['fecha'],
    precio: value('precio', ['gratis', 'pago', 'todos'], 'todos') as FiltrosEvento['precio'],
  };
}
