from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    email = db.Column(db.String(120), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    expenses = db.relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    budgets = db.relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    budget_expenses = db.relationship("BudgetExpense", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        """Hashes the password before storing."""
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        """Verifies the password against the stored hash."""
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r} email={self.email!r}>"

class TokenBlacklist(db.Model):
    __tablename__ = "token_blacklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(80), nullable=False, unique=True)
    blacklisted_on = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))