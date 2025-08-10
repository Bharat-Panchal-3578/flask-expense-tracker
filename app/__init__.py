from flask import Flask, render_template
from app.extensions import db,jwt, migrate

def create_app(config_class="config.Config"):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app,db)

    @app.route('/')
    def home():
        return render_template("index.html")
    
    return app