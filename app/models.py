from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date
from sqlalchemy import func
from decimal import Decimal

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer,primary_key=True)
    username = db.Column(db.String(30),nullable=False)
    email = db.Column(db.String(50),unique=True,nullable=False)
    password_hash = db.Column(db.String(255),nullable=False)
    created_at = db.Column(db.Date,default=date.today)

    def create_password(self,password):
        """Hashes and stores the password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self,password):
        """Verifies the provided password against stored hash."""
        return check_password_hash(self.password_hash,password)
    
    def to_dict(self):
        return {
            'id':self.id,
            'username':self.username,
            'email':self.email,
            'created_at':self.created_at.isoformat() if self.created_at else None
        }

class Expense(db.Model):
    __tablename__ = 'expenses'

    id = db.Column(db.Integer,primary_key=True)
    user_id = db.Column(db.Integer,db.ForeignKey("users.id"),nullable=False,index=True)
    amount = db.Column(db.Numeric(12,2),nullable=False)
    category = db.Column(db.String(50),nullable=False)
    date = db.Column(db.Date,default=date.today)
    description = db.Column(db.Text,nullable=True)
    budget_id = db.Column(db.Integer,db.ForeignKey("budgets.id",ondelete="SET NULL"),nullable=True,index=True)

    user = db.relationship("User",backref=db.backref("expenses",lazy="dynamic"))

    def to_dict(self):
        return {
            "id":self.id,
            "amount":float(self.amount) if self.amount is not None else None,
            "category":self.category,
            "date":self.date.isoformat() if self.date else None,
            "description": self.description,
            "budget_id": self.budget_id
        }

class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer,db.ForeignKey("users.id"),nullable=False,index=True)
    name = db.Column(db.String(120),nullable=False)
    period_type = db.Column(db.Enum('weekly','monthly','yearly','custom',name='period_type_enum'),nullable=False)
    start_date = db.Column(db.Date,nullable=False)
    end_date = db.Column(db.Date,nullable=False)
    created_at = db.Column(db.Date, server_default=func.now())
    updated_at = db.Column(db.Date,server_default=func.now(),onupdate=func.now())

    categories = db.relationship("BudgetCategory",back_populates="budget",cascade="all,delete-orphan",lazy="dynamic")
    user = db.relationship("User",backref=db.backref("budgets",lazy="dynamic"))

    def total_limit(self):
        total = Decimal("0")
        for category in self.categories.all():
            if category.limit is not None:
                total += Decimal(category.limit)
        return total
    
    def to_dict(self):
        return {
            "id":self.id,
            "name":self.name,
            "period_type":self.period_type,
            "start_date":self.start_date.isoformat(),
            "end_date":self.end_date.isoformat(),
            "total_limit": float(self.total_limit()),
            "categories": [
                {
                    "id": c.id,
                    "category": c.category,
                    "limit":float(c.limit)
                }
                for c in self.categories.all()
            ]
        }
        
class BudgetCategory(db.Model):
    __tablename__ = "budget_categories"
    id = db.Column(db.Integer,primary_key=True)
    budget_id = db.Column(db.Integer,db.ForeignKey("budgets.id",ondelete="CASCADE"),nullable=False,index=True)
    category = db.Column(db.String(120),nullable=False)
    limit = db.Column(db.Numeric(12,2),nullable=False,default=0)

    budget = db.relationship("Budget",back_populates="categories")

    __table_args__ = (
        db.UniqueConstraint('budget_id','category',name='uq_budget_category_name'),
    )