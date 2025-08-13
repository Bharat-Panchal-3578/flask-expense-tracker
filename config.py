from dotenv import load_dotenv
import os
load_dotenv()

class Config:
    DEBUG=True
    
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    JWT_TOKEN_LOCATION = ['headers','cookies']
    JWT_COOKIE_SECURE = False
    JWT_REFRESH_COOKIE_PATH = "/"
    JWT_COOKIE_CSRF_PROTECT = False