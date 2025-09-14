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
    if (!container) return;

    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const clsByStatus = status === 'red' ? 'bg-danger' :
                        status === 'yellow' ? 'bg-warning' :
                        status === 'green' ? 'bg-success' :
                        'bg-secondary';
    const badgeClasses = status === 'yellow' ? 'text-dark' : 'text-white';

    container.innerHTML = `
        <div class="d-flex align-items-center gap-2">
        <span class="small">${pct.toFixed(2)}%</span>
        <div class="flex-grow-1">
            <div class="progress" style="height:8px;">
            <div class="progress-bar ${clsByStatus}" role="progressbar"
                style="width:${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
        </div>
        <span class="badge ${clsByStatus} ${badgeClasses}">
            ${status === 'red' ? 'Over budget' : status === 'yellow' ? 'Near limit' : status === 'green' ? 'Good' : '—'}
        </span>
        </div>
    `;
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

function openEditExpenseModal(expense) {
    const modal = new bootstrap.Modal(document.getElementById('budgetExpenseModal'));

    // Fill form values
    document.querySelector('#budgetExpenseForm [name="budget_id"]').value = expense.budget_id;
    document.querySelector('#budgetExpenseForm [name="expense_id"]').value = expense.id;
    document.querySelector('#budgetExpenseForm [name="date"]').value = expense.date;
    document.querySelector('#budgetExpenseForm [name="category"]').value = expense.category;
    document.querySelector('#budgetExpenseForm [name="description"]').value = expense.description;
    document.querySelector('#budgetExpenseForm [name="amount"]').value = expense.amount;

    // Change modal title + button
    document.getElementById('budgetExpenseModalTitle').textContent = "Edit Budget Expense";
    document.getElementById('budgetExpenseSubmitBtn').textContent = "Save Changes";

    modal.show();
}

