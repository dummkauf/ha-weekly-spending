/**
 * Weekly Budget Tracker – Lovelace Cards
 * All three cards in a single file to avoid multi-file loading issues.
 */

/* ── Card 1: Weekly Budget Overview ────────────────────────────────── */

class WeeklyBudgetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
    if (!this.shadowRoot.getElementById("wb-root")) {
      this.shadowRoot.innerHTML =
        '<style>' +
        ':host{display:block}' +
        'ha-card{overflow:hidden}' +
        '.content{padding:20px}' +
        '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}' +
        '.ttl{font-size:18px;font-weight:600;color:var(--primary-text-color)}' +
        '.sub{font-size:12px;color:var(--secondary-text-color);margin-top:2px}' +
        '.badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px}' +
        '.ring-wrap{display:flex;justify-content:center;align-items:center;margin:8px 0 20px;position:relative}' +
        '.ring-svg{transform:rotate(-90deg);width:140px;height:140px}' +
        '.ring-bg{fill:none;stroke:var(--divider-color,#e5e7eb);stroke-width:10}' +
        '.ring-fill{fill:none;stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset .6s ease,stroke .3s}' +
        '.ring-ctr{position:absolute;text-align:center}' +
        '.ring-amt{font-size:22px;font-weight:700;line-height:1.1}' +
        '.ring-lbl{font-size:11px;color:var(--secondary-text-color);margin-top:2px}' +
        '.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}' +
        '.stat{text-align:center;padding:10px 6px;border-radius:10px;background:var(--card-background-color,rgba(0,0,0,.03));border:1px solid var(--divider-color,#e5e7eb)}' +
        '.sv{font-size:16px;font-weight:700;color:var(--primary-text-color)}' +
        '.sl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--secondary-text-color);margin-top:4px}' +
        '.fsec{border-top:1px solid var(--divider-color,#e5e7eb);padding-top:16px;margin-top:4px}' +
        '.fttl{font-size:13px;font-weight:600;color:var(--primary-text-color);margin-bottom:10px}' +
        '.frow{display:flex;gap:8px;margin-bottom:8px}' +
        '.frow input{flex:1;padding:8px 12px;border:1px solid var(--divider-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--card-background-color,#fff);color:var(--primary-text-color);outline:none;box-sizing:border-box}' +
        '.frow input:focus{border-color:var(--primary-color,#03a9f4)}' +
        '.brow{display:flex;gap:8px}' +
        '.btn{flex:1;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer}' +
        '.btn-a{background:var(--primary-color,#03a9f4);color:#fff}' +
        '.btn-a:hover{opacity:.9}' +
        '.btn-r{background:transparent;border:1px solid var(--divider-color,#e5e7eb);color:var(--secondary-text-color);flex:.5}' +
        '.btn-r:hover{background:rgba(239,68,68,.08);color:#ef4444;border-color:#ef4444}' +
        '.rnote{font-size:11px;color:var(--secondary-text-color);text-align:center;margin-top:8px;font-style:italic}' +
        '.msg{text-align:center;padding:24px 16px;color:var(--secondary-text-color);font-size:14px}' +
        '</style>' +
        '<ha-card><div class="content" id="wb-root"><div class="msg">Waiting for data...</div></div></ha-card>';
    }
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() { return 5; }

  static getStubConfig() { return { entity: "" }; }

  _update() {
    var root = this.shadowRoot.getElementById("wb-root");
    if (!root || !this._hass) return;
    var eid = this._config.entity;
    if (!eid) { root.innerHTML = '<div class="msg">No entity configured. Edit this card and set an entity.</div>'; return; }
    var s = this._hass.states[eid];
    if (!s) { root.innerHTML = '<div class="msg">Entity not found: ' + eid + '</div>'; return; }

    var rem = parseFloat(s.state) || 0;
    var a = s.attributes || {};
    var spent = parseFloat(a.spent) || 0;
    var limit = parseFloat(a.weekly_limit) || 0;
    var roll = parseFloat(a.rollover) || 0;
    var eff = parseFloat(a.effective_budget) || limit;
    var cur = a.currency || "$";
    var ws = a.week_start || "";
    var pct = eff > 0 ? Math.min((spent / eff) * 100, 100) : (spent > 0 ? 100 : 0);
    var over = rem < 0;
    var rc = over ? "#ef4444" : (pct > 75 ? "#f59e0b" : "#22c55e");
    var R = 54, C = 2 * Math.PI * R, off = C - (pct / 100) * C;
    var wsl = ws; try { wsl = new Date(ws + "T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); } catch(e){}
    var rn = roll > 0 ? cur+roll.toFixed(2)+" saved from last week" : (roll < 0 ? cur+Math.abs(roll).toFixed(2)+" overspent last week" : "");

    var h = '<div class="hdr"><div><div class="ttl">Weekly Budget</div><div class="sub">Week of '+wsl+'</div></div>' +
      '<div class="badge" style="background:'+(over?"rgba(239,68,68,.15)":"rgba(34,197,94,.15)")+';color:'+(over?"#ef4444":"#22c55e")+'">'+(over?"Over Budget":"On Track")+'</div></div>' +
      '<div class="ring-wrap"><svg class="ring-svg" viewBox="0 0 128 128"><circle class="ring-bg" cx="64" cy="64" r="'+R+'"/>' +
      '<circle class="ring-fill" cx="64" cy="64" r="'+R+'" style="stroke:'+rc+';stroke-dasharray:'+C+';stroke-dashoffset:'+off+'"/></svg>' +
      '<div class="ring-ctr"><div class="ring-amt" style="color:'+(over?"#ef4444":"#22c55e")+'">'+cur+Math.abs(rem).toFixed(2)+'</div>' +
      '<div class="ring-lbl">'+(over?"over budget":"remaining")+'</div></div></div>' +
      '<div class="stats"><div class="stat"><div class="sv">'+cur+spent.toFixed(2)+'</div><div class="sl">Spent</div></div>' +
      '<div class="stat"><div class="sv">'+cur+eff.toFixed(2)+'</div><div class="sl">Budget</div></div>' +
      '<div class="stat"><div class="sv" style="color:'+(roll>=0?"#22c55e":"#ef4444")+'">'+(roll>=0?"+":"")+cur+roll.toFixed(2)+'</div><div class="sl">Rollover</div></div></div>' +
      '<div class="fsec"><div class="fttl">Add Expense</div>' +
      '<div class="frow"><input type="number" id="wb-a" placeholder="Amount" step="0.01" min="0.01"/>' +
      '<input type="text" id="wb-d" placeholder="Description"/></div>' +
      '<div class="brow"><button class="btn btn-a" id="wb-add">Add Expense</button>' +
      '<button class="btn btn-r" id="wb-rst">Reset</button></div>' +
      (rn ? '<div class="rnote">'+rn+'</div>' : '') + '</div>';

    root.innerHTML = h;
    var self = this;
    var ab = this.shadowRoot.getElementById("wb-add");
    var rb = this.shadowRoot.getElementById("wb-rst");
    if (ab) ab.onclick = function(){ self._addExp(); };
    if (rb) rb.onclick = function(){ self._hass.callService("weekly_budget","reset_budget",{}); };
    var ae = this.shadowRoot.getElementById("wb-a");
    var de = this.shadowRoot.getElementById("wb-d");
    function ek(e){ if(e.key==="Enter") self._addExp(); }
    if (ae) ae.onkeydown = ek;
    if (de) de.onkeydown = ek;
  }

  _addExp() {
    var ae = this.shadowRoot.getElementById("wb-a");
    var de = this.shadowRoot.getElementById("wb-d");
    if (!ae||!de) return;
    var amt = parseFloat(ae.value), desc = de.value.trim();
    if (!amt||amt<=0){ ae.style.borderColor="#ef4444"; setTimeout(function(){ae.style.borderColor="";},1500); return; }
    if (!desc){ de.style.borderColor="#ef4444"; setTimeout(function(){de.style.borderColor="";},1500); return; }
    this._hass.callService("weekly_budget","add_expense",{amount:amt,description:desc});
    ae.value=""; de.value="";
  }
}

/* ── Card 2: Weekly Budget Expenses ───────────────────────────────── */

class WeeklyBudgetExpensesCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
    if (!this.shadowRoot.getElementById("we-root")) {
      this.shadowRoot.innerHTML =
        '<style>' +
        ':host{display:block}ha-card{overflow:hidden}.content{padding:20px}' +
        '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}' +
        '.ttl{font-size:18px;font-weight:600;color:var(--primary-text-color)}' +
        '.cnt{font-size:12px;color:var(--secondary-text-color);background:var(--card-background-color,rgba(0,0,0,.05));border:1px solid var(--divider-color,#e5e7eb);padding:3px 10px;border-radius:20px}' +
        '.usum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--divider-color,#e5e7eb)}' +
        '.uchip{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:var(--card-background-color,rgba(0,0,0,.03));border:1px solid var(--divider-color,#e5e7eb);font-size:12px}' +
        '.cn{font-weight:600;color:var(--primary-text-color)}.ca{color:var(--secondary-text-color)}' +
        '.elist{display:flex;flex-direction:column}' +
        '.eitem{display:flex;align-items:flex-start;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--divider-color,#e5e7eb)}' +
        '.eitem:last-child{border-bottom:none}' +
        '.eleft{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}' +
        '.edesc{font-size:14px;font-weight:500;color:var(--primary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.emeta{font-size:11px;color:var(--secondary-text-color);display:flex;gap:8px;align-items:center}' +
        '.euser{font-weight:600}' +
        '.eamt{font-size:15px;font-weight:700;color:var(--primary-text-color);white-space:nowrap;margin-left:12px;padding-top:1px}' +
        '.empty{text-align:center;padding:32px 16px;color:var(--secondary-text-color);font-size:14px}' +
        '.tbar{display:flex;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:2px solid var(--divider-color,#e5e7eb)}' +
        '.tlbl{font-size:14px;font-weight:600;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.5px}' +
        '.tval{font-size:18px;font-weight:700;color:var(--primary-text-color)}' +
        '.msg{text-align:center;padding:24px 16px;color:var(--secondary-text-color);font-size:14px}' +
        '</style>' +
        '<ha-card><div class="content" id="we-root"><div class="msg">Waiting for data...</div></div></ha-card>';
    }
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() { return 4; }

  static getStubConfig() { return { entity: "" }; }

  _update() {
    var root = this.shadowRoot.getElementById("we-root");
    if (!root || !this._hass) return;
    var eid = this._config.entity;
    if (!eid) { root.innerHTML = '<div class="msg">No entity configured. Edit this card and set an entity.</div>'; return; }
    var s = this._hass.states[eid];
    if (!s) { root.innerHTML = '<div class="msg">Entity not found: ' + eid + '</div>'; return; }

    var mx = this._config.max_items || 50;
    var st = this._config.show_total !== false;
    var ttl = this._config.title || "Expenses This Week";
    var a = s.attributes || {};
    var exps = (a.expenses || []).slice().reverse();
    var cur = a.currency || "$";
    var dl = exps.slice(0, mx);
    var tot = 0, bu = {};
    for (var i = 0; i < exps.length; i++) {
      var am = exps[i].amount || 0; tot += am;
      var u = exps[i].user || "Unknown"; bu[u] = (bu[u]||0) + am;
    }
    var h = '<div class="hdr"><div class="ttl">' + this._esc(ttl) + '</div><div class="cnt">' + exps.length + ' expense' + (exps.length!==1?'s':'') + '</div></div>';
    var uk = Object.keys(bu).sort(function(a,b){return bu[b]-bu[a];});
    if (uk.length) { h += '<div class="usum">'; for (var j=0;j<uk.length;j++) h += '<div class="uchip"><span class="cn">'+this._esc(uk[j])+'</span><span class="ca">'+cur+bu[uk[j]].toFixed(2)+'</span></div>'; h += '</div>'; }
    h += '<div class="elist">';
    if (!dl.length) { h += '<div class="empty">No expenses recorded this week.</div>'; }
    else { for (var k=0;k<dl.length;k++) { var e=dl[k]; h += '<div class="eitem"><div class="eleft"><div class="edesc">'+this._esc(e.description||"No description")+'</div><div class="emeta"><span class="euser">'+this._esc(e.user||"Unknown")+'</span><span>'+this._ft(e.timestamp)+'</span></div></div><div class="eamt">'+cur+(e.amount||0).toFixed(2)+'</div></div>'; } }
    h += '</div>';
    if (exps.length>mx) h += '<div style="font-size:11px;color:var(--secondary-text-color);text-align:center;padding-top:8px;font-style:italic">Showing '+mx+' of '+exps.length+' expenses</div>';
    if (st && exps.length>0) h += '<div class="tbar"><span class="tlbl">Total</span><span class="tval">'+cur+tot.toFixed(2)+'</span></div>';
    root.innerHTML = h;
  }

  _esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  _ft(ts) { if (!ts) return ""; try { return new Date(ts).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e){ return ts; } }
}

