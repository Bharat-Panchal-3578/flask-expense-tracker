from app.extensions import db
from datetime import datetime, timezone

class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    period_type = db.Column(
        db.Enum("weekly", "monthly", "yearly", "custom", name="period_type"),
        nullable=False
    )
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="budgets")
    categories = db.relationship("BudgetCategory", back_populates="budget", cascade="all, delete-orphan")
    budget_expenses = db.relationship("BudgetExpense", back_populates="budget", cascade="all, delete-orphan")

    __table_args__ = (
        db.Index("ix_budgets_user_id_start_end", "user_id", "start_date", "end_date"),
    )

    def __repr__(self):
        return f"<Budget id={self.id} user_id={self.user_id} name={self.name!r} period_type={self.period_type}>"

class BudgetCategory(db.Model):
    __tablename__ = "budget_categories"

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey("budgets.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    limit = db.Column(db.Numeric(12, 2), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    budget = db.relationship("Budget", back_populates="categories")
    budget_expenses = db.relationship("BudgetExpense", back_populates="budget_category", cascade="all, delete-orphan")

    __table_args__ = (
        db.Index("ix_budget_categories_budget_id", "budget_id"),
    )

    def __repr__(self):
        return f"<BudgetCategory id={self.id} budget_id={self.budget_id} name={self.name!r} limit={self.limit}>"

class BudgetExpense(db.Model):
    __tablename__ = "budget_expenses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    budget_id = db.Column(db.Integer, db.ForeignKey("budgets.id"), nullable=False)
    budget_category_id = db.Column(db.Integer, db.ForeignKey("budget_categories.id"), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.Text, nullable=True)
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="budget_expenses")
    budget = db.relationship("Budget", back_populates="budget_expenses")
    budget_category = db.relationship("BudgetCategory", back_populates="budget_expenses")

    __table_args__ = (
        db.Index("ix_budget_expenses_budget_id_category_id", "budget_id", "budget_category_id"),
        db.Index("ix_budget_expenses_user_id_date", "user_id", "date"),
    )

    def __repr__(self):
        return f"<BudgetExpense id={self.id} user_id={self.user_id} budget_id={self.budget_id} amount={self.amount} date={self.date}>"