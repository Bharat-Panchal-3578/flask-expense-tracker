from flask import render_template
from . import dashboard

@dashboard.route('/dashboard')
def dashboard():
    return render_template("dashboard.html")