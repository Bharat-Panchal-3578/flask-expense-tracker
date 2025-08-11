from flask import Blueprint
from flask_restful import Api
from .resources import RegisterResource,LoginResource

api_bp = Blueprint('api',__name__)
api = Api(api_bp)

api.add_resource(RegisterResource,"/register")
api.add_resource(LoginResource, "/login")