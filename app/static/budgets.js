function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatINR(n) {
  const num = Number(n || 0);
  return '₹' + num.toFixed(2);
}

function setMeter(container, percent, status) {
    const shell = container;
    if (!shell) return;

    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const clsByStatus = status === 'red' ? 'bg-danger'
                        : status === 'yellow' ? 'bg-warning'
                        : status === 'green' ? 'bg-success'
                        : 'bg-secondary';
    
    shell.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <span class="small">${pct.toFixed(2)}%</span>
            <div class="flex-grow-1">
                <div class="progress" style="height:8px;">
                    <div class="progress-bar ${clsByStatus}" role="progressbar"
                        style="width:${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
            <span class="badge ${clsByStatus} ${status==='yellow' ? 'text-dark' : 'text-white'}">
                ${status === 'red' ? 'Over budget' : status === 'yellow' ? 'Near limit' : status === 'green' ? 'Good' : '—'}
            </span>
        </div>`;
}

let createFormShown = false;

function initCreateFormToggle() {
    const toggleBtn = document.getElementById('toggleCreateForm');
    const body = document.getElementById('createPlanBody');
    if (!toggleBtn || !body) return;

    function renderState() {
        if (createFormShown) {
            body.classList.add('show');
            toggleBtn.textContent = 'Hide';
        } else {
            body.classList.remove('show');
            toggleBtn.textContent = 'Show';
        }
    }

    toggleBtn.addEventListener('click', () => {
        createFormShown = !createFormShown;
        renderState();
    });

    renderState();
}

function initCategoryRepeater() {
    const list = document.getElementById('categoryList');
    const addBtn = document.getElementById('addCategoryBtn');
    if (!list || !addBtn) return;

    function addRow(initial = {category: '', limit: ''}) {
        const row = document.createElement('div');
        row.className = 'row g-2 align-items-center mb-2';
        row.innerHTML = `
            <div class="col-md-7">
                <input class="form-control" name="category_name" placeholder="Category Name" value="${escapeHtml(initial.category)}" autocomplete="off" required />
            </div>
            <div class="col-md-3">
                <input type="number" step="0.01" class="form-control" name="category_limit" placeholder="Limit" value="${escapeHtml(initial.limit)}" autocomplete="off" required />
            </div>
            <div class="col-md-2 d-grid">
                <button type="button" class="btn btn-outline-danger removeCatBtn"><i class="bi bi-x"></i></button>
            </div>
        `;
        list.appendChild(row);
    }

    addBtn.addEventListener('click', () => addRow());

    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.removeCatBtn');
        if (!btn) return;
        const row = btn.closest('.row');
        if (row) row.remove();
    });

    if (!list.children.length) addRow();

    return { addRow };
}

async function loadCurrentPlan() {
    const statsEl = document.getElementById('overviewStats');
    const meterEl = document.getElementById('overviewMeter');
    const addBtn = document.getElementById('addBudgetExpenseBtn');
    const editBtn = document.getElementById('editPlanBtn');
    
    if (!statsEl || !meterEl) return;
    
    try {
        const response = await apiFetch('/api/budgets/current', { method: 'GET'});
        const payload = await response.json().catch(() => null);
        
        if (!response.ok || !payload || payload.status !== 'success' || !payload.data) {
            statsEl.innerHTML = `<span class="text-muted">No active plan yet. Create one above.</span>`;
            setMeter(meterEl, 0, 'none');
            if (addBtn) addBtn.disabled = true;
            if (editBtn) editBtn.disabled = true;
            return;
        }
        
        const budget = payload.data;
        const summary = budget.summary || {};
        const planned = Number(summary.total_limit || 0);
        const spent = Number(summary.total_spent || 0);
        const remain = Number(summary.remaining ?? (planned - spent));
        const pct = Number(summary.percent_used || 0);
        const status = summary.status || (pct > 100 ? 'red' : pct >=80 ? 'yellow' : 'green');

        statsEl.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-center">
        <div>
        <div class="fw-semibold">${escapeHtml(budget.name || 'Untitled plan')}</div>
        <div class="small text-muted">${escapeHtml(budget.start_date || '')} — ${escapeHtml(budget.end_date || '')}</div>
        </div>
        <ul class="list-unstyled mb-0 small">
        <li>Planned: <strong>${formatINR(planned)}</strong></li>
        <li>Spent: <strong>${formatINR(spent)}</strong></li>
        <li>Remaining: <strong>${formatINR(remain)}</strong></li>
        </ul>
        </div>
        `;
        
        setMeter(meterEl, pct, status);
        
        if (addBtn) addBtn.disabled = false;
        if (editBtn) editBtn.disabled = false;
        
        const hiddenBudgetId = document.querySelector('#budgetExpenseForm input[name="budget_id"]');
        if (hiddenBudgetId) hiddenBudgetId.value = budget.id;
    } catch (err) {
        console.error('Loading current plan failed', err);
        statsEl.innerHTML = `<span class="text-danger">Failed to load current plan.</span>`;
        setMeter(meterEl, 0, 'none');
        if (addBtn) addBtn.disabled = true;
        if (editBtn) editBtn.disabled = true;
    }
}

