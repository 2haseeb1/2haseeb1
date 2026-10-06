# 3 Types of To‑Do List Apps for React Native

*Build-ready product specs — not three reskins of the same list screen.*

Most "todo app" ideas are the same app with a different color scheme. These three are different **types**: they differ in their core interaction model, their data architecture, and how they make money. You could build all three on the same foundation and they would still feel like three different products.

- **Type 1 — Frictionless capture** (local-first, single-player, speed as the feature)
- **Type 2 — Shared lists** (multiplayer, sync, permissions, offline queue)
- **Type 3 — Context-aware assistant** (AI parsing, geofences, calendar-aware triage)

---

## TL;DR comparison

| | **1. Blink** — Frictionless capture | **2. Tandem** — Shared lists | **3. Compass** — Context-aware assistant |
|---|---|---|---|
| **One-line pitch** | Capture in under 2 seconds, do one thing at a time | The household/team list everyone actually keeps updated | Tell it in plain words; it figures out when and where |
| **Core loop** | Capture → Now Card → done → streak | Add → assign → do → confirm | Say it → parsed → surfaced at the right moment |
| **User** | Busy individuals, ADHD/low-executive-function users | Families, couples, small teams, flatmates | Knowledge workers juggling calendar + errands |
| **Hardest part** | Ruthless UI restraint | Sync, conflict resolution, permissions | Parsing accuracy + battery/geofence limits |
| **Backend** | None (100% on-device) | Supabase (Postgres + RLS + Realtime) | Thin API + LLM function calling |
| **Offline** | Native state — always offline | Offline-first with outbox queue | Degrades to Type‑1 behaviour |
| **Money** | One-time Pro unlock | Per-workspace subscription | Free tier + AI credits subscription |
| **Time to MVP** | ~1–2 weeks | ~3–5 weeks | ~3–4 weeks |
| **License to ship solo** | High | High | Medium (API cost + accuracy risk) |
| **Killer detail** | Home-screen widget + "Now Card" | Recurring chores with rotation fairness | "Remind me when I'm near the bank" |

---

## Baseline stack (all three)

| Concern | Choice | Notes |
|---|---|---|
| SDK | **Expo SDK 57+** (React Native 0.86, React 19.2) | Stable as of mid‑2026. SDK 55+ is **New Architecture only** — the legacy arch flag no longer exists, so don't copy old tutorial config. |
| Language | TypeScript, `strict: true` | Use `expo-type-information` / generated types for native modules. |
| Navigation | **expo-router** (file-based) | Note: since SDK 56 expo-router no longer depends on react-navigation — don't mix navigation deps. |
| State | Zustand (UI/session) + TanStack Query (server, Type 2/3 only) | Keep server cache out of Zustand. |
| Local DB | **op-sqlite** + **Drizzle ORM** | Faster than expo-sqlite for heavy list queries and gives you typed migrations. Use `expo-sqlite` if you want zero native build friction. |
| Lists UI | `@shopify/flash-list` (or `expo-ui` natives where you want platform look) | FlashList for 1k+ rows. |
| Animation | `react-native-reanimated` + `react-native-gesture-handler` | Required for swipe-to-complete. |
| Icons | Scoped `@react-native-vector-icons/*` | `@expo/vector-icons` was deprecated in SDK 56. |
| Testing | `jest-expo` + `@testing-library/react-native`; **Maestro** for E2E flows | Maestro's YAML flow files are the cheapest E2E win for a list app. |
| Ship | EAS Build + `expo-updates` (OTA) | Ship JS fixes without store review. |
| Node | ≥ 20.19.4 | RN 0.85+ dropped older Node. |

### Shared folder layout

```
app/                      # expo-router routes (screens only, thin)
  (tabs)/index.tsx
components/               # dumb, reusable UI
features/
  tasks/                  # hooks, selectors, business logic per feature
data/
  db.ts                   # Drizzle client + migrations
  schema.ts               # table definitions -> types
lib/                      # pure functions (parsers, schedulers) — unit-test these
theme/                    # tokens: spacing, type scale, colors (dark mode first)
```

