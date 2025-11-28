// src/worker.ts

export interface Env {
  AI: {
    run(
      model: string,
      options: { prompt: string; stream?: boolean }
    ): Promise<string>;
  };
  HABIT_STORE: DurableObjectNamespace;
}

type HabitFrequency = "daily" | "weekly";

export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  targetPerPeriod: number; // e.g. 1/day or 3/week
  period: "day" | "week"; // for now just "day" or "week"
  createdAt: string; // ISO
}

export interface HabitLog {
  id: string;
  habitId: string;
  timestamp: string; // ISO
}

export interface UserState {
  habits: Habit[];
  logs: HabitLog[];
}

function defaultState(): UserState {
  return {
    habits: [],
    logs: []
  };
}

function uuid(): string {
  // Simple UUID-ish helper; good enough for this project
  return crypto.randomUUID();
}

function computeStats(state: UserState) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  return state.habits.map((habit) => {
    const completedLast7Days = state.logs.filter((log) => {
      return (
        log.habitId === habit.id &&
        new Date(log.timestamp).getTime() >= weekAgo
      );
    }).length;

    const targetPerWeek =
      habit.period === "week"
        ? habit.targetPerPeriod
        : habit.targetPerPeriod * 7;

    const completionRate =
      targetPerWeek > 0
        ? Math.min(1, completedLast7Days / targetPerWeek)
        : 0;

    return {
      habitId: habit.id,
      name: habit.name,
      completedLast7Days,
      targetPerWeek,
      completionRate
    };
  });
}

export class HabitStore implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private async loadState(): Promise<UserState> {
    const stored = await this.state.storage.get<UserState>("state");
    if (stored) return stored;
    const fresh = defaultState();
    await this.state.storage.put("state", fresh);
    return fresh;
  }

  private async saveState(state: UserState): Promise<void> {
    await this.state.storage.put("state", state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname; // will be /api/... here

    try {
      if (request.method === "GET" && path === "/api/state") {
        const state = await this.loadState();
        const stats = computeStats(state);
        return Response.json({ state, stats });
      }

      if (request.method === "POST" && path === "/api/habits") {
        const body = (await request.json()) as {
          name?: string;
          frequency?: HabitFrequency;
          targetPerPeriod?: number;
          period?: "day" | "week";
        };

        if (
          !body.name ||
          !body.frequency ||
          !body.targetPerPeriod ||
          !body.period
        ) {
          return new Response("Invalid habit payload", { status: 400 });
        }

        const state = await this.loadState();

        const newHabit: Habit = {
          id: uuid(),
          name: body.name,
          frequency: body.frequency,
          targetPerPeriod: body.targetPerPeriod,
          period: body.period,
          createdAt: new Date().toISOString()
        };

        state.habits.push(newHabit);
        await this.saveState(state);
        const stats = computeStats(state);

        return Response.json({ habit: newHabit, state, stats });
      }

      if (request.method === "POST" && path === "/api/log") {
        const body = (await request.json()) as { habitId?: string };
        if (!body.habitId) {
          return new Response("Missing habitId", { status: 400 });
        }

        const state = await this.loadState();
        const habit = state.habits.find((h) => h.id === body.habitId);

        if (!habit) {
          return new Response("Habit not found", { status: 404 });
        }

        const log: HabitLog = {
          id: uuid(),
          habitId: body.habitId,
          timestamp: new Date().toISOString()
        };

        state.logs.push(log);
        await this.saveState(state);
        const stats = computeStats(state);

        return Response.json({ log, state, stats });
      }

      if (request.method === "POST" && path === "/api/coach") {
        const body = (await request.json()) as { message?: string };
        const userMessage = (body.message || "").trim();

        if (!userMessage) {
          return new Response("Missing message", { status: 400 });
        }

        const state = await this.loadState();
        const stats = computeStats(state);

        const statsSummary = stats
          .map((s) => {
            return `Habit: ${s.name}
- Completed last 7 days: ${s.completedLast7Days}
- Target per week: ${s.targetPerWeek}
- Completion rate: ${(s.completionRate * 100).toFixed(0)}%`;
          })
          .join("\n\n");

        const habitsSummary =
          state.habits.length === 0
            ? "The user has not created any habits yet."
            : statsSummary;

        const systemPrompt = `
You are an encouraging, practical AI habit coach. 
You see the user's habit definitions and their performance over the last 7 days.
Give clear, concise feedback and *one or two* actionable suggestions.

Be:
- Short (2–4 paragraphs max)
- Concrete (numbers, patterns, examples)
- Supportive (no shaming).

User's habit data:

${habitsSummary || "No data yet."}

User's question or message:
"${userMessage}"
`.trim();

        const aiResponse = await this.env.AI.run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          {
            prompt: systemPrompt
          }
        );

        return Response.json({
          reply: aiResponse,
          stats
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("HabitStore error", err);
      return new Response("Internal error", { status: 500 });
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Get userId from query string; frontend keeps it in localStorage
    const userId = url.searchParams.get("userId") || "anonymous";

    const id = env.HABIT_STORE.idFromName(userId);
    const stub = env.HABIT_STORE.get(id);

    // Forward the original request to the Durable Object
    return stub.fetch(request);
  }
};
