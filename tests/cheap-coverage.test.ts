import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('cobertura no confunde fiestas distintas del mismo lugar cuando hay fuente precisa', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cheap-coverage-'));
  try {
    const benchmark = join(dir, 'benchmark.json'), snapshot = join(dir, 'snapshot.json');
    writeFileSync(benchmark, JSON.stringify({ fecha: '2026-10-17', eventos: [{ titulo: 'Fiesta Infinito Pop', lugar: 'Trotamundos', acceso: 'gratis_condicional', precio_min: 0, fuente: 'https://www.passline.com/evento?id=infinito' }] }));
    writeFileSync(snapshot, JSON.stringify({ events: [{ nombre: 'Alex Anwandter + fiesta', lugar: 'Trotamundos', fecha: '2026-10-17', fuente_url: 'https://www.passline.com/evento?id=alex' }] }));
    const output = execFileSync('python3', ['scripts/cheap-event-coverage.py', benchmark, snapshot], { encoding: 'utf8' });
    assert.match(output, /faltan: Fiesta Infinito Pop · Trotamundos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
