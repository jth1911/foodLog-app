# Food Log

A simple food-tracking dashboard. Mock UI built with React, TypeScript and Tailwind CSS.

## Features

- **Dashboard / Foods tabs** — a persistent tab bar switches between the dashboard and a browser of reference foods. Both stay mounted, so the dashboard keeps its logged entries while you browse.
- **Foods page** — reference foods from `src/data/proteinSources.json`, grouped into headed sections by category (Dairy/Eggs, Meat/Poultry, …) with each food's serving size and key macros. New categories appear automatically as the JSON grows. Tapping a food jumps to the dashboard with the add-food modal pre-filled from its macros (`fat` and `fiber` are absent from the data, so you fill those in); you can adjust anything before saving.
- **Quantity scaling** — when the modal opens pre-filled from a reference food, the macro fields represent **one serving** (shown read-only, e.g. `1 large`) and a **quantity** input multiplies them, so "I ate 2 eggs" or "half a cup" scales protein/carbs/calories — and any fat/fiber you add — automatically, with a live preview of the totals. Quantities allow decimals (`0.5`) and scaled macros round to one decimal place. The logged entry remembers its serving and quantity and the food-log row shows them (e.g. **`Egg — 2 × 1 large`**). A blank open from the `+` button has no quantity field and behaves as before — entered macros are final.
- **Date selector** — the app lands on the **real current date**, and a **Today** button jumps back to it. Pick any day from a clickable month-grid calendar (a popover behind the date button — visible weekdays make "a Wednesday two weeks ago" a glance-and-click) or step one day at a time (`‹` / `›`). The summary card and food log are both driven by the selected date, so they always describe the same set of entries. The current date is an injectable `today` prop (defaulting to the real clock) so tests pin a known day instead of depending on `Date.now()`.
- **Daily summary card** — the selected day's totals vs. goals for calories, protein, fat, carbs and fiber, colour-coded by whether each goal is met.
- **Editable goals panel** — adjust each macro goal inline; the summary updates immediately.
- **Meal-grouped food log** — the selected day's entries grouped under Breakfast, Lunch, Dinner and Snacks, with a friendly empty state per meal.
- **Add / delete entries** — a floating `+` button opens a modal form (food name, meal type and the five macros) that appends a new entry to the **selected** day; each food row has a delete control that removes the entry after a confirmation. Both immediately update the summary totals and the meal feed.

All state is local to the component and seeded with example entries pinned to a fixed demo day (`2026-05-01` in `src/Dashboard.tsx`), decoupled from the real "today" the app lands on. The nutrition math lives in `src/lib/nutrition.ts`, and ISO date math in `src/lib/dates.ts`: UTC-safe `addDays` / `weekdayOf` / `isoWeekOf`, plus `todayIso` (the local current day) and the `isoToDate` / `dateToIso` helpers that bridge ISO `YYYY-MM-DD` strings to/from the calendar's `Date` values without timezone drift. The calendar itself is [React DayPicker](https://daypicker.dev/) (`@daypicker/react`). The reference-food accessor in `src/lib/foods.ts` types the JSON and normalises its mixed macro strings — ranges (`"100-110"`) take the lower bound, the `"<1"` sentinel rounds up to `1`, and anything unparseable falls back to `0`. It also holds the pure `scaleMacros` helper (and its `roundMacro` rounding rule) that multiplies a per-serving macro set by a quantity. The `FoodEntry` type carries optional `servingSize` and `quantity` fields, set only for quantity-scaled entries and omitted by seed data and manual entries.

## Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [React DayPicker](https://daypicker.dev/) (`@daypicker/react`) for the calendar date picker
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) for tests

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite once
npm run build    # type-check and build for production
```

## Project structure

```
src/
  App.tsx              # tab bar (Dashboard | Foods) + Foods→modal pre-fill wiring
  App.test.tsx         # tests: default tab, switching, pre-fill flow, blank FAB
  Dashboard.tsx        # main UI: summary card, goals panel, food log, add/delete
  Dashboard.test.tsx   # component tests (rendering, totals, goal edits, grouping, add/delete)
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
    nutrition.ts       # pure logic: totals, goal status, meal grouping + types
    nutrition.test.ts  # unit tests for the logic
    dates.ts           # ISO date math: addDays/weekdayOf/isoWeekOf (UTC) + todayIso/isoToDate/dateToIso (local)
    dates.test.ts      # unit tests: month/year/leap, weekday/ISO-week boundaries, today + Date round-trips
    foods.ts           # typed accessor + macro normaliser over proteinSources.json
    foods.test.ts      # unit tests: normaliseMacro rules + category map shape
```
