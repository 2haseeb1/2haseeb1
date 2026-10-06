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
- **A home-screen widget.** One thing, the streak behind it, and a timeline that
  refreshes itself at the day boundary so the label is never stale. Sizes from
  `systemSmall` up to lock-screen `accessoryCircular`.
- **A share-sheet target.** Share a sentence or a link from any app and Blink opens
  with the capture sheet already filled in — title, date and repeat parsed from the
  share. It is still one tap to save, because the parser is good, not infallible.

## Native features (widget + share sheet)

These are extension targets, not JavaScript: they need a **dev build**, not Expo Go.

| | iOS | Android |
|---|---|---|
| Widget | `expo-widgets` — SwiftUI layout, `systemSmall`→`systemLarge` + lock screen | `react-native-android-widget` — a React component rendered to a launcher view |
| Share sheet | `expo-share-intent` extension | `intent-filter` on the main activity (`text/*`) |
| Shared storage | app group `group.com.blink.todo` | n/a — the widget reads the app's own store |

The pieces that live in this repo:

- `src/widgets/BlinkWidget.tsx` — the iOS layout. Its `'widget'` directive is compiled
  into a **source string** by `babel-preset-expo`, evaluated later in the widget's own
  JS runtime. So the layout may only use bare globals and may not reference anything
  from module scope; `src/features/widget/__tests__/widget-layout.test.ts` asserts the
  extracted string is valid JavaScript and resolves nothing outside the widget runtime.
- `src/widgets/blink-widget-ios.ts`, `src/widgets/BlinkAndroidWidget.tsx` —
  the two widget instances. Both are named `BlinkNow`, matching `app.json`.
- `src/widgets/widget-task-handler.tsx` — Android's headless entry point, imported from
  `index.js` ahead of `expo-router/entry`. Android can launch the JS bundle with no
  activity mounted, so this reads the persisted store from storage.
- `src/features/widget/bridge.ts` — the only module that touches either widget library.
  It coalesces updates, swallows every native failure, and no-ops on web.

**Not verified on a device.** There is no Xcode or Android Studio in the environment this
was built in, so these were type-checked, bundled for both platforms, and their config was
validated with `expo config --type introspect` — but never rendered. First device build:
add the widget to the home screen and confirm it shows the current task, then complete that
task in the app and confirm the widget updates.

## Expo Go vs a development build

Blink runs on both, but the three native integrations need a dev build. That is not
a limitation of this app — Expo Go ships a fixed set of native modules and the
widget, the share-sheet extension and *remote* push are not among them.

| | Expo Go | Dev build |
|---|---|---|
| Capture, lists, recurrence, rollover, streak, themes | ✅ | ✅ |
| Widget | — | ✅ |
| Share-sheet target | — | ✅ |
| Reminders (iOS) | ✅ | ✅ |
| Reminders (Android) | — | ✅ |

### Two of these libraries throw on *import*, not on use

This is the important detail, and it caused a real crash:

```
[runtime not ready]: Error: expo-notifications: Android Push notifications …
  was removed from Expo Go with the release of SDK 53.
```

The stack trace ended at `src/lib/notifications.ts:14` — the import line.
`expo-notifications` throws while its own module body evaluates
(`DevicePushTokenAutoRegistration.fx` → `addPushTokenListener` →
`warnOfExpoGoPushUsage`, which does `if (Platform.OS === 'android') throw`).
`react-native-android-widget` does the same via
`TurboModuleRegistry.getEnforcing('AndroidWidget')`, and `index.js` imported it on
every platform.

**A throw during import cannot be caught at a call site.** So those two modules are
never imported eagerly: they are `require`d lazily, behind
`src/lib/runtime.ts`. `src/lib/__tests__/native-import-boundary.test.ts` walks the
real static import graph from the entry point and fails if a forbidden package
reappears in it — verified by reintroducing the bug and watching it fail.

In Expo Go the app now degrades honestly instead of crashing: Settings says
*"Needs a development build — Expo Go cannot run this"* rather than offering a
permission button that cannot work.

### "Cannot connect to Expo CLI" in the app

This one is a **dev-server networking warning, not an app bug** — and the source
proves it. In `expo/src/async-require/hmr.ts`:

```js
client.on('connection-error', (e) => setHMRUnavailableReason(getConnectionError(serverHost, e)));

client.on('update-start', () => { didConnect = true; /* … */ });

// We only want to show a warning if Fast Refresh is on *and* if we ever
// previously managed to connect successfully.
if (hmrClient.isEnabled() && didConnect) { … }
```

The warning is gated on `didConnect`, which is only set after Metro has actually
sent an update. So the sequence is: **the bundle downloaded fine and Fast Refresh
connected, then the socket dropped.** The app itself is running — Blink makes zero
network requests, by design.

