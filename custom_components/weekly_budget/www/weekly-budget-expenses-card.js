/**
 * Weekly Budget Expenses Card
 *
 * A Lovelace card that displays the list of expenses for the current week,
 * including the description, user, amount, and timestamp.
 */

/**
 * Config editor for the Weekly Budget Expenses Card
 * Provides a visual UI in the Lovelace card picker instead of raw YAML.
 */
class WeeklyBudgetExpensesCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._buildUI();
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .hint {
          font-size: 11px;
          color: var(--secondary-text-color);
        }
        select, input {
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #e5e7eb);
          border-radius: 8px;
          font-size: 14px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
        }
        select:focus, input:focus {
          border-color: var(--primary-color, #03a9f4);
        }
        .row {
          display: flex;
          gap: 12px;
        }
        .row .field {
          flex: 1;
        }
      </style>
      <div class="editor">
        <div class="field">
          <label for="entity">Entity</label>
          <select id="entity"></select>
          <span class="hint">Select the weekly_budget_remaining or weekly_budget_spent sensor</span>
        </div>
        <div class="field">
          <label for="title">Card Title</label>
          <input type="text" id="title" placeholder="Expenses This Week" value="${this._config.title || ""}" />
        </div>
        <div class="row">
          <div class="field">
            <label for="max_items">Max Items</label>
            <input type="number" id="max_items" min="1" max="200" placeholder="50" value="${this._config.max_items || ""}" />
            <span class="hint">Maximum expenses to show</span>
          </div>
          <div class="field">
            <label for="show_total">Show Total</label>
            <select id="show_total">
              <option value="true" ${this._config.show_total !== false ? "selected" : ""}>Yes</option>
              <option value="false" ${this._config.show_total === false ? "selected" : ""}>No</option>
            </select>
          </div>
        </div>
      </div>
    `;
    this._buildUI();
  }

  _buildUI() {
    if (!this._hass || !this.shadowRoot) return;
    const select = this.shadowRoot.getElementById("entity");
    if (!select) return;

    const entities = Object.keys(this._hass.states)
      .filter((eid) => eid.startsWith("sensor.weekly_budget"))
      .sort();

    select.innerHTML = `
      <option value="">-- Select entity --</option>
      ${entities
        .map(
          (eid) =>
            `<option value="${eid}" ${eid === this._config.entity ? "selected" : ""}>${eid}</option>`
        )
        .join("")}
    `;

    if (entities.length === 0) {
      const allSensors = Object.keys(this._hass.states)
        .filter((eid) => eid.startsWith("sensor."))
        .sort();
      select.innerHTML = `
        <option value="">-- Select entity --</option>
        ${allSensors
          .map(
            (eid) =>
              `<option value="${eid}" ${eid === this._config.entity ? "selected" : ""}>${eid}</option>`
          )
          .join("")}
      `;
    }

    // Wire up all change events
    select.addEventListener("change", (ev) => {
      this._config = { ...this._config, entity: ev.target.value };
      this._fireChanged();
    });

    const titleEl = this.shadowRoot.getElementById("title");
    if (titleEl) {
      titleEl.addEventListener("input", (ev) => {
        this._config = { ...this._config, title: ev.target.value || undefined };
        this._fireChanged();
      });
    }

    const maxEl = this.shadowRoot.getElementById("max_items");
    if (maxEl) {
      maxEl.addEventListener("input", (ev) => {
        const val = parseInt(ev.target.value);
        this._config = { ...this._config, max_items: val > 0 ? val : undefined };
        this._fireChanged();
      });
    }

    const showTotalEl = this.shadowRoot.getElementById("show_total");
    if (showTotalEl) {
      showTotalEl.addEventListener("change", (ev) => {
        this._config = { ...this._config, show_total: ev.target.value === "true" };
        this._fireChanged();
      });
    }
  }

  _fireChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

customElements.define("weekly-budget-expenses-card-editor", WeeklyBudgetExpensesCardEditor);


class WeeklyBudgetExpensesCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity (sensor.weekly_budget_remaining or sensor.weekly_budget_spent)");
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
    const maxItems = this._config.max_items || 50;
    const showTotal = this._config.show_total !== false;
    const title = this._config.title || "Expenses This Week";

    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card header="Expenses">
          <div style="padding: 16px; color: #999;">Entity not found: ${entityId}</div>
        </ha-card>`;
      return;
    }

    const attrs = state.attributes || {};
    const expenses = (attrs.expenses || []).slice().reverse();
    const currency = attrs.currency || "$";
    const displayExpenses = expenses.slice(0, maxItems);
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Group by user for the summary
    const byUser = {};
    expenses.forEach((e) => {
      const u = e.user || "Unknown";
      byUser[u] = (byUser[u] || 0) + (e.amount || 0);
    });

    const userSummary = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .map(([user, total]) => ({ user, total }));

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
          margin-bottom: 14px;
        }
        .title {
          font-size: 18px;
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .count {
          font-size: 12px;
          color: var(--secondary-text-color);
          background: var(--card-background-color, rgba(0,0,0,0.05));
          border: 1px solid var(--divider-color, #e5e7eb);
          padding: 3px 10px;
          border-radius: 20px;
        }
        .user-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--divider-color, #e5e7eb);
        }
        .user-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--card-background-color, rgba(0,0,0,0.03));
          border: 1px solid var(--divider-color, #e5e7eb);
          font-size: 12px;
        }
        .user-chip-name {
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .user-chip-amount {
          color: var(--secondary-text-color);
        }
        .expense-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .expense-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--divider-color, #e5e7eb);
        }
        .expense-item:last-child {
          border-bottom: none;
        }
        .expense-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .expense-desc {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .expense-meta {
          font-size: 11px;
          color: var(--secondary-text-color);
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .expense-user {
          font-weight: 600;
        }
        .expense-amount {
          font-size: 15px;
          font-weight: 700;
          color: var(--primary-text-color);
          white-space: nowrap;
          margin-left: 12px;
          padding-top: 1px;
        }
        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: var(--secondary-text-color);
        }
        .empty-icon {
          font-size: 36px;
          margin-bottom: 8px;
          opacity: 0.3;
        }
        .empty-text {
          font-size: 14px;
        }
        .total-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0 0;
          margin-top: 4px;
          border-top: 2px solid var(--divider-color, #e5e7eb);
        }
        .total-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .total-amount {
          font-size: 18px;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .more-note {
          font-size: 11px;
          color: var(--secondary-text-color);
          text-align: center;
          padding-top: 8px;
          font-style: italic;
        }
      </style>

      <ha-card>
        <div class="header">
          <div class="title">${title}</div>
          <div class="count">${expenses.length} expense${expenses.length !== 1 ? "s" : ""}</div>
        </div>

        ${
          userSummary.length > 0
            ? `<div class="user-summary">${userSummary
                .map(
                  (u) =>
                    `<div class="user-chip">
                      <span class="user-chip-name">${this._escapeHtml(u.user)}</span>
                      <span class="user-chip-amount">${currency}${u.total.toFixed(2)}</span>
                    </div>`
                )
                .join("")}</div>`
            : ""
        }

        <div class="expense-list">
          ${
            displayExpenses.length === 0
              ? `<div class="empty-state">
                  <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                    </svg>
                  </div>
                  <div class="empty-text">No expenses recorded this week.</div>
                </div>`
              : displayExpenses
                  .map(
                    (e) => `
                  <div class="expense-item">
                    <div class="expense-left">
                      <div class="expense-desc">${this._escapeHtml(e.description || "No description")}</div>
                      <div class="expense-meta">
                        <span class="expense-user">${this._escapeHtml(e.user || "Unknown")}</span>
                        <span>${this._formatTimestamp(e.timestamp)}</span>
                      </div>
                    </div>
                    <div class="expense-amount">${currency}${(e.amount || 0).toFixed(2)}</div>
                  </div>`
                  )
                  .join("")
          }
        </div>

        ${expenses.length > maxItems ? `<div class="more-note">Showing ${maxItems} of ${expenses.length} expenses</div>` : ""}

        ${
          showTotal && expenses.length > 0
            ? `<div class="total-bar">
                <span class="total-label">Total</span>
                <span class="total-amount">${currency}${totalSpent.toFixed(2)}</span>
              </div>`
            : ""
        }
      </ha-card>
    `;
  }

  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  _formatTimestamp(ts) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  getCardSize() {
    return 4;
  }

  static getConfigElement() {
    return document.createElement("weekly-budget-expenses-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.weekly_budget_remaining" };
  }
}

customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weekly-budget-expenses-card",
  name: "Weekly Budget Expenses",
  description: "Displays the list of expenses for the current week with user, description, and amount.",
  preview: true,
});
