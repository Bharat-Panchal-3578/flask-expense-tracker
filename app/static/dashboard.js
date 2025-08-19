const tableBody = document.querySelector("#expensesTable tbody");
const totalExpenses = document.querySelector("#totalExpenses");
const recentTransactions = document.querySelector("#recentTransactions");
const addForm = document.getElementById("addExpenseForm");

let currentExpenses = [];
let currentEditId = null;
let addModalInstance = null;

async function loadExpenses() {
    const response = await fetch("/api/expenses", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        }
    });
    const data = await response.json();

    if (data.status === "success") {
        const expenses = data.data.expenses;
        currentExpenses = expenses;
        tableBody.innerHTML = '';
        recentTransactions.innerHTML = '';

        if (expenses.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-wallet2 me-2"></i>
                        No expenses yet. Click <strong>Add Expense</strong> to create your first one.
                    </td>
                </tr>
            `;
            recentTransactions.innerHTML = `<li class="text-muted">No recent transactions</li>`;
            totalExpenses.textContent = `₹0.00`;
            return;
        }

        let total = 0;
        expenses.forEach((exp, idx) => {
            total += parseFloat(exp.amount);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${exp.date}</td>
                <td>${exp.category}</td>
                <td>${exp.description}</td>
                <td>₹${exp.amount}</td>
                <td>
                    <button class="btn btn-sm btn-warning editBtn" data-id="${exp.id}">Edit</button>
                    <button class="btn btn-sm btn-danger deleteBtn" data-id="${exp.id}">Delete</button>
                </td>`;
            tableBody.appendChild(row);

            if (idx < 5) {
                const li = document.createElement("li");
                li.textContent = `${exp.date} - ${exp.category} - ₹${exp.amount}`;
                recentTransactions.appendChild(li);
            }
        });

        totalExpenses.textContent = `₹${total.toFixed(2)}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    addModalInstance = new bootstrap.Modal(document.getElementById("addExpenseModal"));
    document.getElementById("addExpenseBtn").addEventListener("click", () => {
        currentEditId = null;
        const modalTitle = document.querySelector("#addExpenseModal .modal-title");
        if (modalTitle) modalTitle.textContent = "Add Expense";

        const submitBtn = document.querySelector("#addExpenseModal button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Add";

        addForm.reset();

        addModalInstance.show();
    });
    loadExpenses();

    document.getElementById("addExpenseModal").addEventListener("hidden.bs.modal",() => {
        currentEditId = null;
        addForm.reset();
        const modalTitle = document.querySelector("#addExpenseModal .modal-title");
        if (modalTitle) modalTitle.textContent = "Add Expense";
        const submitBtn = document.querySelector("#addExpenseModal button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Add";
    })
});

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

    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === "success") {
        loadExpenses();
        addForm.reset();
        currentEditId = null;
        addModalInstance = bootstrap.Modal.getInstance(document.getElementById("addExpenseModal"));
        if (addModalInstance) addModalInstance.hide();
        showFlash(data.message, 'success');
    } else {
        showFlash(data.message, 'danger');
    }
});

function showFlash(message, type) {
    document.getElementById("flashMessage").innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

tableBody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".editBtn");
    const deleteBtn = e.target.closest(".deleteBtn");

    if (editBtn) {
        const id = editBtn.dataset.id;
        if (!id) return;

        const expense = currentExpenses.find(e => String(e.id) === String(id));
        if (!expense) {
            showFlash("Could not find expense to edit.","danger");
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
        (async () => {
            const id = deleteBtn.dataset.id;
            if (!id) return;

            if (!confirm("Are you sure you want to delete the expense?")) return;

            try {
                deleteBtn.disabled = true;

                const response = await fetch(`/api/expenses/${id}`,{
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        'Authorization': `Bearer ${localStorage.getItem("access_token")}`
                    }
                });

                if (!response.ok) {
                    const txt = await response.text().catch(() => "");
                    console.error("DELETE /api/expenses failed:",response.status,txt);
                    showFlash("Server error while deleting expense.","danger");
                    deleteBtn.disabled = false;
                    return;
                }

                const payload = await response.json();
                const ok = payload && payload.status === "success";

                showFlash(payload.message,"success");

                if (ok) await loadExpenses();

            } catch (error) {
                console.error("Error deleting expense:",error);
                showFlash('Network error while deleting expense',"danger");
            } finally {
                deleteBtn.disabled = false;
            }
        })();
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

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderDashboardBudget();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') fetchAndRenderDashboardBudget();
    });
});