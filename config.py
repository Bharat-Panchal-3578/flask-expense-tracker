import os
import logging
import logging.config
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
API_LOG_LEVEL = os.environ.get("API_LOG_LEVEL", "INFO")

def _build_logging_config(app_level: str) -> dict:
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "[{levelname}] {asctime} {name}: {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "verbose": {
                "format": "[{levelname}] {asctime} {name} ({pathname}: {lineno}): {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "standard",
                "level": app_level,
            },
            "app_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": os.path.join(LOGS_DIR, "app.log"),
                "formatter": "standard",
                "level": app_level,
                "maxBytes": 5*1024*1024,
                "backupCount": 5,
                "encoding": "utf-8",
            },
            "api_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": os.path.join(LOGS_DIR, "api.log"),
                "formatter": "standard",
                "level": API_LOG_LEVEL,
                "maxBytes": 5*1024*1024,
                "backupCount": 5,
                "encoding": "utf-8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": os.path.join(LOGS_DIR, "error.log"),
                "formatter": "verbose",
                "level": "ERROR",
                "maxBytes": 5*1024*1024,
                "backupCount": 5,
                "encoding": "utf-8",
            },
        },
        "loggers": {
            "werkzeug": {
                "handlers": ["console", "app_file"],
                "level": app_level,
                "propagate": False,
            },
            "app": {
                "handlers": ["console", "error_file"],
                "level": "ERROR",
                "propagate": False,
            },
            "api": {
                "handlers": ["console", "api_file", "error_file"],
                "level": API_LOG_LEVEL,
                "propagate": True,
            },
        },
    }


class Config:
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get("SECRET_KEY")
    
    # Database
    SQLALCHEMY_DATABASE_URI = (
        f"mysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}"
        f"/{os.getenv('DB_NAME')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    #JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ALGORITHM = "HS256"
    JWT_HEADER_TYPE = "Bearer"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_COOKIE_SECURE = False
    JWT_REFRESH_COOKIE_PATH = "/"
    JWT_COOKIE_CSRF_PROTECT = False

    @staticmethod
    def init_logging():
        logging.config.dictConfig(_build_logging_config("INFO"))

class DevelopmentConfig(Config):
    DEBUG = True
    
    @staticmethod
    def init_logging():
        logging.config.dictConfig(_build_logging_config("DEBUG"))

class ProductionConfig(Config):
    JWT_COOKIE_SECURE = True

    @staticmethod
    def init_logging():
        logging.config.dictConfig(_build_logging_config("ERROR"))

class TestingConfig(Config):
    TESTING = True

    SQLALCHEMY_DATABASE_URI = (
    f"mysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}"
    f"/{os.getenv('TEST_DB_NAME')}"
)

    @staticmethod
    def init_logging():
        pass # no file logging needed

config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": ProductionConfig,
}