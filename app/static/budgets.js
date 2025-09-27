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

async function refreshAllPlans() {
    await Promise.all([
        loadPlans("current"),
        loadPlans("future"),
        loadPlans("past")
    ]);
}

function fillModalFields(modalEl, values = {}) {
    Object.entries(values).forEach(([key, val]) => {
        const field = modalEl.querySelector(`[name='${key}']`);
        if (field) field.value = val ?? '';
    });
}

// fetch helper for budgets
async function apiRequest(url, options = {}, expect = "json") {
    try {
        const resp = await apiFetch(url, options);

        let data = null;
        if (expect === "json") {
            data = await resp.json().catch(() => null);
        } else if (expect === "text") {
            data = await resp.text().catch(() => null);
        }

        if (!resp.ok || !data || (data.status && data.status !== "success")) {
            const msg = data?.message || `Request failed (${resp.status})`;
            return { ok: false, status: resp.status, message: msg, data: null };
        }

        return { ok: true, status: resp.status, message: data?.message, data: data?.data ?? data };
    } catch (err) {
        console.error("apiRequest error:", err);
        return { ok: false, status: 0, message: "Network error", data: null };
    }
}

// Generic render dispatcher
async function loadPlans(type) {
    const containerMap = {
        current: document.getElementById("activePlanHeader"),
        future: document.getElementById("futurePlansList"),
        past: document.getElementById("pastPlansList"),
    }
    const container = containerMap[type];
    if (!container) return;

    container.innerHTML = `<div class="text-muted small">Loading ${type} plans...</div>`;

    let plan;
    if (type === 'current') {
        result = await apiRequest("/api/budgets/current");
        if (!result.ok) {
            container.innerHTML = `<span class="text-muted">No active plan for today.</span>`;
            return; 
        }
        plan = result.data;
        renderCurrentPlan(plan);
    } else {
        const result = await apiRequest("/api/budgets");
        if (!result.ok || !Array.isArray(result.data)) {
            container.innerHTML = `<div class="text-muted small">No data available.</div>`;
            return;
        }
        
        const allPlans = result.data;
        const today = new Date().toISOString().split("T")[0];
        const filtered = type === "future"
            ? allPlans.filter(p => (p.start_date || "") > today)
            : allPlans.filter(p => (p.end_date || "") < today);

        renderPlans(type, filtered, container);
    }
}

function renderCurrentPlan(budget) {
    const headerEl = document.getElementById('activePlanHeader');
    const meterEl = document.getElementById('activePlanMeter');
    const catsEl = document.getElementById('activePlanCategories');
    const unplannedEl = document.getElementById('activePlanUnplanned');
    const addBtn = document.getElementById('addBudgetExpenseBtn');
    const editBtn = document.getElementById('editPlanBtn');
    const hiddenInput = document.querySelector('#budgetExpenseForm input[name="budget_id"]');

    if (!budget) {
        headerEl.innerHTML = `<span class="text-muted">No active plan for today.</span>`;
        meterEl.innerHTML = '';
        catsEl.innerHTML = '';
        unplannedEl.innerHTML = '';
        if (addBtn) addBtn.disabled = true;
        if (editBtn) editBtn.disabled = true;
        if (hiddenInput) hiddenInput.value = '';
        return;
    }

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

    // Categories
    if (catsEl) {
        const perCat = budget.per_category || [];
        if (!perCat.length) {
            catsEl.innerHTML = `<div class="text-muted small">No categories defined for this plan.</div>`;
        } else {
            catsEl.innerHTML = `<div class="fw-semibold mb-2">Categories</div>` +
				perCat.map(c => categoryHtml(c, budget.id)).join('');
        }
    }

    // Unplanned
    if (unplannedEl) {
        const unplannedList = budget.unplanned || [];
        if (!unplannedList.length) {
            unplannedEl.innerHTML = '';
        } else {
            unplannedEl.innerHTML = `<div class="fw-semibold mb-2">Unplanned Categories</div>` +
				unplannedList.map(u => {
					const upPct = Math.max(0, Math.min(100, Number(u.percent_used || 0)));
					return `<div class="mb-3"><div class="d-flex justify-content-between"><span>${escapeHtml(u.category||'Unplanned')}</span><span class="text-muted">Spent: ${formatINR(Number(u.spent||0))}</span></div><div class="progress" style="height:8px;"><div class="progress-bar bg-info" style="width:${Math.min(100,upPct)}%"></div></div></div>`;
				}).join('');
        }
    }

    if (addBtn) addBtn.disabled = false;
    if (editBtn) editBtn.disabled = false;
    if (hiddenInput) hiddenInput.value = budget.id || '';

    loadBudgetExpenses(budget.id);
}