function collectCategories() {
    const list = document.getElementById("categoryList");
    if (!list) return [];
    
    const rows = Array.from(list.querySelectorAll(':scope > .row'));
    const categories = [];
    for (const row of rows) {
        const nameInput = row.querySelector('input[name="category_name"]');
        const limitInput = row.querySelector('input[name="category_limit"]');
        const name = nameInput ? (nameInput.value || '').trim() : '';
        const limitRaw = limitInput ? limitInput.value : '';
        const limit = limitRaw === '' ? null : Number(limitRaw);
        if (!name) continue;
        categories.push({category: name, limit: limit === null ? 0 : limit});
    }
    
    return categories;
}

let categoryRepeater = null;

async function handleCreatePlanSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const name = (form.elements['name']?.value || '').trim();
  const period_type = (form.elements['period_type']?.value || '').trim();
  const start_date = (form.elements['start_date']?.value || '').trim();
  const end_date = (form.elements['end_date']?.value || '').trim();

  let flash = document.getElementById("createPlanFlash");
  if (!flash) {
    flash = document.createElement('div');
    flash.id = "createPlanFlash";
    flash.className = "mt-2";
    form.prepend(flash);
  }
  flash.innerHTML = "";

  // basic validation
  if (!name || !period_type || !start_date || !end_date) {
    flash.innerHTML = `<div class="alert alert-danger p-2">Name, period, start date and end date are required.</div>`;
    return;
  }

  if (new Date(start_date) > new Date(end_date)) {
    flash.innerHTML = `<div class="alert alert-danger p-2">Start date must be before or equal to end date.</div>`;
    return;
  }

  // collect categories from repeater (do NOT re-init the repeater here)
  const categories = collectCategories();
  if (!categories.length) {
    flash.innerHTML = `<div class="alert alert-danger p-2">Please add at least one category with a limit.</div>`;
    return;
  }

  const payload = { name, period_type, start_date, end_date, categories };

  // disable submit while saving
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

  try {
    const response = await apiFetch('/api/budgets', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const pl = await response.json().catch(() => null);

    if (!response.ok || !pl || pl.status !== 'success') {
      const msg = pl && pl.message ? pl.message : 'Failed to create budget plan.';
      flash.innerHTML = `<div class="alert alert-danger p-2">${escapeHtml(msg)}</div>`;
      return;
    }

    // success — create a proper alert element so classes aren't accidentally overridden
    flash.innerHTML = '';
    const alertEl = document.createElement('div');
    alertEl.className = 'alert alert-success p-2';
    alertEl.setAttribute('role', 'alert');
    alertEl.textContent = 'Budget created successfully.';
    flash.appendChild(alertEl);

    // reset form and repeater rows
    form.reset();
    const list = document.getElementById('categoryList');
    if (list) list.innerHTML = '';
    // re-add a single empty row via the repeater API (captured on DOMContentLoaded)
    categoryRepeater?.addRow();

    // collapse the create form safely
    const createBody = document.getElementById('createPlanBody');
    if (createBody) {
      const bsCollapse = bootstrap.Collapse.getInstance(createBody) || new bootstrap.Collapse(createBody, { toggle: false });
      bsCollapse.hide();
      createFormShown = false;
      const toggleBtn = document.getElementById('toggleCreateForm');
      if (toggleBtn) toggleBtn.textContent = 'Show';
    }

    // refresh overview
    await loadCurrentPlan();

  } catch (err) {
    console.error('Create plan failed', err);
    flash.innerHTML = `<div class="alert alert-danger p-2">Network error while creating plan.</div>`;
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
    initCreateFormToggle();
    categoryRepeater = initCategoryRepeater();
    loadCurrentPlan();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') loadCurrentPlan();
    });

    const form = document.getElementById("createPlanForm");
    if (form) form.addEventListener("submit", handleCreatePlanSubmit);
});