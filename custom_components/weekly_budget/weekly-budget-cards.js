/* Weekly Budget Tracker - Lovelace Cards */

/* ── Shared Editor ──────────────────────────────────────────── */

class WbEntityEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    var picker = this.querySelector('ha-entity-picker');
    if (picker) picker.hass = hass;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  _render() {
    this.innerHTML =
      '<div style="padding:16px 0">' +
        '<ha-entity-picker allow-custom-entity></ha-entity-picker>' +
        '<p style="margin:8px 0 0;font-size:12px;color:var(--secondary-text-color)">' +
          'Select a weekly_budget sensor (e.g. Budget Remaining)' +
        '</p>' +
      '</div>';

    var picker = this.querySelector('ha-entity-picker');
    if (!picker) return;
    if (this._hass) picker.hass = this._hass;
    picker.value = this._config.entity || '';
    picker.includeDomains = ['sensor'];
    picker.entityFilter = function(stateObj) {
      return stateObj.entity_id.indexOf('weekly_budget') !== -1 ||
             stateObj.entity_id.indexOf('budget_remaining') !== -1 ||
             stateObj.entity_id.indexOf('budget_spent') !== -1 ||
             stateObj.entity_id.indexOf('budget_rollover') !== -1 ||
             stateObj.entity_id.indexOf('weekly_limit') !== -1;
    };

    var self = this;
    picker.addEventListener('value-changed', function(ev) {
      if (!ev.detail || ev.detail.value === self._config.entity) return;
      self._config = Object.assign({}, self._config, { entity: ev.detail.value });
      self.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: self._config },
        bubbles: true,
        composed: true
      }));
    });
  }
}

if (!customElements.get('wb-entity-editor')) {
  customElements.define('wb-entity-editor', WbEntityEditor);
}


/* ── Overview Card ──────────────────────────────────────────── */

class WeeklyBudgetCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._built = false;
  }

  static getConfigElement() {
    return document.createElement('wb-entity-editor');
  }

  static getStubConfig(hass) {
    var match = '';
    if (hass && hass.states) {
      var keys = Object.keys(hass.states);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('budget_remaining') !== -1) { match = keys[i]; break; }
      }
      if (!match) {
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].indexOf('weekly_budget') !== -1) { match = keys[j]; break; }
        }
      }
    }
    return { entity: match };
  }

  setConfig(config) {
    this._config = config;
    if (!this._built) this._buildLayout();
    if (this._hass) this._updateDisplay();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._buildLayout();
    this._updateDisplay();
  }

  _buildLayout() {
    this._built = true;
    this.innerHTML =
      '<ha-card>' +
        '<div style="padding:20px">' +
          '<div style="font-size:18px;font-weight:700;margin-bottom:16px">Weekly Budget</div>' +
          '<div style="background:#e5e7eb;border-radius:8px;height:12px;margin-bottom:16px;overflow:hidden">' +
            '<div id="wb-bar" style="height:100%;width:0%;border-radius:8px;transition:width 0.3s"></div>' +
          '</div>' +
          '<div id="wb-info" style="color:#888;text-align:center">Select an entity in card settings</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px" id="wb-stats"></div>' +
          '<div style="display:flex;gap:8px;margin-bottom:8px">' +
            '<input type="number" id="wb-amt" placeholder="Amount" step="0.01" min="0.01" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>' +
            '<input type="text" id="wb-desc" placeholder="Description" style="flex:2;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button id="wb-add" style="flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Add Expense</button>' +
            '<button id="wb-reset" style="padding:10px 16px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset</button>' +
          '</div>' +
          '<div id="wb-msg" style="text-align:center;margin-top:8px;color:#16a34a;display:none;font-weight:600">Expense added!</div>' +
        '</div>' +
      '</ha-card>';

    var self = this;
    this.querySelector('#wb-add').onclick = function() { self._submit(); };
    this.querySelector('#wb-reset').onclick = function() {
      if (self._hass) self._hass.callService('weekly_budget', 'reset_budget', {});
    };
    this.querySelector('#wb-amt').onkeydown = function(e) { if (e.key === 'Enter') self._submit(); };
    this.querySelector('#wb-desc').onkeydown = function(e) { if (e.key === 'Enter') self._submit(); };
  }

  _updateDisplay() {
    if (!this._hass || !this._config || !this._config.entity) return;
    var s = this._hass.states[this._config.entity];
    var infoEl = this.querySelector('#wb-info');
    var statsEl = this.querySelector('#wb-stats');
    var barEl = this.querySelector('#wb-bar');
    if (!s) {
      if (infoEl) infoEl.textContent = 'Entity not found: ' + this._config.entity;
      return;
    }
    if (infoEl) infoEl.style.display = 'none';
    var a = s.attributes || {};
    var cur = a.currency || '$';
    var rem = parseFloat(s.state) || 0;
    var spent = parseFloat(a.spent) || 0;
    var lim = parseFloat(a.effective_budget) || parseFloat(a.weekly_limit) || 0;
    var roll = parseFloat(a.rollover) || 0;
    var pct = lim > 0 ? Math.min(100, Math.round((spent / lim) * 100)) : 0;
    var barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.style.background = barColor;
    }
    if (statsEl) {
      statsEl.innerHTML =
        '<div style="padding:12px;background:#f0fdf4;border-radius:8px;text-align:center">' +
          '<div style="font-size:12px;color:#666">Remaining</div>' +
          '<div style="font-size:20px;font-weight:700;color:#16a34a">' + cur + rem.toFixed(2) + '</div>' +
        '</div>' +
        '<div style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center">' +
          '<div style="font-size:12px;color:#666">Spent</div>' +
          '<div style="font-size:20px;font-weight:700;color:#dc2626">' + cur + spent.toFixed(2) + '</div>' +
        '</div>' +
        '<div style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center">' +
          '<div style="font-size:12px;color:#666">Budget</div>' +
          '<div style="font-size:20px;font-weight:700">' + cur + lim.toFixed(2) + '</div>' +
        '</div>' +
        '<div style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center">' +
          '<div style="font-size:12px;color:#666">Rollover</div>' +
          '<div style="font-size:20px;font-weight:700;color:' + (roll >= 0 ? '#16a34a' : '#dc2626') + '">' + cur + roll.toFixed(2) + '</div>' +
        '</div>';
    }
  }

  _submit() {
    if (!this._hass) return;
    var a = this.querySelector('#wb-amt');
    var d = this.querySelector('#wb-desc');
    if (!a || !d) return;
    var amt = parseFloat(a.value);
    var desc = d.value.trim();
    if (!amt || amt <= 0 || !desc) return;
    this._hass.callService('weekly_budget', 'add_expense', { amount: amt, description: desc });
    a.value = '';
    d.value = '';
    var m = this.querySelector('#wb-msg');
    if (m) { m.style.display = 'block'; setTimeout(function() { m.style.display = 'none'; }, 2000); }
  }

  getCardSize() { return 5; }
}