function renderPlans(type, plans, container) {
	if (!plans || plans.length === 0) {
		container.innerHTML = type === "future"
			? `<div class="text-muted small fst-italic">No Upcoming Plans</div>`
			: `<div class="text-muted small fst-italic">(Older plans and analysis will appear here)</div>`;
		return;
	}

	if (type === "future") futurePlansData = plans;

	container.innerHTML = plans.map(plan => {
		const totalPlanned = Number(plan.summary?.total_limit || 0);
		const totalSpent = Number(plan.summary?.total_spent || 0);
		const pct = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
		const status = plan.summary?.status || (pct > 100 ? "red" : pct >= 80 ? "yellow" : "green");
		const barClass = status === "red" ? "bg-danger" : status === "yellow" ? "bg-warning" : "bg-success";

		const catsHtml = (plan.per_category || []).map(cat => categoryHtml(cat, plan.id)).join('');

		if (type === "future") {
			return `<div class="border rounded p-3 mb-3"><div class="fw-semibold">${escapeHtml(plan.name||'Unnamed')}</div><div class="small text-muted mb-3">${escapeHtml(plan.start_date)} — ${escapeHtml(plan.end_date)}</div><div class="mb-2 d-flex justify-content-between"><strong>Total Planned:</strong><strong>${formatINR(totalPlanned)}</strong></div><hr>${catsHtml || `<div class="text-muted small">No categories defined.</div>`}<div class="mt-2 text-end"><button class="btn btn-outline-secondary btn-sm editFuturePlanBtn" data-budget-id="${plan.id}"><i class="bi bi-pencil"></i> Edit Plan</button></div></div>`;
		}

		return `<div class="border rounded p-2 mb-3"><div class="fw-semibold">${escapeHtml(plan.name||'Unnamed')}</div><div class="small text-muted">${escapeHtml(plan.start_date)} — ${escapeHtml(plan.end_date)}</div><div class="small mb-2">Planned: <strong>${formatINR(totalPlanned)}</strong> | Spent: <strong>${formatINR(totalSpent)}</strong></div><hr><div class="mb-3"><div class="d-flex justify-content-between"><span>Overall Budget Progress</span><span class="text-muted">Planned: ${formatINR(totalPlanned)}</span></div><div class="d-flex justify-content-between small text-muted"><span>Spent: ${formatINR(totalSpent)}</span><span>Remaining: ${formatINR(totalPlanned-totalSpent)}</span></div><div class="progress" style="height:8px;"><div class="progress-bar ${barClass}" style="width:${Math.min(120,pct)}%"></div></div></div><div class="small mt-1">Status:<span class="badge ${barClass} ${status === "yellow" ? "text-dark" : "text-white"}">${status === "red" ? "Over Budget" : status === "yellow" ? "Near Limit" : "On Track"}</span></div></div>`;
	}).join('');
}

