from flask import render_template
# from flask_jwt_extended import jwt_required
from . import dashboard

@dashboard.route('/dashboard')
def dashboard():
    return render_template("dashboard.html")