from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import create_access_token, create_refresh_token, set_refresh_cookies, jwt_required, get_jwt_identity, unset_jwt_cookies
from app.extensions import db
from .utils import _parse_amount, _parse_args, _parse_date
from sqlalchemy import or_
from app.models import User
from app.utils import success_response, error_response
from datetime import timedelta

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
        password = (data.get("password") or "")

        user = User.query.filter(or_(User.username == username, User.email == email)).first()
        if not username or not email or not password:
            return  error_response("Email and password are required",400)
        
        if not user:
            return error_response("Invalid credentials",401)
        
        access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(minutes=15))
        refresh_token = create_refresh_token(identity=str(user.id),expires_delta=timedelta(days=7))

        resp = success_response(data={"access_token":access_token,"user":user.to_dict()},message="Login Successful")
        set_refresh_cookies(resp,refresh_token)

        return resp
    
class TokenRefreshResource(Resource):
    @jwt_required(refresh=True)
    def post(self):
        current_user = int(get_jwt_identity())
        new_access_token = create_access_token(identity=str(current_user))
        return success_response(data={"access_token":new_access_token},message="Token refreshed")

class LogoutResource(Resource):
    def post(self):
        resp = jsonify({"message": "Logout successful"})
        unset_jwt_cookies(resp)
        return resp