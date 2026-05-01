from flask import Blueprint
from flask_restful import Api

budgets_bp = Blueprint("budgets", __name__)
budgets_api = Api(budgets_bp)

from app.budgets import routes