from flask import render_template
from . import budget

@budget.route('/budgets')
def budgets():
    return render_template('budgets.html')