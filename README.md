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
