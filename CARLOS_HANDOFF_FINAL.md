# Carlos — entrega final (11-10-2026)

Hay dos versiones para revisar. Ambas son públicas: no necesitas cuenta de Vercel.

| | URL | Rama | Para qué |
|---|---|---|---|
| **Estable** | https://dondesalgo.vercel.app | `main` | El producto en uso. No se toca. |
| **3D** | https://dondesalgo3d.vercel.app | `experiment/dondesalgo-3d` | Interfaz experimental. Aquí trabajas tú. |

- **SHA de código verificado:** estable `d6d4c8f`; 3D: el HEAD de `experiment/dondesalgo-3d`.
- **El 3D no se indexa en buscadores.** No tiene cron, ni claves privadas, ni `/admin`.
- **Revisión del 3D:** las 10 preguntas, mediciones y capturas están en `docs/3D_REVIEW.md` de la rama 3D.
- **Perfiles para comparar:** `?perfil=static`, `?perfil=lite` y `?perfil=full`. Al pie de la página está el control "Profundidad: Auto · Apagada".

## Editar el 3D

```bash
git clone https://github.com/Neuroxel/carreteando.git
cd carreteando
git switch experiment/dondesalgo-3d
git pull
npm ci
cp .env.example .env.local   # llena solo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (públicas; pídelas a David) y borra el resto
echo "NEXT_PUBLIC_EXPERIMENT=1" >> .env.local
npm run dev
```

- **Despliegue:** cada push a `experiment/dondesalgo-3d` publica solo https://dondesalgo3d.vercel.app (en 1–2 minutos). Los pushes a `main` o a `release/dondesalgo-v1` no tocan el 3D, y los del 3D no tocan la estable.
- **Tu acceso:** GitHub `tpotp` tiene permiso de escritura (no de administración).
- **Antes de cada push:** `npm test`, `npm run lint` y `npx tsc --noEmit`.
- **Feedback:** responde las 10 preguntas en un issue de GitHub titulado "Revisión 3D", o directo a David.

## Moderar (`/admin`)

- Solo en la estable: https://dondesalgo.vercel.app/admin. En el 3D, `/admin` no existe.
- Entras con **tu propia clave de moderador** (David te la envía por un canal privado). Tus revisiones quedan firmadas como "Carlos" en la auditoría.
- No uses nunca la clave del propietario.

## No tocar

- **`main` directamente.** Los cambios a la estable van por pull request y los revisa David.
- **Secretos y variables de producción** (Vercel `carreteando`).
- **Cron, Apify, motor de automatización e IndexNow.**
- **El proyecto Vercel `carreteando`.** El 3D es `carreteando3d`.
