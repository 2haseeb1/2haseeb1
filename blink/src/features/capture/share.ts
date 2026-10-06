/**
 * Share-sheet capture.
 *
 * The widget covers "capture without opening the app"; the share sheet covers
 * "capture from somewhere else". Both funnel into the same parser, so a link or
 * a sentence shared from another app becomes a task with the same date
 * understanding as typing it in.
 *
 * The parsing rule here is intentionally narrow: only the *first* line becomes
 * the title, and the rest is kept as notes. Sharing an entire email body must not
 * produce a 400-character task title.
 */

import { parseTaskInput } from '@/lib/parse';
import { bucketForDue } from '@/lib/rollover';
import type { NewTaskInput } from '@/lib/types';

/** Longest title we will accept from an external app before truncating. */
export const MAX_SHARED_TITLE = 140;

/** Longest notes body we keep; beyond this it is almost always boilerplate. */
export const MAX_SHARED_NOTES = 2000;

/**
 * A shared string that *is* a link, rather than text containing one.
 *
 * Links get a different code path because running the date parser over a URL
 * corrupts it: `https://example.com/2026/10/07` would have `2026/10/07` stripped
 * out as a date and the remaining title would no longer resolve.
 */
const BARE_URL = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

export interface SharedPayload {
  text?: string | null;
  /** Set when the share came from a web browser. */
  webUrl?: string | null;
  /** Shared files are recorded as a note rather than downloaded. */
  files?: { fileName?: string | null }[] | null;
}

export interface ShareCaptureResult {
  input: NewTaskInput;
  /** The raw shared text, for displaying a confirmation. */
  source: string;
}

/**
 * Turns a shared payload into a task input, or null when there is nothing worth
 * capturing (an empty share, or a file-only share with no usable name).
 */
export function taskInputFromShare(
  payload: SharedPayload,
  now: number,
  rolloverHour = 4
): ShareCaptureResult | null {
  const rawText = (payload.text ?? '').trim();
  const url = (payload.webUrl ?? '').trim();

  // A shared link with no accompanying text is itself the task.
  const combined = rawText || url;
  if (!combined && (payload.files ?? []).length === 0) return null;

  const source = rawText || url;

  if (!combined) {
    // File-only share: name the task after the file.
    const firstFile = (payload.files ?? [])[0];
    const fileName = firstFile?.fileName?.trim();
    if (!fileName) return null;
    return {
      input: {
        title: truncate(fileName, MAX_SHARED_TITLE),
        bucket: bucketForDue(null, now, rolloverHour),
      },
      source: fileName,
    };
  }

  if (BARE_URL.test(combined)) {
    // Capture the link verbatim — no date parsing, no title casing.
    return {
      input: {
        title: truncate(combined, MAX_SHARED_TITLE),
        dueAt: null,
        bucket: bucketForDue(null, now, rolloverHour),
      },
      source: combined,
    };
  }

  const { title, remainder } = splitSharedText(combined);
  const parsed = parseTaskInput(title, now);
  const notes = buildNotes(remainder, url && rawText ? url : null);

  const finalTitle = truncate(parsed.title.trim() || title, MAX_SHARED_TITLE);

  return {
    input: {
      title: finalTitle,
      notes,
      dueAt: parsed.dueAt,
      bucket: parsed.bucket ?? bucketForDue(parsed.dueAt, now, rolloverHour),
      recurrence: parsed.recurrence,
    },
    source,
  };
}

function splitSharedText(text: string): { title: string; remainder: string } {
  const newlineIndex = text.indexOf('\n');
  if (newlineIndex === -1) return { title: text, remainder: '' };
  return {
    title: text.slice(0, newlineIndex).trim(),
    remainder: text.slice(newlineIndex + 1).trim(),
  };
}

function buildNotes(remainder: string, url: string | null): string | undefined {
  const parts = [remainder, url].filter((part): part is string => Boolean(part && part.length > 0));
  if (parts.length === 0) return undefined;
  return truncate(parts.join('\n\n'), MAX_SHARED_NOTES);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
