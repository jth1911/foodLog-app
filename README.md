# Food Log

A simple food-tracking dashboard. Mock UI built with React, TypeScript and Tailwind CSS.

## Features

- **Daily summary card** — today's totals vs. goals for calories, protein, fat, carbs and fiber, colour-coded by whether each goal is met.
- **Editable goals panel** — adjust each macro goal inline; the summary updates immediately.
- **Meal-grouped food log** — entries grouped under Breakfast, Lunch and Dinner, with a placeholder for empty meals.

All state is local to the component and seeded with example entries (see `src/Dashboard.tsx`). The nutrition math lives in `src/lib/nutrition.ts`.

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
  Dashboard.tsx        # main UI: summary card, goals panel, food log
  Dashboard.test.tsx   # component tests (rendering, totals, goal edits, grouping)
  lib/
    nutrition.ts       # pure logic: totals, goal status, meal grouping + types
    nutrition.test.ts  # unit tests for the logic
```
