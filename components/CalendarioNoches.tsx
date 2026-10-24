'use client';
import { useState } from 'react';
import { etiquetaRango, MESES_ADELANTE, semanasDelMes, sumarMeses } from '../lib/rango-noches';

/**
 * Calendario táctil de noches: un toque elige un día, un segundo toque cierra el
 * rango (tocar el mismo día lo deja como día único). Solo botones: nunca abre el
 * teclado. Las noches pasadas no se pueden elegir. Cuenta lo que ya está en el
 * snapshot del teléfono, sin pedir nada al servidor.
 */
export default function CalendarioNoches({
  today,
  desde,
  hasta,
  conteo,
  onElegir,
  onCerrar,
}: {
  today: string;
  desde: string | null;
  hasta: string | null;
  conteo: (desde: string, hasta: string) => number;
  onElegir: (desde: string, hasta: string) => void;
  onCerrar: () => void;
}) {
  const [a, setA] = useState<string | null>(desde);
  const [b, setB] = useState<string | null>(hasta);
  const [esperandoFin, setEsperandoFin] = useState(false);
  const mesHoy = today.slice(0, 7);
  const mesTope = sumarMeses(mesHoy, MESES_ADELANTE);
  // Abre en el mes del rango elegido (si hay), si no en el de hoy.
  const [mes, setMes] = useState(() => (desde && desde.slice(0, 7) > mesHoy ? desde.slice(0, 7) : mesHoy));
  const semanas = semanasDelMes(mes);
  const nombreMes = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`));
  const tocar = (dia: string) => {
    if (!esperandoFin || !a) {
      setA(dia);
      setB(dia);
      setEsperandoFin(true);
      return;
    }
    const [x, y] = dia < a ? [dia, a] : [a, dia];
    setA(x);
    setB(y);
    setEsperandoFin(false);
  };
  const n = a && b ? conteo(a, b) : 0;
  return (
    <div className="cal-noches" role="group" aria-label="Elegir fechas">
      <p className="cal-ayuda" aria-live="polite">
        {!a ? 'Toca una noche. Para un rango, toca después la última.' : `${etiquetaRango(a, b!)}${esperandoFin ? ' · toca otra noche para un rango' : ''}`}
      </p>
      <div className="cal-mes">
        <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} disabled={mes <= mesHoy} aria-label="Mes anterior">
          ‹
        </button>
        <strong aria-live="polite">{nombreMes}</strong>
        <button type="button" onClick={() => setMes(sumarMeses(mes, 1))} disabled={mes >= mesTope} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="cal-dias" aria-hidden="true">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      {semanas.map((semana) => (
        <div className="cal-semana" key={semana[0]}>
          {semana.map((dia) => {
            const pasado = dia < today;
            const enRango = a && b && dia >= a && dia <= b;
            const borde = dia === a || dia === b;
            const fuera = dia.slice(0, 7) !== mes;
            if (fuera) return <span key={dia} className="cal-relleno" aria-hidden="true" />;
            return (
              <button
                type="button"
                key={dia}
                disabled={pasado}
                onClick={() => tocar(dia)}
                className={`${enRango ? 'en-rango' : ''} ${borde ? 'borde' : ''} ${dia === today ? 'hoy' : ''}`}
                aria-pressed={Boolean(enRango)}
                aria-label={etiquetaRango(dia, dia)}
              >
                {Number(dia.slice(8))}
              </button>
            );
          })}
        </div>
      ))}
      <p className="cal-nota">Cada noche dura hasta las 05:00: un show del sábado a la 1 am cuenta como viernes.</p>
      <div className="cal-acciones">
        <button type="button" className="button button-outline" onClick={onCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!a}
          onClick={() => a && b && onElegir(a, b)}
        >
          {a ? `Ver ${n} ${n === 1 ? 'carrete' : 'carretes'}` : 'Elige las fechas'}
        </button>
      </div>
    </div>
  );
}
