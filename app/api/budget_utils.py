from decimal import Decimal, InvalidOperation, getcontext
from sqlalchemy import func
from app.extensions import db
from app.models import Expense, BudgetCategory
from datetime import date

getcontext().prec = 28

green_threshold= Decimal("80")
yellow_min = Decimal("80")
yellow_max = Decimal("100")

def _to_decimal(value):
    if value is None:
        return Decimal("0")
    if isinstance(value,Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")

def status_from_decimal(percent_decimal: Decimal) -> str:
    """Returns status string based on percent used (Decimal)"""
    if percent_decimal < green_threshold:
        return "green"
    if yellow_min <= percent_decimal <= yellow_max:
        return "yellow"
    return "red"

def compute_budget_totals(budget):
    """
    Compute overall totals for a Budget object.
    Returns dict:
      {
        "total_limit": Decimal,
        "total_spent": Decimal,
        "remaining": Decimal,
        "percent_used": Decimal,   # percent, not fraction (e.g., 42.5 means 42.5%)
        "status": "green"|"yellow"|"red"
      }
    Notes: budget must have .id, .start_date, .end_date
    """

    total_limit = _to_decimal(budget.total_limit())

    total_spent = db.session.query(
        func.coalesce(func.sum(Expense.amount),0)
    ).filter(
        Expense.budget_id == budget.id,
        Expense.date >= budget.start_date,
        Expense.date <= budget.end_date
    ).scalar()

    total_spent = _to_decimal(total_spent)

    remaining = total_limit - total_spent

    if total_limit == Decimal("0"):
        percent_used = Decimal("0") if total_spent == Decimal("0") else (total_spent * Decimal("100"))
    
    else:
        percent_used = (total_spent/total_limit) * Decimal("100")

    percent_used = percent_used.quantize(Decimal("0.01"))

    return {
        "total_limit":total_limit,
        "total_spent":total_spent,
        "remaining":remaining,
        "percent_used":percent_used,
        "status":status_from_decimal(percent_used)
    }

def compute_per_category(budget):
    """
    Compute per-category planned vs spent for a Budget object.
    Returns:
      {
        "categories": [
          {"category": "Groceries", "planned": Decimal, "spent": Decimal, "remaining": Decimal, "percent_used": Decimal, "status": str}
          ...
        ],
        "unplanned": [
          {"category": "Misc vendor", "planned": Decimal(0), "spent": Decimal(...), ...}
        ]
      }
    Notes:
      - category names are treated case-sensitively to match how you store them.
      - If category appears in expenses but not in budget categories, it will be returned under "unplanned".
    """
    budget_categories = BudgetCategory.query.filter_by(budget_id=budget.id).all()
    planned_map = {c.category.strip(): _to_decimal(c.limit) for c in budget_categories}

    rows = db.session.query(
        Expense.category,
        func.coalesce(func.sum(Expense.amount),0)
    ).filter(
        Expense.budget_id == budget.id,
        Expense.date >= budget.start_date,
        Expense.date <= budget.end_date
    ).group_by(Expense.category).all()

    spent_map = {r[0]: _to_decimal(r[1]) for r in rows}

    results = []
    for c in budget_categories:
        cat_name = c.category.strip()
        planned = planned_map.get(cat_name,Decimal("0"))
        spent = spent_map.get(cat_name,Decimal("0"))
        remaining = planned -spent

        if planned == Decimal("0"):
            percent_used = Decimal("0") if spent == Decimal("0") else (spent * Decimal("100"))
        else:
            percent_used = (spent/planned) * Decimal("100")
        percent_used = percent_used.quantize(Decimal("0.01"))
        results.append({
            "category": cat_name,
            "planned":planned,
            "spent":spent,
            "remaining":remaining,
            "percent_used":percent_used,
            "status": status_from_decimal(percent_used)
        })
    
    unplanned = []
    for expense_category,spent_amount in spent_map.items():
        if expense_category not in planned_map:
            spent = _to_decimal(spent_amount)
            planned = Decimal("0")
            remaining = planned - spent
            percent_used = Decimal("0") if spent == Decimal("0") else (spent * Decimal("100"))
            percent_used = percent_used.quantize(Decimal("0.01"))
            unplanned.append({
                "category":expense_category,
                "planned":planned,
                "spent":spent,
                "remaining":remaining,
                "percent_used":percent_used,
                "status": status_from_decimal(percent_used)
            })
        
    return {"categories": results, "unplanned": unplanned}

def get_budget_type(budget):
    today = date.today()
    if budget.start_date <= today <= budget.end_date:
        return "active"
    elif today < budget.start_date:
        return "upcoming"
    else:
        return "past"