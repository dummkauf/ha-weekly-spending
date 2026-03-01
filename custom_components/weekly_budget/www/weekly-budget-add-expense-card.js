/**
 * Weekly Budget Add Expense Card
 *
 * A standalone form for entering new expenses. The HA username is
 * automatically attached via the service call context.
 */
(function () {
  "use strict";

  class WeeklyBudgetAddExpenseCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      this._config = config || {};
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._updateBadge();
    }

    getCardSize() {
      return 3;
    }

    static getStubConfig() {
      return { entity: "" };
    }

    _render() {
      var title = this._config.title || "Add Expense";
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          ha-card { overflow: hidden; }
          .card-content { padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
          .badge { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
          .badge-ok { background: rgba(34,197,94,0.15); color: #22c55e; }
          .badge-over { background: rgba(239,68,68,0.15); color: #ef4444; }
          .group { margin-bottom: 12px; }
          .group label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--secondary-text-color); margin-bottom: 6px; }
          .group input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px; font-size: 14px; background: var(--card-background-color, #fff); color: var(--primary-text-color); outline: none; transition: border-color 0.2s; }
          .group input:focus { border-color: var(--primary-color, #03a9f4); }
          .group input::placeholder { color: var(--secondary-text-color); opacity: 0.6; }
          .btn { width: 100%; padding: 11px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; background: var(--primary-color, #03a9f4); color: #fff; transition: opacity 0.2s; }
          .btn:hover { opacity: 0.9; }
          .btn:active { transform: scale(0.97); }
          .btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .success { text-align: center; padding: 8px 0 0; font-size: 13px; font-weight: 500; color: #22c55e; opacity: 0; transition: opacity 0.3s; }
          .success.show { opacity: 1; }
        </style>
        <ha-card>
          <div class="card-content">
            <div class="header">
              <div class="title">${title}</div>
              <div class="badge badge-ok" id="wb-badge">--</div>
            </div>
            <div class="group">
              <label>Amount</label>
              <input type="number" id="wb-amt" placeholder="0.00" step="0.01" min="0.01" inputmode="decimal"/>
            </div>
            <div class="group">
              <label>Description</label>
              <input type="text" id="wb-desc" placeholder="What was this expense for?"/>
            </div>
            <button class="btn" id="wb-btn">Add Expense</button>
            <div class="success" id="wb-msg">Expense added!</div>
          </div>
        </ha-card>
      `;

      var self = this;
      this.shadowRoot.getElementById("wb-btn").onclick = function () { self._submit(); };
      this.shadowRoot.getElementById("wb-amt").onkeydown = function (e) { if (e.key === "Enter") self._submit(); };
      this.shadowRoot.getElementById("wb-desc").onkeydown = function (e) { if (e.key === "Enter") self._submit(); };

      this._updateBadge();
    }

    _updateBadge() {
      if (!this._hass || !this._config) return;
      var badge = this.shadowRoot.getElementById("wb-badge");
      if (!badge) return;
      var s = this._hass.states[this._config.entity];
      if (!s) { badge.textContent = "N/A"; return; }
      var rem = parseFloat(s.state) || 0;
      var cur = (s.attributes || {}).currency || "$";
      var over = rem < 0;
      badge.textContent = cur + Math.abs(rem).toFixed(2) + (over ? " over" : " left");
      badge.className = "badge " + (over ? "badge-over" : "badge-ok");
    }

    _submit() {
      var amtEl = this.shadowRoot.getElementById("wb-amt");
      var descEl = this.shadowRoot.getElementById("wb-desc");
      var btn = this.shadowRoot.getElementById("wb-btn");
      var amount = parseFloat(amtEl.value);
      var desc = descEl.value.trim();
      var ok = true;
      if (!amount || amount <= 0) { amtEl.style.borderColor = "#ef4444"; ok = false; }
      if (!desc) { descEl.style.borderColor = "#ef4444"; ok = false; }
      if (!ok) { setTimeout(function(){ amtEl.style.borderColor = ""; descEl.style.borderColor = ""; }, 1500); return; }
      btn.disabled = true;
      this._hass.callService("weekly_budget", "add_expense", { amount: amount, description: desc });
      amtEl.value = "";
      descEl.value = "";
      var msg = this.shadowRoot.getElementById("wb-msg");
      msg.classList.add("show");
      setTimeout(function () { msg.classList.remove("show"); btn.disabled = false; }, 1500);
    }
  }

  customElements.define("weekly-budget-add-expense-card", WeeklyBudgetAddExpenseCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "weekly-budget-add-expense-card",
    name: "Weekly Budget Add Expense",
    description: "A standalone form for adding expenses. Automatically uses the logged-in HA username.",
    preview: false,
  });
})();
