/**
 * Weekly Budget Overview Card
 *
 * A Lovelace card that displays the current weekly budget status:
 * - Spent vs Remaining with a progress ring
 * - Effective budget (limit + rollover)
 * - Quick-add expense form
 * - Reset button
 */

class WeeklyBudgetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  static get properties() {
    return {
      _config: {},
      _hass: {},
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity (sensor.weekly_budget_remaining)");
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;

    const entityId = this._config.entity;
    const state = this._hass.states[entityId];

    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card header="Weekly Budget">
          <div style="padding: 16px; color: #999;">Entity not found: ${entityId}</div>
        </ha-card>`;
      return;
    }

    const remaining = parseFloat(state.state) || 0;
    const attrs = state.attributes || {};
    const spent = parseFloat(attrs.spent) || 0;
    const weeklyLimit = parseFloat(attrs.weekly_limit) || 0;
    const rollover = parseFloat(attrs.rollover) || 0;
    const effectiveBudget = parseFloat(attrs.effective_budget) || weeklyLimit;
    const currency = attrs.currency || "$";
    const expenseCount = attrs.expense_count || 0;

    const spentPercent =
      effectiveBudget > 0
        ? Math.min((spent / effectiveBudget) * 100, 100)
        : spent > 0
        ? 100
        : 0;

    const isOverBudget = remaining < 0;
    const ringColor = isOverBudget
      ? "#ef4444"
      : spentPercent > 75
      ? "#f59e0b"
      : "#22c55e";
    const remainingColor = isOverBudget ? "#ef4444" : "#22c55e";

    // SVG ring calculations
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (spentPercent / 100) * circumference;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 20px;
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .title {
          font-size: 18px;
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .subtitle {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 2px;
        }
        .badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          background: ${isOverBudget ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)"};
          color: ${isOverBudget ? "#ef4444" : "#22c55e"};
        }
        .ring-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 8px 0 20px;
          position: relative;
        }
        .ring-svg {
          transform: rotate(-90deg);
          width: 140px;
          height: 140px;
        }
        .ring-bg {
          fill: none;
          stroke: var(--divider-color, #e5e7eb);
          stroke-width: 10;
        }
        .ring-fill {
          fill: none;
          stroke: ${ringColor};
          stroke-width: 10;
          stroke-linecap: round;
          stroke-dasharray: ${circumference};
          stroke-dashoffset: ${offset};
          transition: stroke-dashoffset 0.6s ease;
        }
        .ring-text {
          position: absolute;
          text-align: center;
        }
        .ring-text .amount {
          font-size: 22px;
          font-weight: 700;
          color: ${remainingColor};
          line-height: 1.1;
        }
        .ring-text .label {
          font-size: 11px;
          color: var(--secondary-text-color);
          margin-top: 2px;
        }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-box {
          text-align: center;
          padding: 10px 6px;
          border-radius: 10px;
          background: var(--card-background-color, rgba(0,0,0,0.03));
          border: 1px solid var(--divider-color, #e5e7eb);
        }
        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .form-section {
          border-top: 1px solid var(--divider-color, #e5e7eb);
          padding-top: 16px;
          margin-top: 4px;
        }
        .form-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--primary-text-color);
          margin-bottom: 10px;
        }
        .form-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .form-row input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #e5e7eb);
          border-radius: 8px;
          font-size: 13px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
          transition: border-color 0.2s;
        }
        .form-row input:focus {
          border-color: var(--primary-color, #03a9f4);
        }
        .form-row input::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.6;
        }
        .btn-row {
          display: flex;
          gap: 8px;
        }
        .btn {
          flex: 1;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
        }
        .btn:active {
          transform: scale(0.97);
        }
        .btn-add {
          background: var(--primary-color, #03a9f4);
          color: #fff;
        }
        .btn-add:hover { opacity: 0.9; }
        .btn-reset {
          background: transparent;
          border: 1px solid var(--divider-color, #e5e7eb);
          color: var(--secondary-text-color);
          flex: 0.5;
        }
        .btn-reset:hover {
          background: rgba(239,68,68,0.08);
          color: #ef4444;
          border-color: #ef4444;
        }
        .rollover-note {
          font-size: 11px;
          color: var(--secondary-text-color);
          text-align: center;
          margin-top: 8px;
          font-style: italic;
        }
      </style>

      <ha-card>
        <div class="header">
          <div>
            <div class="title">Weekly Budget</div>
            <div class="subtitle">Week of ${this._formatWeekStart(attrs.week_start)}</div>
          </div>
          <div class="badge">${isOverBudget ? "Over Budget" : "On Track"}</div>
        </div>

        <div class="ring-container">
          <svg class="ring-svg" viewBox="0 0 128 128">
            <circle class="ring-bg" cx="64" cy="64" r="${radius}" />
            <circle class="ring-fill" cx="64" cy="64" r="${radius}" />
          </svg>
          <div class="ring-text">
            <div class="amount">${currency}${Math.abs(remaining).toFixed(2)}</div>
            <div class="label">${isOverBudget ? "over budget" : "remaining"}</div>
          </div>
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="stat-value">${currency}${spent.toFixed(2)}</div>
            <div class="stat-label">Spent</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${currency}${effectiveBudget.toFixed(2)}</div>
            <div class="stat-label">Budget</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: ${rollover >= 0 ? "#22c55e" : "#ef4444"}">${rollover >= 0 ? "+" : ""}${currency}${rollover.toFixed(2)}</div>
            <div class="stat-label">Rollover</div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-title">Add Expense</div>
          <div class="form-row">
            <input type="number" id="expense-amount" placeholder="Amount" step="0.01" min="0.01" />
            <input type="text" id="expense-desc" placeholder="Description" />
          </div>
          <div class="form-row">
            <input type="text" id="expense-user" placeholder="Your name (optional)" />
          </div>
          <div class="btn-row">
            <button class="btn btn-add" id="btn-add">Add Expense</button>
            <button class="btn btn-reset" id="btn-reset">Reset</button>
          </div>
          ${rollover !== 0 ? `<div class="rollover-note">${rollover > 0 ? `${currency}${rollover.toFixed(2)} saved from last week` : `${currency}${Math.abs(rollover).toFixed(2)} overspent last week`}</div>` : ""}
        </div>
      </ha-card>
    `;

    // Wire up buttons
    this.shadowRoot.getElementById("btn-add").addEventListener("click", () => {
      this._addExpense();
    });
    this.shadowRoot.getElementById("btn-reset").addEventListener("click", () => {
      this._resetBudget();
    });

    // Allow Enter key on inputs
    ["expense-amount", "expense-desc", "expense-user"].forEach((id) => {
      this.shadowRoot.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._addExpense();
      });
    });
  }

  _addExpense() {
    const amountEl = this.shadowRoot.getElementById("expense-amount");
    const descEl = this.shadowRoot.getElementById("expense-desc");
    const userEl = this.shadowRoot.getElementById("expense-user");

    const amount = parseFloat(amountEl.value);
    const description = descEl.value.trim();
    const user = userEl.value.trim() || "Unknown";

    if (!amount || amount <= 0) {
      amountEl.style.borderColor = "#ef4444";
      setTimeout(() => (amountEl.style.borderColor = ""), 1500);
      return;
    }
    if (!description) {
      descEl.style.borderColor = "#ef4444";
      setTimeout(() => (descEl.style.borderColor = ""), 1500);
      return;
    }

    this._hass.callService("weekly_budget", "add_expense", {
      amount: amount,
      description: description,
      user: user,
    });

    amountEl.value = "";
    descEl.value = "";
    userEl.value = "";
  }

  _resetBudget() {
    if (confirm("Reset the budget? This clears all expenses and rollover.")) {
      this._hass.callService("weekly_budget", "reset_budget", {});
    }
  }

  _formatWeekStart(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  getCardSize() {
    return 5;
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "entity",
          required: true,
          selector: {
            entity: {
              domain: "sensor",
              integration: "weekly_budget",
            },
          },
        },
      ],
      computeLabel: (schema) => {
        if (schema.name === "entity") return "Budget Entity";
        return undefined;
      },
      computeHelper: (schema) => {
        if (schema.name === "entity")
          return "Select the weekly_budget_remaining sensor";
        return undefined;
      },
    };
  }

  static getStubConfig(hass) {
    // Try to find the remaining sensor automatically
    const entities = Object.keys(hass.states).filter((eid) =>
      eid.startsWith("sensor.weekly_budget_remaining")
    );
    return { entity: entities[0] || "sensor.weekly_budget_remaining" };
  }
}

customElements.define("weekly-budget-card", WeeklyBudgetCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weekly-budget-card",
  name: "Weekly Budget Overview",
  description: "Displays your weekly budget status with a progress ring, stats, and quick-add expense form.",
  preview: true,
});
