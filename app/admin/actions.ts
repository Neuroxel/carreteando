'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentActor, isAdmin, loginAdmin, logoutAdmin } from '../../lib/admin-session';
import { getAdminDb } from '../../lib/server-db';
import { ReviewInputError, reviewInput } from '../../lib/review-input';
import { CIUDADES } from '../../lib/types';
import { safeWebUrl } from '../../lib/safety';
export async function login(form: FormData) {
  const ok = await loginAdmin(String(form.get('token') || ''));
  redirect(ok ? '/admin' : '/admin?status=login-failed');
}
export async function logout() {
  await logoutAdmin();
  redirect('/admin');
}
export async function review(
  kind: string,
  id: string,
  revision: number,
  action: string,
  form: FormData,
) {
  const actor = await currentActor();
  if (!actor) redirect('/admin');
  let status = 'invalid';
  let detalle = '';
  try {
    const { note, fields } = reviewInput(kind, action, revision, form);
    const db = getAdminDb();
    if (!db) throw new ReviewInputError('unavailable');
    const result = await db.rpc('review_item', {
      p_kind: kind,
      p_id: id,
      p_revision: revision,
      p_action: action,
      p_note: note,
      p_fields: fields,
      p_actor: actor,
    });
    status = result.error ? 'failed' : result.data === 'saved' ? 'saved' : 'conflict';
    if (result.error)
      // Sin esto, un fallo de la base es indistinguible de un campo mal llenado.
      console.warn(`admin-review falló rpc kind=${kind} accion=${action} motivo=${result.error.message}`);
  } catch (error) {
    status = error instanceof ReviewInputError ? error.status : 'failed';
    // El motivo exacto viaja a la pantalla: un rechazo sin campo señalado es
    // indistinguible de un producto roto, que es lo que pasó aquí.
    if (error instanceof ReviewInputError && error.detail) detalle = error.detail;
    console.warn(`admin-review rechazado kind=${kind} accion=${action} motivo=${status}`);
  }
  revalidatePath('/admin');
  redirect(`/admin?status=${status}${detalle ? `&campo=${encodeURIComponent(detalle)}` : ''}`);
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

/** The owner should never have to wait for a cron to see whether a source works. */
export async function runIngestion() {
  if (!(await isAdmin())) redirect('/admin');
  const db = getAdminDb();
  if (!db) redirect('/admin?status=failed');
  const { dispatchSources } = await import('../../lib/sources/dispatcher');
  let status = 'failed';
  try {
    const result = await dispatchSources(db, 8);
    status = result.ran ? `ingesta-${result.ran}` : 'ingesta-al-dia';
  } catch {
    status = 'failed';
  }
  revalidatePath('/admin');
  redirect(`/admin?status=${status}`);
}

export async function reviewVenue(id: string, revision: number, action: string, form: FormData) {
  const actor = await currentActor();
  if (!actor) redirect('/admin');
  let status = 'invalid';
  try {
    const note = String(form.get('note') || '').trim();
    if (
      !['approve', 'save', 'reject', 'withdraw'].includes(action) ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new ReviewInputError('invalid');
    if (note.length < 10 || note.length > 1000) throw new ReviewInputError('invalid-note');
    const fields: Record<string, unknown> = {};
    if (action === 'approve' || action === 'save') {
      if (form.get('checked') !== 'yes') throw new ReviewInputError('invalid-check');
      for (const k of [
        'name',
        'city',
        'zone',
        'address',
        'venue_type',
        'description_short',
        'official_url',
        'instagram_url',
        'calendar_url',
        'source_url',
      ])
        fields[k] = String(form.get(k) || '').trim();
      if (
        String(fields.name).length < 2 ||
        !CIUDADES.includes(String(fields.city)) ||
        !safeWebUrl(fields.source_url)
      )
        throw new ReviewInputError('invalid-fields');
      for (const k of ['official_url', 'instagram_url', 'calendar_url'])
        fields[k] = fields[k] ? safeWebUrl(fields[k]) : null;
    }
    const db = getAdminDb();
    if (!db) throw new ReviewInputError('unavailable');
    const result = await db.rpc('review_venue', {
      p_id: id,
      p_revision: revision,
      p_action: action,
      p_note: note,
      p_fields: fields,
      p_actor: actor,
    });
    status = result.error ? 'failed' : result.data === 'saved' ? 'saved' : 'conflict';
  } catch (error) {
    status = error instanceof ReviewInputError ? error.status : 'failed';
  }
  revalidatePath('/admin');
  redirect(`/admin?status=${status}`);
}
