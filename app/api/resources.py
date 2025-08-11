from flask import request
from flask_restful import Resource
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models import User
from app.utils import success_response, error_response

class RegisterResource(Resource):
    def post(self):
        data = request.get_json()

        username = (data.get("username") or "").strip()
        email = (data.get("email").strip() or "").strip().lower()
        password = data.get("password")

        if not username or not email or not password:
            return error_response(message= "All fields are required",status=400)
        
        if User.query.filter_by(username=username).first():
            return error_response(message="Username already exists",status=400)
        
        if User.query.filter_by(email=email).first():
            return error_response(message="Email already exists",status=400)
        
        user = User(username=username,email=email)
        user.create_password(password)

        db.session.add(user)
        db.session.commit()

        return success_response(data=user.to_dict(),message="Registration Successful!",status=201)

class LoginResource(Resource):
    def post(self):
        data = request.get_json()

        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password" or ""))

        user = User.query.filter((username == username) | (email == email)).first()
        if not username or not email or not password:
            return  error_response("Email and password are required",400)
        
        if not user:
            return error_response("Invalid credentials",401)
        
        token = create_access_token(identity=user.id)

        return success_response({
            "access_token":token,
            "user": user.to_dict()
        }, "Login Successful!")