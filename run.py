import os
from app import create_app

config_name = os.environ.get("ENV_CONFIG", "default")
app = create_app(config_name)

if __name__ == "__main__":
    app.run()