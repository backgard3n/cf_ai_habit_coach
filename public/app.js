// public/app.js

(function () {
  const API_BASE = "/api";

  function getUserId() {
    let id = localStorage.getItem("habit_coach_user_id");
    if (!id) {
      id = self.crypto?.randomUUID
        ? self.crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      localStorage.setItem("habit_coach_user_id", id);
    }
    return id;
  }

  const userId = getUserId();

  const habitForm = document.getElementById("habit-form");
  const habitNameInput = document.getElementById("habit-name");
  const habitFrequencyInput = document.getElementById("habit-frequency");
  const habitTargetInput = document.getElementById("habit-target");
  const habitPeriodInput = document.getElementById("habit-period");
  const habitItemsContainer = document.getElementById("habit-items");

  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");
  const chatWindow = document.getElementById("chat-window");

  let latestStats = [];

  function apiUrl(path) {
    const url = new URL(API_BASE + path, window.location.origin);
    url.searchParams.set("userId", userId);
    return url.toString();
  }

  async function apiGet(path) {
    const res = await fetch(apiUrl(path));
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function renderHabits(state, stats) {
    latestStats = stats || [];
    habitItemsContainer.innerHTML = "";

    if (!state.habits.length) {
      const p = document.createElement("p");
      p.className = "habit-empty";
      p.textContent = "You don't have any habits yet. Create your first one above!";
      habitItemsContainer.appendChild(p);
      return;
    }

    state.habits.forEach((habit) => {
      const stat = stats.find((s) => s.habitId === habit.id);

      const item = document.createElement("div");
      item.className = "habit-item";

      const meta = document.createElement("div");
      meta.className = "habit-meta";

      const name = document.createElement("div");
      name.className = "habit-name";
      name.textContent = habit.name;

      const details = document.createElement("div");
      details.className = "habit-details";
      details.textContent = `${habit.frequency} • target ${habit.targetPerPeriod} per ${habit.period}`;

      const progress = document.createElement("div");
      progress.className = "habit-progress";

      if (stat) {
        const rate = stat.completionRate;
        const badge = document.createElement("span");
        badge.className =
          "badge " + (rate >= 0.8 ? "badge-good" : rate < 0.4 ? "badge-bad" : "");
        badge.textContent = `${stat.completedLast7Days}/${stat.targetPerWeek} last 7 days (${formatPercent(
          rate
        )})`;

        progress.appendChild(badge);
      } else {
        progress.textContent = "No activity yet";
      }

      meta.appendChild(name);
      meta.appendChild(details);
      meta.appendChild(progress);

      const actions = document.createElement("div");
      actions.className = "habit-actions";

      const logBtn = document.createElement("button");
      logBtn.type = "button";
      logBtn.textContent = "Log done";
      logBtn.addEventListener("click", () => logHabitCompletion(habit.id));

      actions.appendChild(logBtn);

      item.appendChild(meta);
      item.appendChild(actions);

      habitItemsContainer.appendChild(item);
    });
  }

  function addChatMessage(type, text) {
    const div = document.createElement("div");
    div.className = `chat-message ${type}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  async function loadState() {
    try {
      const data = await apiGet("/state");
      renderHabits(data.state, data.stats);
      if (!data.state.habits.length) {
        addChatMessage(
          "system",
          "Welcome! Create a habit on the left, then ask your coach how you're doing."
        );
      }
    } catch (err) {
      console.error(err);
      addChatMessage("system", "Failed to load your habits. Try refreshing.");
    }
  }

  async function createHabit(event) {
    event.preventDefault();

    const name = habitNameInput.value.trim();
    if (!name) return;

    try {
      const payload = {
        name,
        frequency: habitFrequencyInput.value,
        targetPerPeriod: Number(habitTargetInput.value || "1"),
        period: habitPeriodInput.value
      };

      const data = await apiPost("/habits", payload);
      renderHabits(data.state, data.stats);
      habitNameInput.value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to create habit. Check console for details.");
    }
  }

  async function logHabitCompletion(habitId) {
    try {
      const data = await apiPost("/log", { habitId });
      renderHabits(data.state, data.stats);
      addChatMessage("system", "Nice! Logged that habit as completed.");
    } catch (err) {
      console.error(err);
      alert("Failed to log completion. Check console for details.");
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    addChatMessage("user", message);
    chatInput.value = "";

    addChatMessage("system", "Coach is thinking...");

    try {
      const data = await apiPost("/coach", { message });
      // Remove the last "Coach is thinking..." message
      const last = chatMessages.lastElementChild;
      if (last && last.classList.contains("system")) {
        chatMessages.removeChild(last);
      }
      addChatMessage("bot", data.reply);
    } catch (err) {
      console.error(err);
      addChatMessage(
        "system",
        "Something went wrong while talking to the coach. Try again."
      );
    }
  }

  habitForm.addEventListener("submit", createHabit);
  chatForm.addEventListener("submit", sendChat);

  loadState();
})();