Rule: **`lib/` and `features/` contain no JSX.** Pure logic is what you unit-test; screens stay dumb enough to eyeball.

### Shared quickstart

```bash
npx create-expo-app@latest blink --template           # pick TypeScript + expo-router
cd blink
npx expo install expo-notifications expo-haptics @shopify/flash-list \
  react-native-reanimated react-native-gesture-handler op-sqlite
npx expo start                                        # scan with Expo Go / dev build
```

> Verify versions with `npx expo install --check` and `npx expo-doctor` before you start. Adding native modules (op-sqlite, widgets, geofencing) means you need a **dev build**, not Expo Go.

---

# Type 1 — Blink: the frictionless capture to-do app

**Local-first. Single-player. Speed is the entire product.**

### Pitch

> The todo app for people who abandon todo apps. Add a task in under two seconds from anywhere, then do exactly one thing at a time.

### Who it's for

People who bounce off Notion/Todoist because *maintaining the system became the work*. Explicitly friendly to ADHD and low-executive-function users: no nested projects, no mandatory fields, no guilt.

### Why it's a different *type*

| Ordinary todo app | Blink |
|---|---|
| Organising is the feature | Organising is deliberately absent |
| Shows you everything overdue | Shows you exactly one task |
| Sync account required | No account, no server, no login screen |
| Endless list = anxiety | Finished-today list = dopamine |

### Core loop

1. **Capture** (widget / share sheet / voice / one-tap FAB) → ≤ 2 s, no required fields.
2. **Now Card** — one task, full-screen, big hit targets: *Do it · Snooze 10 m · Not today · Break it down*.
3. **Done** → confetti-free but satisfying haptic + streak tick.
4. **Rollover at midnight** — undone tasks silently move forward, **no "overdue" red badge ever**.

### Features

**MVP (week 1–2)**
- Quick add with natural-language date parsing (`tomorrow 5pm`, `fri`) via a small local parser
- Now Card with snooze/complete/skip
- Today + Later buckets (two buckets only, no custom lists)
- Local notifications for time-based reminders
- Streak counter + "done today" log
- Full dark mode, 3 accent themes
- 100% offline, no account

**v1 (week 3–4)**
- iOS/Android home-screen widget (quick add + today count) — iOS widgets are stable in Expo SDK 56+
- Share-sheet target: share text from any app → becomes a task
- Recurring tasks (simple: daily/weekly/every N days)
- Swipe gestures: right = done, left = snooze
- Import/export JSON (also your "backup" story)

**Later**
- Voice capture via `expo-speech-recognition`
- "Break it down" → splits a task into 3 steps
- Apple Watch / Wear OS companion, Focus-mode integration
- Pro: widget themes, stats, multiple devices via iCloud/Google Drive file sync (no server to run)

### Screens (6 total)

```
app/(tabs)/index.tsx      Today — Now Card + queue beneath it
app/(tabs)/done.tsx       Done today / streak calendar
app/(tabs)/settings.tsx   Themes, reminder defaults, export
app/capture.tsx           Modal quick-add (also widget deep-link target)
app/task/[id].tsx         Detail — optional notes only, no fields required
app/now.tsx               Full-screen focus mode
```

### Data model (SQLite / Drizzle)

```ts
// data/schema.ts
export const tasks = sqliteTable('tasks', {
  id:          text('id').primaryKey(),          // uuid v4 — generate on device
  title:       text('title').notNull(),
  notes:       text('notes'),
  dueAt:       integer('due_at', { mode: 'timestamp' }),
  remindAt:    integer('remind_at', { mode: 'timestamp' }),
  bucket:      text('bucket', { enum: ['today', 'later'] }).notNull().default('today'),
  status:      text('status', { enum: ['open', 'done', 'skipped'] }).notNull().default('open'),
  recurrence:  text('recurrence'),               // 'daily' | 'weekly:MO,WE' | 'every:3d'
  streakWeight: integer('streak_weight').notNull().default(1),
  sortKey:     real('sort_key').notNull(),       // fractional index -> reorder without rewriting rows
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const streaks = sqliteTable('streaks', {
  day:       text('day').primaryKey(),           // 'YYYY-MM-DD'
  completed: integer('completed').notNull().default(0),
});
```

