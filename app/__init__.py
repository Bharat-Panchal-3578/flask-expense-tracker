from flask import Flask
from app.main import main
from app.api import api_bp
from app.auth import auth
from app.dashboard import dashboard
from app.extensions import db,jwt, migrate

def create_app(config_class="config.Config"):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app,db)

    app.register_blueprint(main)
    app.register_blueprint(api_bp,url_prefix="/api")
    app.register_blueprint(auth)
    app.register_blueprint(dashboard)
    
    return app