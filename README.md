# Next shadcn Boilerplate

A Next.js boilerplate with shadcn/ui, Tailwind CSS, TypeScript, ESLint, and Prettier.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Radix UI
- React DayPicker
- date-fns
- ESLint 9 flat config
- Prettier with Tailwind class sorting and import sorting

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run with Turbopack:

```bash
npm run dev:turbo
```

## Scripts

```bash
npm run dev
npm run dev:turbo
npm run build
npm run start
npm run lint
npm run format
npm run typecheck
```

## UI Components

Base shadcn-style components live in `components/ui`.

Custom form components:

- `InputText`
- `InputNumber`
- `InputFormattedNumber`
- `DatePicker`
- `DateRangePicker`

Supporting primitives:

- `Button`
- `Input`
- `InputGroup`
- `Textarea`
- `Field`
- `Label`
- `Calendar`
- `Popover`
- `Separator`

## Component Usage

```tsx
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import DateRangePicker from "@/components/ui/date-range-picker";
import InputFormattedNumber from "@/components/ui/input-formatted-number";
import InputNumber from "@/components/ui/input-number";
import InputText from "@/components/ui/input-text";
```

Example:

```tsx
<InputText required label="Username" placeholder="Username" />

<InputNumber required hideStepper label="Amount" min={0} step={1} startContent="Rp" />

<InputFormattedNumber
  label="Formatted amount"
  startContent="Rp"
  defaultValue={1250000.5}
/>

<DatePicker label="Date" />

<DateRangePicker label="Period" />
```

## Formatting

Prettier is configured in `.prettierrc` with:

- `prettier-plugin-tailwindcss`
- `@trivago/prettier-plugin-sort-imports`

Tailwind class sorting includes `cn` and `cva` via `tailwindFunctions`.

Run formatting:

```bash
npm run format
```

## Linting

ESLint uses the Next.js flat config with TypeScript support and `eslint-config-prettier` to avoid conflicts with Prettier.

Run linting:

```bash
npm run lint
```

Run type checking:

```bash
npm run typecheck
```

## Theme

Theme tokens are defined in `app/globals.css` using OKLCH colors.

The current palette uses a blue/cyan direction with:

- cyan primary color
- blue-tinted light surfaces
- navy blue dark background
- blue-tinted dark cards, borders, inputs, and accents

## Adding shadcn Components

Use the shadcn CLI:

```bash
npx shadcn@latest add button
```

Generated UI components are placed under `components/ui`.