/* ── Expenses Card ──────────────────────────────────────────── */

class WeeklyBudgetExpensesCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._built = false;
  }

  static getConfigElement() {
    return document.createElement('wb-entity-editor');
  }

  static getStubConfig(hass) {
    return WeeklyBudgetCard.getStubConfig(hass);
  }

  setConfig(config) {
    this._config = config;
    if (!this._built) this._buildLayout();
    if (this._hass) this._updateDisplay();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._buildLayout();
    this._updateDisplay();
  }

  _buildLayout() {
    this._built = true;
    this.innerHTML =
      '<ha-card>' +
        '<div style="padding:20px">' +
          '<div style="font-size:18px;font-weight:700;margin-bottom:16px" id="wbe-title">Expenses This Week</div>' +
          '<div id="wbe-list" style="color:#888;text-align:center">Select an entity in card settings</div>' +
        '</div>' +
      '</ha-card>';
  }

  _updateDisplay() {
    if (!this._hass || !this._config || !this._config.entity) return;
    var s = this._hass.states[this._config.entity];
    var listEl = this.querySelector('#wbe-list');
    var titleEl = this.querySelector('#wbe-title');
    if (!listEl) return;
    if (titleEl && this._config.title) titleEl.textContent = this._config.title;
    if (!s) {
      listEl.innerHTML = 'Entity not found: ' + this._config.entity;
      return;
    }
    var a = s.attributes || {};
    var exps = a.expenses || [];
    var cur = a.currency || '$';
    if (!exps.length) {
      listEl.innerHTML = '<div style="color:#999;text-align:center;padding:20px">No expenses recorded yet</div>';
      return;
    }
    var total = 0;
    var h = '';
    for (var i = exps.length - 1; i >= 0; i--) {
      var e = exps[i];
      var ea = parseFloat(e.amount) || 0;
      total += ea;
      var dateStr = '';
      if (e.timestamp) {
        var d = new Date(e.timestamp);
        dateStr = (d.getMonth() + 1) + '/' + d.getDate();
      }
      var user = e.user || 'Unknown';
      var desc = e.description || '';
      h +=
        '<div style="padding:4px 0;font-size:14px;line-height:1.6">' +
          '<span style="color:#888">' + dateStr + '</span> ' +
          '<span style="font-weight:600">' + cur + ea.toFixed(2) + '</span>' +
          ' - ' + user + ': ' + desc +
        '</div>';
    }
    h += '<div style="margin-top:8px;padding-top:8px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-weight:700">' +
      '<span>Total</span><span>' + cur + total.toFixed(2) + '</span></div>';
    listEl.innerHTML = h;
  }

  getCardSize() { return 5; }
}


