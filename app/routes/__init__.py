from flask import Blueprint

web_bp = Blueprint("web_bp",__name__)

from . import routes