let currentExpenses = [];
let currentEditId = null;
let addModalInstance = null;

const totalExpensesEl = document.querySelector("#totalExpenses");
const recentTransactionsEl = document.querySelector("#recentTransactions");
const expensesByCategoryEl = document.querySelector("#expensesByCategory");
const addForm = document.querySelector("#addExpenseForm");
const addModalEl = document.querySelector("#addExpenseModal");
const flashMessageEl = document.querySelector("#flashMessage");

/* Utility Functions */
function showFlash(message, type) {
    flashMessageEl.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`
}

function resetExpenseModal(title="Add Expense",btnText="Add") {
    addForm.reset();
    currentEditId = null;
    const modalTitle = addModalEl.querySelector(".modal-title");
    const submitBtn = addModalEl.querySelector("button[type='submit']");
    if (modalTitle) modalTitle.textContent = title;
    if (submitBtn) submitBtn.textContent = btnText;
}

/* Rendering Functions */
function renderTotalExpenses(expenses) {
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    totalExpensesEl.textContent = `₹${total.toFixed(2)}`;
}

function renderRecentTransactions(expenses) {
    recentTransactionsEl.innerHTML = "";
    if (expenses.length === 0) {
        recentTransactionsEl.innerHTML = `<li class="list-group-item text-muted">No recent transactions</li>`;
        return;
    }

    expenses.slice(0,5).forEach(exp => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
            <div>
                <div class="fw-semibold">${exp.category}</div>
                <small class="text-muted">${exp.date} - ${exp.description || "No description"}</small>
            </div>
            <span class="fw-bold">₹${exp.amount}</span>
        `;
        recentTransactionsEl.appendChild(li);
    });
}

function renderExpensesByCategory(expenses) {
    expensesByCategoryEl.innerHTML = "";
    if (expenses.length === 0) {
        expensesByCategoryEl.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-wallet2 me-2"></i>No expenses yet. Click <strong>Add Expense</strong> to create one.
            </div>`;
        return;
    }

    // Group expenses by category
    const grouped = {};
    expenses.forEach(exp => {
        if (!grouped[exp.category]) grouped[exp.category] = [];
        grouped[exp.category].push(exp);
    });

    Object.keys(grouped).forEach(category => {
        const col = document.createElement("div");
        col.className = "col-12 col-md-6 col-lg-4";

        const card = document.createElement("div");
        card.className = "card h-100 shadow-sm";

        const cardHeader = document.createElement("div");
        cardHeader.className = "card-header d-flex justify-content-between align-items-center";

        const headerTitle = document.createElement("div");
        headerTitle.innerHTML = `
            <div class="fw-semibold">${category}</div>
            <div class="small text-muted">
                Total spent: <strong>₹${grouped[category].reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}</strong>
            </div>`;

        cardHeader.appendChild(headerTitle);
        card.appendChild(cardHeader);

        const cardBody = document.createElement("div");
        cardBody.className = "card-body p-0";

        const list = document.createElement("ul");
        list.className = "list-group list-group-flush";

        grouped[category].forEach(exp => {
            const item = document.createElement("li");
            item.className = "list-group-item d-flex justify-content-between align-items-start";

            item.innerHTML = `
                <div class="me-3">
                    <div class="fw-medium">${exp.description || "No description"}</div>
                    <div class="small text-muted">${exp.date}</div>
                </div>
                <div class="text-end">
                    <div class="fw-semibold">₹${exp.amount.toFixed(2)}</div>
                    <div class="mt-1 d-flex gap-2 justify-content-end">
                        <button class="btn btn-sm btn-outline-primary editBtn d-flex align-items-center gap-1" data-id="${exp.id}">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger deleteBtn d-flex align-items-center gap-1" data-id="${exp.id}">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>`;

            list.appendChild(item);
        });

        cardBody.appendChild(list);
        card.appendChild(cardBody);
        col.appendChild(card);
        expensesByCategoryEl.appendChild(col);
    });
}

async function loadExpenses() {
    try {
        const response = await apiFetch("/api/expenses",{ method: "GET"});
        const data = await response.json();
    
        if (data.status !== "success") throw new Error(data.message);
    
        currentExpenses = data.data.expenses || [];
        renderTotalExpenses(currentExpenses);
        renderRecentTransactions(currentExpenses);
        renderExpensesByCategory(currentExpenses);

    } catch (err) {
        console.error("Error loading Expenses:",err);
        showFlash("Failed to load Expenses","danger");
    }
}

addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(addForm);
    const payload = Object.fromEntries(formData.entries());

    let url = "/api/expenses";
    let method = "POST";

    if (currentEditId) {
        url = `/api/expenses/${currentEditId}`;
        method = "PUT";
    }

    const response = await apiFetch(url,{
        method,
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === "success") {
        await loadExpenses();
        addForm.reset();
        currentEditId = null;
        addModalInstance = bootstrap.Modal.getInstance(document.getElementById("addExpenseModal"));
        if (addModalInstance) addModalInstance.hide();
        showFlash(data.message, 'success');
    } else {
        showFlash(data.message, 'danger');
    }
});

expensesByCategoryEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".editBtn");
    const deleteBtn = e.target.closest(".deleteBtn");

    if (editBtn) {
        const id = editBtn.dataset.id;
        if (!id) return;

        const expense = currentExpenses.find(e => String(e.id) === String(id));
        if (!expense) {
            showFlash("Could not find expense to edit.", "danger");
            return;
        }

        const dateInput = document.querySelector("input[name='date']");
        const categoryInput = document.querySelector("input[name='category']");
        const descriptionInput = document.querySelector("input[name='description']");
        const amountInput = document.querySelector("input[name='amount']");

        if (dateInput) dateInput.value = expense.date ?? "";
        if (categoryInput) categoryInput.value = expense.category ?? "";
        if (descriptionInput) descriptionInput.value = expense.description ?? "";
        if (amountInput) amountInput.value = expense.amount ?? "";

        currentEditId = id;

        const modalTitle = document.querySelector("#addExpenseModal .modal-title");
        if (modalTitle) modalTitle.textContent = "Edit Expense";

        const submitBtn = document.querySelector("#addExpenseModal button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Save";

        if (addModalInstance) addModalInstance.show();
        return;
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (!id) return;
        if (!confirm("Are you sure you want to delete the expense?")) return;

        try {
            deleteBtn.disabled= true;
            const response = await apiFetch(`/api/expenses/${id}`,{method: 'DELETE'});
            const payload = await response.json();

            if (payload.status === "success") {
                showFlash(payload.message,"success")
                await loadExpenses();
            } else {
                showFlash(payload.message || "Failed to delete expense","danger");
            }
        } catch (err) {
            console.error("Error while deleting expense:",err);
            showFlash("Network error while deleting expense","danger");
        } finally {
            deleteBtn.disabled = false;
        }
        return;
    }
});

async function fetchAndRenderDashboardBudget() {
    const overviewEl = document.getElementById("dashboardBudgetOverview");
    const detailsEl = document.getElementById("dashboardBudgetDetails");
    const percentLabel = document.getElementById("dashboardBudgetPercentLabel");
    const progressBar = document.getElementById("dashboardBudgetProgressBar");
    const statusBadge = document.getElementById("dashboardBudgetStatusBadge");

    if (!overviewEl || !detailsEl || !percentLabel || !progressBar || !statusBadge) return;

    overviewEl.innerHTML = '<div class="text-muted small">Loading current plan…</div>';
    detailsEl.innerHTML = '';

    try {
        const response = await apiFetch('/api/budgets/current',{ method: 'GET'});
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || payload.status !== "success" || !payload.data) {
            overviewEl.innerHTML = `<div class="text-muted small">No active plan. <a href="/budgets">Create one</a></div>`;
            detailsEl.innerHTML = '';
            setBudgetMeter(0,'none');
            return;
        }

        const budget = payload.data;
        const summary = budget.summary || { total_limit: 0, total_spent: 0, remaining: 0, percent_used: 0, status: 'green' };

        const name = ( budget.name || 'Untitled plan' );
        const start = ( budget.start_date || '' );
        const end = ( budget.end_date || '');
        overviewEl.innerHTML = `<div class="fw-semibold">${escapeHtml(name)}</div>
        <div class="small text-muted">${escapeHtml(start)} — ${escapeHtml(end)}</div>`;

        const planned = Number(summary.total_limit || 0);
        const spent = Number(summary.total_spent || 0);
        const remaining = Number(summary.remaining || (planned - spent));
        const categoriesCount = (budget.categories && budget.categories.length) ? budget.categories.length : 0;

        detailsEl.innerHTML = `
      <li>Planned: <strong>₹${planned.toFixed(2)}</strong></li>
      <li>Spent: <strong>₹${spent.toFixed(2)}</strong></li>
      <li>Remaining: <strong>₹${remaining.toFixed(2)}</strong></li>
      <li>Categories: <strong>${categoriesCount}</strong></li>
    `;

    const percent = Number(summary.percent_used || 0);
    const status = summary.status || (percent > 100 ? 'red' : percent >= 80 ? 'yellow' : 'green');
    setBudgetMeter(percent,status);
        
    } catch (err) {
        console.error('fetching and rendering dashboard budget error',err);
        overviewEl.innerHTML = `<div class="text-danger small">Failed to load budget overview</div>`;
        detailsEl.innerHTML = '';
        setBudgetMeter(0, 'none');
    }
}

function setBudgetMeter(percent,status) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const label = document.getElementById("dashboardBudgetPercentLabel");
    const bar = document.getElementById("dashboardBudgetProgressBar");
    const badge = document.getElementById("dashboardBudgetStatusBadge");

    if (!label || !bar || !badge) return;

    label.textContent = pct.toFixed(2) + '%';
    bar.style.width = pct + '%';
    bar.setAttribute('aria-valuenow',String(pct));

    bar.className = 'progress-bar';
    badge.className = 'badge text-white';

    if (status === 'green') {
        bar.classList.add('bg-success');
        badge.classList.add('bg-success');
        badge.textContent = 'Good';
    } else if (status === 'yellow') {
        bar.classList.add('bg-warning');
        badge.classList.add('bg-warning', 'text-dark');
        badge.textContent = 'Near limit';
    } else if (status === 'red') {
        bar.classList.add('bg-danger');
        badge.classList.add('bg-danger');
        badge.textContent = 'Over budget';
    } else {
        bar.style.width = '0%';
        badge.classList.add('bg-secondary');
        badge.textContent = '—';
    }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener("DOMContentLoaded", () => {
    // --- Initialize modal ---
    addModalInstance = new bootstrap.Modal(addModalEl);

    // --- Add Expense button opens modal ---
    document.getElementById("addExpenseBtn").addEventListener("click", () => {
        resetExpenseModal("Add Expense", "Add");
        if (addModalInstance) addModalInstance.show();
    });

    // --- Reset modal when hidden ---
    addModalEl.addEventListener("hidden.bs.modal", () => {
        resetExpenseModal("Add Expense", "Add");
    });

    // --- Initial data fetches ---
    loadExpenses();
    fetchAndRenderDashboardBudget();

    // --- Refresh budget when tab regains focus ---
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            fetchAndRenderDashboardBudget();
        }
    });
}); 