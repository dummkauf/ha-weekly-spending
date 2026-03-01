console.info("[WEEKLY-BUDGET] JS file execution starting...");

try {

class WeeklyBudgetCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = "<ha-card><div style='padding:16px'>Weekly Budget Overview - set entity in card config</div></ha-card>";
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this._config.entity) return;
    var s = hass.states[this._config.entity];
    if (!s) {
      this.innerHTML = "<ha-card><div style='padding:16px'>Entity not found: " + this._config.entity + "</div></ha-card>";
      return;
    }
    var a = s.attributes || {};
    var cur = a.currency || "$";
    var rem = parseFloat(s.state) || 0;
    var spent = parseFloat(a.spent) || 0;
    var lim = parseFloat(a.effective_budget) || parseFloat(a.weekly_limit) || 0;
    var roll = parseFloat(a.rollover) || 0;
    var pct = lim > 0 ? Math.min(100, Math.round((spent / lim) * 100)) : 0;
    var barColor = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";
    this.innerHTML = "<ha-card>" +
      "<div style='padding:20px'>" +
        "<div style='font-size:18px;font-weight:700;margin-bottom:16px'>Weekly Budget</div>" +
        "<div style='background:#e5e7eb;border-radius:8px;height:12px;margin-bottom:16px;overflow:hidden'>" +
          "<div style='height:100%;width:" + pct + "%;background:" + barColor + ";border-radius:8px;transition:width 0.3s'></div>" +
        "</div>" +
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px'>" +
          "<div style='padding:12px;background:#f0fdf4;border-radius:8px;text-align:center'>" +
            "<div style='font-size:12px;color:#666'>Remaining</div>" +
            "<div style='font-size:20px;font-weight:700;color:#16a34a'>" + cur + rem.toFixed(2) + "</div>" +
          "</div>" +
          "<div style='padding:12px;background:#fef2f2;border-radius:8px;text-align:center'>" +
            "<div style='font-size:12px;color:#666'>Spent</div>" +
            "<div style='font-size:20px;font-weight:700;color:#dc2626'>" + cur + spent.toFixed(2) + "</div>" +
          "</div>" +
          "<div style='padding:12px;background:#f8fafc;border-radius:8px;text-align:center'>" +
            "<div style='font-size:12px;color:#666'>Budget</div>" +
            "<div style='font-size:20px;font-weight:700'>" + cur + lim.toFixed(2) + "</div>" +
          "</div>" +
          "<div style='padding:12px;background:#f8fafc;border-radius:8px;text-align:center'>" +
            "<div style='font-size:12px;color:#666'>Rollover</div>" +
            "<div style='font-size:20px;font-weight:700;color:" + (roll >= 0 ? "#16a34a" : "#dc2626") + "'>" + cur + roll.toFixed(2) + "</div>" +
          "</div>" +
        "</div>" +
        "<div style='margin-top:16px;display:flex;gap:8px'>" +
          "<input type='number' id='wb-amt' placeholder='Amount' step='0.01' min='0.01' style='flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px'/>" +
          "<input type='text' id='wb-desc' placeholder='Description' style='flex:2;padding:8px;border:1px solid #d1d5db;border-radius:6px'/>" +
        "</div>" +
        "<div style='margin-top:8px;display:flex;gap:8px'>" +
          "<button id='wb-add' style='flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600'>Add Expense</button>" +
          "<button id='wb-reset' style='padding:10px 16px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600'>Reset</button>" +
        "</div>" +
        "<div id='wb-msg' style='text-align:center;margin-top:8px;color:#16a34a;display:none'>Expense added!</div>" +
      "</div></ha-card>";
    var self = this;
    var addBtn = this.querySelector("#wb-add");
    var resetBtn = this.querySelector("#wb-reset");
    if (addBtn) addBtn.onclick = function() { self._submit(); };
    if (resetBtn) resetBtn.onclick = function() {
      if (self._hass) self._hass.callService("weekly_budget", "reset_budget", {});
    };
    var amtEl = this.querySelector("#wb-amt");
    var descEl = this.querySelector("#wb-desc");
    if (amtEl) amtEl.onkeydown = function(e) { if (e.key === "Enter") self._submit(); };
    if (descEl) descEl.onkeydown = function(e) { if (e.key === "Enter") self._submit(); };
  }
  _submit() {
    if (!this._hass) return;
    var a = this.querySelector("#wb-amt");
    var d = this.querySelector("#wb-desc");
    if (!a || !d) return;
    var amt = parseFloat(a.value);
    var desc = d.value.trim();
    if (!amt || amt <= 0 || !desc) return;
    this._hass.callService("weekly_budget", "add_expense", { amount: amt, description: desc });
    a.value = "";
    d.value = "";
    var m = this.querySelector("#wb-msg");
    if (m) { m.style.display = "block"; setTimeout(function() { m.style.display = "none"; }, 2000); }
  }
  getCardSize() { return 5; }
  static getStubConfig() { return { entity: "" }; }
}

console.info("[WEEKLY-BUDGET] WeeklyBudgetCard class defined");


class WeeklyBudgetExpensesCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = "<ha-card><div style='padding:16px'>Weekly Budget Expenses - set entity in card config</div></ha-card>";
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this._config.entity) return;
    var s = hass.states[this._config.entity];
    if (!s) {
      this.innerHTML = "<ha-card><div style='padding:16px'>Entity not found: " + this._config.entity + "</div></ha-card>";
      return;
    }
    var a = s.attributes || {};
    var exps = a.expenses || [];
    var cur = a.currency || "$";
    var total = 0;
    var h = "<ha-card><div style='padding:20px'>" +
      "<div style='font-size:18px;font-weight:700;margin-bottom:16px'>" + (this._config.title || "Expenses This Week") + "</div>";
    if (!exps.length) {
      h += "<div style='color:#999;text-align:center;padding:20px'>No expenses recorded yet</div>";
    } else {
      for (var i = exps.length - 1; i >= 0; i--) {
        var e = exps[i];
        var ea = parseFloat(e.amount) || 0;
        total += ea;
        var ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";
        h += "<div style='display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f1f1'>" +
          "<div>" +
            "<div style='font-weight:600'>" + (e.description || "") + "</div>" +
            "<div style='font-size:12px;color:#888'>" + (e.user || "Unknown") + (ts ? " - " + ts : "") + "</div>" +
          "</div>" +
          "<div style='font-weight:700;color:#dc2626'>" + cur + ea.toFixed(2) + "</div>" +
        "</div>";
      }
      h += "<div style='margin-top:12px;padding-top:12px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-weight:700'>" +
        "<span>Total</span><span>" + cur + total.toFixed(2) + "</span></div>";
    }
    h += "</div></ha-card>";
    this.innerHTML = h;
  }
  getCardSize() { return 5; }
  static getStubConfig() { return { entity: "" }; }
}

console.info("[WEEKLY-BUDGET] WeeklyBudgetExpensesCard class defined");


class WeeklyBudgetAddExpenseCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = "<ha-card>" +
      "<div style='padding:20px'>" +
        "<div style='font-size:18px;font-weight:700;margin-bottom:16px'>Add Expense</div>" +
        "<div style='margin-bottom:8px'><input type='number' id='wba-amt' placeholder='Amount' step='0.01' style='width:100%;padding:10px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px'/></div>" +
        "<div style='margin-bottom:8px'><input type='text' id='wba-desc' placeholder='Description' style='width:100%;padding:10px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px'/></div>" +
        "<button id='wba-sub' style='width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px'>Add Expense</button>" +
        "<div id='wba-msg' style='text-align:center;margin-top:8px;color:#16a34a;display:none;font-weight:600'>Expense added!</div>" +
      "</div></ha-card>";
    var self = this;
    this.querySelector("#wba-sub").onclick = function() { self._submit(); };
    this.querySelector("#wba-amt").onkeydown = function(e) { if (e.key === "Enter") self._submit(); };
    this.querySelector("#wba-desc").onkeydown = function(e) { if (e.key === "Enter") self._submit(); };
  }
  set hass(hass) { this._hass = hass; }
  _submit() {
    if (!this._hass) return;
    var a = this.querySelector("#wba-amt");
    var d = this.querySelector("#wba-desc");
    if (!a || !d) return;
    var amt = parseFloat(a.value);
    var desc = d.value.trim();
    if (!amt || amt <= 0 || !desc) return;
    this._hass.callService("weekly_budget", "add_expense", { amount: amt, description: desc });
    a.value = "";
    d.value = "";
    var m = this.querySelector("#wba-msg");
    if (m) { m.style.display = "block"; setTimeout(function() { m.style.display = "none"; }, 2000); }
  }
  getCardSize() { return 3; }
  static getStubConfig() { return { entity: "" }; }
}

console.info("[WEEKLY-BUDGET] WeeklyBudgetAddExpenseCard class defined");

if (!customElements.get("weekly-budget-card")) customElements.define("weekly-budget-card", WeeklyBudgetCard);
console.info("[WEEKLY-BUDGET] weekly-budget-card registered");

if (!customElements.get("weekly-budget-expenses-card")) customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);
console.info("[WEEKLY-BUDGET] weekly-budget-expenses-card registered");

if (!customElements.get("weekly-budget-add-expense-card")) customElements.define("weekly-budget-add-expense-card", WeeklyBudgetAddExpenseCard);
console.info("[WEEKLY-BUDGET] weekly-budget-add-expense-card registered");

window.customCards = window.customCards || [];
window.customCards.push({ type: "weekly-budget-card", name: "Weekly Budget Overview", description: "Budget progress, stats, and expense entry form." });
window.customCards.push({ type: "weekly-budget-expenses-card", name: "Weekly Budget Expenses", description: "Lists all expenses for the current week." });
window.customCards.push({ type: "weekly-budget-add-expense-card", name: "Weekly Budget Add Expense", description: "Standalone expense entry form." });

console.info("[WEEKLY-BUDGET] All 3 cards registered and pushed to window.customCards");

} catch(e) {
  console.error("[WEEKLY-BUDGET] FATAL ERROR:", e);
}