async function loadBudgetExpenses(budgetId) {
    const container = document.getElementById("budgetExpenseLog");
    if (!container) return;

    container.innerHTML = `<div class="text-muted small">Loading expenses...</div>`;

    if (!budgetId) {
        container.innerHTML = `<div class="text-muted small">No budget selected.</div>`;
        return;
    }

    try {
        const response = await apiFetch(`/api/expenses?budget_id=${budgetId}`, { method: "GET" });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || payload.status !== 'success') {
            container.innerHTML = `<div class="text-muted small">No expenses found for this budget.</div>`;
            return;
        }

        const expenses = payload.data.expenses;

        if (!Array.isArray(expenses) || expenses.length === 0) {
            container.innerHTML = `<div class="text-muted small">No expenses found for this budget.</div>`;
            return;
        }

        // Group expenses by category
        const grouped = {};
        expenses.forEach(exp => {
            const cat = exp.category || 'Uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(exp);
        });


        // Generate HTML
        const html = Object.entries(grouped).map(([category, items]) => {
            const totalSpent = items.reduce((sum, e) => sum + Number(e.amount || 0), 0);

            const listItems = items.map(e => `
                <li class="list-group-item d-flex justify-content-between align-items-start">
                    <div class="me-3">
                        <div class="fw-medium">${escapeHtml(e.description || '')}</div>
                        <div class="small text-muted">${escapeHtml(e.date || '')}</div>
                    </div>
                    <div class="text-end">
                        <div class="fw-semibold">${formatINR(e.amount)}</div>
                        <div class="mt-1 d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 editExpenseBtn" data-id="${e.id}">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 deleteExpenseBtn" data-id="${e.id}">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </li>
            `).join('');

            return `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100 shadow-sm">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-semibold">${escapeHtml(category)}</div>
                                <div class="small text-muted">Total spent: <strong>${formatINR(totalSpent)}</strong></div>
                            </div>
                        </div>
                        <div class="card-body p-0">
                            <ul class="list-group list-group-flush">
                                ${listItems}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Attach Edit & Delete handlers
        container.querySelectorAll('.editExpenseBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const expenseId = btn.dataset.id;
                const expense = expenses.find(e => String(e.id) === String(expenseId))
                if (expense){
                    openEditExpenseModal(expense); // implement this to open your modal
                }
            });
        });

        container.querySelectorAll('.deleteExpenseBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const expenseId = btn.dataset.id;
                if (confirm('Are you sure you want to delete this expense?')) {
                    try {
                        const res = await apiFetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
                        if (res.ok) {
                            loadCurrentPlan();
                            loadFuturePlans();
                            loadBudgetExpenses(budgetId); // refresh after deletion
                        } else {
                            alert('Failed to delete expense');
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Error deleting expense');
                    }
                }
            });
        });

    } catch (err) {
        console.error('Failed to load expenses', err);
        container.innerHTML = `<div class="text-danger small">Failed to load expenses.</div>`;
    }
}

async function loadCurrentPlan() {
    const headerEl = document.getElementById('activePlanHeader');
    const meterEl = document.getElementById('activePlanMeter');
    const catsEl = document.getElementById('activePlanCategories');
    const unplannedEl = document.getElementById('activePlanUnplanned');
    const addBtn = document.getElementById('addBudgetExpenseBtn');
    const editBtn = document.getElementById('editPlanBtn');

    if (!headerEl || !meterEl) return;

    headerEl.innerHTML = `<div class="text-muted small">Loading active plan...</div>`;
    meterEl.innerHTML = '';
    if (catsEl) catsEl.innerHTML = '';
    if (unplannedEl) unplannedEl.innerHTML = '';
    if (addBtn) addBtn.disabled = true;
    if (editBtn) editBtn.disabled = true;

    const hiddenInput = document.querySelector('#budgetExpenseForm input[name="budget_id"]');
    if (hiddenInput) hiddenInput.value = '';

    try {
        const response = await apiFetch('/api/budgets/current', { method: 'GET' });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || payload.status !== 'success' || !payload.data) {
            headerEl.innerHTML = `<span class="text-muted">No active plan for today.</span>`;
            meterEl.innerHTML = '';
            if (catsEl) catsEl.innerHTML = '';
            if (unplannedEl) unplannedEl.innerHTML = '';
            if (addBtn) addBtn.disabled = true;
            if (editBtn) editBtn.disabled = true;
            if (hiddenInput) hiddenInput.value = '';
            return;
        }

        
        const budget = payload.data;
        const summary = budget.summary || {};
        const planned = Number(summary.total_limit || 0);
        const spent = Number(summary.total_spent || 0);
        const remain = Number(summary.remaining ?? (planned - spent));
        const pct = Number(summary.percent_used || 0);
        const status = summary.status || (pct > 100 ? 'red' : pct >= 80 ? 'yellow' : 'green');

        headerEl.innerHTML = `
            <div class="d-flex flex-wrap justify-content-between align-items-center">
                <div>
                    <div class="fw-semibold">${escapeHtml(budget.name || 'Untitled plan')}</div>
                    <div class="small text-muted">${escapeHtml(budget.start_date || '')} — ${escapeHtml(budget.end_date || '')}</div>
                </div>
                <ul class="list-unstyled mb-0 small text-end">
                    <li>Planned: <strong>${formatINR(planned)}</strong></li>
                    <li>Spent: <strong>${formatINR(spent)}</strong></li>
                    <li>Remaining: <strong>${formatINR(remain)}</strong></li>
                </ul>
            </div>
        `;
        setMeter(meterEl, pct, status);

        // categories list
        if (catsEl) {
            const perCat = budget.per_category || [];
            if (!perCat.length) {
                catsEl.innerHTML = `<div class="text-muted small">No categories defined for this plan.</div>`;
            } else {
                const itemsHtml = perCat.map(c => {
                    const catPct = Math.max(0, Math.min(100, Number(c.percent_used || 0)));
                    const cls = c.status === 'red' ? 'bg-danger' : c.status === 'yellow' ? 'bg-warning' : 'bg-success';

                    return `
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <span>${escapeHtml(c.category)}</span>
                                    <span class="text-muted ms-2">Planned: ${formatINR(Number(c.planned || 0))}</span>
                                </div>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary editCategoryBtn"
                                        data-budget-id="${budget.id}"
                                        data-category-id="${c.id}"
                                        data-name="${escapeHtml(c.category)}"
                                        data-limit="${c.planned}">
                                        <i class="bi bi-pencil"></i> Edit
                                    </button>
                                    <button class="btn btn-outline-danger deleteCategoryBtn mx-2"
                                        data-budget-id="${budget.id}"
                                        data-category-id="${c.id}"
                                        ${Number(c.spent || 0) > 0 ? "disabled" : ""}>
                                        <i class="bi bi-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                            <div class="d-flex justify-content-between small text-muted">
                                <span>Spent: ${formatINR(Number(c.spent || 0))}</span>
                                <span>Remaining: ${formatINR(Number(c.remaining || 0))}</span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar ${cls}" style="width: ${catPct}%;"></div>
                            </div>
                        </div>
                    `;

                }).join('');

                catsEl.innerHTML = `<div class="fw-semibold mb-2">Categories</div>${itemsHtml}`;
            }
        }

        // unplanned list
        if (unplannedEl) {
            const unplannedList = budget.unplanned || [];
            if (!unplannedList.length)  {
                unplannedEl.innerHTML = '';
            } else {
                const upHtml = unplannedList.map(u => {
                    const upPct = Math.max(0, Math.min(100, Number(u.percent_used || 0)));

                    return `
                        <div class="mb-3">
                            <div class="d-flex justify-content-between">
                                <span>${escapeHtml(u.category || 'Unplanned')}</span>
                                <span class="text-muted">Spent: ${formatINR(Number(u.spent || 0))}</span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-info" style="width: ${Math.min(100, upPct)}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
                unplannedEl.innerHTML = `<div class="fw-semibold mb-2">Unplanned Categories</div>${upHtml}`;
            }
        }

        if (addBtn) addBtn.disabled = false;
        if (editBtn) editBtn.disabled = false;
        if (hiddenInput) {
            hiddenInput.value = budget.id || '';
            loadBudgetExpenses(budget.id);
        }

    } catch (err) {
        console.error('Loading current plan failed', err);
        headerEl.innerHTML = `<span class="text-danger">Failed to load current plan.</span>`;
        meterEl.innerHTML = '';
        if (catsEl) catsEl.innerHTML = '';
        if (unplannedEl) unplannedEl.innerHTML = '';
        if (addBtn) addBtn.disabled = true;
        if (editBtn) editBtn.disabled = true;
        if (hiddenInput) hiddenInput.value = '';
    }
}

