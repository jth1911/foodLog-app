# Food Log

A simple food-tracking dashboard. Mock UI built with React, TypeScript and Tailwind CSS.

## Features

- **Date selector** — pick any day with a native date input or step one day at a time (`‹` / `›`), with a **Today** button to jump back to the seeded date. The summary card and food log are both driven by the selected date, so they always describe the same set of entries.
- **Daily summary card** — the selected day's totals vs. goals for calories, protein, fat, carbs and fiber, colour-coded by whether each goal is met.
- **Editable goals panel** — adjust each macro goal inline; the summary updates immediately.
- **Meal-grouped food log** — the selected day's entries grouped under Breakfast, Lunch, Dinner and Snacks, with a friendly empty state per meal.
- **Add / delete entries** — a floating `+` button opens a modal form (food name, meal type and the five macros) that appends a new entry to the **selected** day; each food row has a delete control that removes the entry after a confirmation. Both immediately update the summary totals and the meal feed.

All state is local to the component and seeded with example entries (see `src/Dashboard.tsx`). The nutrition math lives in `src/lib/nutrition.ts`, and ISO date math (`addDays`, `weekdayOf`, `isoWeekOf`) in `src/lib/dates.ts`.

## Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
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
  Dashboard.tsx        # main UI: summary card, goals panel, food log, add/delete
  Dashboard.test.tsx   # component tests (rendering, totals, goal edits, grouping, add/delete)
  AddFoodModal.tsx     # presentational add-food form shown in a Tailwind overlay
  AddFoodModal.test.tsx# tests: fields, validation, submit payload, cancel/close
  MealFeed.tsx         # food log container: groups entries into meal sections
  MealFeed.test.tsx    # tests: section order, routing, empty placeholders
  MealSection.tsx      # one meal bucket: heading, empty state, food rows + delete
  MealSection.test.tsx # tests: empty state, populated rows, delete confirmation
  lib/
    nutrition.ts       # pure logic: totals, goal status, meal grouping + types
    nutrition.test.ts  # unit tests for the logic
    dates.ts           # pure ISO date math: addDays, weekdayOf, isoWeekOf (UTC-safe)
    dates.test.ts      # unit tests: month/year/leap + weekday/ISO-week boundaries
```