/* ── Card 3: Weekly Budget Add Expense ────────────────────────────── */

class WeeklyBudgetAddExpenseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
    var t = this._config.title || "Add Expense";
    this.shadowRoot.innerHTML =
      '<style>' +
      ':host{display:block}ha-card{overflow:hidden}.content{padding:20px}' +
      '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}' +
      '.ttl{font-size:18px;font-weight:600;color:var(--primary-text-color)}' +
      '.badge{font-size:13px;font-weight:600;padding:4px 10px;border-radius:20px}' +
      '.bok{background:rgba(34,197,94,.15);color:#22c55e}' +
      '.bov{background:rgba(239,68,68,.15);color:#ef4444}' +
      '.grp{margin-bottom:12px}' +
      '.grp label{display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--secondary-text-color);margin-bottom:6px}' +
      '.grp input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color,#e5e7eb);border-radius:8px;font-size:14px;background:var(--card-background-color,#fff);color:var(--primary-text-color);outline:none}' +
      '.grp input:focus{border-color:var(--primary-color,#03a9f4)}' +
      '.btn{width:100%;padding:11px 16px;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;background:var(--primary-color,#03a9f4);color:#fff}' +
      '.btn:hover{opacity:.9}.btn:disabled{opacity:.5;cursor:not-allowed}' +
      '.ok{text-align:center;padding:8px 0 0;font-size:13px;font-weight:500;color:#22c55e;opacity:0;transition:opacity .3s}' +
      '.ok.show{opacity:1}' +
      '</style>' +
      '<ha-card><div class="content">' +
      '<div class="hdr"><div class="ttl">' + t + '</div><div class="badge bok" id="wa-bdg">--</div></div>' +
      '<div class="grp"><label>Amount</label><input type="number" id="wa-a" placeholder="0.00" step="0.01" min="0.01" inputmode="decimal"/></div>' +
      '<div class="grp"><label>Description</label><input type="text" id="wa-d" placeholder="What was this expense for?"/></div>' +
      '<button class="btn" id="wa-btn">Add Expense</button>' +
      '<div class="ok" id="wa-msg">Expense added!</div>' +
      '</div></ha-card>';
    var self = this;
    this.shadowRoot.getElementById("wa-btn").onclick = function(){ self._submit(); };
    this.shadowRoot.getElementById("wa-a").onkeydown = function(e){ if(e.key==="Enter") self._submit(); };
    this.shadowRoot.getElementById("wa-d").onkeydown = function(e){ if(e.key==="Enter") self._submit(); };
    this._updateBadge();
  }

  set hass(hass) { this._hass = hass; this._updateBadge(); }

  getCardSize() { return 3; }

  static getStubConfig() { return { entity: "" }; }

  _updateBadge() {
    if (!this._hass || !this._config) return;
    var b = this.shadowRoot.getElementById("wa-bdg");
    if (!b) return;
    var s = this._hass.states[this._config.entity];
    if (!s) { b.textContent = "N/A"; return; }
    var rem = parseFloat(s.state) || 0;
    var cur = (s.attributes||{}).currency || "$";
    var ov = rem < 0;
    b.textContent = cur + Math.abs(rem).toFixed(2) + (ov ? " over" : " left");
    b.className = "badge " + (ov ? "bov" : "bok");
  }

  _submit() {
    var ae = this.shadowRoot.getElementById("wa-a");
    var de = this.shadowRoot.getElementById("wa-d");
    var btn = this.shadowRoot.getElementById("wa-btn");
    var amt = parseFloat(ae.value), desc = de.value.trim(), ok = true;
    if (!amt||amt<=0) { ae.style.borderColor="#ef4444"; ok=false; }
    if (!desc) { de.style.borderColor="#ef4444"; ok=false; }
    if (!ok) { setTimeout(function(){ae.style.borderColor="";de.style.borderColor="";},1500); return; }
    btn.disabled = true;
    this._hass.callService("weekly_budget","add_expense",{amount:amt,description:desc});
    ae.value = ""; de.value = "";
    var msg = this.shadowRoot.getElementById("wa-msg");
    msg.classList.add("show");
    setTimeout(function(){ msg.classList.remove("show"); btn.disabled = false; }, 1500);
  }
}

/* ── Register all three cards ─────────────────────────────────────── */

if (!customElements.get("weekly-budget-card"))
  customElements.define("weekly-budget-card", WeeklyBudgetCard);
if (!customElements.get("weekly-budget-expenses-card"))
  customElements.define("weekly-budget-expenses-card", WeeklyBudgetExpensesCard);
if (!customElements.get("weekly-budget-add-expense-card"))
  customElements.define("weekly-budget-add-expense-card", WeeklyBudgetAddExpenseCard);

window.customCards = window.customCards || [];
window.customCards.push(
  { type: "weekly-budget-card", name: "Weekly Budget Overview", description: "Budget progress ring, stats, and quick expense entry.", preview: false },
  { type: "weekly-budget-expenses-card", name: "Weekly Budget Expenses", description: "List of all expenses this week with user and amount.", preview: false },
  { type: "weekly-budget-add-expense-card", name: "Weekly Budget Add Expense", description: "Standalone form for adding expenses.", preview: false }
);

console.info("%c WEEKLY-BUDGET %c Cards loaded ", "color:white;background:#03a9f4;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px", "color:#03a9f4;background:#e3f2fd;font-weight:bold;padding:2px 6px;border-radius:0 4px 4px 0");
