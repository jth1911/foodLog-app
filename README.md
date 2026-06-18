# Food Log

A simple, offline-first food-tracking dashboard built with React, TypeScript and Tailwind CSS. It's a self-contained single-user tool — no accounts, no network — that persists your log to the browser's local storage.

## Features

- **Dashboard / Foods / Goals tabs** — a persistent tab bar switches between the dashboard, a browser of reference foods, and the goals history. All stay mounted and share one data store, so the dashboard keeps its logged entries while you browse and reflects goal changes immediately.
- **Foods page** — a **user-managed** reference library grouped into headed sections by category (Dairy/Eggs, Meat/Poultry, …), each food showing its serving size and key macros. On first load the library is **seeded once** from `src/data/proteinSources.json` into `localStorage`; after that the stored copy is the sole source of truth. You can **add a food** to any category (name, serving size, protein/carbs/calories required; fat/fiber optional), **add a category**, **edit a food** in place (its id and category preserved), and **delete** a single food or a whole category (deleting a non-empty category asks first). Tapping a food jumps to the dashboard with the add-food modal pre-filled from its macros — user foods store plain numbers, and `fat`/`fiber` flow through when present; you can adjust anything before saving.
- **Quantity scaling** — when the modal opens pre-filled from a reference food, the macro fields represent **one serving** (shown read-only, e.g. `1 large`) and a **quantity** input multiplies them, so "I ate 2 eggs" or "half a cup" scales protein/carbs/calories — and any fat/fiber you add — automatically, with a live preview of the totals. Quantities allow decimals (`0.5`) and scaled macros round to one decimal place. The logged entry remembers its serving and quantity and the food-log row shows them (e.g. **`Egg — 2 × 1 large`**). A blank open from the `+` button has no quantity field and behaves as before — entered macros are final.
- **Date selector** — the app lands on the **real current date**, and a **Today** button jumps back to it. Pick any day from a clickable month-grid calendar (a popover behind the date button — visible weekdays make "a Wednesday two weeks ago" a glance-and-click) or step one day at a time (`‹` / `›`). The summary card and food log are both driven by the selected date, so they always describe the same set of entries. The current date is an injectable `today` prop (defaulting to the real clock) so tests pin a known day instead of depending on `Date.now()`.
- **Daily summary card** — the selected day's totals vs. the **goal in effect on that day** for calories, protein, fat, carbs and fiber, colour-coded by whether each goal is met. The goal shown here is read-only — it's resolved from the goal history (see below) and edited on the Goals tab.
- **Effective-dated goals (Goals tab)** — goals are a dated history rather than a single timeless value, so changing a goal doesn't silently re-judge past days. Each entry is a date plus a full set of five macro targets; the goal for any viewed day is the entry with the **latest effective date on or before that day** (dates before the first entry use the earliest one, so there's never a "no goal" gap). The Goals tab lists the history newest-first with a delete control per row and an **add-goal-change** form (date + the five macros, with its own validation). Editing is **add-and-delete only** — an existing entry is immutable, so an "edit" is a delete-and-re-add; adding on a date that already has an entry replaces it, and the last remaining entry can't be deleted.
- **Meal-grouped food log** — the selected day's entries grouped under Breakfast, Lunch, Dinner and Snacks, with a friendly empty state per meal.
- **Add / delete entries** — a floating `+` button opens a modal form (food name, meal type and the five macros) that appends a new entry to the **selected** day; each food row has a delete control that removes the entry after a confirmation. Both immediately update the summary totals and the meal feed.
- **Local persistence** — your entries, goal history **and** reference foods are saved to the browser's `localStorage` (under versioned keys `foodlog:entries:v1` / `foodlog:goalHistory:v1` / `foodlog:foods:v1`) and reloaded on every visit, so everything survives refreshes and restarts. On a first-ever load (empty storage) the app seeds a demo day, a single default goal, and the reference-food library (from the bundled JSON); once you've made any change the seed never re-runs or overwrites your data. A pre-existing single goal from an older version (`foodlog:goals:v1`) is migrated into one history entry on load. Corrupt or absent storage falls back to the seed/defaults rather than failing.

State is persisted to `localStorage` and seeded — only when storage is empty — with example entries pinned to a fixed demo day (`2026-05-01`, in `src/useFoodLog.ts`), decoupled from the real "today" the app lands on. The `useFoodLog` hook is the single data source the app reads from (lifted into `App` so the dashboard and Goals tab share one instance): it loads from storage on mount (seeding when empty, migrating a legacy single goal when present) and writes every change straight back, going through a `FoodLogStore` interface (`src/lib/foodLogRepo.ts`) so components never touch `localStorage` directly and tests inject an in-memory fake. Goal resolution is the pure `goalsForDate(history, date)` in `src/lib/nutrition.ts`. The nutrition math lives in `src/lib/nutrition.ts`, and ISO date math in `src/lib/dates.ts`: UTC-safe `addDays` / `weekdayOf` / `isoWeekOf`, plus `todayIso` (the local current day) and the `isoToDate` / `dateToIso` helpers that bridge ISO `YYYY-MM-DD` strings to/from the calendar's `Date` values without timezone drift. The calendar itself is [React DayPicker](https://daypicker.dev/) (`@daypicker/react`). The reference-food helpers in `src/lib/foods.ts` type the JSON and normalise its mixed macro strings — ranges (`"100-110"`) take the lower bound, the `"<1"` sentinel rounds up to `1`, and anything unparseable falls back to `0`. `seedFoodsFromJson()` uses that normaliser to build the first-run library (a `Record<category, UserFoodReference[]>` of plain-number macros, each food stamped with an id) that `useFoodLog` writes to `localStorage` when the foods key is empty; thereafter the static JSON is only this seed and the stored copy is read instead. The module also holds the pure `scaleMacros` helper (and its `roundMacro` rounding rule) that multiplies a per-serving macro set by a quantity. The `FoodEntry` type carries optional `servingSize` and `quantity` fields, set only for quantity-scaled entries and omitted by seed data and manual entries.

## Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [React DayPicker](https://daypicker.dev/) (`@daypicker/react`) for the calendar date picker
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) (`localStorage`) for persistence
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) for tests

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite once
npm run build    # type-check and build for production
```

## Persistence

The log lives in the browser's `localStorage` under three versioned keys, `foodlog:entries:v1` (the entries array), `foodlog:goalHistory:v1` (the effective-dated goal history — a sorted list of `{ effectiveDate, goals }`) and `foodlog:foods:v1` (the reference-food library — a `Record<category, UserFoodReference[]>`). The `useFoodLog` hook loads them on mount and writes back on every change, all behind a small `FoodLogStore` interface (`src/lib/foodLogRepo.ts`) so the storage details stay isolated and tests can inject an in-memory fake. Each key is shape-validated on read, so a tampered or wrong-shaped value falls back to the seed/defaults instead of crashing a consumer.

Seeding follows a **seed-when-empty** rule: on a first-ever load (no key present) the demo day, a single default goal entry, and the reference-food library (built from the bundled JSON) are seeded and immediately written back, so once any data exists — even an empty log after you delete everything — the seed never re-runs or overwrites it. **Migration:** if there's no goal history but a legacy single goal (`foodlog:goals:v1`, from before goals were dated) exists, it's converted into one history entry effective at a sentinel epoch date so it applies to every day; the legacy key is read-only and left in place. Malformed or absent JSON is treated as empty and falls back to the seed/defaults rather than throwing. There are no accounts and no network calls; the data is local to the browser profile.

## Project structure

```
src/
  App.tsx              # tab bar (Dashboard | Foods | Goals) + shared store + Foods→modal pre-fill wiring
  App.test.tsx         # tests: default tab, switching, pre-fill flow, blank FAB, goal-change reflected on dashboard
  Dashboard.tsx        # main UI: summary card (read-only goal), food log, add/delete (DashboardView + store wrapper)
  Dashboard.test.tsx   # component tests (rendering, totals, read-only goal resolution, grouping, add/delete)
  useFoodLog.ts        # data hook: loads from localStorage, seeds/migrates goals + seeds foods when empty, saves on change
  useFoodLog.test.tsx  # tests: seed-when-empty, migration, load-from-store, save-on-change, goal-history + foods mutations
  GoalsPage.tsx        # Goals tab: dated goal history (newest-first) with delete + add-goal-change form
  GoalsPage.test.tsx   # tests: ordering, initial-goal label, delete (disabled on last), add + validation
  FoodsPage.tsx        # user-managed reference-food library by category: add/edit/delete foods & categories; raises picked macros
  FoodsPage.test.tsx   # tests: headings, rows, food→NewFoodInput mapping, add/edit/delete food & category, validation
  AddFoodModal.tsx     # presentational add-food form shown in a Tailwind overlay
  AddFoodModal.test.tsx# tests: fields, validation, submit payload, pre-fill, cancel/close
  MealFeed.tsx         # food log container: groups entries into meal sections
  MealFeed.test.tsx    # tests: section order, routing, empty placeholders
  MealSection.tsx      # one meal bucket: heading, empty state, food rows + delete
  MealSection.test.tsx # tests: empty state, populated rows, delete confirmation
  data/
    proteinSources.json# reference foods keyed by category (seed-only source; the runtime library lives in localStorage)
  lib/
    foodLogRepo.ts     # FoodLogStore interface + localStorage-backed implementation (incl. goal-history + foods guards, legacy-goal read)
    foodLogRepo.test.ts# unit tests: round-trips, empty vs absent, versioned keys, shape guards, foods round-trip, legacy-goal migration read
    nutrition.ts       # pure logic: totals, goal status, goalsForDate, meal grouping + types + DEFAULT_GOALS
    nutrition.test.ts  # unit tests for the logic (incl. goalsForDate resolution cases)
    dates.ts           # ISO date math: addDays/weekdayOf/isoWeekOf (UTC) + todayIso/isoToDate/dateToIso (local)
    dates.test.ts      # unit tests: month/year/leap, weekday/ISO-week boundaries, today + Date round-trips
    foods.ts           # typed accessor + macro normaliser + UserFoodReference type + seedFoodsFromJson (first-run library)
    foods.test.ts      # unit tests: normaliseMacro/scale rules, category map shape, seed conversion
```
