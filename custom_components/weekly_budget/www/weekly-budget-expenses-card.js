/**
 * Weekly Budget Expenses Card
 *
 * Displays the list of expenses for the current week with user, description,
 * amount, and timestamp.
 */
(function () {
  "use strict";

  class WeeklyBudgetExpensesCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      this._config = config || {};
      this._buildShell();
    }

    set hass(hass) {
      this._hass = hass;
      this._updateContent();
    }

    getCardSize() {
      return 4;
    }

    static getStubConfig() {
      return { entity: "" };
    }

    _buildShell() {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          ha-card { overflow: hidden; }
          .card-content { padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
          .title { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
          .count { font-size: 12px; color: var(--secondary-text-color); background: var(--card-background-color, rgba(0,0,0,0.05)); border: 1px solid var(--divider-color, #e5e7eb); padding: 3px 10px; border-radius: 20px; }
          .user-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--divider-color, #e5e7eb); }
          .user-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: var(--card-background-color, rgba(0,0,0,0.03)); border: 1px solid var(--divider-color, #e5e7eb); font-size: 12px; }
          .chip-name { font-weight: 600; color: var(--primary-text-color); }
          .chip-amt { color: var(--secondary-text-color); }
          .expense-list { display: flex; flex-direction: column; }
          .expense-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--divider-color, #e5e7eb); }
          .expense-item:last-child { border-bottom: none; }
          .exp-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
          .exp-desc { font-size: 14px; font-weight: 500; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .exp-meta { font-size: 11px; color: var(--secondary-text-color); display: flex; gap: 8px; align-items: center; }
          .exp-user { font-weight: 600; }
          .exp-amount { font-size: 15px; font-weight: 700; color: var(--primary-text-color); white-space: nowrap; margin-left: 12px; padding-top: 1px; }
          .empty { text-align: center; padding: 32px 16px; color: var(--secondary-text-color); font-size: 14px; }
          .total-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 0; margin-top: 4px; border-top: 2px solid var(--divider-color, #e5e7eb); }
          .total-lbl { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; }
          .total-val { font-size: 18px; font-weight: 700; color: var(--primary-text-color); }
          .info-msg { text-align: center; padding: 24px 16px; color: var(--secondary-text-color); font-size: 14px; }
        </style>
        <ha-card>
          <div class="card-content" id="root">
            <div class="info-msg">Waiting for data...</div>
          </div>
        </ha-card>
      `;
    }

    _updateContent() {
      var root = this.shadowRoot.getElementById("root");
      if (!root) return;
      if (!this._hass) { root.innerHTML = '<div class="info-msg">Loading...</div>'; return; }

      var entityId = this._config.entity;
      if (!entityId) { root.innerHTML = '<div class="info-msg">No entity configured. Edit this card to select an entity.</div>'; return; }

      var stateObj = this._hass.states[entityId];
      if (!stateObj) { root.innerHTML = '<div class="info-msg">Entity not found: ' + entityId + '</div>'; return; }

      var maxItems = this._config.max_items || 50;
      var showTotal = this._config.show_total !== false;
      var title = this._config.title || "Expenses This Week";
      var a = stateObj.attributes || {};
      var expenses = (a.expenses || []).slice().reverse();
      var currency = a.currency || "$";
      var displayList = expenses.slice(0, maxItems);
      var totalSpent = 0;
      var byUser = {};
      for (var i = 0; i < expenses.length; i++) {
        var amt = expenses[i].amount || 0;
        totalSpent += amt;
        var u = expenses[i].user || "Unknown";
        byUser[u] = (byUser[u] || 0) + amt;
      }

      var h = '';
      h += '<div class="header"><div class="title">' + this._esc(title) + '</div>';
      h += '<div class="count">' + expenses.length + ' expense' + (expenses.length !== 1 ? 's' : '') + '</div></div>';

      // User chips
      var users = Object.keys(byUser).sort(function(a,b){ return byUser[b]-byUser[a]; });
      if (users.length > 0) {
        h += '<div class="user-summary">';
        for (var j = 0; j < users.length; j++) {
          h += '<div class="user-chip"><span class="chip-name">' + this._esc(users[j]) + '</span>';
          h += '<span class="chip-amt">' + currency + byUser[users[j]].toFixed(2) + '</span></div>';
        }
        h += '</div>';
      }

      h += '<div class="expense-list">';
      if (displayList.length === 0) {
        h += '<div class="empty">No expenses recorded this week.</div>';
      } else {
        for (var k = 0; k < displayList.length; k++) {
          var e = displayList[k];
          h += '<div class="expense-item"><div class="exp-left">';
          h += '<div class="exp-desc">' + this._esc(e.description || "No description") + '</div>';
          h += '<div class="exp-meta"><span class="exp-user">' + this._esc(e.user || "Unknown") + '</span>';
          h += '<span>' + this._fmtTime(e.timestamp) + '</span></div></div>';
          h += '<div class="exp-amount">' + currency + (e.amount || 0).toFixed(2) + '</div></div>';
        }
      }
      h += '</div>';

      if (expenses.length > maxItems) {
        h += '<div style="font-size:11px;color:var(--secondary-text-color);text-align:center;padding-top:8px;font-style:italic">Showing ' + maxItems + ' of ' + expenses.length + ' expenses</div>';
      }

      if (showTotal && expenses.length > 0) {
        h += '<div class="total-bar"><span class="total-lbl">Total</span>';
        h += '<span class="total-val">' + currency + totalSpent.toFixed(2) + '</span></div>';
      }

      root.innerHTML = h;
    }

    _esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

    _fmtTime(ts) {
      if (!ts) return "";
      try { var d = new Date(ts); return d.toLocaleDateString(undefined, {weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e) { return ts; }
    }
  }

  customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "weekly-budget-expenses-card",
    name: "Weekly Budget Expenses",
    description: "Displays the list of expenses for the current week with user, description, and amount.",
    preview: false,
  });
})();
