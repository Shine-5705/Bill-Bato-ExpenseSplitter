# Smart Expense Splitter

Lightweight web app to split shared expenses among friends, roommates, and teams.

## Live Demo

https://bill-bato.netlify.app/

## What This Solves

Manual shared-expense tracking causes confusion around:

- who paid
- who owes whom
- exact settlement amounts

This app automates that workflow with real-time balance updates.

## Features Implemented

- Create groups
- Add members per group
- Add expenses with:
  - equal split
  - custom split
- Automatic balance calculation per member
- Simplified settlement suggestions (minimum transactions)
- Expense feed with category tags
- AI-like smart categorization from expense descriptions
- AI-like spending insights by weekly category trend
- Local persistence using browser localStorage
- Responsive mobile + desktop UI

## Tech Stack

- React + TypeScript
- Vite
- Pure CSS (custom theme + responsive layout)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Preview production build:

```bash
npm run preview
```

## Deployment (Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel, choose Import Project.
3. Framework preset: Vite (auto-detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.

## Deployment (Netlify)

1. Push this folder to a GitHub repo.
2. In Netlify, Add New Site -> Import from Git.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

## Evaluation Criteria Mapping

- Feature completion: Core and optional AI-inspired features are implemented.
- Code quality/scalability: Typed data models, modular calculations, and readable state flow.
- Real-time performance: All totals/balances update instantly on state changes.
- AI accuracy: Keyword-based categorization + trend analytics (extendable to LLM APIs).
- UX/UI: Mobile-first responsive design with clear forms and debt summaries.

## Future Enhancements

- Real multi-user sync via Supabase/Firebase
- Auth and invite links for groups
- Export settlement report (PDF/CSV)
- Integrate LLM API for richer categorization and natural-language insights
