/**
 * Export/import tests.
 *
 * With no server there is no server-side backup, so the export file *is* the
 * user's safety net. It has to survive being hand-edited, truncated, or written
 * by an older build, and it must never be able to crash the list on import.
 */

import { buildExport, exportToJson, importFromJson } from '../export';
import { DEFAULT_SETTINGS, type Task } from '../types';

const NOW = new Date(2026, 9, 7, 10, 0, 0).getTime();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Buy milk',
    dueAt: NOW + 3_600_000,
    remindAt: NOW + 3_600_000,
    bucket: 'today',
    status: 'open',
    recurrence: null,
    sortKey: 1024,
    createdAt: NOW,
    completedAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    ...overrides,
  };
}

describe('buildExport', () => {
  it('stamps the schema and app name so files are identifiable', () => {
    const payload = buildExport([makeTask()], DEFAULT_SETTINGS, NOW);
    expect(payload.app).toBe('blink');
    expect(payload.schema).toBe(1);
    expect(payload.exportedAt).toBe(new Date(NOW).toISOString());
  });

  it('includes every task', () => {
    const payload = buildExport([makeTask(), makeTask({ id: 't2' })], DEFAULT_SETTINGS, NOW);
    expect(payload.tasks).toHaveLength(2);
  });
});

describe('round trip', () => {
  it('restores tasks and settings unchanged', () => {
    const tasks = [makeTask(), makeTask({ id: 't2', title: 'Call mom', status: 'done', completedAt: NOW })];
    const settings = { ...DEFAULT_SETTINGS, theme: 'forest' as const, rolloverHour: 6 };

    const restored = importFromJson(exportToJson(tasks, settings, NOW));
    expect(restored.tasks).toEqual(tasks);
    expect(restored.settings).toEqual(settings);
  });

  it('exports human-readable JSON', () => {
    expect(exportToJson([makeTask()], DEFAULT_SETTINGS, NOW)).toContain('\n  "app": "blink"');
  });
});

describe('importFromJson — rejection', () => {
  it('rejects invalid JSON', () => {
    expect(() => importFromJson('not json at all')).toThrow();
  });

  it('rejects JSON that is not a Blink export', () => {
    expect(() => importFromJson('{"app":"something-else","tasks":[]}')).toThrow('Not a Blink export');
  });

  it('rejects an export with no task array', () => {
    expect(() => importFromJson('{"app":"blink"}')).toThrow('Not a Blink export');
  });

  it('rejects a bare array', () => {
    expect(() => importFromJson('[]')).toThrow('Not a Blink export');
  });

  it('rejects a null payload', () => {
    expect(() => importFromJson('null')).toThrow('Not a Blink export');
  });
});

describe('importFromJson — repair', () => {
  it('fills in missing fields rather than dropping the task', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [{ title: 'Salvaged' }] })
    );
    const task = restored.tasks[0];
    expect(task.title).toBe('Salvaged');
    expect(task.id).toBe('imported_0');
    expect(task.bucket).toBe('today');
    expect(task.status).toBe('open');
    expect(task.dueAt).toBeNull();
    expect(task.snoozeCount).toBe(0);
  });

  it('replaces a missing title', () => {
    const restored = importFromJson(JSON.stringify({ app: 'blink', tasks: [{}] }));
    expect(restored.tasks[0].title).toBe('Untitled');
  });

  it('coerces an unknown bucket or status to a safe value', () => {
    const restored = importFromJson(
      JSON.stringify({
        app: 'blink',
        tasks: [{ title: 'Odd', bucket: 'whenever', status: 'archived' }],
      })
    );
    expect(restored.tasks[0].bucket).toBe('today');
    expect(restored.tasks[0].status).toBe('open');
  });

  it('drops non-object entries instead of throwing', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [{ title: 'Keep' }, null, 'garbage', 42] })
    );
    expect(restored.tasks).toHaveLength(1);
    expect(restored.tasks[0].title).toBe('Keep');
  });

  it('clears any in-flight snooze so an import cannot hide tasks', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [{ title: 'Snoozed', snoozedUntil: NOW + 99_999_999 }] })
    );
    expect(restored.tasks[0].snoozedUntil).toBeNull();
  });

  it('gives tasks distinct sort keys when none are provided', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [{ title: 'A' }, { title: 'B' }] })
    );
    expect(restored.tasks[0].sortKey).not.toBe(restored.tasks[1].sortKey);
    expect(restored.tasks[1].sortKey).toBeGreaterThan(restored.tasks[0].sortKey);
  });

  it('ignores a malformed settings block and falls back to defaults', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [], settings: 'nope' })
    );
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps only the settings it recognises from a partial file', () => {
    const restored = importFromJson(
      JSON.stringify({ app: 'blink', tasks: [], settings: { theme: 'ember' } })
    );
    expect(restored.settings.theme).toBe('ember');
    expect(restored.settings.rolloverHour).toBe(DEFAULT_SETTINGS.rolloverHour);
  });
});
