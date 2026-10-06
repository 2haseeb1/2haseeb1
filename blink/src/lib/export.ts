/**
 * Local-first means the user's data must be able to leave the app on their terms.
 * Export is the whole backup story; there is no server copy to fall back on.
 */

import { DEFAULT_SETTINGS, type Settings, type Task } from './types';

export interface ExportPayload {
  app: 'blink';
  schema: 1;
  exportedAt: string;
  settings: Settings;
  tasks: Task[];
}

export function buildExport(tasks: Task[], settings: Settings, now = Date.now()): ExportPayload {
  return {
    app: 'blink',
    schema: 1,
    exportedAt: new Date(now).toISOString(),
    settings,
    tasks,
  };
}

export function exportToJson(tasks: Task[], settings: Settings, now = Date.now()): string {
  return JSON.stringify(buildExport(tasks, settings, now), null, 2);
}

export interface ImportResult {
  tasks: Task[];
  settings: Settings;
}

/**
 * Parses a previously exported payload. Validates rather than trusts: a malformed
 * import must not be able to put the store into an unrecoverable state.
 */
export function importFromJson(json: string): ImportResult {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Not a Blink export');
  }
  const payload = parsed as Partial<ExportPayload>;
  if (payload.app !== 'blink' || !Array.isArray(payload.tasks)) {
    throw new Error('Not a Blink export');
  }

  const tasks: Task[] = payload.tasks
    .filter((task): task is Task => typeof task === 'object' && task !== null)
    .map((task, index) => ({
      ...task,
      // Repair anything missing so a partial file cannot crash the list.
      id: task.id ?? `imported_${index}`,
      title: typeof task.title === 'string' ? task.title : 'Untitled',
      bucket: task.bucket === 'later' ? 'later' : 'today',
      status: task.status === 'done' ? 'done' : 'open',
      sortKey: typeof task.sortKey === 'number' ? task.sortKey : (index + 1) * 1024,
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
      dueAt: typeof task.dueAt === 'number' ? task.dueAt : null,
      remindAt: typeof task.remindAt === 'number' ? task.remindAt : null,
      completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
      snoozedUntil: null,
      snoozeCount: typeof task.snoozeCount === 'number' ? task.snoozeCount : 0,
      recurrence: task.recurrence ?? null,
    }));

  // Merge over defaults so a hand-edited or older file cannot leave a setting
  // undefined (which would, for example, blank the theme lookup).
  const rawSettings =
    typeof payload.settings === 'object' && payload.settings !== null ? payload.settings : {};

  return {
    tasks,
    settings: { ...DEFAULT_SETTINGS, ...rawSettings },
  };
}
