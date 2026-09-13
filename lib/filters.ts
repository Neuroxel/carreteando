import { CATEGORIAS, CIUDADES, FiltrosEvento } from './types';
export function parseFilters(params: URLSearchParams, defaultDate = 'futuro'): FiltrosEvento {
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
    fecha: value(
      'fecha',
      ['hoy', 'finde', 'futuro', 'semana', 'todos'],
      defaultDate,
    ) as FiltrosEvento['fecha'],
    precio: value('precio', ['gratis', 'pago', 'todos'], 'todos') as FiltrosEvento['precio'],
  };
}
