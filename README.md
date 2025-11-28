# Habit Coach (`cf_ai_habit_coach`)

An AI-powered habit tracker and coach built on **Cloudflare Workers**, **Workers AI**, and **Durable Objects**.

Users can:

- Define habits and goals
- Log habit completions
- See lightweight stats for the last 7 days
- Ask an AI coach for feedback and suggestions based on their data
---

## Tech Stack

- **Cloudflare Workers** for the backend API (`src/worker.ts`)
- **Workers AI** for text generation (Llama 3.3 70B Instruct fp8 fast)
- **Durable Objects** for per-user persistent state (`HabitStore`)
- **Static HTML/CSS/JS** UI served from `public/`

---


## Instructions 
Go to the Cloudflare dashboard.

Choose Workers & Pages.

Click Create application.

Select Workers & Pages (or Pages with a Workers build, depending on UI).

Choose “Connect to Git” and select your cf_ai_habit_coach repository.

Build configuration:

Build command: npx wrangler deploy

Build output directory: leave empty (Wrangler handles deploy)

Save / deploy.

Cloudflare will:

Clone your repo

Run npm install

Run npx wrangler deploy

Visit Link created from application


## Project Structure

```text
├── src/
│   └── worker.ts      # Worker + Durable Object
├── public/
│   ├── index.html     # UI
│   ├── style.css      # Styling
│   └── app.js         # Frontend logic
├── wrangler.jsonc     # Cloudflare config (AI binding, Durable Object, assets)
├── package.json
├── tsconfig.json
├── README.md
└── PROMPTS.md