/* ── Add Expense Card ───────────────────────────────────────── */

class WeeklyBudgetAddExpenseCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._built = false;
  }

  static getConfigElement() {
    return document.createElement('wb-entity-editor');
  }

  static getStubConfig(hass) {
    return WeeklyBudgetCard.getStubConfig(hass);
  }

  setConfig(config) {
    this._config = config;
    if (!this._built) this._buildLayout();
  }

  set hass(hass) { this._hass = hass; }

  _buildLayout() {
    this._built = true;
    this.innerHTML =
      '<ha-card>' +
        '<div style="padding:20px">' +
          '<div style="font-size:18px;font-weight:700;margin-bottom:16px">Add Expense</div>' +
          '<div style="margin-bottom:8px"><input type="number" id="wba-amt" placeholder="Amount" step="0.01" style="width:100%;padding:10px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/></div>' +
          '<div style="margin-bottom:8px"><input type="text" id="wba-desc" placeholder="Description" style="width:100%;padding:10px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/></div>' +
          '<button id="wba-sub" style="width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px">Add Expense</button>' +
          '<div id="wba-msg" style="text-align:center;margin-top:8px;color:#16a34a;display:none;font-weight:600">Expense added!</div>' +
        '</div>' +
      '</ha-card>';
    var self = this;
    this.querySelector('#wba-sub').onclick = function() { self._submit(); };
    this.querySelector('#wba-amt').onkeydown = function(e) { if (e.key === 'Enter') self._submit(); };
    this.querySelector('#wba-desc').onkeydown = function(e) { if (e.key === 'Enter') self._submit(); };
  }

  _submit() {
    if (!this._hass) return;
    var a = this.querySelector('#wba-amt');
    var d = this.querySelector('#wba-desc');
    if (!a || !d) return;
    var amt = parseFloat(a.value);
    var desc = d.value.trim();
    if (!amt || amt <= 0 || !desc) return;
    this._hass.callService('weekly_budget', 'add_expense', { amount: amt, description: desc });
    a.value = '';
    d.value = '';
    var m = this.querySelector('#wba-msg');
    if (m) { m.style.display = 'block'; setTimeout(function() { m.style.display = 'none'; }, 2000); }
  }

  getCardSize() { return 3; }
}


/* ── Register elements ──────────────────────────────────────── */

if (!customElements.get('weekly-budget-card')) customElements.define('weekly-budget-card', WeeklyBudgetCard);
if (!customElements.get('weekly-budget-expenses-card')) customElements.define('weekly-budget-expenses-card', WeeklyBudgetExpensesCard);
if (!customElements.get('weekly-budget-add-expense-card')) customElements.define('weekly-budget-add-expense-card', WeeklyBudgetAddExpenseCard);

window.customCards = window.customCards || [];

var _wbTypes = window.customCards.map(function(c) { return c.type; });
if (_wbTypes.indexOf('weekly-budget-card') === -1) {
  window.customCards.push({ type: 'weekly-budget-card', name: 'Weekly Budget Overview', description: 'Budget progress, stats, and expense entry form.' });
}
if (_wbTypes.indexOf('weekly-budget-expenses-card') === -1) {
  window.customCards.push({ type: 'weekly-budget-expenses-card', name: 'Weekly Budget Expenses', description: 'Lists all expenses for the current week.' });
}
if (_wbTypes.indexOf('weekly-budget-add-expense-card') === -1) {
  window.customCards.push({ type: 'weekly-budget-add-expense-card', name: 'Weekly Budget Add Expense', description: 'Standalone expense entry form.' });
}

console.info('%c WEEKLY-BUDGET %c Cards loaded ', 'color:white;background:#2563eb;font-weight:700;padding:2px 6px;border-radius:3px 0 0 3px', 'color:#2563eb;background:#e0e7ff;font-weight:700;padding:2px 6px;border-radius:0 3px 3px 0');
