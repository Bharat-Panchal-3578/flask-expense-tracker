from flask import Blueprint
from flask_restful import Api

expenses_bp = Blueprint("expenses", __name__)
expenses_api = Api(expenses_bp)

from app.expenses import routes