What it costs you: Fast Refresh. Saving a file will not hot-reload until the app
reconnects. Press `r` in the Metro terminal (or reload the app) and the warning goes
away.

Ranked causes, and the fix for each:

| Cause | Fix |
|---|---|
| Metro was stopped or restarted while the app was open | Start it again and press `r`, or reload the app |
| Phone and PC on different networks (guest Wi-Fi, VLAN, hotspot) | Put both on the same Wi-Fi, or use `--tunnel` |
| Windows Firewall blocking Node.js on port 8081 | Allow Node.js through on **private** networks |
| VPN active on the PC or the phone | Disconnect it while developing |
| The machine's LAN IP changed (DHCP) and the app is holding the old one | Reload the app so it re-reads the manifest |
| Router has AP/client isolation enabled | Turn it off, or use `--tunnel` |
| USB-connected device without port forwarding | `adb reverse tcp:8081 tcp:8081` |

Two settings survive all of the above:

```bash
npx expo start --tunnel          # routes through a tunnel; works on any network
npx expo start --clear           # when in doubt, drop the Metro cache too
```

If a scan of the QR code connects but Fast Refresh keeps dropping, `--tunnel` is the
reliable answer — it removes LAN topology from the equation entirely.

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
npm test                 # 303 tests: pure logic + a render test per screen
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
| `features/widget/__tests__/widget-layout.test.ts` | the widget layout compiles to valid JS that resolves nothing outside the widget runtime |
| `features/widget/__tests__/snapshot.test.ts` | the widget's view of the data: headline choice, queue, timeline, serialisability |
| `features/widget/__tests__/bridge.test.ts` | widget sync can never throw into the app, on any platform |
| `features/capture/__tests__/share.test.ts` | shared text and links become tasks without corrupting either |
| `widgets/__tests__/widget-task-handler.test.ts` | the Android handler never registers on a platform that cannot support it |
| `lib/__tests__/expo-go.test.ts` | with Expo Go simulated and the native libraries rigged to throw on import, every module still loads |
| `lib/__tests__/native-import-boundary.test.ts` | no entry-reachable module statically imports a library that throws during import |

### Dependency notes (what `npm install` prints)

`npm install` reports deprecation warnings and an audit count. Both were checked;
here is the verdict so nobody has to re-derive it.

**`npm audit` — 68 advisories, all dev/BUILD tooling, none in the app.** The five
distinct advisories arrive through `jest`, `jest-expo`, `@expo/cli` and
`@expo/config-plugins` (used at prebuild time), not through anything this app imports:

| Advisory | Reaches the app via |
|---|---|
| `node-forge` RSA signature check | `expo` → `@expo/cli` — the dev server / code signing |
| `braces` stack exhaustion | `jest` → `@jest/core` → `micromatch` |
| `sprintf-js` DoS | `jest-expo` → `babel-jest` → `istanbul-lib` (coverage) |
| `uuid` buffer bounds | `expo-share-intent` → `@expo/config-plugins` → `xcode` (prebuild) |
| `decode-uri-component` DoS | `expo-router` → `query-string` |

Verified rather than assumed: grepping the shipped Android (`.hbc`) and web bundles for
every one of these package names returns **zero** hits, while app-code controls
(`THE ONE THING`, `blink-store`, `BlinkNow`) return hits — so the search is meaningful.

**Do not run `npm audit fix --force`.** For an Expo app the transitive chain *is* the
SDK version alignment, and forcing fixes breaks it for no security gain. `npm audit fix`
proposes no changes, which is the correct outcome.

**`unrs-resolver` postinstall blocked** — that is npm's install-script gating, not a
project error. It is pulled in by `eslint-config-expo` via
`eslint-import-resolver-typescript`, and the script only verifies the platform binary
that npm already installed as an optional dependency. Nothing to approve.

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
  features/widget/
    snapshot.ts           pure: the widget's props + the timeline it refreshes on
    bridge.tsx            the only module that talks to either widget library
  features/capture/
    share.ts              pure: a shared payload -> a task input
  widgets/                native widget targets (see "Native features")
    BlinkWidget.tsx       iOS layout, compiled into a string at build time
    BlinkAndroidWidget.tsx  Android layout, an ordinary React component
    widget-task-handler.tsx Android's headless entry point
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

- **Voice capture** — `expo-speech-recognition` feeds the same parser pipeline. The last
  input method still missing.
- **Widget quick-add** — the widget opens the capture sheet rather than accepting text
  inline. Inline entry needs a WidgetKit `AppIntent` text field, which is a bigger piece
  of native work than the read-only widget.
- **Import UI** — `lib/export.ts` parses an import and is fully tested, but the Settings
  screen only exposes export today.
- **Sync** — out of scope by design. Export is the backup story.

## License

MIT
