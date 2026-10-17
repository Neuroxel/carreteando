import { LogoApilado } from './Logo';

/**
 * El H1 de portada y de explorar. En la portada el logo es la imagen y el
 * encabezado lleva su nombre para lectores de pantalla ("Dónde Salgo"); en
 * explorar dice qué hay: Carretes, Lugares o Radar.
 */
export default function TituloSeccion({ home, vista, ver }: { home: boolean; vista: 'lista' | 'mapa'; ver: string }) {
  if (home)
    return (
      <h1>
        <span className="sr-only">Dónde Salgo</span>
        <LogoApilado className="hero-logo hero-logo-apilado" decorativo />
      </h1>
    );
  return (
    <h1>
      {vista === 'mapa' ? (
        <>
          Radar <em>de carretes.</em>
        </>
      ) : ver === 'lugares' ? (
        <>
          Lugares <em>para salir.</em>
        </>
      ) : (
        <>
          Carretes <em>de la región.</em>
        </>
      )}
    </h1>
  );
}
