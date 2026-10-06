/**
 * Local id generation.
 *
 * Client-generated ids (rather than DB autoincrement) keep Blink's data model
 * sync-ready: a task created offline already owns its final identity, so a later
 * cloud sync can never duplicate it.
 */

let counter = 0;

export function createId(prefix = 't'): string {
  counter = (counter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const seq = counter.toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${seq}_${rand}`;
}
