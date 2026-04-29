import os
import logging
from flask import Flask
from config import config_map
from app.extensions import db, migrate, jwt, cors

def create_app(config_name: str = "default") -> Flask:
    app = Flask(__name__)

    # Load configs
    env_config = config_map[config_name]
    app.config.from_object(env_config)

    # Initialize logging
    env_config.init_logging()

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from app.users import users_bp
    from app.expenses import expenses_bp
    from app.budgets import budgets_bp

    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
    app.register_blueprint(budgets_bp, url_prefix="/api/budgets")

    logger = logging.getLogger("api")
    logger.info("App created in '%s' environment", config_name)

    return app