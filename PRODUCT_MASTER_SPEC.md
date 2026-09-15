# Carreteando — especificación maestra

Documento canónico del producto. Un agente o una persona nueva debería entender Carreteando
leyendo sólo este archivo. Estado: **15 de septiembre de 2026**.

## 1. Qué es

> **Carreteando es el mapa vivo de la noche en la Región de Valparaíso.**
> Dónde salir hoy, qué hay, cuánto cuesta y cómo está ahora.

No es una ticketera, ni un directorio de eventos, ni un scraper de Instagram, ni una guía turística.
Es la capa de descubrimiento que responde una sola pregunta:

> **«Estoy acá y quiero salir. ¿Qué hay y dónde está bueno?»**

La diferencia con todo lo demás es que respondemos **aunque no haya ningún evento con entrada**.

## 2. Para quién

| Usuario | Qué necesita |
|---|---|
| Quien sale (20–35, Valpo / Viña / interior) | Decidir en menos de un minuto, con hora, precio y cómo llegar |
| Quien llega de afuera | Entender la geografía nocturna real, no la administrativa |
| El local chico | Que su Instagram y su programación aparezcan sin pagar ni operar un panel |
| El organizador | Que su evento se encuentre, con enlace a donde vende |

## 3. El bucle

```
DESCUBRIR → IR → REPORTAR → CREAR → DISTRIBUIR → (atribuir → recompensar) → DESCUBRIR
```

Hoy se optimizan los cinco primeros. Atribución y recompensa quedan para cuando haya identidad.

## 4. Entidades

| Entidad | Regla que la define |
|---|---|
| **LUGAR** | Existe tenga o no evento esta noche. Es la entidad central |
| **EVENTO** | Ocurrencia fechada. Se enlaza a un lugar cuando se conoce |
| **ZONA** | Unidad real de descubrimiento (Subida Ecuador), no la comuna |
| **FUENTE** | De dónde salió cada dato, siempre visible |
| **REPORTE EN VIVO** | Opinión voluntaria de quien está ahí. Caduca sola |
| **APORTE** | Envío de la comunidad. Privado hasta aprobarse |
| *Promotor, medios, usuario, grupo* | Futuros, ya previstos en el backlog |

Un evento nunca representa un lugar, y un lugar nunca se inventa para colgar un evento temporal:
una fonda de cuatro días es un evento con dirección propia, no un recinto permanente.

## 5. Arquitectura de la información

```
/                    portada: descubrimiento (estacional cuando corresponde)
/buscar              cartelera con filtros de fecha, zona, estilo, tipo y precio
/lugares             los lugares, por comuna y tipo
/lugar/[slug]        ficha estable del lugar
/zonas               zonas reales + vista por comuna
/zonas/[slug]        una zona con sus lugares y lo que viene
/evento/[id]         ficha de evento
/publicar            aportes de la comunidad
/confianza           de dónde salen los datos
/admin               revisión privada
```

## 6. Modelo de confianza

Cuatro estados que **no se aplanan en «verificado»**: fuente oficial · curaduría revisada · enviado
por la comunidad · reporte de la comunidad.

Reglas que no se rompen:

- Nunca se inventa hora, precio, género musical ni verificación del organizador.
- Lo incierto queda privado; no se publica para engordar el conteo.
- Lo vencido desaparece solo, por fecha de Chile.
- Un cierre confirmado se registra como cerrado, para que no vuelva a entrar desde una guía vieja.
- Un reporte en vivo necesita **dos voces coincidentes** y muestra siempre su muestra y antigüedad.

## 7. Principios visuales

Ver `DESIGN_SYSTEM.md`. En resumen: se mira de noche, con una mano y con prisa. Una base oscura,
acento de marca, acento por ciudad sólo en filetes y chips. Arte generativo cuando no hay flyer,
determinista pero nunca repetido. El movimiento comunica vivo, no decora.

## 8. Marca

`Carreteando` es el nombre **de trabajo** y sigue en producción. `BRAND_NAMING_EXPLORATION.md`
contiene 30 candidatos y cinco finalistas; la recomendación es **Prendido**, porque nombra
exactamente la ventaja del producto. **Es una decisión del propietario y no se ejecuta sin ella.**

El asterisco naranja actual se considera provisional: se parece demasiado a un motivo visual
genérico de producto de IA. La identidad definitiva se cierra **después** del nombre, no antes.

## 9. Comunidad

Orden de dependencias, sin saltarse pasos:

```
IDENTIDAD → DENUNCIA / BLOQUEO / MODERACIÓN → COMENTARIOS → MEDIOS → SOCIAL → EMPAREJAMIENTO
```

Hoy existe el nivel cero: reportes en vivo anónimos, con límite por dispositivo y caducidad.
Navegar nunca exigirá cuenta. Comentarios, fotos, «Voy», grupos y citas están en el backlog con sus
requisitos previos explícitos. No se envía chat ni citas sin control de edad, bloqueo y denuncia.

## 10. Modelo de negocio

Dirección, no implementación:

| Nivel | Qué ofrece |
|---|---|
| Gratis | reclamar el lugar, corregir datos, enviar programación |
| Socio | perfil enriquecido, logo y banner, promociones, métricas, sincronización |
| Destacado | posición en descubrimiento, **siempre rotulada** |

Regla innegociable: **el pago nunca altera el estado en vivo de la comunidad.** Lo que la gente
reporta sobre cómo está un lugar no se compra.

No habrá checkout propio. Enlazamos a quien vende, incluida Vesti.

## 11. No-objetivos

Ticketera propia · guía de restaurantes, hoteles o turismo diurno · feed infinito · conteos de gente
inventados · aforo inferido · rastreo de ubicación · identidades de asistentes · reseñas con
estrellas · recompensas por reseñar positivo · recomendador opaco.

## 12. Estado y hoja de ruta

Estado: **INTERNAL TEST**. Ver `PRODUCT_BACKLOG.md` para la lista canónica, `REGIONAL_COVERAGE.md`
para la cobertura y por qué falta lo que falta, y `SOURCE_REGISTRY.md` para el rendimiento de cada
fuente.

Lo único que separa de CLOSED BETA es la verificación funcional del panel `/admin`, que requiere un
inicio de sesión humano.
