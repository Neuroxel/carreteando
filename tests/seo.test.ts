import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbRowToEvento } from '../lib/events';
import { eventJsonLd, safeJsonLd } from '../lib/event-seo';
test('structured data does not invent prices, availability, time or location; script safe', () => {
  const e = dbRowToEvento({
    instagram_id: 'abc',
    title: '</script><img src=x>',
    date_text: '2026-09-19',
    is_active: true,
    moderation_status: 'approved',
  })!;
  const schema = eventJsonLd(e);
  assert.equal('offers' in schema, false);
  assert.equal('location' in schema, false);
  assert.equal(schema.startDate, '2026-09-19');
  assert.equal(safeJsonLd(schema).includes('</script>'), false);
});
