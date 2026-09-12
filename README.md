# 🍻 Carretes V Región — Centralizador de Fiestas, Universitarios & Under

> **El "Facebook Events" de la época dorada, revivido y modernizado para la era de Instagram en Valparaíso, Viña del Mar, Reñaca y Quilpué.**

Plataforma web diseñada para responder a la pregunta que todo universitario o joven se hace: **"¿Dónde se carretea hoy en la V Región?"** Centraliza la información que actualmente se encuentra dispersa en historias de Instagram, flyers de DM, tomas de facultades y grupos de WhatsApp.

---

## ⚡ Características Principales

1. **Cartelera Centralizada & Filtros Inteligentes**:
   - **Por Fecha**: *🔥 Esta Noche (Hoy)*, *⚡ Este Finde (Vie-Dom)*, *Próximos 7 días*, o cartelera completa.
   - **Por Comuna**: Valparaíso (Subida Ecuador, Barrio Puerto, Cerro Alegre, Muelle Barón), Viña del Mar (Población Vergara, 1 Norte), Reñaca (Sector 5), Quilpué (Trotamundos, Cumming), Concón y Villa Alemana.
   - **Por Categoría**: 🎓 Mechoneos & Universitarios (UV, PUCV, USM, UPLA), 🌙 Under & Fiestas Ocultas, 🎧 Electrónica & Techno, 🪗 Cumbia Porteña & Pachanga, 🔥 Reggaetón & Perreo 2000s, 🎸 Rock & Tocatas en Vivo.
   - **Por Precio**: Filtro de *🎉 Solo Gratis / Con Lista Free* y *🎫 Con Entrada*.

2. **📡 Radar de Instagram en Vivo**:
   - Monitorea automáticamente perfiles clave de la bohemia local: `@elhuevovalpo`, `@terrazabellavista_valpo`, `@mascaraclub_oficial`, `@trotamundosquilpue`, `@feuv.oficial`, `@feusm_casa_central`, colectivos techno under y productoras.
   - **Importador Inteligente**: Cualquier usuario o productor puede pegar el texto/caption de un post o flyer de Instagram y el motor extrae automáticamente: Nombre, Fecha, Hora, Lugar, Precio y Categoría.

3. **✍️ Publicación Abierta para Productores & Centros de Alumnos**:
   - Formulario ultra-rápido de autoservicio para subir flyers en 30 segundos con previsualización en vivo.
   - Persistencia local y en base de datos.

4. **🗺️ Mapa de Hotspots de la Bohemia**:
   - Visualización por zonas de calor: Subida Ecuador, Muelle Barón, Barrio Puerto, Reñaca Sector 5, Trotamundos Quilpué, etc.

5. **📱 Diseñado para Celular (Mobile-First)**:
   - Botón directo de **"Mandar al Grupo de WhatsApp"** con mensaje preformateado.
   - RSVP ("Me interesa / Voy") con contador en tiempo real.
   - Enlace directo a Google Maps para saber cómo llegar.

---

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components y Client Components optimizados)
- **Lenguaje**: TypeScript
- **Estilos**: CSS nativo con diseño Dark Mode Glassmorphism, tokens de diseño y animaciones suaves
- **Iconos**: [Lucide React](https://lucide.dev/)
- **Scraping Pipeline**: Apify Actors / Heuristic & LLM Parsing
- **Automatización**: Vercel Cron Jobs (`0 */6 * * *`)
- **Hosting**: Vercel (`carretes.vercel.app`)

---

## 🚀 Despliegue en Vercel

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tpotp/carretes.git
   cd carretes
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Correr en modo desarrollo:
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:3000](http://localhost:3000).

4. Desplegar en Vercel:
   - Conectar el repositorio de GitHub `tpotp/carretes` en [vercel.com](https://vercel.com).
   - El proyecto se compilará automáticamente con `npm run build`.
   - Asignar el dominio personalizado o usar `carretes.vercel.app`.

---

## 📋 Variables de Entorno Opcionales (`.env.local`)

```env
# Supabase (opcional para sincronización multi-servidor)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Apify / SerpAPI (opcional para scraping externo)
APIFY_API_TOKEN=your-token
GEMINI_API_KEY=your-gemini-key

# Cron Job Secret
CRON_SECRET=secret-key
```

---

Hecho con ❤️ para la juventud y cultura bohemia de la V Región de Chile.
