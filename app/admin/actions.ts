'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isAdmin, loginAdmin, logoutAdmin } from '../../lib/admin-session';
import { getAdminDb } from '../../lib/server-db';
import { validateSubmission } from '../../lib/submission-validation';
import { eventKey } from '../../lib/event-identity';
import { safeImageUrl } from '../../lib/safety';
export async function login(form: FormData) {
  const ok = await loginAdmin(String(form.get('token') || ''));
  redirect(ok ? '/admin' : '/admin?status=login-failed');
}
export async function logout() {
  await logoutAdmin();
  redirect('/admin');
}
export async function review(form: FormData) {
  if (!(await isAdmin())) redirect('/admin');
  const db = getAdminDb();
  let status = 'invalid';
  try {
    const action = String(form.get('action')),
      kind = String(form.get('kind')),
      id = String(form.get('id'));
    const revision = Number(form.get('revision')),
      note = String(form.get('note') || '').trim();
    if (
      !['event', 'inbox'].includes(kind) ||
      !['approve', 'save', 'reject', 'withdraw', 'resolve'].includes(action) ||
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      note.length < 10 ||
      note.length > 1000
    )
      throw new Error();
    let fields = {};
    if (action === 'approve' || action === 'save') {
      if (form.get('checked') !== 'yes') throw new Error();
      const raw = Object.fromEntries(form);
      const validated = validateSubmission({
        ...raw,
        precio: raw.precio === '' ? null : Number(raw.precio),
      });
      fields = {
        title: validated.nombre,
        description: validated.descripcion,
        date_text: validated.fecha,
        event_time: validated.hora,
        venue: validated.lugar,
        city: validated.ciudad,
        address: validated.direccion,
        price_clp: validated.precio,
        price_text:
          validated.precio_texto ||
          (validated.precio === null
            ? 'Precio por confirmar'
            : validated.precio === 0
              ? 'Gratis'
              : `$${validated.precio.toLocaleString('es-CL')}`),
        category: validated.categoria,
        instagram_url: validated.fuente_url,
        image_url: safeImageUrl(validated.imagen_url),
        username: validated.organizador,
        event_key: eventKey(
          `${validated.lugar} ${validated.ciudad}`,
          validated.fecha,
          validated.nombre,
        ),
      };
    }
    if (!db) throw new Error();
    const result = await db.rpc('review_item', {
      p_kind: kind,
      p_id: id,
      p_revision: revision,
      p_action: action,
      p_note: note,
      p_fields: fields,
    });
    status = result.error ? 'failed' : result.data === 'saved' ? 'saved' : 'conflict';
  } catch {
    status = 'invalid';
  }
  revalidatePath('/admin');
  redirect(`/admin?status=${status}`);
}
export async function importEditorial() {
  if (!(await isAdmin())) redirect('/admin');
  const db = getAdminDb();
  const { editorialRows } = await import('../../lib/editorial-feed');
  const rows = editorialRows();
  const saved = rows.length
    ? await db
        ?.from('events')
        .upsert(rows, { onConflict: 'instagram_id', ignoreDuplicates: true })
        .select('instagram_id')
    : null;
  revalidatePath('/admin');
  redirect(`/admin?status=${saved && !saved.error ? 'imported' : 'failed'}`);
}
