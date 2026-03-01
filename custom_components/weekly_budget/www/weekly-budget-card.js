/**
 * Weekly Budget Overview Card
 *
 * Displays the current weekly budget status: spent vs remaining with a
 * progress ring, stats, and a quick-add expense form.
 */
(function () {
  "use strict";

  class WeeklyBudgetCard extends HTMLElement {
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
      return 5;
    }

    static getStubConfig() {
      return { entity: "" };
    }

    /* ── Build the outer card shell once ──────────────────────────── */

    _buildShell() {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          ha-card { overflow: hidden; }
          .card-content { padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
          .subtitle { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
          .badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
          .ring-wrap { display: flex; justify-content: center; align-items: center; margin: 8px 0 20px; position: relative; }
          .ring-svg { transform: rotate(-90deg); width: 140px; height: 140px; }
          .ring-bg { fill: none; stroke: var(--divider-color, #e5e7eb); stroke-width: 10; }
          .ring-fill { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease, stroke 0.3s; }
          .ring-center { position: absolute; text-align: center; }
          .ring-amount { font-size: 22px; font-weight: 700; line-height: 1.1; }
          .ring-label { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
          .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .stat { text-align: center; padding: 10px 6px; border-radius: 10px; background: var(--card-background-color, rgba(0,0,0,0.03)); border: 1px solid var(--divider-color, #e5e7eb); }
          .stat-val { font-size: 16px; font-weight: 700; color: var(--primary-text-color); }
          .stat-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--secondary-text-color); margin-top: 4px; }
          .form-section { border-top: 1px solid var(--divider-color, #e5e7eb); padding-top: 16px; margin-top: 4px; }
          .form-title { font-size: 13px; font-weight: 600; color: var(--primary-text-color); margin-bottom: 10px; }
          .form-row { display: flex; gap: 8px; margin-bottom: 8px; }
          .form-row input { flex: 1; padding: 8px 12px; border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px; font-size: 13px; background: var(--card-background-color, #fff); color: var(--primary-text-color); outline: none; transition: border-color 0.2s; box-sizing: border-box; }
          .form-row input:focus { border-color: var(--primary-color, #03a9f4); }
          .form-row input::placeholder { color: var(--secondary-text-color); opacity: 0.6; }
          .btn-row { display: flex; gap: 8px; }
          .btn { flex: 1; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
          .btn:active { transform: scale(0.97); }
          .btn-add { background: var(--primary-color, #03a9f4); color: #fff; }
          .btn-add:hover { opacity: 0.9; }
          .btn-reset { background: transparent; border: 1px solid var(--divider-color, #e5e7eb); color: var(--secondary-text-color); flex: 0.5; }
          .btn-reset:hover { background: rgba(239,68,68,0.08); color: #ef4444; border-color: #ef4444; }
          .rollover-note { font-size: 11px; color: var(--secondary-text-color); text-align: center; margin-top: 8px; font-style: italic; }
          .info-msg { text-align: center; padding: 24px 16px; color: var(--secondary-text-color); font-size: 14px; }
        </style>
        <ha-card>
          <div class="card-content" id="root">
            <div class="info-msg">Waiting for data...</div>
          </div>
        </ha-card>
      `;
    }

    /* ── Update inner content on each hass change ─────────────────── */

    _updateContent() {
      var root = this.shadowRoot.getElementById("root");
      if (!root) return;
      if (!this._hass) { root.innerHTML = '<div class="info-msg">Loading...</div>'; return; }

      var entityId = this._config.entity;
      if (!entityId) { root.innerHTML = '<div class="info-msg">No entity configured. Edit this card to select an entity.</div>'; return; }

      var stateObj = this._hass.states[entityId];
      if (!stateObj) { root.innerHTML = '<div class="info-msg">Entity not found: ' + entityId + '</div>'; return; }

      var remaining = parseFloat(stateObj.state) || 0;
      var a = stateObj.attributes || {};
      var spent = parseFloat(a.spent) || 0;
      var weeklyLimit = parseFloat(a.weekly_limit) || 0;
      var rollover = parseFloat(a.rollover) || 0;
      var effectiveBudget = parseFloat(a.effective_budget) || weeklyLimit;
      var currency = a.currency || "$";
      var weekStart = a.week_start || "";

      var pct = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : (spent > 0 ? 100 : 0);
      var isOver = remaining < 0;
      var ringColor = isOver ? "#ef4444" : (pct > 75 ? "#f59e0b" : "#22c55e");
      var remColor = isOver ? "#ef4444" : "#22c55e";

      var R = 54;
      var C = 2 * Math.PI * R;
      var offset = C - (pct / 100) * C;

      var wsLabel = "";
      try { var dd = new Date(weekStart + "T00:00:00"); wsLabel = dd.toLocaleDateString(undefined, {month:"short",day:"numeric",year:"numeric"}); } catch(e){ wsLabel = weekStart; }

      var rollNote = "";
      if (rollover > 0) rollNote = currency + rollover.toFixed(2) + " saved from last week";
      else if (rollover < 0) rollNote = currency + Math.abs(rollover).toFixed(2) + " overspent last week";

      var h = '';
      h += '<div class="header"><div><div class="title">Weekly Budget</div><div class="subtitle">Week of ' + wsLabel + '</div></div>';
      h += '<div class="badge" style="background:' + (isOver ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)") + ';color:' + (isOver ? "#ef4444" : "#22c55e") + '">' + (isOver ? "Over Budget" : "On Track") + '</div></div>';

      h += '<div class="ring-wrap">';
      h += '<svg class="ring-svg" viewBox="0 0 128 128"><circle class="ring-bg" cx="64" cy="64" r="' + R + '"/>';
      h += '<circle class="ring-fill" cx="64" cy="64" r="' + R + '" style="stroke:' + ringColor + ';stroke-dasharray:' + C + ';stroke-dashoffset:' + offset + '"/></svg>';
      h += '<div class="ring-center"><div class="ring-amount" style="color:' + remColor + '">' + currency + Math.abs(remaining).toFixed(2) + '</div>';
      h += '<div class="ring-label">' + (isOver ? "over budget" : "remaining") + '</div></div></div>';

      h += '<div class="stats">';
      h += '<div class="stat"><div class="stat-val">' + currency + spent.toFixed(2) + '</div><div class="stat-lbl">Spent</div></div>';
      h += '<div class="stat"><div class="stat-val">' + currency + effectiveBudget.toFixed(2) + '</div><div class="stat-lbl">Budget</div></div>';
      h += '<div class="stat"><div class="stat-val" style="color:' + (rollover >= 0 ? "#22c55e" : "#ef4444") + '">' + (rollover >= 0 ? "+" : "") + currency + rollover.toFixed(2) + '</div><div class="stat-lbl">Rollover</div></div>';
      h += '</div>';

      h += '<div class="form-section"><div class="form-title">Add Expense</div>';
      h += '<div class="form-row"><input type="number" id="wb-amt" placeholder="Amount" step="0.01" min="0.01"/>';
      h += '<input type="text" id="wb-desc" placeholder="Description"/></div>';
      h += '<div class="btn-row"><button class="btn btn-add" id="wb-add">Add Expense</button>';
      h += '<button class="btn btn-reset" id="wb-reset">Reset</button></div>';
      if (rollNote) h += '<div class="rollover-note">' + rollNote + '</div>';
      h += '</div>';

      root.innerHTML = h;

      var self = this;
      var addBtn = this.shadowRoot.getElementById("wb-add");
      var resetBtn = this.shadowRoot.getElementById("wb-reset");
      if (addBtn) addBtn.onclick = function() { self._addExpense(); };
      if (resetBtn) resetBtn.onclick = function() { self._resetBudget(); };

      var amtEl = this.shadowRoot.getElementById("wb-amt");
      var descEl = this.shadowRoot.getElementById("wb-desc");
      function onEnter(e) { if (e.key === "Enter") self._addExpense(); }
      if (amtEl) amtEl.onkeydown = onEnter;
      if (descEl) descEl.onkeydown = onEnter;
    }

    _addExpense() {
      var amtEl = this.shadowRoot.getElementById("wb-amt");
      var descEl = this.shadowRoot.getElementById("wb-desc");
      if (!amtEl || !descEl) return;
      var amount = parseFloat(amtEl.value);
      var desc = descEl.value.trim();
      if (!amount || amount <= 0) { amtEl.style.borderColor = "#ef4444"; setTimeout(function(){ amtEl.style.borderColor = ""; }, 1500); return; }
      if (!desc) { descEl.style.borderColor = "#ef4444"; setTimeout(function(){ descEl.style.borderColor = ""; }, 1500); return; }
      this._hass.callService("weekly_budget", "add_expense", { amount: amount, description: desc });
      amtEl.value = "";
      descEl.value = "";
    }

    _resetBudget() {
      this._hass.callService("weekly_budget", "reset_budget", {});
    }
  }

  customElements.define("weekly-budget-card", WeeklyBudgetCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "weekly-budget-card",
    name: "Weekly Budget Overview",
    description: "Shows your weekly budget status with a progress ring, stats, and quick expense entry form.",
    preview: false,
  });
})();