**Key trick — fractional `sortKey`:** to move a task between two others, set its key to the midpoint of its neighbours (e.g. `2.5`). Reorder becomes one row update instead of renumbering the list. Renormalise when gaps get smaller than `1e-6`.

### Notification strategy (this is where todo apps break)

- iOS caps pending local notifications (~64). Never schedule one per task.
- Instead: schedule **one repeating "daily review" ping**, and at that ping (or on app open) schedule only the next ~10 due reminders, then refill.
- Reschedule on app foreground; `expo-notifications` + a `NotificationScheduler` in `lib/` that is pure and unit-tested.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| Feature creep turns it into Todoist | Hard rule: **no nested projects, ever**. Add to the doc's "never" list and re-read it monthly. |
| Inbox zero becomes a graveyard | Silent rollover; never show "overdue". |
| Widget / share sheet needs native build | Budget for a dev build + EAS from day one; don't rely on Expo Go. |
| Battery/alarm drift on Android | Use `AlarmManager`-backed notifications via expo-notifications; test on a Xiaomi/Oppo (aggressive OEM killers). |

### Monetisation

- Free: everything core (don't paywall the loop).
- **Blink Pro — one-time $9–14**: widget themes, advanced stats, voice capture, Drive/iCloud sync, multiple "modes" (work/personal). One-time pricing matches the app's anti-subscription ethos and converts better in this niche.
- Optional "tip jar" consumable.

**Success metric:** median time from cold app open → task captured < 4 s.

---

# Type 2 — Tandem: the shared list app

**Multiplayer. Offline-first. Sync and permissions are the product.**

### Pitch

> The grocery list, chore roster and family errands in one place — everyone sees the same state, even on the train with no signal.

### Who it's for

Couples, flatmates, families with teens, and small volunteer teams. The list is a *coordination surface*, not a personal productivity system.

### Why it's a different *type*

| Personal todo app | Tandem |
|---|---|
| One user, account optional | N users, roles, invites |
| Conflict = impossible | Conflict resolution is the core algorithm |
| Recurrence is a reminder | Recurrence is *shared work distribution* |
| Sync is a nice-to-have | Offline queue → sync is existential |

### Core loop

1. Someone adds *anything* (offline is normal, not an error state).
2. Assign to a person or leave unassigned for whoever's free.
3. Doing it stamps the row (`doneBy`, `doneAt`) and pushes to everyone.
4. Weekly rotation handles the boring recurring stuff; the **fairness counter** makes it visible who's been carrying the load.

### Features

**MVP (week 1–2)**
- Workspaces (household) + invite by code/link
- Lists within a workspace, realtime updates, member presence
- Tap to claim → assign to me; tap to complete
- Offline outbox: mutations queue locally and replay in order on reconnect
- Push notifications: "assigned to you", "3 items added", "completed"
- Recurring chores with rotation + fairness tally

**v1 (week 3–5)**
- Roles: owner / member / **child** (children can complete, not delete)
- Photo attachments (receipts, "this is the right brand" photos)
- Templates: "Weekly shop", "Moving house", "Party prep"
- Web read-only link (Next.js/Supabase — one extra day, huge for adoption)
- Activity feed + undo

**Later**
- Barcode/price capture for shopping mode
- Location-aware list nudge ("you're at the supermarket — 6 items")
- Calendar overlay for chore deadlines
- Per-workspace subscription billing (RevenueCat / Stripe)

### Screens

```
app/(auth)/sign-in.tsx
app/(app)/workspaces.tsx        switch/create household
app/(app)/[workspace]/index.tsx list of lists + today's assigned
app/(app)/[workspace]/[list].tsx  the shared list (realtime)
app/(app)/[workspace]/members.tsx roles, invites, fairness tally
app/(app)/activity.tsx          who did what, undo
app/join/[code].tsx             deep-link invite accept
```

### Backend: Supabase

Chosen because Postgres **row-level security gives you multiplayer authorisation for free** — the rule "you can only read/write rows in workspaces you're a member of" lives in the database, not scattered across the client.

```sql
create table workspaces (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid references auth.users);
create table memberships (
  workspace_id uuid references workspaces on delete cascade,
  user_id uuid references auth.users,
  role text not null default 'member' check (role in ('owner','member','child')),
  primary key (workspace_id, user_id)
);
create table lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null, kind text not null default 'checklist'
);
create table tasks (
  id uuid primary key,                     -- client-generated UUID: enables offline insert
  list_id uuid not null references lists on delete cascade,
  title text not null,
  assignee uuid references auth.users,
  status text not null default 'open' check (status in ('open','done','skipped')),
  recurrence text,                         -- RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO
  rotation jsonb,                          -- ["userA","userB"] round-robin queue
  done_by uuid references auth.users,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                  -- soft delete so deletes sync as updates
  client_seq bigint not null               -- monotonic per-device counter, for ordering
);

alter table tasks enable row level security;

create policy "members read tasks" on tasks for select
  using (list_id in (select l.id from lists l join memberships m on m.workspace_id = l.workspace_id where m.user_id = auth.uid()));

create policy "non-children write tasks" on tasks for all
  using (list_id in (select l.id from lists l join memberships m on m.workspace_id = l.workspace_id
                     where m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (list_id in (select l.id from lists l join memberships m on m.workspace_id = l.workspace_id
                     where m.user_id = auth.uid() and m.role in ('owner','member')));
```

**Client-generated UUIDs** are the single most important decision here: an insert created while offline already has its final primary key, so replaying the queue can't duplicate rows.

### Sync engine (keep it dumb)

1. Every mutation writes to local SQLite **and** an `outbox` table (`{id, tableName, rowId, op, payload, clientSeq, attempts}`), in one transaction.
2. On reconnect (or every 20 s in foreground), drain the outbox **in `clientSeq` order**.
3. Pull changes with `supabase.from('tasks').select().gt('updated_at', lastCursor)` — per list, paginated.
4. Conflict rule for MVP: **last-write-wins on the whole row** using `updated_at`, except `status` which is *monotonic* (`done` beats `open` — un-completing must be an explicit action, so a stale replay can't revive a done chore).
5. Keep a realtime subscription for live updates while the app is open; treat it as a latency optimisation, never as the source of truth.

```ts
// data/outbox.ts — the whole offline story in ~15 lines
export async function enqueue(db: DB, op: Mutation) {
  await db.transaction(async (tx) => {
    await applyLocally(tx, op);                                   // optimistic UI
    await tx.insert(outbox).values({ ...op, clientSeq: await nextSeq(tx) });
  });
}

export async function drain(db: DB, api: Api) {
  for (const item of await db.select().from(outbox).orderBy(outbox.clientSeq)) {
    try   { await api.push(item); await db.delete(outbox).where(eq(outbox.id, item.id)); }
    catch { await bumpAttempts(db, item.id); break; }            // stay ordered; retry later
  }
}
```

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| Sync bugs are invisible until users lose data | Instrument: log row counts before/after every drain in dev; write a "kill network mid-drain" Maestro test. |
| Recurring + offline + rotation = the hairiest logic | Model recurrence as a **pure function** `nextOccurrence(task, now)` in `lib/`, snapshot-tested with 40+ cases. Never inside a component. |
| "Family app" market is crowded (Cozi, AnyList) | Differentiate on **fairness tally + child-safe roles + templates**; win the flatmate/teen segment incumbents ignore. |
| Realtime bills scale with connections | Only subscribe while a list screen is focused. |

### Monetisation

- Free: 1 workspace, 3 lists, unlimited members (viral loop is the growth engine — never charge per seat).
- **Tandem Plus — $3.99/mo or $29/yr per workspace**: unlimited lists, photo attachments, templates, activity history > 30 days, child roles, web view.
- Sell a one-time **"Lifetime household" $79** to capture subscription-haters.

**Success metric:** 4‑week retention of the *second* member (a shared app dies when only one person installs it).

---

# Type 3 — Compass: the context-aware assistant list

**Natural language in, the right task at the right moment out.**

### Pitch

> Type "pay the electricity bill on the 5th, and remind me when I'm near the bank" — Compass handles the parsing, scheduling and timing.

### Who it's for

Knowledge workers with a messy calendar and location-bound errands. The list is an *intent inbox*, not a spreadsheet.

### Why it's a different *type*

| Classic todo app | Compass |
|---|---|
| You structure the data | You speak; it structures |
| Reminders fire at a time you chose | Reminders fire when context matches |
| Priority is manual | Priority is computed from deadline, effort, calendar, energy |
| One input: typing in a field | Many inputs: text, voice, share sheet, email/Slack forward, screenshot |

### Features

**MVP (week 1–2)**
- Capture box that accepts prose; deterministic parser first (dates, times, priority words, `@person`, `#project`)
- Explicit review step: parsed fields shown as *editable chips* before saving — never silently guess
- Timeline view: Today / This week / Someday, computed from `dueAt`
- **Triage score** ordering (see formula below) with a "Why this first?" explainer row
- Local notifications for time-based triggers

**v1 (week 3–4)**
- **Geofenced reminders**: "remind me at the pharmacy", radius + dwell time; reverse-geocode a place name to coordinates once, at save time
- Voice capture (`expo-speech-recognition`) → same parser pipeline
- Calendar-aware day plan: read busy blocks (new `expo-calendar` API is stable in SDK 56+) and propose a realistic schedule; export chosen blocks back
- LLM fallback when the deterministic parser fails (structured JSON function calling), with confidence score → below threshold = ask the user, never invent
- "Batching" suggestion: group errands by proximity and open hours

**Later**
- Email/Slack forward-to-capture address (server parses, writes to DB)
- Screenshot OCR capture ("Capture this receipt/ticket")
- Weekly review ritual: 5 cards, swipe-assign to next week / drop
- Shared "delegation" (send a parsed task to a Tandem workspace — nice cross-product hook)

### Screens

```
app/(tabs)/index.tsx      Timeline (Today / Week / Someday)
app/capture.tsx           NL input + voice + parsed chips
app/task/[id].tsx         Detail with context triggers
app/places.tsx            Saved places + radius management
app/plan.tsx              "Plan my day" — calendar-aware proposal
app/review.tsx            Weekly triage ritual
```

### Parsing pipeline (deterministic first, LLM second)

```ts
// lib/parse.ts  — pure, unit-tested, zero network
export type ParsedTask = {
  title: string;
  dueAt?: Date;
  priority?: 'low' | 'normal' | 'high';
  people?: string[];      // "@sam"
  project?: string;       // "#house"
  place?: string;         // "at the pharmacy"
  confidence: number;     // 0..1
};

export function parse(input: string, now = new Date()): ParsedTask {
  // 1. strip & extract #project, @person
  // 2. match date/time grammar (chrono-style token table, in lib/grammar.ts)
  // 3. match place preposition -> "at|near|when I'm at X"
  // 4. confidence = weighted sum of matched fields; < 0.55 => call LLM
}
```

LLM call shape (server-side function so the key never ships in the app):

```ts
// supabase/functions/parse-task/index.ts
const tool = {
  name: 'create_task',
  description: 'Extract a single task from user text',
  parameters: {
    type: 'object',
    required: ['title', 'confidence'],
    properties: {
      title:      { type: 'string' },
      due_at:     { type: 'string', description: 'ISO 8601, interpret relative dates against `now`' },
      priority:   { type: 'string', enum: ['low', 'normal', 'high'] },
      place:      { type: 'string', description: 'Only if the user tied the task to a location' },
      confidence: { type: 'number', description: '0-1. Use <0.6 when unsure.' },
    },
  },
};
// Pass `now` and the device timezone explicitly in the prompt, or the model will hallucinate "tomorrow".
```

**Design rule for the whole app:** every parse lands on a **review screen** with editable chips. The magic is the pre-fill, not the autonomy. An assistant that silently files a task in the wrong week is worse than a blank field.

### Triage score — ordering without manual priority

```ts
// lib/triage.ts — pure function, easy to test and to explain in the UI
export function triageScore(t: Task, now: Date, ctx: Context): number {
  const hours  = Math.max(0.5, hoursUntil(t.dueAt ?? addDays(now, 30), now));
  const urgency = Math.min(1, 72 / hours);              // 72h horizon, caps at 1
  const batching = ctx.nearbyPlaces.includes(t.place) ? 0.25 : 0;   // you're already there
  const calGap   = ctx.freeMinutes >= estimate(t) ? 0.2 : -0.3;     // does it fit today?
  const staleness = Math.min(0.2, daysSince(t.createdAt) * 0.02);   // stop the 40-day zombies
  const effort    = 1 - Math.min(1, estimate(t) / 120);             // quick wins float up
  return urgency * 0.5 + effort * 0.2 + batching + calGap + staleness;
}
```

Show the top two contributing terms as text: *"Due in 5 h · you're near the pharmacy anyway."* Explainability is the retention feature — users trust a ranking they can argue with.

### Geofencing: platform reality check

| Constraint | Reality |
|---|---|
| iOS monitored regions | ~20 per app — so cap saved places at **15** and evict least-used. |
| Android geofences | ~100, but OEM battery managers kill them. Ask for `ACCESS_BACKGROUND_LOCATION` only when the user adds their first place. |
| Dwell time | Fire on *arrival dwell* (e.g. 2 min inside radius), not instant entry — avoids firing while driving past. |
| Radius | 150–300 m for shops (GPS drift makes 50 m unreliable). |
| Battery | Geofences are OS-level and cheap; continuous `watchPositionAsync` is not. **Never** poll location. |

Also cap pending local notifications (~64 on iOS): schedule only the next window and refill in the foreground, exactly like Blink.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM parsing cost spirals | Deterministic parser handles ~70% of captures for $0; LLM only on low confidence; cache identical inputs; per-user monthly credit cap. |
| Wrong-time reminders destroy trust | Confidence threshold + review chips + "Undo" in the notification action. |
| Location permission refusal | Feature-degrade: places are optional, time-based reminders always work. |
| Privacy concerns (list content to an LLM) | Send only the capture string, never the user's existing list; state it plainly in the onboarding screen; offer "on-device parsing only" toggle. |

### Monetisation

- Free: 30 captures/mo, 1 saved place, no calendar sync.
- **Compass Pro — $4.99/mo**: unlimited AI captures, unlimited places, calendar planning, voice, weekly review, email capture address.
- B2B angle later: per-team plan where the delegation hook (Type 3 → Type 2) becomes the wedge.

**Success metric:** % of captures completed with **zero field edits** (target > 60%); if it's low, fix the parser, not the marketing.

---

## Which one should *you* build?

| If you… | Build |
|---|---|
| Want a shipping win in 2 weeks, hate backend work | **Blink** |
| Enjoy data modelling, want a product with a built-in viral loop | **Tandem** |
| Are comfortable with APIs, want the most defensible/novel product | **Compass** |
| Want the highest chance of App Store "Editor's pick" style attention | **Tandem** (shared apps get featured) |
| Want the lowest ongoing cost | **Blink** (no server bill at all) |

**Portfolio play:** Blink is the foundation. Tandem reuses the list UI and adds sync. Compass reuses the capture pipeline and adds parsing. Build Blink first — you'll ship the design system, task row, swipe gestures and notification scheduler that the other two inherit. Roughly 40–60% of code is shared if you keep `lib/` pure.

### Suggested 30-day plan (Blink-first)

| Days | Deliverable |
|---|---|
| 1–2 | Expo project, drizzle schema, migrations, seeded dev data, dark-mode tokens |
| 3–5 | Quick-add + parser (`lib/parse.ts`) + unit tests |
| 6–9 | Today list, swipe-to-complete, Now Card, optimistic writes |
| 10–12 | Notification scheduler with the "next 10 only" strategy |
| 13–15 | Streak/done view, settings, export JSON |
| 16–19 | Dev build + widget + share-sheet target |
| 20–23 | Poleshing pass: empty states, haptics, reduced-motion, accessibility labels |
| 24–27 | Maestro E2E flows, crash reporting (Sentry), EAS Build, TestFlight/Play internal |
| 28–30 | 10 real users, instrument capture-to-task time, fix the top friction |

### Cross-cutting gotchas (all three)

1. **New Architecture only** on SDK 55+. Old tutorials' `newArchEnabled` / `expo build:` advice is stale; use `eas build`.
2. **`app.json` permissions:** write a one-line *why* string for every permission (`NSLocationWhenInUseUsageDescription`, notification rationale) — vague strings get rejected on iOS.
3. **Timezones:** store UTC, render local. A task captured at 23:30 "tomorrow" in Asia/Dhaka is a different UTC day.
4. **DST & recurrence:** always compute recurrence with a date library that is timezone-aware; naive `+7 days` drifts twice a year.
5. **Accessibility:** every swipe action needs a visible/announceable equivalent (an "Actions" menu on the row). Also gives you keyboard/`Switch Control` support for free.
6. **Reduced motion:** honour `prefers-reduced-motion` for the Now Card and confetti.
7. **`expo-file-system` copy/move are async** as of SDK 56 — check any snippet you copy.
8. **Don't ship secrets:** OpenAI/Anthropic keys live in a server function (Supabase Edge Function or Expo API route), never in the bundle. Anything in the JS bundle is public.

---

## Bonus: six more one-line variants (if none of the above fits)

1. **Voice-first driveway list** — a lock-screen widget that records; transcription becomes tasks; zero typing (great for tradespeople/drivers).
2. **Git-native dev todos** — sync with GitHub Issues/Linear and a terminal TUI; `TODO:` comments in code become tasks.
3. **Kids' gamified chores** — tasks are quests, completion earns in-app currency redeemable against real rewards the parent configures. (Strictly a subset of Tandem with a different skin — only build if you love the game design.)
4. **Body-doubling focus app** — shared silent timer rooms where strangers/teammates work "together"; tasks are session goals, not lists.
5. **Ephemeral / expiry-first todos** — every task auto-deletes unless you explicitly vouch for it (7-day TTL, "decay" visual). Anti-hoarding by design.
6. **Offline-first field-work checklist** — audit/inspection checklists with photos, GPS stamps, signatures, export to PDF. B2B, boring, profitable, and the least crowded market on this list.

---

## References

- Expo SDK 57 changelog (RN 0.86, React 19.2, Hermes V1 regression fix): https://expo.dev/changelog/sdk-57
- Expo SDK 56 changelog (Expo UI stable, `expo-calendar` stable, TS 6, CLI speedups): https://expo.dev/changelog/sdk-56
- Expo SDK 55 changelog (legacy architecture dropped, Node/Xcode minimums): https://expo.dev/changelog/sdk-55
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Maestro (mobile E2E flows): https://maestro.mobile.dev

> Version note: verify every package against `npx expo install --check` when you scaffold — the ecosystem moves fast and this doc is a snapshot.

---

## Status

**Type 1 — Blink is built.** See [`../blink/`](../blink/) for the implementation:
Expo SDK 57 / React Native 0.86 / TypeScript, with 209 passing tests (pure logic plus a
render test per screen) and a web build you can preview in a browser.

Deviations from the spec above, and why:

| Spec said | Built | Why |
|---|---|---|
| op-sqlite + Drizzle | zustand + AsyncStorage | A local-only dataset in the hundreds of tasks does not need a query engine; this removes the native build dependency and keeps the whole store serialisable for export. Swapping in op-sqlite later is contained to `features/tasks/store.ts`. |
| FlashList | FlatList | FlashList's benefit starts in the thousands of rows; FlatList keeps the dependency list smaller. Revisit if someone tracks 1k+ tasks. |
| expo-speech-recognition voice capture | not built | Deferred with the widget work — see "Known gaps" in the app README. |
| Home-screen widget | not built | Needs native code beyond Expo's managed config; it is the highest-value next feature. |

What the implementation added beyond the spec: a 28-day activity grid, undo-friendly
`reopen` on every completed task, a focus mode with an elapsed timer, export-as-backup
with a fully tested importer, and a storage layer that degrades to memory instead of
crashing when `localStorage` is unavailable.
