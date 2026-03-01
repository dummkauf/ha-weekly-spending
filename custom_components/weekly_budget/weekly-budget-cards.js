class WeeklyBudgetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = config;
    this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>Weekly Budget Overview - configure entity in card YAML</div></ha-card>";
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this._config.entity) return;
    var s = hass.states[this._config.entity];
    if (!s) {
      this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>Entity not found: " + this._config.entity + "</div></ha-card>";
      return;
    }
    var a = s.attributes || {};
    var cur = a.currency || "$";
    var rem = parseFloat(s.state) || 0;
    var spent = parseFloat(a.spent) || 0;
    var limit = parseFloat(a.effective_budget) || parseFloat(a.weekly_limit) || 0;
    this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>" +
      "<div style='font-size:18px;font-weight:bold;margin-bottom:12px'>Weekly Budget</div>" +
      "<div>Remaining: " + cur + rem.toFixed(2) + "</div>" +
      "<div>Spent: " + cur + spent.toFixed(2) + "</div>" +
      "<div>Budget: " + cur + limit.toFixed(2) + "</div>" +
      "</div></ha-card>";
  }
  getCardSize() { return 3; }
  static getStubConfig() { return { entity: "" }; }
}

class WeeklyBudgetExpensesCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = config;
    this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>Weekly Budget Expenses - configure entity in card YAML</div></ha-card>";
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this._config.entity) return;
    var s = hass.states[this._config.entity];
    if (!s) {
      this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>Entity not found: " + this._config.entity + "</div></ha-card>";
      return;
    }
    var a = s.attributes || {};
    var exps = a.expenses || [];
    var cur = a.currency || "$";
    var h = "<ha-card><div style='padding:16px'><div style='font-size:18px;font-weight:bold;margin-bottom:12px'>Expenses This Week</div>";
    if (!exps.length) {
      h += "<div>No expenses yet.</div>";
    } else {
      for (var i = exps.length - 1; i >= 0; i--) {
        var e = exps[i];
        h += "<div style='padding:8px 0;border-bottom:1px solid #eee'>" +
          "<strong>" + (e.description || "") + "</strong> - " + cur + (e.amount || 0).toFixed(2) +
          " <span style='color:#888'>(" + (e.user || "Unknown") + ")</span></div>";
      }
    }
    h += "</div></ha-card>";
    this.shadowRoot.innerHTML = h;
  }
  getCardSize() { return 4; }
  static getStubConfig() { return { entity: "" }; }
}

class WeeklyBudgetAddExpenseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
  }
  setConfig(config) {
    this._config = config;
    this.shadowRoot.innerHTML = "<ha-card><div style='padding:16px'>" +
      "<div style='font-size:18px;font-weight:bold;margin-bottom:12px'>Add Expense</div>" +
      "<div style='margin-bottom:8px'><input type='number' id='amt' placeholder='Amount' step='0.01' style='width:100%;padding:8px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px'/></div>" +
      "<div style='margin-bottom:8px'><input type='text' id='desc' placeholder='Description' style='width:100%;padding:8px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px'/></div>" +
      "<button id='sub' style='width:100%;padding:10px;background:#03a9f4;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold'>Add Expense</button>" +
      "<div id='msg' style='text-align:center;margin-top:8px;color:green;display:none'>Added!</div>" +
      "</div></ha-card>";
    var self = this;
    this.shadowRoot.getElementById("sub").addEventListener("click", function() { self._submit(); });
    this.shadowRoot.getElementById("amt").addEventListener("keydown", function(e) { if (e.key === "Enter") self._submit(); });
    this.shadowRoot.getElementById("desc").addEventListener("keydown", function(e) { if (e.key === "Enter") self._submit(); });
  }
  set hass(hass) { this._hass = hass; }
  getCardSize() { return 3; }
  static getStubConfig() { return { entity: "" }; }
  _submit() {
    if (!this._hass) return;
    var a = this.shadowRoot.getElementById("amt");
    var d = this.shadowRoot.getElementById("desc");
    var amt = parseFloat(a.value);
    var desc = d.value.trim();
    if (!amt || amt <= 0 || !desc) return;
    this._hass.callService("weekly_budget", "add_expense", { amount: amt, description: desc });
    a.value = "";
    d.value = "";
    var m = this.shadowRoot.getElementById("msg");
    m.style.display = "block";
    setTimeout(function() { m.style.display = "none"; }, 2000);
  }
}

customElements.define("weekly-budget-card", WeeklyBudgetCard);
customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);
customElements.define("weekly-budget-add-expense-card", WeeklyBudgetAddExpenseCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weekly-budget-card",
  name: "Weekly Budget Overview",
  description: "Shows remaining budget, spent, and budget limit."
});
window.customCards.push({
  type: "weekly-budget-expenses-card",
  name: "Weekly Budget Expenses",
  description: "Lists all expenses for the current week."
});
window.customCards.push({
  type: "weekly-budget-add-expense-card",
  name: "Weekly Budget Add Expense",
  description: "Form to add a new expense."
});

console.info("weekly-budget-cards.js loaded");
