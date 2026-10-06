# 2haseeb1

React Native to-do app ideas, and the first one built.

```
docs/react-native-todo-app-ideas.md   Three types of to-do app, fully specced
blink/                                Type 1, implemented — Expo + TypeScript
```

## Blink

**The to-do app for people who abandon to-do apps.** Capture in under two seconds, then
do exactly one thing at a time. No account, no server, no sync.

```bash
cd blink
npm install
npx expo start              # native dev server (needs a dev build for notifications)
npm test                    # 209 tests
npm run build:web           # static web build
npm run preview             # serve it at http://localhost:8080
```

See [`blink/README.md`](blink/README.md) for the architecture, the full feature list and
the known gaps.

### Why these three ideas are different types

They differ in their core interaction model and data architecture, not just their UI:

| | Type 1 — Blink | Type 2 — Tandem | Type 3 — Compass |
|---|---|---|---|
| Core bet | Local-first, speed is the feature | Multiplayer sync and permissions | Context-aware parsing and triage |
| Hardest part | UI restraint | Conflict resolution | Parsing accuracy |
| Backend | None | Supabase (Postgres + RLS) | Thin API + LLM fallback |
| Status | **Built** | Specced | Specced |
