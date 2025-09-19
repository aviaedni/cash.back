document.addEventListener('DOMContentLoaded', () => {
  // --- נתוני ברירת מחדל (ניתנים לעריכה בדף) ---
  const DEFAULT_BUDGETS = {
    // משתנות
    "אוכל": 3000,
    "סופר": 2000,
    "מסעדות/וולט": 1000,
    "תחבורה": 300,
    // קבועות
    "חשבונות": 280,
    "מנויים קבועים": 315,
    "החזר הלוואה": 1000,
    "החזרי קרדיט": 1914,
    "העברות קרדיט": 1226,
    "חוב סכין": 318,
    "חשבון חשמל (חוב)": 184,
    "מתנות": 186,
    "שכר דירה": 3600
  };
  const VARIABLE_KEYS = ["אוכל","סופר","מסעדות/וולט","תחבורה"];
  const FIXED_KEYS    = ["חשבונות","מנויים קבועים","החזר הלוואה","החזרי קרדיט","העברות קרדיט","חוב סכין","חשבון חשמל (חוב)","מתנות","שכר דירה"];

  // --- DOM ---
  const monthInput   = document.getElementById('month');
  const switchBtn    = document.getElementById('switchMonth');
  const resetBtn     = document.getElementById('resetMonth');
  const exportBtn    = document.getElementById('exportJson');
  const incomeInput  = document.getElementById('incomeInput');
  const saveIncomeBtn= document.getElementById('saveIncome');
  const sumIncomeEl  = document.getElementById('sumIncome');
  const sumSpentEl   = document.getElementById('sumSpent');
  const sumLeftEl    = document.getElementById('sumLeft');
  const variableWrap = document.getElementById('variable');
  const fixedWrap    = document.getElementById('fixed');
  const tpl          = document.getElementById('catRow');

  // --- Utils ---
  const safeStorage = (() => {
    try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return localStorage; }
    catch { 
      // פולבאק בזיכרון אם localStorage חסום
      let mem = {};
      return {
        getItem:k=>mem[k]||null,
        setItem:(k,v)=>{mem[k]=String(v)},
        removeItem:k=>{delete mem[k]}
      };
    }
  })();

  const fmt = n => Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0});
  const nowMonthStr = () => {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const storageKey = m => `budget-tracker:${m}`;
  const incomeKey  = m => `budget-tracker:${m}:income`;

  function loadMonth(m){
    const raw = safeStorage.getItem(storageKey(m));
    if(!raw){
      const data = {
        month:m,
        budgets:{...DEFAULT_BUDGETS},
        spent:Object.fromEntries(Object.keys(DEFAULT_BUDGETS).map(k=>[k,0])),
        history:[]
      };
      safeStorage.setItem(storageKey(m), JSON.stringify(data));
      return data;
    }
    try { return JSON.parse(raw); }
    catch { safeStorage.removeItem(storageKey(m)); return loadMonth(m); }
  }
  function saveMonth(data){ safeStorage.setItem(storageKey(data.month), JSON.stringify(data)); }
  function loadIncome(m){ return Number(safeStorage.getItem(incomeKey(m))) || 0; }
  function saveIncome(m,v){ safeStorage.setItem(incomeKey(m), String(v||0)); }

  // --- Render a category card ---
  function renderCategory(parent, data, catKey){
    const node = tpl.content.firstElementChild.cloneNode(true);
    const nameEl   = node.querySelector('.cat-name');
    const budgetEl = node.querySelector('.budget');
    const spentEl  = node.querySelector('.spent');
    const leftEl   = node.querySelector('.left');
    const bar      = node.querySelector('.bar');
    const addBtn   = node.querySelector('.add');
    const minusBtn = node.querySelector('.minus');
    const input    = node.querySelector('.add-input');
    const editBtn  = node.querySelector('.edit');

    nameEl.textContent = catKey;

    function refresh(){
      const b = data.budgets[catKey]||0;
      const s = data.spent[catKey]||0;
      const left = b - s;
      budgetEl.textContent = fmt(b);
      spentEl.textContent  = fmt(s);
      leftEl.textContent   = fmt(left);
      const pct = b>0 ? Math.min(100,(s/b)*100) : 0;
      bar.style.width = `${pct}%`;
      bar.style.background = left >= 0
        ? 'linear-gradient(90deg,#60a5fa,#34d399)'
        : 'linear-gradient(90deg,#f59e0b,#ef4444)';
    }

    function add(amount){
      const v = Number(amount);
      if(!v || isNaN(v)) return;
      data.spent[catKey] = (data.spent[catKey]||0) + v;
      data.history.push({ts:Date.now(), cat:catKey, amount:v});
      saveMonth(data);
      refresh(); refreshSummary();
      input.value='';
    }

    addBtn.addEventListener('click', ()=> add(Number(input.value)));
    minusBtn.addEventListener('click', ()=>{
      const v = Number(input.value);
      if(!v || isNaN(v)) return;
      data.spent[catKey] = Math.max(0, (data.spent[catKey]||0) - v);
      saveMonth(data);
      refresh(); refreshSummary();
      input.value='';
    });

    editBtn.addEventListener('click', ()=>{
      const current = data.budgets[catKey]||0;
      const next = prompt(`קבעי יעד חדש ל"${catKey}" (₪):`, current);
      if(next===null) return;
      const n = Number(next);
      if(Number.isFinite(n) && n>=0){
        data.budgets[catKey]=n;
        saveMonth(data);
        refresh(); refreshSummary();
      }
    });

    parent.appendChild(node);
    refresh();
  }

  // --- App state ---
  let current;

  function refreshSummary(){
    const income = loadIncome(monthInput.value);
    const spent  = Object.values(current.spent).reduce((a,b)=>a+(b||0),0);
    const left   = income - spent;
    sumIncomeEl.textContent = fmt(income)+' ₪';
    sumSpentEl.textContent  = fmt(spent)+' ₪';
    sumLeftEl.textContent   = fmt(left)+' ₪';
  }

  function boot(){
    // חודש ברירת מחדל = הנוכחי
    if(!monthInput.value) monthInput.value = nowMonthStr();
    current = loadMonth(monthInput.value);

    // טען הכנסה לחודש
    incomeInput.value = loadIncome(monthInput.value) || '';

    // בנה כרטיסים
    variableWrap.innerHTML=''; fixedWrap.innerHTML='';
    VARIABLE_KEYS.forEach(k=> renderCategory(variableWrap, current, k));
    FIXED_KEYS.forEach(k=> renderCategory(fixedWrap, current, k));

    refreshSummary();
  }

  // --- Events ---
  switchBtn.addEventListener('click', ()=>{
    current = loadMonth(monthInput.value);
    incomeInput.value = loadIncome(monthInput.value) || '';
    boot();
  });

  resetBtn.addEventListener('click', ()=>{
    if(!confirm('לאפס נתוני חודש זה?')) return;
    const fresh = {
      month: monthInput.value,
      budgets:{...DEFAULT_BUDGETS},
      spent:Object.fromEntries(Object.keys(DEFAULT_BUDGETS).map(k=>[k,0])),
      history:[]
    };
    saveMonth(fresh); saveIncome(monthInput.value,0);
    current = fresh; incomeInput.value='';
    boot();
  });

  exportBtn.addEventListener('click', ()=>{
    const data = {
      month: monthInput.value,
      income: loadIncome(monthInput.value),
      ...current
    };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-${data.month}.json`;
    a.click();
  });

  saveIncomeBtn.addEventListener('click', ()=>{
    const val = Number(incomeInput.value);
    if(!isNaN(val) && val>=0){ saveIncome(monthInput.value, val); refreshSummary(); }
  });

  // הפעלה
  monthInput.value = nowMonthStr();
  boot();
});
