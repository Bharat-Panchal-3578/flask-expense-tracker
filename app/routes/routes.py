from flask import render_template
from . import web_bp

@web_bp.route('/')
@web_bp.route('/home')
def home():
    return render_template("index.html")

@web_bp.route('/register')
def register():
    return render_template("register.html")

@web_bp.route('/login')
def login():
    return render_template("login.html")

@web_bp.route('/dashboard')
def dashboard():
    return render_template("dashboard.html")

@web_bp.route('/budgets')
def budgets():
    return render_template('budgets.html')