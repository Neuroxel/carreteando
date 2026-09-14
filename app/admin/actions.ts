'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isAdmin, loginAdmin, logoutAdmin } from '../../lib/admin-session';
import { getAdminDb } from '../../lib/server-db';
import { ReviewInputError, reviewInput } from '../../lib/review-input';
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
  if (!(await isAdmin())) redirect('/admin');
  let status = 'invalid';
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
    });
    status = result.error ? 'failed' : result.data === 'saved' ? 'saved' : 'conflict';
  } catch (error) {
    status = error instanceof ReviewInputError ? error.status : 'failed';
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