let futurePlansData = [];

async function loadFuturePlans() {
    const container = document.getElementById("futurePlansList");
    if (!container) return;

    container.innerHTML = `<div class="text-muted small">Loading future plans...</div>`;

    try {
        const response = await apiFetch('/api/budgets',{method: "GET"});
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || payload.status !== 'success') {
            container.innerHTML = `<div class="text-muted small">No data available.</div>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const future = payload.data.filter(plan => (plan.start_date || '') > today);
        futurePlansData = future;


        if (!future.length) {
            container.innerHTML = `<div class="text-muted small fst-italic">No Upcoming Plans</div>`;
            return;
        }

        const plans = (payload.data || []).filter(p => !p.is_active);
        if (!plans.length) {
            listEl.innerHTML = `(No other plans yet)`;
            return;
        }

        const html = future.map(plan => {
            const cats = (plan.per_category || []).map(cat => {
                const hasExpenses = Number(cat.spent || 0) > 0; // disable delete if spent > 0

                return `
                    <div class="mb-2 d-flex justify-content-between align-items-center">
                        <div>
                            <span>${escapeHtml(cat.category)}</span>
                            <span class="text-muted ms-2">Planned: ${formatINR(Number(cat.planned || 0))}</span>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary editCategoryBtn"
                                data-budget-id="${plan.id}"
                                data-category-id="${cat.id}"
                                data-name="${escapeHtml(cat.category)}"
                                data-limit="${cat.planned}">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-outline-danger deleteCategoryBtn mx-2"
                                data-budget-id="${plan.id}"
                                data-category-id="${cat.id}"
                                ${hasExpenses ? "disabled" : ""}>
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join('');


            return `
                <div class="border rounded p-3 mb-3">
                    <div class="fw-semibold">${escapeHtml(plan.name || 'Unnamed')}</div>
                    <div class="small text-muted mb-3">${escapeHtml(plan.start_date)} — ${escapeHtml(plan.end_date)}</div>
                    <div class="mb-2 d-flex justify-content-between">
                        <strong>Total Planned:</strong>
                        <strong>${formatINR(Number(plan.summary?.total_limit || 0))}</strong>
                    </div>
                    <hr>
                    ${cats || `<div class="text-muted small">No categories defined.</div>`}
                    <div class="mt-2 text-end">
                        <button class="btn btn-outline-secondary btn-sm editFuturePlanBtn"
                            data-budget-id="${plan.id}">
                            <i class="bi bi-pencil"></i> Edit Plan
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (err) {
        console.error("Loading other plans failed",err);
        container.innerHTML = `<div class="text-danger small">Failed to load future plans.</div>`;
    }
}

async function loadPastPlans() {
    const container = document.querySelector('#pastPlansList');
    if (!container) return;

    container.innerHTML = `<div class="text-muted small">Loading past plans...</div>`;

    try {
        const resp = await apiFetch('/api/budgets', { method: 'GET' });
        const payload = await resp.json().catch(() => null);

        if (!resp.ok || !payload || payload.status !== 'success' || !Array.isArray(payload.data)) {
            container.innerHTML = `<div class="text-muted small">No data available.</div>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const past = payload.data.filter(p => (p.end_date || '') < today);

        if (!past.length) {
            container.innerHTML = `<div class="text-muted small fst-italic">(Older plans and analysis will appear here)</div>`;
            return;
        }

        const html = past.map(plan => {
            const planned = Number(plan.summary?.total_limit || 0);
            const spent = Number(plan.summary?.total_spent || 0);
            const remain = planned - spent;
            const pct = planned > 0 ? (spent / planned) * 100 : 0;
            const status = plan.summary?.status || (pct > 100 ? 'red' : pct >= 80 ? 'yellow' : 'green');
            const barClass = status === 'red' ? 'bg-danger' : status === 'yellow' ? 'bg-warning' : 'bg-success';

            const cats = (plan.per_category || []).map(c => {
                const catRemain = (Number(c.planned || 0) - Number(c.spent || 0));
                const catPct = Number(c.percent_used || 0);
                const catClass = c.status === 'red' ? 'bg-danger' : c.status === 'yellow' ? 'bg-warning' : 'bg-success';

                return `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between">
                            <span>${escapeHtml(c.category)}</span>
                            <span class="text-muted">Planned: ${formatINR(Number(c.planned || 0))}</span>
                        </div>
                        <div class="d-flex justify-content-between small text-muted">
                            <span>Spent: ${formatINR(Number(c.spent || 0))}</span>
                            <span>Remaining: ${formatINR(catRemain)}</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar ${catClass}" style="width: ${Math.min(120, catPct)}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="border rounded p-2 mb-3">
                    <div class="fw-semibold">${escapeHtml(plan.name || 'Unnamed')}</div>
                    <div class="small text-muted">${escapeHtml(plan.start_date)} — ${escapeHtml(plan.end_date)}</div>
                    <div class="small mb-2">Planned: <strong>${formatINR(planned)}</strong> | Spent: <strong>${formatINR(spent)}</strong></div>
                    ${cats}
                    <hr>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between">
                            <span>Overall Budget Progress</span>
                            <span class="text-muted">Planned: ${formatINR(planned)}</span>
                        </div>
                        <div class="d-flex justify-content-between small text-muted">
                            <span>Spent: ${formatINR(spent)}</span>
                            <span>Remaining: ${formatINR(remain)}</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar ${barClass}" style="width: ${Math.min(120, pct)}%"></div>
                        </div>
                    </div>
                    <div class="small mt-1">Status: 
                        <span class="badge ${barClass} ${status === 'yellow' ? 'text-dark' : 'text-white'}">
                            ${status === 'red' ? 'Over Budget' : status === 'yellow' ? 'Near Limit' : 'On Track'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (err) {
        console.error('Past plans load failed', err);
        container.innerHTML = `<div class="text-danger small">Failed to load past plans.</div>`;
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

    // validation
    if (!name || !period_type || !start_date || !end_date) {
        flash.innerHTML = `<div class="alert alert-danger p-2">Name, period, start date and end date are required.</div>`;
        return;
    }

    if (new Date(start_date) > new Date(end_date)) {
        flash.innerHTML = `<div class="alert alert-danger p-2">Start date must be before or equal to end date.</div>`;
        return;
    }

    // collect categories from repeater
    const categories = collectCategories();
    if (!categories.length) {
        flash.innerHTML = `<div class="alert alert-danger p-2">Please add at least one category with a limit.</div>`;
        return;
    }

    const payload = { name, period_type, start_date, end_date};

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

        const newPlanId = pl.data.id;

        for (const category of categories) {
            await apiFetch(`/api/budgets/${newPlanId}/categories`,{
                method: "POST",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify(category)
            });
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

document.getElementById("budgetExpenseLog").addEventListener("click", async (e) => {
    if (e.target.closest('.editExpenseBtn')) {
        const id = e.target.closest('.editExpenseBtn').dataset.id;
        // Open modal in edit mode
    }
    if (e.target.closest('.deleteExpenseBtn')) {
        const id = e.target.closest('.deleteExpenseBtn').dataset.id;
        // Confirm & delete
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initCreateFormToggle();
    categoryRepeater = initCategoryRepeater();
    loadCurrentPlan();
    loadFuturePlans();
    loadPastPlans();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadCurrentPlan();
            loadFuturePlans();
            loadPastPlans();
        }
    });

    const form = document.getElementById("createPlanForm");
    if (form) form.addEventListener("submit", handleCreatePlanSubmit);
});

document.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".editCategoryBtn");
    const deleteBtn = e.target.closest(".deleteCategoryBtn");

    // EDIT CATEGORY
    if (editBtn) {
        const budgetId = editBtn.dataset.budgetId;
        const categoryId = editBtn.dataset.categoryId;
        const name = editBtn.dataset.name;
        const limit = editBtn.dataset.limit;

        // Fill the modal with current values
        const modalEl = document.getElementById("categoryEditModal");
        if (!modalEl) return;
        modalEl.querySelector("input[name='budget_id']").value = budgetId;
        modalEl.querySelector("input[name='category_id']").value = categoryId;
        modalEl.querySelector("input[name='category_name']").value = name;
        modalEl.querySelector("input[name='category_limit']").value = limit;

        // Show modal
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    //DELETE CATEGORY
    if (deleteBtn) {
        const budgetId = deleteBtn.dataset.budgetId;
        const categoryId = deleteBtn.dataset.categoryId;

        if (!confirm("Are you sure you want to delete this category?")) return;

        try {
            const resp = await apiFetch(`/api/budgets/${budgetId}/categories/${categoryId}`, {
                method: "DELETE"
            });
            const result = await resp.json().catch(() => null);

            if (!resp.ok || !result || result.status !== "success") {
                alert(result?.message || "Failed to delete category.");
                return;
            }

            // Reload plan UI
            await loadCurrentPlan();
            await loadFuturePlans();
        } catch (err) {
            console.error("Delete failed", err);
        }
    }
});

document.getElementById("categoryEditForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const budgetId = form.querySelector("input[name='budget_id']").value;
    const categoryId = form.querySelector("input[name='category_id']").value;
    const name = form.querySelector("input[name='category_name']").value.trim();
    const limit = form.querySelector("input[name='category_limit']").value;

    try {
        const resp = await apiFetch(`/api/budgets/${budgetId}/categories/${categoryId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, limit })
        });
        const result = await resp.json().catch(() => null);

        if (!resp.ok || !result || result.status !== "success") {
            alert(result?.message || "Failed to update category.");
            return;
        }

        // Hide modal
        const modalEl = document.getElementById("categoryEditModal");
        bootstrap.Modal.getInstance(modalEl)?.hide();

        // Reload plans
        await loadCurrentPlan();
        await loadFuturePlans();
    } catch (err) {
        console.error("Update failed", err);
        alert("Network error while updating category.");
    }
});

