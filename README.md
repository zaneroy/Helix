This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# 006D-02 — Corporate Actions TypeScript + Next.js Server Actions

This package connects the `006D-01` PostgreSQL API functions to your Next.js application.

## Included files

- `src/types/corporate-actions.ts`
- `src/lib/validators/corporate-actions.ts`
- `src/lib/actions/corporate-actions.ts`

## Installation

Copy the included `src` folders into the root of your Next.js project.

The server-action file currently imports:

```ts
import { createClient } from "@/utils/supabase/server";
```

Keep it unchanged if that is your existing Supabase server-client path. Otherwise, update this one import to match your project.

## Architecture

The files intentionally keep Next.js Server Components free from React hooks.

- Database calls live in `"use server"` functions.
- Types are framework-independent.
- Validation has no external dependency.
- Client components can call the exported actions from forms or event handlers.
- Server Components can call the read actions directly.

## Main exported actions

Read:

- `listCorporateActions`
- `getCorporateAction`
- `getCorporateActionsDashboard`
- `previewCorporateActionReversal`

Draft management:

- `createCorporateActionDraft`
- `updateCorporateActionDraft`
- `deleteCorporateActionDraft`

Workflow:

- `submitCorporateAction`
- `approveCorporateAction`
- `rejectCorporateAction`
- `cancelCorporateAction`
- `calculateCorporateAction`
- `executeCorporateAction`
- `issueCorporateActionCertificates`
- `processCorporateAction`
- `reverseCorporateAction`

## Important route note

The revalidation helper currently refreshes these paths:

```text
/admin/investors/corporate-actions
/admin/companies/[companyId]/corporate-actions
/admin/companies/[companyId]/corporate-actions/[actionId]
```

Update those strings if your final routes are different.

## Recommended next step

Build `006D-03` as the Admin Corporate Actions page using Server Components for data loading and small existing Client Components only for interactive controls.

# Helix Investors Frontend SQL Wiring v1

This package wires the Investors page to the SQL backend that passed:

- `assert_investors_sql_production_ready()`
- `sql_backend_production_ready: true`
- `356 passed`
- `0 failed`

## Files

Copy these into your Helix project:

```txt
types/investor-equity.ts
lib/actions/investor-equity.ts
app/dashboard/investors/InvestorEquityCommandCenter.tsx
```

Then either:

1. Replace your current files with the patched files in `patched-current-files/`, or
2. Manually apply the same changes.

```txt
patched-current-files/app/dashboard/investors/page.tsx
patched-current-files/app/dashboard/investors/AdminInvestorsClient.tsx
```

## What appears in the UI

The Investors page gets a new tab:

```txt
Live equity desk
```

It includes:

```txt
Command center
Offers
Issue shares
Move shares
Buy back / cancel
Certificates
Approvals
Backend safety check
```

## After copying

Run:

```bash
npm run lint
npm run build
```

If your project uses a different Supabase server-client import than:

```ts
import { createClient } from "@/lib/supabase/server";
```

update that one import inside:

```txt
lib/actions/investor-equity.ts
```

## Important

This is frontend wiring only. The SQL backend is already the source of truth.
The UI uses simple words on top of high-level SQL workflows.
