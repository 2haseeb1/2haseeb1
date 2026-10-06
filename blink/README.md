# Blink

**The to-do app for people who abandon to-do apps.**

Capture in under two seconds, then do exactly one thing at a time. No account, no
server, no sync — everything lives on the device, which is what makes capture
instant and means nothing leaves without your say-so.

This is **Type 1** from [`../docs/react-native-todo-app-ideas.md`](../docs/react-native-todo-app-ideas.md):
the local-first, single-player, speed-is-the-feature todo app.

---

## The three ideas that make it different

| Ordinary todo app | Blink |
|---|---|
| Organising is the feature | Organising is deliberately absent — no nested projects, ever |
| Shows you everything overdue | Shows you exactly one task (the **Now Card**) |
| Account and sync required | No account, no server, no login screen |
| "Overdue" in red | Unfinished work **silently rolls forward** and is presented as due now |
| One notification per task | A capped reminder window — the reason reminders still work |

## What's actually implemented

- **Quick capture with a real parser.** `call mom tomorrow at 5pm`, `gym every monday at 7am`,
  `pay rent on the 5th`, `stretch in 20 minutes`, `learn to sail someday` — all parsed
  offline by a deterministic grammar. No LLM, no network round-trip, because a capture
  that waits on a server is not frictionless.
- **The Now Card.** Big tap targets, one task, four moves: done, snooze 10m, not today, focus.
- **Today / Later / Done** with a streak, a 28-day activity grid and a per-day history.
- **Swipe gestures**: right to complete, left to snooze — plus `accessibilityActions` so
  both are reachable without a gesture.
- **Rollover** at a configurable day boundary (default 4am, for night owls). Missed
  recurring tasks skip forward instead of piling up.
- **Recurrence** — daily, specific weekdays, every N days. Finishing one mints the next
  occurrence and keeps history.
- **Fractional-index ordering.** Moving a task rewrites one row, not the whole list.
- **Reminders** with a capped, soonest-first scheduling window (iOS allows ~64 pending
  local notifications; one-per-task is the classic way todo apps silently stop reminding).
- **Four themes**, haptics, export-as-backup, and a full test suite.

## Run it

```bash
npm install
npx expo start          # then press i / a, or scan with a dev build
```

Adding native modules (notifications) means **use a dev build**, not Expo Go:

```bash
npx expo run:ios         # or run:android
```

### Try it in a browser

```bash
npm run build:web        # static export to web-build/
npm run preview          # serves it on http://localhost:8080
```

The web build is genuinely useful for a quick look, but notifications and haptics are
platform features and are no-ops there.

## Verify it

```bash
npm test                 # 209 tests: pure logic + a render test per screen
npm run typecheck        # tsc --noEmit, strict
npm run lint             # eslint
```

| Suite | Covers |
|---|---|
| `lib/__tests__/parse.test.ts` | 47 parser cases: relative days, weekdays, clock times, recurrence, edge cases |
| `lib/__tests__/day.test.ts` | day keys, rollover hour, DST-safe arithmetic, streaks |
| `lib/__tests__/recurrence.test.ts` | next-occurrence maths across DST and month boundaries |
| `lib/__tests__/rollover.test.ts` | the rollover sweep, including "no change" short-circuiting |
| `lib/__tests__/sortKey.test.ts` | fractional indexing and the renormalisation trigger |
| `lib/__tests__/export.test.ts` | backup round-trip, and refusing to trust a malformed file |
| `features/tasks/__tests__/store.test.ts` | store rules: recurrence spawning, snooze, reordering |
| `features/tasks/__tests__/screens.test.tsx` | every screen renders; the interactions that define the product |

### End-to-end

Maestro flows live in `.maestro/`:

```bash
maestro test .maestro/smoke.yaml
```

## Architecture

```
src/
  app/                    expo-router routes — thin, presentational only
    (tabs)/               Today · Later · Done
    capture.tsx           quick capture (modal)
    now.tsx               focus mode
    task/[id].tsx         task detail
    settings.tsx          theme, reminders, day boundary, export, reset
  components/             dumb, reusable UI (Button, Card, Chip, TaskRow, NowCard, icons)
  features/tasks/
    store.ts              zustand + AsyncStorage persistence — the single source of truth
    selectors.ts          pure derived views (Now Card, queues, streaks, progress)
  lib/                    pure logic, no JSX, no store access
    parse.ts              the natural-language capture grammar
    day.ts                calendar maths, formatters, streak computation
    recurrence.ts         next-occurrence maths
    rollover.ts           the end-of-day sweep
    sortKey.ts            fractional indexing
    notifications.ts      capped reminder scheduling
    export.ts             backup round-trip
  theme/                  tokens + the useTheme hook
```

**The rule that keeps this testable:** `lib/` and `features/` contain no JSX. Screens are
thin. Every product decision worth arguing about — what counts as "today", how a streak
resets, what happens to a missed recurring chore — is a pure function with tests.

### Notable implementation details

- **No icon font.** Every glyph is drawn with Views, so icons inherit the theme colour
  and the bundle carries no font dependency.
- **Client-generated ids** (`lib/id.ts`) keep the data model sync-ready: a task created
  offline already owns its final identity.
- **Storage that cannot take the app down.** `localStorage` throws in a sandboxed iframe
  and writes fail on a full device, so persistence degrades to in-memory rather than
  losing the ability to capture.
- **Hydration has a timeout.** A failed rehydrate must not strand the user on a splash
  screen forever.
- **Reminders are rebuilt, not patched.** Cancel-all-then-schedule is idempotent and
  immune to drift between app state and OS state.
- **React Compiler is on**, which is why the checkbox animation uses Reanimated's
  `.set()` API — the `.value =` form is rejected by the compiler's immutability rule.

## Known gaps (deliberately not shipped in v1)

- **Home-screen widget** and **share-sheet target** — both need native code beyond
  Expo's managed config. This is the next feature that matters most for the "under two
  seconds from anywhere" promise.
- **Voice capture** — `expo-speech-recognition` feeds the same parser pipeline.
- **Import UI** — `lib/export.ts` parses an import and is fully tested, but the Settings
  screen only exposes export today.
- **Sync** — out of scope by design. Export is the backup story.
- iOS/Android home-screen *quick add* also requires the widget extension work above.

## License

MIT