//Handle "Add Budget Expense" button click
document.getElementById("addBudgetExpenseBtn").addEventListener("click", () => {
    const modalEl = document.getElementById("budgetExpenseModal");
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
});

// Handle Add Budget Expense form submission
document.getElementById("budgetExpenseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const expenseId = form.expense_id.value;
    const budgetId = form.budget_id.value;

    const payload = {
        budget_id: budgetId,
        date: form.date.value,
        category: form.category.value,
        description: form.description.value,
        amount: parseFloat(form.amount.value)
    };

    const errorEl = document.getElementById("budgetExpenseError");
    errorEl.textContent = "";

    try {
        let response;
        if (expenseId) {
            response = await apiFetch(`/api/expenses/${expenseId}`,{
                method: "PUT",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });
        } else {
            response = await apiFetch(`/api/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        const result = await response.json().catch(() => null);

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById("budgetExpenseModal")).hide();
            form.reset();
            form.expense_id.value = '';
            document.getElementById("budgetExpenseModalTitle").textContent = "Add Budget Expense";
            document.getElementById("budgetExpenseSubmitBtn").textContent = "Add";
            
            // refresh UI
            loadCurrentPlan();
            await loadCurrentPlan();
            await loadFuturePlans();
            await loadBudgetExpenses(budgetId);
        } else {
            const errorData = await response.json();
            errorEl.textContent = errorData.message || "Error occured";
        }


    } catch (err) {
        console.error("Expense add failed", err);
        errorEl.textContent = "Network error while adding expense.";
    }
});

const editPlanBtn = document.getElementById("editPlanBtn"); // single button
if (editPlanBtn) {
    editPlanBtn.addEventListener("click", async () => {
        try {
            // fetch current plan
            const resp = await apiFetch('/api/budgets/current', { method: 'GET' });
            const payload = await resp.json();
            
            if (!resp.ok || !payload || payload.status !== 'success' || !payload.data) {
                alert("No active plan to edit.");
                return;
            }

            const plan = payload.data;

            // fill modal fields
            const modalEl = document.getElementById("editPlanModal");
            modalEl.querySelector("input[name='budget_id']").value = plan.id || '';
            modalEl.querySelector("input[name='name']").value = plan.name || '';
            modalEl.querySelector("select[name='period_type']").value = plan.period_type || 'weekly';
            modalEl.querySelector("input[name='start_date']").value = plan.start_date || '';
            modalEl.querySelector("input[name='end_date']").value = plan.end_date || '';

            // show modal
            new bootstrap.Modal(modalEl).show();

        } catch (err) {
            console.error("Failed to load current plan", err);
            alert("Network error while fetching current plan.");
        }
    });
}

document.getElementById("editPlanForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const budgetId = form.querySelector("input[name='budget_id']").value;
    const data = {
        name: form.querySelector("input[name='name']").value.trim(),
        period_type: form.querySelector("select[name='period_type']").value,
        start_date: form.querySelector("input[name='start_date']").value,
        end_date: form.querySelector("input[name='end_date']").value,
    };

    try {
        const resp = await apiFetch(`/api/budgets/${budgetId}`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: { "Content-Type": "application/json" }
        });
        const payload = await resp.json().catch(() => null);

        if (!resp.ok || !payload || payload.status !== "success") {
            form.querySelector("#editPlanError").textContent = payload?.message || "Failed to update plan";
            return;
        }

        // Success: close modal and refresh plans
        bootstrap.Modal.getInstance(document.getElementById("editPlanModal")).hide();
        await loadCurrentPlan();  // your existing function
        await loadFuturePlans();   // your existing function

    } catch (err) {
        form.querySelector("#editPlanError").textContent = "An error occurred.";
        console.error(err);
    }
});

const futurePlansContainer = document.getElementById('futurePlansList');
futurePlansContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.editFuturePlanBtn');
    if (!btn) return;

    const budgetId = btn.dataset.budgetId;
    const plan = futurePlansData.find(p => p.id == budgetId);
    if (!plan) return;

    const modalEl = document.getElementById('editPlanModal');
    modalEl.querySelector("input[name='budget_id']").value = plan.id;
    modalEl.querySelector("input[name='name']").value = plan.name;
    modalEl.querySelector("select[name='period_type']").value = plan.period_type;
    modalEl.querySelector("input[name='start_date']").value = plan.start_date;
    modalEl.querySelector("input[name='end_date']").value = plan.end_date;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
});
