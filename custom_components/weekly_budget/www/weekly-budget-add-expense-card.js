/**
 * Weekly Budget Add Expense Card
 *
 * A standalone Lovelace card solely for entering new expenses.
 * The Home Assistant username of the logged-in user is automatically
 * attached to each expense via the service call context.
 */

class WeeklyBudgetAddExpenseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Light update: keep the form as-is but refresh the remaining budget display
    this._updateBudgetInfo();
  }

  /* ── Rendering ─────────────────────────────────────────────────── */

  _render() {
    const title = this._config.title || "Add Expense";

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
        .budget-info {
          font-size: 13px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .budget-info.ok {
          background: rgba(34,197,94,0.15);
          color: #22c55e;
        }
        .budget-info.over {
          background: rgba(239,68,68,0.15);
          color: #ef4444;
        }
        .form-group {
          margin-bottom: 12px;
        }
        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }
        .form-group input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--divider-color, #e5e7eb);
          border-radius: 8px;
          font-size: 14px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: var(--primary-color, #03a9f4);
        }
        .form-group input::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.6;
        }
        .form-group input.error {
          border-color: #ef4444;
        }
        .btn-submit {
          width: 100%;
          padding: 11px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          background: var(--primary-color, #03a9f4);
          color: #fff;
          transition: opacity 0.2s, transform 0.1s;
        }
        .btn-submit:hover {
          opacity: 0.9;
        }
        .btn-submit:active {
          transform: scale(0.97);
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .success-msg {
          text-align: center;
          padding: 8px 0 0;
          font-size: 13px;
          font-weight: 500;
          color: #22c55e;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .success-msg.show {
          opacity: 1;
        }
      </style>

      <ha-card>
        <div class="header">
          <div class="title">${this._escapeHtml(title)}</div>
          <div class="budget-info ok" id="budget-info">--</div>
        </div>

        <div class="form-group">
          <label for="amount">Amount</label>
          <input type="number" id="amount" placeholder="0.00" step="0.01" min="0.01" inputmode="decimal" />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <input type="text" id="description" placeholder="What was this expense for?" />
        </div>

        <button class="btn-submit" id="btn-submit">Add Expense</button>
        <div class="success-msg" id="success-msg">Expense added!</div>
      </ha-card>
    `;

    // Wire up submit
    this.shadowRoot.getElementById("btn-submit").addEventListener("click", () => {
      this._submit();
    });

    // Enter key submits
    ["amount", "description"].forEach((id) => {
      this.shadowRoot.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._submit();
      });
    });

    this._updateBudgetInfo();
  }

  /* ── Budget info badge ─────────────────────────────────────────── */

  _updateBudgetInfo() {
    if (!this._hass || !this._config) return;
    const badge = this.shadowRoot && this.shadowRoot.getElementById("budget-info");
    if (!badge) return;

    const state = this._hass.states[this._config.entity];
    if (!state) {
      badge.textContent = "N/A";
      return;
    }

    const remaining = parseFloat(state.state) || 0;
    const currency = (state.attributes || {}).currency || "$";
    const isOver = remaining < 0;

    badge.textContent = `${currency}${Math.abs(remaining).toFixed(2)} ${isOver ? "over" : "left"}`;
    badge.className = `budget-info ${isOver ? "over" : "ok"}`;
  }

  /* ── Submit expense ────────────────────────────────────────────── */

  _submit() {
    const amountEl = this.shadowRoot.getElementById("amount");
    const descEl = this.shadowRoot.getElementById("description");
    const btn = this.shadowRoot.getElementById("btn-submit");

    // Clear previous error states
    amountEl.classList.remove("error");
    descEl.classList.remove("error");

    const amount = parseFloat(amountEl.value);
    const description = descEl.value.trim();

    let valid = true;
    if (!amount || amount <= 0) {
      amountEl.classList.add("error");
      valid = false;
    }
    if (!description) {
      descEl.classList.add("error");
      valid = false;
    }
    if (!valid) {
      setTimeout(() => {
        amountEl.classList.remove("error");
        descEl.classList.remove("error");
      }, 1500);
      return;
    }

    // Disable button briefly to prevent double-submit
    btn.disabled = true;

    this._hass.callService("weekly_budget", "add_expense", {
      amount: amount,
      description: description,
    });

    // Clear form and show success
    amountEl.value = "";
    descEl.value = "";

    const msg = this.shadowRoot.getElementById("success-msg");
    msg.classList.add("show");
    setTimeout(() => {
      msg.classList.remove("show");
      btn.disabled = false;
    }, 1500);
  }

  /* ── Utilities ─────────────────────────────────────────────────── */

  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement("weekly-budget-add-expense-card-editor");
  }

  static getStubConfig(hass) {
    const entities = Object.keys(hass.states).filter(
      (eid) => eid.includes("weekly_budget") || eid.includes("budget_remaining")
    );
    const remaining = entities.find((e) => e.includes("remaining"));
    return { entity: remaining || entities[0] || "" };
  }
}

customElements.define(
  "weekly-budget-add-expense-card",
  WeeklyBudgetAddExpenseCard
);


/**
 * Visual config editor for the Add Expense card.
 */
class WeeklyBudgetAddExpenseCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    const picker =
      this.shadowRoot && this.shadowRoot.querySelector("ha-entity-picker");
    if (picker) picker.hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        .editor-row {
          padding: 8px 0;
        }
        .editor-row label {
          display: block;
          font-weight: 500;
          margin-bottom: 4px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .editor-row .hint {
          display: block;
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .editor-row input[type="text"] {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border: 1px solid var(--divider-color, #e5e7eb);
          border-radius: 4px;
          font-size: 14px;
          color: var(--primary-text-color);
          background: var(--card-background-color, #fff);
        }
      </style>
      <div class="editor-row">
        <label>Entity</label>
        <ha-entity-picker allow-custom-entity></ha-entity-picker>
        <span class="hint">Select sensor.weekly_budget_remaining</span>
      </div>
      <div class="editor-row">
        <label>Card Title</label>
        <input type="text" id="title" placeholder="Add Expense" value="${this._config.title || ""}" />
      </div>
    `;

    const picker = this.shadowRoot.querySelector("ha-entity-picker");
    if (picker) {
      picker.hass = this._hass;
      picker.value = this._config.entity || "";
      picker.includeDomains = ["sensor"];
      picker.addEventListener("value-changed", (ev) => {
        this._config = { ...this._config, entity: ev.detail.value };
        this._fireChanged();
      });
    }

    const titleEl = this.shadowRoot.getElementById("title");
    if (titleEl) {
      titleEl.addEventListener("input", (ev) => {
        this._config = {
          ...this._config,
          title: ev.target.value || undefined,
        };
        this._fireChanged();
      });
    }
  }

  _fireChanged() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define(
  "weekly-budget-add-expense-card-editor",
  WeeklyBudgetAddExpenseCardEditor
);


window.customCards = window.customCards || [];
window.customCards.push({
  type: "weekly-budget-add-expense-card",
  name: "Weekly Budget Add Expense",
  description:
    "A standalone form for adding expenses to the weekly budget. Automatically uses the logged-in HA username.",
  preview: false,
  documentationURL: "https://github.com/weekly-budget-tracker",
});
