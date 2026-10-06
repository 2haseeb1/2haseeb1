# Blink — file & folder structure

An annotated map of the app. 79 tracked files: **58 under `src/`** (6,255 lines of
production code + 2,424 lines of tests across 13 suites).

```
blink/
├── index.js                      app entry: registers the Android widget task handler,
│                                 then boots expo-router
├── app.json                      Expo config — including the three native plugins
│                                 (expo-widgets, react-native-android-widget, expo-share-intent)
├── package.json                  deps + scripts (start / test / typecheck / lint /
│                                 build:web / preview)
├── tsconfig.json                 strict TS, `@/*` → `./src/*`
├── eslint.config.js              lint rules; ignores web-build + dist
├── jest.resolver.js              composes jest-expo's resolver with the react-native-worklets
│                                 fix that Reanimated 4 needs
├── jest.setup.js                 test env setup
├── README.md                     architecture, verification, native-feature caveats
├── .gitignore
├── .maestro/                     end-to-end flows (written, never run — no device here)
│   ├── smoke.yaml
│   └── parser.yaml
├── assets/images/                icon, splash, adaptive + monochrome icon, favicon
├── scripts/
│   └── serve-web.js              dependency-free static server for the web build
└── src/
    ├── app/                      expo-router routes — thin and presentational
    │   ├── _layout.tsx           root: theme, hydration, rollover, reminder sync,
    │   │                         widget sync, share-intent provider
    │   ├── (tabs)/
    │   │   ├── _layout.tsx       Today · Later · Done tab bar
    │   │   ├── index.tsx         Today — Now Card, streak, day header
    │   │   ├── later.tsx         Later — the "not now" bucket
    │   │   └── done.tsx          Done — log, activity grid
    │   ├── capture.tsx           quick capture modal; accepts a shared draft
    │   ├── now.tsx               focus mode with elapsed timer
    │   ├── task/[id].tsx         task detail — edit, reschedule, reopen
    │   └── settings.tsx          theme, reminders, day boundary, export, reset
    │
    ├── components/               dumb, reusable UI. No store access.
    │   ├── NowCard.tsx           the one task, four moves
    │   ├── TaskRow.tsx           a row in a list
    │   ├── SwipeableTaskRow.tsx  swipe right to complete, left to snooze
    │   ├── ActivityGrid.tsx      28-day completion grid
    │   ├── Button.tsx  Card.tsx  Checkbox.tsx  Chip.tsx
    │   ├── EmptyState.tsx  Screen.tsx  Text.tsx
    │   └── icons.tsx             hand-rolled SVG icons (no icon font dependency)
    │
    ├── features/                 stateful app logic, split by capability
    │   ├── tasks/
    │   │   ├── store.ts          zustand + AsyncStorage — the single source of truth
    │   │   ├── selectors.ts      pure derived views: Now Card, queues, streaks
    │   │   └── __tests__/
    │   │       ├── store.test.ts     recurrence spawning, snooze, reordering
    │   │       └── screens.test.tsx  every screen renders + key interactions
    │   │
    │   ├── widget/               everything the home-screen widget needs
    │   │   ├── snapshot.ts       pure: the widget's props + its refresh timeline
    │   │   ├── bridge.tsx        the ONLY module that talks to either widget library
    │   │   └── __tests__/
    │   │       ├── snapshot.test.ts       headline choice, queue, serialisability
    │   │       ├── bridge.test.ts         sync can never throw into the app
    │   │       └── widget-layout.test.ts  the compiled layout is valid JS that
    │   │                                  resolves nothing outside the widget runtime
    │   │
    │   └── capture/              everything the share sheet needs
    │       ├── share.ts          pure: a shared payload → a task input
    │       ├── useSharedDraft.ts reads the pending OS share
    │       ├── SharedDraftApplier.tsx   hands it to the capture screen
    │       ├── SharedIntentRedirect.tsx opens capture when launched by a share
    │       └── __tests__/share.test.ts  shared text and links become tasks intact
    │
    ├── lib/                      pure logic. No JSX, no store, no side effects.
    │   ├── parse.ts              the natural-language capture grammar (489 lines —
    │   │                         the biggest file in the app)
    │   ├── day.ts                calendar maths, formatters, streak computation
    │   ├── recurrence.ts         next-occurrence maths across DST/month boundaries
    │   ├── rollover.ts           the end-of-day sweep
    │   ├── sortKey.ts            fractional indexing for manual ordering
    │   ├── notifications.ts      capped, soonest-first reminder scheduling
    │   ├── export.ts             backup round-trip + a distrustful importer
    │   ├── types.ts              Task, Settings, NewTaskInput, Bucket
    │   ├── haptics.ts  id.ts
    │   └── __tests__/            day, export, parse, recurrence, rollover, sortKey
    │
    ├── theme/
    │   ├── tokens.ts             four themes, spacing, radii, hit targets
    │   └── useTheme.ts           the theme hook
    │
    └── widgets/                  NATIVE widget targets (dev build only — not Expo Go)
        ├── BlinkWidget.tsx       iOS layout. Compiled into a source STRING at build
        │                         time and evaluated inside the widget extension
        ├── blink-widget-ios.ts   the iOS widget instance (createWidget)
        ├── BlinkAndroidWidget.tsx  Android layout — an ordinary React component
        ├── widget-task-handler.tsx Android's headless entry point; registers on
        │                         Android only
        └── __tests__/widget-task-handler.test.ts
```

## How the layers depend on each other

```
app/  ──────▶ components/        presentation only
  │
  ├──────────▶ features/         stateful logic
  │              │
  └──────────▶ lib/  ◀───────────┘   pure, dependency-free, fully tested
```

The rule that keeps the app testable: **`lib/` and `features/` contain no JSX and
don't import from `app/`.** Every decision worth arguing about — what counts as
"today", how a streak resets, what happens to a missed recurring chore, whether a
shared string is a task or a link — is a pure function with tests. Screens stay
thin.

## The three places that reach outside the app

| File | Why it's special |
|---|---|
| `src/features/widget/bridge.tsx` | The only module importing `expo-widgets` or `react-native-android-widget`. Owns the platform split and swallows every native failure, so a broken widget can never break capture. |
| `src/widgets/BlinkWidget.tsx` | Runs in a different process. Its `'widget'` directive is compiled into a string, so it may only use bare globals and may not reference module scope — `widget-layout.test.ts` enforces this. |
| `src/widgets/widget-task-handler.tsx` | Android can launch the JS bundle with no activity mounted, so it reads the persisted store from storage rather than the live store. |

## Largest files

| Lines | File | |
|---:|---|---|
| 489 | `src/lib/parse.ts` | the capture grammar — the product's core |
| 395 | `src/app/settings.tsx` | most option surface |
| 387 | `features/tasks/__tests__/screens.test.tsx` | render coverage per screen |
| 350 | `src/app/task/[id].tsx` | task detail |
| 318 | `src/app/capture.tsx` | quick capture |
| 311 | `src/features/tasks/store.ts` | all mutations in one place |
| 309 | `src/app/(tabs)/index.tsx` | Today screen |
