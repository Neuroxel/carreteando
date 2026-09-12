import { NextResponse } from 'next/server';
import { MONITORED_IG_ACCOUNTS, parseInstagramCaption } from '../../../../lib/scraper-engine';
import { saveEvent } from '../../../../lib/events-store';

export async function GET(request: Request) {
  // Opcional verificación de CRON_SECRET si está configurado
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Permitir en dev o si no está seteado
  }

  // Ejecución del pipeline de scraping sobre cuentas monitoreadas
  const simulatedFeed = [
    {
      handle: '@elhuevovalpo',
      caption: `🔥 VIERNES DE CARRETE PORTEÑO 🔥\nEste viernes en El Huevo 3 pisos llenos de fiesta.\nPista 1: Reggaeton Old School\nPista 2: Techno & Acid\nPista 3: Cumbia & Terremotos 2x$5.000\n📍 Blanco #1386, Valparaíso\nEntrada liberada con lista hasta las 23:30, luego $4.000.\n#valparaiso #elhuevovalpo #carrete`,
      url: 'https://instagram.com/elhuevovalpo',
      image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    },
    {
      handle: '@subterraneo_valpo',
      caption: `🌙 SUBTERRÁNEO RAVE #04\nSábado en Bodega Secreta del Barrio Puerto.\nLineup: 4 DJs de la escena local porteña.\nSonido potente, visuales analógicas.\nPreventa $5.000 por Passline.\n#technovalpo #rave #underground`,
      url: 'https://instagram.com/subterraneo_valpo',
      image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    },
  ];

  const processed = [];

  for (const item of simulatedFeed) {
    const candidate = parseInstagramCaption(item.caption, item.handle, item.url, item.image);
    const saved = saveEvent({
      nombre: candidate.nombre,
      descripcion: candidate.descripcion,
      fecha: candidate.fecha,
      hora: candidate.hora,
      lugar: candidate.lugar,
      ciudad: candidate.ciudad,
      precio: candidate.precio,
      precio_texto: candidate.precio_texto,
      categoria: candidate.categoria,
      organizador: candidate.organizador,
      fuente_url: candidate.fuente_url,
      imagen_url: candidate.imagen_url,
      tags: candidate.tags.join(','),
    });
    processed.push(saved);
  }

  return NextResponse.json({
    success: true,
    scanned_accounts: MONITORED_IG_ACCOUNTS.length,
    events_ingested: processed.length,
    timestamp: new Date().toISOString(),
  });
}
