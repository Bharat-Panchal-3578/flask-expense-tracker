from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.services.responses import success_response, error_response
from app.users.services.authentication import register_user, login_user, logout_user
from app.users.services.token import rotate_tokens

class RegisterView(Resource):
    def post(self):
        data = request.get_json(silent=True) or {}
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        if not username or not email or not password:
            return error_response("Missing fields", status_code=400)
        
        try:
            user, access_token, refresh_token = register_user(username=username, email=email, password=password)
        
        except ValueError as err:
            return error_response(str(err), status_code=400)
        
        return success_response(
            data={
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
            },
            message="User registration successful",
            status_code=201,
        )

class LoginView(Resource):
    def post(self):
        data = request.get_json(silent=True) or {}
        identifier = data.get("identifier")
        password = data.get("password")

        if not identifier or not password:
            return error_response("Missing fields", status_code=400)
        
        try:
            user, access_token, refresh_token = login_user(identifier=identifier, password=password)
        except ValueError as err:
            return error_response(str(err), status_code=401)
        
        return success_response(
            data={
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
            },
            message="User login successful",
            status_code=200,
        )

class LogoutView(Resource):
    @jwt_required()
    def post(self):
        data = request.get_json(silent=True) or {}
        refresh_token = data.get("refresh_token", "").strip()

        if not refresh_token:
            return error_response("refresh token is required", status_code=400)
        
        try:
            logout_user(refresh_token=refresh_token)
        except ValueError as err:
            return error_response(str(err), status_code=400)
        
        return success_response(message="User logout successful")

class TokenRefreshView(Resource):
    @jwt_required(refresh=True)
    def post(self):
        current_jti = get_jwt()["jti"]
        user_id = get_jwt_identity()

        access_token, refresh_token = rotate_tokens(current_jti, user_id)

        return success_response(
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
            },
            status_code=200
        )