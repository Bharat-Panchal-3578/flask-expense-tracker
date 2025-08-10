from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer,primary_key=True)
    username = db.Column(db.String(30),nullable=False,unique=True)
    email = db.Column(db.String(50),unique=True,nullable=False)
    password_hash = db.Column(db.String(255),nullable=False)
    created_at = db.Column(db.Date,default=date.today)

    def create_password(self,password):
        """Hashes and stores the password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self,password):
        """Verifies the provided password against stored hash."""
        return check_password_hash(self.password_hash,password)