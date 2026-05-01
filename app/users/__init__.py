from flask import Blueprint
from flask_restful import Api

users_bp = Blueprint("users", __name__)
users_api = Api(users_bp)

from app.users import routes