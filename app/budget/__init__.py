from flask import Blueprint

budget = Blueprint("budget", __name__)

from . import routes