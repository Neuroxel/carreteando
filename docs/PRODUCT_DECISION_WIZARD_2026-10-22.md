# Dónde Salgo — decisión de producto: asistente rápido para decidir

Fecha: 22-oct-2026  
Base: `main@be0d050` (PR #23 + #24 ya integrados)  
Estado: especificación canónica para la siguiente iteración.

## Problema de producto

El producto ya resuelve navegación, Radar, filtros, comunas y cartografía mucho mejor que el piloto inicial, pero el feedback de usuarios reales muestra un problema superior:

> una cartelera grande sigue obligando a mirar demasiado antes de decidir.

El valor agregado de Dónde Salgo no debe ser solamente "tener muchos panoramas". Debe ser **reducir el tiempo de decisión** y responder rápido a preguntas del tipo:

- quiero bailar hoy;
- quiero tomar algo cerca;
- quiero música en vivo en Valparaíso;
- quiero algo barato en Quilpué;
- quiero karaoke;
- quiero reírme / ver comedia;
- no sé qué quiero, muéstrame buenas opciones.

La app no debe convertirse en un catálogo tipo Netflix donde la abundancia genera parálisis.

## Decisión

Crear un **asistente rápido de intención** en la portada.

No será un modal obligatorio ni bloqueará la cartelera.

Debe poder:
1. usarse en pocos toques;
2. omitirse con "Ver todo";
3. producir filtros/estado URL compartibles;
4. terminar en resultados normales de Dónde Salgo;
5. mostrar primero una selección corta de mejores opciones;
6. conservar acceso a toda la cartelera.

La navegación canónica sigue siendo:

**Carretes · Lugares · Radar · Aportar**

"Radar" se mantiene como marca de la función de proximidad porque dentro de la página ya se explica como "Carretes cerca de ti".

## Arquitectura de la experiencia

### Entrada principal

Encima de la cartelera, después de la identidad de marca y búsqueda:

**¿Qué quieres hacer?**

Opciones iniciales, revisadas contra los datos actuales:

- Bailar
- Tomar algo
- Música en vivo
- Karaoke
- Comedia
- Algo tranqui
- Sorpréndeme

No usar todavía:
- "Comer" como categoría principal, porque la base actual no modela de forma fiable oferta gastronómica suficiente para prometer resultados de calidad.
- Parques/familia como parte de esta misma vertical. Eso será otra vertical futura.

Siempre visible:
**Ver todos los carretes**

### Segundo paso

**¿Cuándo?**

- Ahora / Esta noche
- Mañana
- Este finde
- Más adelante

Entre 00:00 y 04:59, "Ahora / Esta noche" sigue usando la fecha nocturna canónica del día anterior hasta las 05:00.

### Tercer paso

**¿Dónde?**

- Cerca de mí
- Toda la región
- Valparaíso
- Viña del Mar
- Quilpué
- Villa Alemana
- Concón
- demás comunas disponibles

Si el usuario elige **Cerca de mí**:
- usar el flujo GPS canónico de Radar;
- no mandar coordenadas al backend;
- si precisión >500 m, no afirmar barrio;
- si hay territorio verificado y precisión suficiente, usarlo para ordenar/priorizar.

Si el usuario selecciona una comuna manualmente:
- la comuna manda sobre GPS.

## No forzar un orden rígido

La UI puede presentarse visualmente como 3 preguntas, pero el usuario puede responder en cualquier orden.

Ejemplo:
- Bailar
- Esta noche
- Cerca de mí

o:
- Quilpué
- Comedia
- Este finde

Cada selección actualiza el estado del asistente y el conteo de resultados.

## Capa de intención

Crear una capa explícita, por ejemplo:

`lib/intenciones.ts`

No convertir las intenciones directamente en búsquedas de texto arbitrarias.

Cada intención debe tener:
- `slug`
- `label`
- `description`
- `icon`
- regla de eventos
- regla de lugares
- parámetros URL canónicos
- fallback seguro

### Bailar

Eventos:
- categorías: electronica, cumbia, reggaeton;
- tipos compatibles: club, fiesta_universitaria, festival cuando corresponda;
- escenas: electrónica, tropical, urbano.

Lugares:
- club
- discoteca
- club-electronico
- tags verificadas asociadas a baile.

### Tomar algo

Esta intención es principalmente de **lugares**, no necesariamente de eventos.

Lugares:
- bar
- pub
- terraza

Puede priorizar lugares con un evento esta noche, pero no exigirlo.

No afirmar "abierto ahora" salvo que exista horario verificable suficiente.

### Música en vivo

Eventos:
- concierto
- tocata
- live
- festival
- peña cuando sea musical.

Lugares:
- sala-en-vivo
- tags verificadas en-vivo, jazz, rock, tocatas.

### Karaoke

Eventos y lugares según:
- escena karaoke;
- tipo lugar karaoke;
- coincidencia revisada actual.

### Comedia

La base actual NO tiene `TipoEvento=comedia`.

No resolverlo con regex informal en la UI.

Crear una clasificación canónica.

Opción mínima:
- nueva escena `comedia` basada en evidencia controlada de fuente/título/organizador y fixtures;
- o un `TipoEvento` nuevo si el cambio de schema es suficientemente limpio.

Debe cubrir stand-up/comedia sin meter teatro general por accidente.

ComedyPass y ComediaTicket son señales claras para esta clasificación.

### Algo tranqui

No prometer "tranquilo" como verdad absoluta sin datos.

V1 puede definirse con una combinación conservadora de:
- noche cultural;
- teatro/cultura;
- ciertos lugares tipo terraza/bar con tags explícitas compatibles;
- eventos sin categorías de club/urbano/electrónica.

Etiquetar internamente como criterio editorial, no como hecho objetivo.

### Sorpréndeme

No aleatorio puro.

Ranking diverso:
- temporalmente útil;
- dato verificado;
- cercanía si hay GPS;
- diversidad de lugar/estilo;
- precio conocido;
- evitar 5 resultados del mismo venue.

## Resultado del asistente: evitar el problema "Netflix"

Después de completar al menos una intención o restricción fuerte, NO mostrar primero 40 cards iguales.

Mostrar:

### "Te recomendamos"

Entre 3 y 6 opciones.

Cada opción debe explicar por qué está ahí con señales reales, por ejemplo:

- A 1,2 km
- Empieza a las 23:00
- $5.000
- En Quilpué
- Entrada gratis
- Ya empezó
- Fuente oficial

No inventar:
- popularidad;
- "ideal para una cita";
- ambiente;
- nivel de gente;
- seguridad;
- "el mejor".

Luego:

**Ver todas las 14 opciones**

que abre la lista completa con los mismos filtros.

Si no hay suficientes eventos:
- completar con Lugares compatibles claramente separados;
- o ampliar temporal/geográficamente con consentimiento visible.

Nunca mezclar silenciosamente otra comuna.

## Ranking V1

Crear ranking determinista y testeable.

Prioridades sugeridas:

1. compatibilidad exacta con intención;
2. estado temporal:
   - próximo;
   - iniciado;
   - sin hora;
   - finalizado explícito fuera;
3. distancia, si GPS útil;
4. misma comuna/zona;
5. calidad/verificación de fuente;
6. precio conocido;
7. diversidad por venue.

No rankear por:
- clicks;
- likes;
- supuesta popularidad;
- engagement no disponible.

## Precio: hacerlo mucho más visible

Feedback de usuario: el precio existe pero "sale muy piola abajo".

En `EventCard`, el precio está actualmente en el bloque inferior.

Cambiar jerarquía visual sin perder el orden actual de lectura.

Debe poder escanearse junto con:
- hora;
- lugar;
- distancia si aplica.

Recomendación:
- badge/chip de precio cerca del encabezado de metadata;
- mantener texto completo de condición en card/ficha;
- "Gratis" sólo si realmente es gratuito;
- agotado no debe parecer precio comprable.

Ejemplos:
- **$5.000**
- **Gratis**
- **Desde $8.000** (sólo si ese tier está comprable)
- **Precio por confirmar**

No exagerar visualmente precios desconocidos.

## Buscador

Mantener búsqueda libre.

Mejorar el placeholder para reflejar intención además de entidades:

"¿Qué quieres hacer? Ej: bailar, rock, karaoke, Cerro Alegre…"

Pero:
- el wizard no debe depender del buscador;
- palabras como "bailar" deben mapear a la capa de intenciones, no sólo a coincidencia textual si se puede detectar con seguridad.

## Dos modos de uso que deben convivir

### Decidir por mí
Wizard rápido + shortlist.

### Quiero explorar
Cartelera completa + filtros + mapa + Lugares.

No esconder una detrás de la otra.

## Defectos MEDIUM pendientes del QA del 22-oct

Corregir junto al siguiente PR visual si no se corrigieron antes:

1. chips de comuna:
   - separar visualmente nombre y badge numérico;
   - evitar "Valpo2", "Viña1", "Quilpué1".

2. Filtros colapsados:
   - si existen filtros secundarios activos, mostrar cantidad:
     - `Filtros (2)`
   - no sólo "Filtros · activos".

Contar únicamente filtros secundarios realmente activos.

## Radar

No renombrar todavía "Radar".

Razón:
- ya tiene subtítulo explícito "Carretes cerca de ti.";
- QA externo determinó que se entiende;
- cambiar la navegación otra vez crea churn innecesario.

Reevaluar sólo si pruebas físicas muestran confusión persistente.

## Prueba física obligatoria

Toda lógica GPS anterior se probó con simulación.

Antes de declarar completamente cerrado:

Android real:
- Wi-Fi
- datos móviles
- permiso prompt/granted/denied
- interior/exterior si es posible
- fix inicial grueso → precisión mejorada
- recentrar

iPhone real si está disponible:
mismos casos.

Registrar:
- navegador;
- precisión obtenida;
- tiempo hasta primer fix;
- tiempo hasta fix útil;
- territorio mostrado;
- resultados más cercanos.

## Métricas de producto sin invadir privacidad

No registrar coordenadas.

Sí puede registrarse de manera agregada y no identificante:

- wizard_started
- wizard_completed
- wizard_skipped
- intent_selected
- date_selected
- location_mode = manual | gps | all_region
- shortlist_shown
- shortlist_opened
- view_all_clicked
- map_opened

NO enviar lat/lng.

Objetivo de producto:
medir si el asistente reduce fricción.

## Criterios de aceptación V1

PASS si:

- se puede llegar a una shortlist en <=3 decisiones;
- "Ver todo" siempre existe;
- cada intención visible tiene resultados coherentes o se oculta;
- no hay categoría basada en datos insuficientes;
- comuna manual nunca mezcla otras comunas;
- GPS sigue client-only;
- shortlist explica razones verificables;
- precio es visible al escanear;
- URL reproduce la selección;
- back/forward funciona;
- mobile 360/375/390/430 sin overflow;
- accesibilidad básica PASS;
- tests existentes no bajan;
- CI/Vercel verdes.

## División de trabajo

### Claude
Ingeniería:
- intenciones;
- wizard;
- ranking/shortlist;
- URL/state;
- precio visual;
- fixes MEDIUM;
- tests;
- PR/CI/deploy.

### Antigravity
QA adversarial y taxonomía:
- validar que cada intención devuelve resultados semánticamente correctos;
- detectar falsos positivos/negativos;
- probar first-10-seconds;
- comparar shortlist vs "Ver todo";
- QA físico si el entorno lo permite, sin mutar producción.

### Gemini
Benchmark/product language:
- estudiar patrones de asistentes rápidos / decision helpers de nightlife/events;
- proponer microcopy;
- no modificar código;
- no inventar features que los datos no puedan sostener.

### Work / Supabase
Sólo cuando haga falta schema/data:
- clasificación comedia;
- tags de lugares;
- migraciones;
- QA DB/snapshot.

## No hacer ahora

- vertical familiar/niños dentro de este producto;
- IA generativa como requisito para recomendar;
- perfiles psicológicos/personales;
- recomendación por edad inferida;
- feed infinito;
- puntuación de "popularidad" inventada;
- reviews sin fuente;
- tracking continuo GPS;
- personalización que requiera cuenta.

## Norte de producto

Dónde Salgo debe responder:

**"Dime qué quieres hacer, cuándo y dónde; yo te reduzco el ruido y te muestro pocas opciones útiles."**

No:

**"Aquí tienes 120 cosas, elige."**