//condensed loadBudgetExpenses: delegated handlers instead of per-button loops
async function loadBudgetExpenses(budgetId) {
    const container = document.getElementById("budgetExpenseLog");
    if (!container) return;

    container.innerHTML = `<div class="text-muted small">Loading expenses...</div>`;

    if (!budgetId) {
        container.innerHTML = `<div class="text-muted small">No budget selected.</div>`;
        return;
    }

    try {
        const result = await apiRequest(`/api/expenses?budget_id=${budgetId}`,{ method: "GET"});

        if (!result.ok || !Array.isArray(result.data?.expenses)) {
            container.innerHTML = `<div class="text-muted small">No expenses found for this budget.</div>`;
            return;
        }

        const expenses = result.data.expenses;

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

        const html = Object.entries(grouped).map(([category, items]) => {
            const totalSpent = items.reduce((s, e) => s + Number(e.amount || 0), 0);
            const listItems = items.map(e => `<li class="list-group-item d-flex justify-content-between align-items-start">
                    <div class="me-3"><div class="fw-medium">${escapeHtml(e.description||'')}</div><div class="small text-muted">${escapeHtml(e.date||'')}</div></div>
                    <div class="text-end"><div class="fw-semibold">${formatINR(e.amount)}</div>
                        <div class="mt-1 d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-outline-primary editExpenseBtn" data-id="${e.id}"><i class="bi bi-pencil"></i> Edit</button>
                            <button class="btn btn-sm btn-outline-danger deleteExpenseBtn" data-id="${e.id}"><i class="bi bi-trash"></i> Delete</button>
                        </div>
                    </div></li>`).join('');

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

        // delegated handler: attach once per container to handle edit/delete clicks
        if (container._budgetDelegate) container.removeEventListener('click', container._budgetDelegate);
        const delegate = async (ev) => {
            const edit = ev.target.closest('.editExpenseBtn');
            if (edit) {
                const id = edit.dataset.id;
                const expense = expenses.find(x => String(x.id) === String(id));
                if (expense) openEditExpenseModal(expense);
                return;
            }
            const del = ev.target.closest('.deleteExpenseBtn');
            if (del) {
                const id = del.dataset.id;
                if (!confirm('Are you sure you want to delete this expense?')) return;
                try {
                    const res = await apiRequest(`/api/expenses/${id}`, { method: "DELETE" });
                    if (res.ok) {
                        await refreshAllPlans();
                        await loadBudgetExpenses(budgetId);
                    } else {
                        alert(res.message || 'Failed to delete expense');
                    }
                } catch (err) {
                    alert('Error deleting expense');
                }
            }
        };
        container._budgetDelegate = delegate;
        container.addEventListener('click', delegate);

    } catch (err) {
        container.innerHTML = `<div class="text-danger small">Failed to load expenses.</div>`;
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
        const result = await apiRequest('/api/budgets', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!result.ok) {
            flash.innerHTML = `<div class="alert alert-danger p-2">${escapeHtml(result.message || 'Failed to create budget plan.')}</div>`;
            return;
        }

        const newPlanId = result.data.id;

        for (const category of categories) {
            await apiRequest(`/api/budgets/${newPlanId}/categories`,{
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
        await loadPlans("current");

    } catch (err) {
        console.error('Create plan failed', err);
        flash.innerHTML = `<div class="alert alert-danger p-2">Network error while creating plan.</div>`;
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save'; }
    }
}

/* helper: compact action buttons for a category (used by current/future/past renderers) */
function actionButtonsCat(budgetId, cat, hasExpenses=false) {
	return `<div class="btn-group btn-group-sm">
		<button class="btn btn-outline-primary editCategoryBtn" data-budget-id="${budgetId}" data-category-id="${cat.id}" data-name="${escapeHtml(cat.category)}" data-limit="${cat.planned}">
			<i class="bi bi-pencil"></i>
		</button>
		<button class="btn btn-outline-danger deleteCategoryBtn mx-2" data-budget-id="${budgetId}" data-category-id="${cat.id}" ${hasExpenses ? "disabled" : ""}>
			<i class="bi bi-trash"></i>
		</button>
	</div>`;
}

/* helper: compact category block (single-line-ish) */
function categoryHtml(cat, budgetId) {
	const hasExpenses = Number(cat.spent || 0) > 0;
	const cls = cat.status === 'red' ? 'bg-danger' : cat.status === 'yellow' ? 'bg-warning' : 'bg-success';
	const pct = Math.max(0, Math.min(100, Number(cat.percent_used || 0)));
	return `<div class="mb-2 d-flex justify-content-between align-items-center">
		<div><span>${escapeHtml(cat.category)}</span><span class="text-muted ms-2">Planned: ${formatINR(Number(cat.planned||0))}</span></div>
		${actionButtonsCat(budgetId, cat, hasExpenses)}
	</div>
	<div class="small text-muted d-flex justify-content-between"><span>Spent: ${formatINR(Number(cat.spent||0))}</span><span>Remaining: ${formatINR(Number(cat.remaining||0))}</span></div>
	<div class="progress" style="height:8px;"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>`;
}

// selector cache + small helpers (added)
const EL = {};
function cacheSelectors() {
	EL.createPlanForm = document.getElementById("createPlanForm");
	EL.toggleCreateForm = document.getElementById("toggleCreateForm");
	EL.createPlanBody = document.getElementById("createPlanBody");
	EL.addCategoryBtn = document.getElementById("addCategoryBtn");
	EL.categoryList = document.getElementById("categoryList");
	EL.activePlanHeader = document.getElementById("activePlanHeader");
	EL.activePlanMeter = document.getElementById("activePlanMeter");
	EL.activePlanCategories = document.getElementById("activePlanCategories");
	EL.activePlanUnplanned = document.getElementById("activePlanUnplanned");
	EL.futurePlansList = document.getElementById("futurePlansList");
	EL.pastPlansList = document.getElementById("pastPlansList");
	EL.budgetExpenseLog = document.getElementById("budgetExpenseLog");
	EL.addBudgetExpenseBtn = document.getElementById("addBudgetExpenseBtn");
	EL.budgetExpenseModal = document.getElementById("budgetExpenseModal");
	EL.budgetExpenseForm = document.getElementById("budgetExpenseForm");
	EL.budgetExpenseError = document.getElementById("budgetExpenseError");
	EL.budgetExpenseModalTitle = document.getElementById("budgetExpenseModalTitle");
	EL.budgetExpenseSubmitBtn = document.getElementById("budgetExpenseSubmitBtn");
	EL.editPlanBtn = document.getElementById("editPlanBtn");
	EL.editPlanModal = document.getElementById("editPlanModal");
	EL.editPlanForm = document.getElementById("editPlanForm");
	EL.categoryEditModal = document.getElementById("categoryEditModal");
	EL.categoryEditForm = document.getElementById("categoryEditForm");
}
function showError(el, msg) {
	if (!el) return;
	el.textContent = msg || "";
}

// Replace scattered top-level listeners with a single guarded initializer
document.addEventListener('DOMContentLoaded', async () => {
	// cache selectors and init UI
	cacheSelectors();
	if (EL.toggleCreateForm && EL.createPlanBody) initCreateFormToggle();
	categoryRepeater = initCategoryRepeater();

	// initial data load
	await refreshAllPlans();

	// refresh when tab visible
	document.addEventListener('visibilitychange', async () => {
		if (document.visibilityState === 'visible') await refreshAllPlans();
	});

	// Create plan submit
	if (EL.createPlanForm) {
		EL.createPlanForm.addEventListener('submit', (e) => {
			if (typeof handleCreatePlanSubmit === 'function') return handleCreatePlanSubmit(e);
		});
	}

	// delegate category edit/delete and future-plan edit via document
	document.addEventListener('click', async (e) => {
		// edit category
		const editCat = e.target.closest('.editCategoryBtn');
		if (editCat) {
			const modalEl = EL.categoryEditModal;
			if (!modalEl) return;
			fillModalFields(modalEl, {
				budget_id: editCat.dataset.budgetId,
				category_id: editCat.dataset.categoryId,
				category_name: editCat.dataset.name,
				category_limit: editCat.dataset.limit
			});
			new bootstrap.Modal(modalEl).show();
			return;
		}

		// delete category
		const delCat = e.target.closest('.deleteCategoryBtn');
		if (delCat) {
			const budgetId = delCat.dataset.budgetId;
			const categoryId = delCat.dataset.categoryId;
			if (!confirm("Are you sure you want to delete this category?")) return;
			try {
				const result = await apiRequest(`/api/budgets/${budgetId}/categories/${categoryId}`, { method: "DELETE" });
				if (!result.ok) { alert(result.message || "Failed to delete category."); return; }
				await refreshAllPlans();
			} catch (err) {
				alert("Network error while deleting category.");
			}
			return;
		}

		// edit future plan
		const editFuture = e.target.closest('.editFuturePlanBtn');
		if (editFuture) {
			const id = editFuture.dataset.budgetId;
			const plan = futurePlansData.find(p => p.id == id);
			if (!plan) return;
			const modalEl = EL.editPlanModal;
			fillModalFields(modalEl, { budget_id: plan.id, name: plan.name, period_type: plan.period_type, start_date: plan.start_date, end_date: plan.end_date });
			new bootstrap.Modal(modalEl).show();
			return;
		}
	});

	// category edit form submit (guarded; uses EL)
	if (EL.categoryEditForm) {
		EL.categoryEditForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const form = e.target;
			const budgetId = form.querySelector("input[name='budget_id']").value;
			const categoryId = form.querySelector("input[name='category_id']").value;
			const name = form.querySelector("input[name='category_name']").value.trim();
			const limit = form.querySelector("input[name='category_limit']").value;
			try {
				const result = await apiRequest(`/api/budgets/${budgetId}/categories/${categoryId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name, limit })
				});
				if (!result.ok) { alert(result.message || "Failed to update category."); return; }
				bootstrap.Modal.getInstance(EL.categoryEditModal)?.hide();
				await refreshAllPlans();
			} catch (err) {
				alert("Network error while updating category.");
			}
		});
	}

	// Add Budget Expense — open modal (guarded)
	if (EL.addBudgetExpenseBtn) {
		EL.addBudgetExpenseBtn.addEventListener('click', () => {
			const modalEl = EL.budgetExpenseModal;
			if (!modalEl) return;
			const form = modalEl.querySelector('form');
			form.reset();
			if (form.expense_id) form.expense_id.value = '';
			if (EL.budgetExpenseModalTitle) EL.budgetExpenseModalTitle.textContent = "Add Budget Expense";
			if (EL.budgetExpenseSubmitBtn) EL.budgetExpenseSubmitBtn.textContent = "Add";
			new bootstrap.Modal(modalEl).show();
		});
	}

	// Budget Expense form submit (guarded) — use apiRequest and showError
	if (EL.budgetExpenseForm) {
		EL.budgetExpenseForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const form = e.target;
			const expenseId = form.expense_id?.value || '';
			const budgetId = form.budget_id?.value || '';
			const payload = {
				budget_id: budgetId,
				date: form.date.value,
				category: form.category.value,
				description: form.description.value,
				amount: parseFloat(form.amount.value)
			};
			const errEl = EL.budgetExpenseError;
			if (errEl) errEl.textContent = "";
			try {
				let result;
				if (expenseId) {
					result = await apiRequest(`/api/expenses/${expenseId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
				} else {
					result = await apiRequest(`/api/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
				}
				if (result.ok) {
					bootstrap.Modal.getInstance(EL.budgetExpenseModal)?.hide();
					form.reset();
					if (form.expense_id) form.expense_id.value = '';
					if (EL.budgetExpenseModalTitle) EL.budgetExpenseModalTitle.textContent = "Add Budget Expense";
					if (EL.budgetExpenseSubmitBtn) EL.budgetExpenseSubmitBtn.textContent = "Add";
					await refreshAllPlans();
					await loadBudgetExpenses(budgetId);
				} else {
					if (errEl) errEl.textContent = result.message || "Error occurred";
				}
			} catch (err) {
				if (errEl) errEl.textContent = "Network error while adding expense.";
			}
		});
	}

	// Edit Plan button & form (guarded)
	if (EL.editPlanBtn) {
		EL.editPlanBtn.addEventListener('click', async () => {
			try {
				const result = await apiRequest('/api/budgets/current', { method: 'GET' });
				if (!result.ok) { alert("No active plan to edit."); return; }
				const plan = result.data;
				fillModalFields(EL.editPlanModal, { budget_id: plan.id || '', name: plan.name || '', period_type: plan.period_type || '', start_date: plan.start_date || '', end_date: plan.end_date || '' });
				new bootstrap.Modal(EL.editPlanModal).show();
			} catch (err) {
				alert("Network error while fetching current plan.");
			}
		});
	}
	if (EL.editPlanForm) {
		EL.editPlanForm.addEventListener('submit', async (e) => {
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
				const result = await apiRequest(`/api/budgets/${budgetId}`, { method: "PUT", body: JSON.stringify(data), headers: { "Content-Type": "application/json" }});
				if (!result.ok) { form.querySelector("#editPlanError").textContent = result?.message || "Failed to update plan"; return; }
				bootstrap.Modal.getInstance(EL.editPlanModal)?.hide();
				await refreshAllPlans();
			} catch (err) {
				form.querySelector("#editPlanError").textContent = "An error occurred.";
			}
		});
	}
});