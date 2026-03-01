/**
 * Weekly Budget Expenses Card
 *
 * A Lovelace card that displays the list of expenses for the current week,
 * including the description, user, amount, and timestamp.
 */

class WeeklyBudgetExpensesCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = config;
    this._buildLayout();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._buildLayout();
    }
    this._update();
  }

  /* ── Build the static shell once ───────────────────────────────── */

  _buildLayout() {
    this._rendered = true;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 20px; overflow: hidden; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .title { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
        .count { font-size: 12px; color: var(--secondary-text-color); background: var(--card-background-color, rgba(0,0,0,0.05)); border: 1px solid var(--divider-color, #e5e7eb); padding: 3px 10px; border-radius: 20px; }
        .user-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--divider-color, #e5e7eb); }
        .user-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: var(--card-background-color, rgba(0,0,0,0.03)); border: 1px solid var(--divider-color, #e5e7eb); font-size: 12px; }
        .user-chip-name { font-weight: 600; color: var(--primary-text-color); }
        .user-chip-amount { color: var(--secondary-text-color); }
        .expense-list { display: flex; flex-direction: column; }
        .expense-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--divider-color, #e5e7eb); }
        .expense-item:last-child { border-bottom: none; }
        .expense-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .expense-desc { font-size: 14px; font-weight: 500; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .expense-meta { font-size: 11px; color: var(--secondary-text-color); display: flex; gap: 8px; align-items: center; }
        .expense-user { font-weight: 600; }
        .expense-amount { font-size: 15px; font-weight: 700; color: var(--primary-text-color); white-space: nowrap; margin-left: 12px; padding-top: 1px; }
        .empty-state { text-align: center; padding: 32px 16px; color: var(--secondary-text-color); }
        .empty-icon { font-size: 36px; margin-bottom: 8px; opacity: 0.3; }
        .empty-text { font-size: 14px; }
        .total-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 0; margin-top: 4px; border-top: 2px solid var(--divider-color, #e5e7eb); }
        .total-label { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; }
        .total-amount { font-size: 18px; font-weight: 700; color: var(--primary-text-color); }
        .more-note { font-size: 11px; color: var(--secondary-text-color); text-align: center; padding-top: 8px; font-style: italic; }
        .msg-row { text-align: center; padding: 16px; color: var(--secondary-text-color); font-size: 14px; }
      </style>

      <ha-card>
        <div id="content">
          <div class="msg-row">Loading expenses...</div>
        </div>
      </ha-card>
    `;
  }

  /* ── Lightweight DOM update on every hass change ────────────────── */

  _update() {
    if (!this._hass || !this._config) return;

    const content = this.shadowRoot.getElementById("content");
    if (!content) return;

    const entityId = this._config.entity;
    if (!entityId) {
      content.innerHTML = '<div class="msg-row">No entity configured.</div>';
      return;
    }

    const state = this._hass.states[entityId];
    if (!state) {
      content.innerHTML = '<div class="msg-row">Entity not found: ' + entityId + '</div>';
      return;
    }

    const maxItems = this._config.max_items || 50;
    const showTotal = this._config.show_total !== false;
    const title = this._config.title || "Expenses This Week";

    const attrs = state.attributes || {};
    const expenses = (attrs.expenses || []).slice().reverse();
    const currency = attrs.currency || "$";
    const displayExpenses = expenses.slice(0, maxItems);
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Group by user
    const byUser = {};
    expenses.forEach((e) => {
      const u = e.user || "Unknown";
      byUser[u] = (byUser[u] || 0) + (e.amount || 0);
    });
    const userSummary = Object.entries(byUser).sort((a, b) => b[1] - a[1]);

    let html = '';

    // Header
    html += '<div class="header">';
    html += '<div class="title">' + this._esc(title) + '</div>';
    html += '<div class="count">' + expenses.length + ' expense' + (expenses.length !== 1 ? 's' : '') + '</div>';
    html += '</div>';

    // User summary chips
    if (userSummary.length > 0) {
      html += '<div class="user-summary">';
      userSummary.forEach(([user, total]) => {
        html += '<div class="user-chip">';
        html += '<span class="user-chip-name">' + this._esc(user) + '</span>';
        html += '<span class="user-chip-amount">' + currency + total.toFixed(2) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Expense list
    html += '<div class="expense-list">';
    if (displayExpenses.length === 0) {
      html += '<div class="empty-state">';
      html += '<div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>';
      html += '<div class="empty-text">No expenses recorded this week.</div>';
      html += '</div>';
    } else {
      displayExpenses.forEach((e) => {
        html += '<div class="expense-item">';
        html += '<div class="expense-left">';
        html += '<div class="expense-desc">' + this._esc(e.description || "No description") + '</div>';
        html += '<div class="expense-meta">';
        html += '<span class="expense-user">' + this._esc(e.user || "Unknown") + '</span>';
        html += '<span>' + this._fmtTime(e.timestamp) + '</span>';
        html += '</div></div>';
        html += '<div class="expense-amount">' + currency + (e.amount || 0).toFixed(2) + '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    // More note
    if (expenses.length > maxItems) {
      html += '<div class="more-note">Showing ' + maxItems + ' of ' + expenses.length + ' expenses</div>';
    }

    // Total bar
    if (showTotal && expenses.length > 0) {
      html += '<div class="total-bar">';
      html += '<span class="total-label">Total</span>';
      html += '<span class="total-amount">' + currency + totalSpent.toFixed(2) + '</span>';
      html += '</div>';
    }

    content.innerHTML = html;
  }

  _esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  _fmtTime(ts) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return ts; }
  }

  getCardSize() { return 4; }

  static getConfigElement() {
    return document.createElement("weekly-budget-expenses-card-editor");
  }

  static getStubConfig(hass) {
    const entities = Object.keys(hass.states).filter(
      (eid) => eid.includes("weekly_budget") || eid.includes("budget_remaining")
    );
    const remaining = entities.find((e) => e.includes("remaining"));
    return {
      entity: remaining || entities[0] || "",
      title: "Expenses This Week",
      max_items: 50,
      show_total: true,
    };
  }
}

customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);


/* ── Config Editor ───────────────────────────────────────────────── */

class WeeklyBudgetExpensesCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    const picker = this.shadowRoot && this.shadowRoot.querySelector("ha-entity-picker");
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
        .row { padding: 8px 0; }
        .row label { display: block; font-weight: 500; margin-bottom: 4px; font-size: 14px; color: var(--primary-text-color); }
        .row .hint { display: block; font-size: 12px; color: var(--secondary-text-color); margin-top: 4px; }
        .row input { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid var(--divider-color, #e5e7eb); border-radius: 4px; font-size: 14px; color: var(--primary-text-color); background: var(--card-background-color, #fff); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      </style>
      <div class="row">
        <label>Entity</label>
        <ha-entity-picker allow-custom-entity></ha-entity-picker>
        <span class="hint">Select any weekly_budget sensor</span>
      </div>
      <div class="row">
        <label>Card Title</label>
        <input type="text" id="title" placeholder="Expenses This Week" value="${this._config.title || ""}" />
      </div>
      <div class="grid">
        <div class="row">
          <label>Max Items</label>
          <input type="number" id="max_items" min="1" max="200" placeholder="50" value="${this._config.max_items || ""}" />
        </div>
        <div class="row">
          <label>Show Total</label>
          <ha-switch id="show_total" ${this._config.show_total !== false ? "checked" : ""}></ha-switch>
        </div>
      </div>
    `;

    const picker = this.shadowRoot.querySelector("ha-entity-picker");
    if (picker) {
      picker.hass = this._hass;
      picker.value = this._config.entity || "";
      picker.includeDomains = ["sensor"];
      picker.addEventListener("value-changed", (ev) => {
        this._config = { ...this._config, entity: ev.detail.value };
        this._fire();
      });
    }

    const titleEl = this.shadowRoot.getElementById("title");
    if (titleEl) {
      titleEl.addEventListener("input", (ev) => {
        this._config = { ...this._config, title: ev.target.value || undefined };
        this._fire();
      });
    }

    const maxEl = this.shadowRoot.getElementById("max_items");
    if (maxEl) {
      maxEl.addEventListener("input", (ev) => {
        const val = parseInt(ev.target.value);
        this._config = { ...this._config, max_items: val > 0 ? val : undefined };
        this._fire();
      });
    }

    const toggleEl = this.shadowRoot.getElementById("show_total");
    if (toggleEl) {
      toggleEl.addEventListener("change", (ev) => {
        this._config = { ...this._config, show_total: ev.target.checked };
        this._fire();
      });
    }
  }

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }
}

customElements.define("weekly-budget-expenses-card-editor", WeeklyBudgetExpensesCardEditor);


window.customCards = window.customCards || [];
window.customCards.push({
  type: "weekly-budget-expenses-card",
  name: "Weekly Budget Expenses",
  description: "Displays the list of expenses for the current week with user, description, and amount.",
  preview: false,
  documentationURL: "https://github.com/weekly-budget-tracker",
});
