import {
  MAX_SHARED_NOTES,
  MAX_SHARED_TITLE,
  taskInputFromShare,
  type SharedPayload,
} from '../share';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime(); // Wed 7 Oct 2026, 10:00

function share(payload: SharedPayload, now = WED) {
  return taskInputFromShare(payload, now);
}

describe('taskInputFromShare', () => {
  it('ignores an empty share', () => {
    expect(share({})).toBeNull();
    expect(share({ text: '', webUrl: '', files: [] })).toBeNull();
    expect(share({ text: '   ' })).toBeNull();
  });

  it('turns a shared sentence into a task', () => {
    const result = share({ text: 'Email the landlord about the leak' });
    expect(result?.input.title).toBe('Email the landlord about the leak');
  });

  it('treats a bare shared link as the task itself', () => {
    const result = share({ webUrl: 'https://example.com/article' });
    expect(result?.input.title).toBe('https://example.com/article');
    expect(result?.source).toBe('https://example.com/article');
  });

  it('does not capitalise a shared link into an unusable scheme', () => {
    // `Https://…` is not a valid scheme, so this would silently break the link.
    expect(share({ webUrl: 'https://example.com/article' })?.input.title).not.toMatch(/^Https/);
  });

  it('leaves dates inside a URL alone', () => {
    // The date parser would otherwise strip 2026/10/07 out of the path.
    const url = 'https://example.com/2026/10/07/release-notes';
    expect(share({ webUrl: url })?.input.title).toBe(url);
  });

  it('still parses dates when text surrounds a link', () => {
    // A bare "tomorrow" defaults to 09:00; an explicit time in the text
    // overrides it (both behaviours are pinned by the parser's own suite).
    const result = share({ text: 'Read this tomorrow https://example.com/post' });
    expect(result?.input.dueAt).toBe(new Date(2026, 9, 8, 9, 0).getTime());
    // A link inside the text stays in the title; only a separate `webUrl` is
    // folded into notes.
    expect(result?.input.title).toContain('https://example.com/post');
  });

  it('extracts dates from the shared text', () => {
    // The whole point of sharing into Blink rather than a plain notes app.
    const result = share({ text: 'Call the dentist tomorrow 5pm' });
    expect(result?.input.title).toBe('Call the dentist');
    expect(result?.input.dueAt).toBe(new Date(2026, 9, 8, 17, 0).getTime());
  });

  it('keeps only the first line as the title', () => {
    const result = share({
      text: 'Fix the sink\n\nIt drips when the tap is half open, which the plumber said is the washer.\nAsk about the warranty.',
    });
    expect(result?.input.title).toBe('Fix the sink');
    expect(result?.input.notes).toContain('the washer');
    expect(result?.input.notes).toContain('warranty');
  });

  it('does not fold the rest of the share into the title', () => {
    // Guards the anti-feature: sharing a long email must not create a wall of text.
    const longBody = Array.from({ length: 40 }, (_, i) => `Line ${i}`).join('\n');
    const result = share({ text: `Reply to Sam\n${longBody}` });
    expect(result?.input.title).toBe('Reply to Sam');
    expect(result?.input.title.length).toBeLessThan(30);
  });

  it('records a shared link alongside the text as notes', () => {
    const result = share({ text: 'Read this', webUrl: 'https://example.com/post' });
    expect(result?.input.notes).toContain('https://example.com/post');
  });

  it('names the task after a shared file when there is no text', () => {
    const result = share({ files: [{ fileName: 'invoice-october.pdf' }] });
    expect(result?.input.title).toBe('invoice-october.pdf');
  });

  it('ignores a file share with no usable name', () => {
    expect(share({ files: [{ fileName: null }] })).toBeNull();
    expect(share({ files: [{}] })).toBeNull();
  });

  it('truncates an absurdly long title', () => {
    const result = share({ text: 'x'.repeat(500) });
    expect(result?.input.title.length).toBeLessThanOrEqual(MAX_SHARED_TITLE);
    expect(result?.input.title.endsWith('…')).toBe(true);
  });

  it('truncates an absurdly long notes body', () => {
    const result = share({ text: `Short\n${'y'.repeat(5000)}` });
    expect((result?.input.notes ?? '').length).toBeLessThanOrEqual(MAX_SHARED_NOTES);
  });

  it('schedules has no reminder unless the share said so', () => {
    const result = share({ text: 'Buy milk' });
    expect(result?.input.dueAt).toBeNull();
    expect(result?.input.remindAt).toBeUndefined();
  });

  it('assigns a bucket so the task lands in the right list immediately', () => {
    const undated = share({ text: 'Buy milk' });
    expect(undated?.input.bucket).toBe('today');

    // "next month" is the parser's supported phrasing (not "in 3 months").
    const future = share({ text: 'Renew passport next month' });
    expect(future?.input.bucket).toBe('later');
  });

  it('carries recurrence through from the shared text', () => {
    const result = share({ text: 'Stand-up every monday at 9am' });
    expect(result?.input.recurrence).toBeTruthy();
  });

  it('respects a custom rollover hour', () => {
    const justAfterMidnight = new Date(2026, 9, 7, 1, 0, 0).getTime();
    const result = taskInputFromShare({ text: 'Buy milk' }, justAfterMidnight, 4);
    // Still before the 4am boundary, so it belongs to the day that is ending.
    expect(result?.input.bucket).toBe('today');
  });

  it('is stable across repeat calls', () => {
    const payload = { text: 'Call the dentist tomorrow 5pm' };
    expect(share(payload)?.input).toEqual(share(payload)?.input);
  });

  it('hands back the raw text so the UI can confirm what was captured', () => {
    const result = share({ text: 'Book flights' });
    expect(result?.source).toBe('Book flights');
  });

  it('produces notes that are undefined, not an empty string, when there are none', () => {
    // An empty string would render an empty notes field on the task screen.
    expect(share({ text: 'One liner' })?.input.notes).toBeUndefined();
  });
});
