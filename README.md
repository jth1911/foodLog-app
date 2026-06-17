# Food Log

A simple food-tracking dashboard built with React, TypeScript and Tailwind CSS, with an optional Firebase backend that syncs a signed-in user's log across all their devices.

## Features

- **Dashboard / Foods tabs** — a persistent tab bar switches between the dashboard and a browser of reference foods. Both stay mounted, so the dashboard keeps its logged entries while you browse.
- **Foods page** — reference foods from `src/data/proteinSources.json`, grouped into headed sections by category (Dairy/Eggs, Meat/Poultry, …) with each food's serving size and key macros. New categories appear automatically as the JSON grows. Tapping a food jumps to the dashboard with the add-food modal pre-filled from its macros (`fat` and `fiber` are absent from the data, so you fill those in); you can adjust anything before saving.
- **Quantity scaling** — when the modal opens pre-filled from a reference food, the macro fields represent **one serving** (shown read-only, e.g. `1 large`) and a **quantity** input multiplies them, so "I ate 2 eggs" or "half a cup" scales protein/carbs/calories — and any fat/fiber you add — automatically, with a live preview of the totals. Quantities allow decimals (`0.5`) and scaled macros round to one decimal place. The logged entry remembers its serving and quantity and the food-log row shows them (e.g. **`Egg — 2 × 1 large`**). A blank open from the `+` button has no quantity field and behaves as before — entered macros are final.
- **Date selector** — the app lands on the **real current date**, and a **Today** button jumps back to it. Pick any day from a clickable month-grid calendar (a popover behind the date button — visible weekdays make "a Wednesday two weeks ago" a glance-and-click) or step one day at a time (`‹` / `›`). The summary card and food log are both driven by the selected date, so they always describe the same set of entries. The current date is an injectable `today` prop (defaulting to the real clock) so tests pin a known day instead of depending on `Date.now()`.
- **Daily summary card** — the selected day's totals vs. goals for calories, protein, fat, carbs and fiber, colour-coded by whether each goal is met.
- **Editable goals panel** — adjust each macro goal inline; the summary updates immediately.
- **Meal-grouped food log** — the selected day's entries grouped under Breakfast, Lunch, Dinner and Snacks, with a friendly empty state per meal.
- **Add / delete entries** — a floating `+` button opens a modal form (food name, meal type and the five macros) that appends a new entry to the **selected** day; each food row has a delete control that removes the entry after a confirmation. Both immediately update the summary totals and the meal feed.
- **Multi-device sync (sign in with Google)** — sign in from the header and your entries **and** macro goals are stored per-user in Cloud Firestore and stay in sync on every device you sign into. Signed out, the app runs as a local demo (seeded entries, in-memory edits) exactly as before. Signing in switches to your cloud copy; signing out returns to the demo. See [Backend & sync](#backend--sync).

Signed out, all state is local to the component and seeded with example entries pinned to a fixed demo day (`2026-05-01`, in `src/useFoodLog.ts`), decoupled from the real "today" the app lands on. The `useFoodLog` hook is the single data source the dashboard reads from: signed out it holds local/in-memory state; signed in it subscribes to the user's Firestore documents through a `FoodLogRepository` (`src/lib/foodLogRepo.ts`), so the component never talks to Firebase directly and tests inject an in-memory repo. The nutrition math lives in `src/lib/nutrition.ts`, and ISO date math in `src/lib/dates.ts`: UTC-safe `addDays` / `weekdayOf` / `isoWeekOf`, plus `todayIso` (the local current day) and the `isoToDate` / `dateToIso` helpers that bridge ISO `YYYY-MM-DD` strings to/from the calendar's `Date` values without timezone drift. The calendar itself is [React DayPicker](https://daypicker.dev/) (`@daypicker/react`). The reference-food accessor in `src/lib/foods.ts` types the JSON and normalises its mixed macro strings — ranges (`"100-110"`) take the lower bound, the `"<1"` sentinel rounds up to `1`, and anything unparseable falls back to `0`. It also holds the pure `scaleMacros` helper (and its `roundMacro` rounding rule) that multiplies a per-serving macro set by a quantity. The `FoodEntry` type carries optional `servingSize` and `quantity` fields, set only for quantity-scaled entries and omitted by seed data and manual entries.

## Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [React DayPicker](https://daypicker.dev/) (`@daypicker/react`) for the calendar date picker
- [Firebase](https://firebase.google.com/) (modular JS SDK) — Authentication (Google) + Cloud Firestore with offline persistence, for optional multi-device sync
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) for tests

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite once
npm run build    # type-check and build for production
```

Cloud sync is optional — without any Firebase config the app runs as a local, signed-out demo. To enable sign-in and sync, see [Backend & sync](#backend--sync).

## Backend & sync

Signed in, the app stores each user's entries and macro goals in **Cloud Firestore** and authenticates with **Firebase Authentication** (Google provider). Firestore is initialized with offline persistence (`persistentLocalCache`), so reads and writes work offline and reconcile on reconnect ("last write wins"). Data is keyed per user:

```
users/{uid}/entries/{entryId}   # one document per food entry
users/{uid}/goals/macros        # a single document holding the macro goals
```

Auth state is driven by `onAuthStateChanged`; signing in uses `signInWithPopup`. When the user signs in, the app switches from the local demo to their cloud copy (existing local entries are **not** pushed up — that merge is left for a follow-up); signing out returns to the demo.

### Configuration

Firebase config is read from Vite env vars (only `VITE_`-prefixed vars reach the client), so no keys are hard-coded. **When these are absent the app stays in local demo mode** — Firebase is never initialized.

1. Create a Firebase project and a Web app, and enable **Authentication → Google** and **Cloud Firestore**.
2. Copy `.env.example` to `.env.local` and fill in the values from *Project settings → General → Your apps → Web app*:

   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```

   `.env*` files are git-ignored (except `.env.example`), so your config stays out of version control.
3. Deploy the included security rules so each user can only read/write their own subtree:

   ```bash
   firebase deploy --only firestore:rules   # uses firestore.rules
   ```

   The tests never touch Firebase — they inject an in-memory repository — so no emulator or credentials are needed to run `npm test`.

## Project structure

```
.env.example           # template for the VITE_FIREBASE_* config (copy to .env.local)
firestore.rules        # security rules: each user limited to their own users/{uid} subtree
src/
  App.tsx              # tab bar (Dashboard | Foods) + Foods→modal pre-fill wiring
  App.test.tsx         # tests: default tab, switching, pre-fill flow, blank FAB
  Dashboard.tsx        # main UI: summary card, goals panel, food log, add/delete, sign-in control
  Dashboard.test.tsx   # component tests (rendering, totals, goal edits, grouping, add/delete)
  useFoodLog.ts        # data hook: local seed/demo when signed out, Firestore subscription when signed in
  useFoodLog.test.tsx  # tests: signed-out local mutations, signed-in repo routing, sign-in/out transitions
  SignInControl.tsx    # presentational Google sign-in / sign-out control
  SignInControl.test.tsx# tests: signed-out/signed-in rendering, name/email fallback, click handlers
  FoodsPage.tsx        # reference-food browser grouped by category; raises picked macros
  FoodsPage.test.tsx   # tests: category headings, rows, food→NewFoodInput mapping
  AddFoodModal.tsx     # presentational add-food form shown in a Tailwind overlay
  AddFoodModal.test.tsx# tests: fields, validation, submit payload, pre-fill, cancel/close
  MealFeed.tsx         # food log container: groups entries into meal sections
  MealFeed.test.tsx    # tests: section order, routing, empty placeholders
  MealSection.tsx      # one meal bucket: heading, empty state, food rows + delete
  MealSection.test.tsx # tests: empty state, populated rows, delete confirmation
  data/
    proteinSources.json# reference foods keyed by category (source data for the Foods page)
  lib/
    firebase.ts        # Firebase init from VITE_FIREBASE_* env vars (guarded; null when unconfigured)
    useAuth.ts         # auth hook: onAuthStateChanged + Google sign-in/out (no-op when unconfigured)
    foodLogRepo.ts     # FoodLogRepository interface, Firestore impl, + pure FoodEntry/Goals<->doc mappers
    foodLogRepo.test.ts# unit tests: mapper round-trips, optional-field omission, goals defaults
    nutrition.ts       # pure logic: totals, goal status, meal grouping + types + DEFAULT_GOALS
    nutrition.test.ts  # unit tests for the logic
    dates.ts           # ISO date math: addDays/weekdayOf/isoWeekOf (UTC) + todayIso/isoToDate/dateToIso (local)
    dates.test.ts      # unit tests: month/year/leap, weekday/ISO-week boundaries, today + Date round-trips
    foods.ts           # typed accessor + macro normaliser over proteinSources.json
    foods.test.ts      # unit tests: normaliseMacro rules + category map shape
```
