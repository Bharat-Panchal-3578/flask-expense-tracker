from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import create_access_token, create_refresh_token, set_refresh_cookies, jwt_required, get_jwt_identity, unset_jwt_cookies
from app.extensions import db
from .utils import _parse_amount, _parse_args, _parse_date
from sqlalchemy import or_
from app.models import User, Expense
from app.utils import success_response, error_response
from datetime import timedelta, date

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

class ExpenseListResource(Resource):
    @jwt_required()
    def get(self):
        user_id = int(get_jwt_identity())

        page, per_page = _parse_args()
        start_date = _parse_date(request.args.get("start_date"))
        end_date = _parse_date(request.args.get("end_date"))
        category = (request.args.get("category") or "").strip()

        query = Expense.query.filter_by(user_id=user_id)

        if start_date:
            query = query.filter(Expense.date >= start_date)
        if end_date:
            query = query.filter(Expense.date <= end_date   )
        if category:
            query =query.filter(Expense.category.ilike(f"%{category}%"))

        pagination = query.order_by(Expense.date.desc()).paginate(
            page=page,per_page=per_page,error_out=False
        )

        expenses = [e.to_dict() for e in pagination.items]
        total_count = pagination.total

        return success_response(data={"expenses":expenses,"total_count":total_count},message="Expenses fetched successfully")

    @jwt_required()
    def post(self):
        identity = get_jwt_identity()

        try:
            user_id = int(identity)
        
        except Exception:
            return error_response("Invalid token identity",401)
        
        data = request.get_json() or {}

        amount = _parse_amount(data.get("amount"))
        if amount is None:
            return error_response("Amount must be a positive number",400)
        
        category = (data.get("category") or "").strip()
        if not category:
            return error_response("Category is required.",400)
        
        description = (data.get("description") or "").strip() or None

        budget_id = data.get("budget_id",None)

        date_str = data.get("date",None)
        if date_str:
            parsed_date = _parse_date(date_str)
            if parsed_date is None:
                return error_response("Invalid date (expected YYYY-MM-DD)",400)
            
        else:
            parsed_date = date.today()

        expense = Expense(
            user_id=user_id,
            amount=amount,
            category=category,
            date=parsed_date,
            description=description,
            budget_id=budget_id
        )

        db.session.add(expense)
        db.session.commit()

        return success_response(data=expense.to_dict(),message="Expense created",status=201)
    
    @jwt_required()
    def put(self, expense_id):
        user_id = int(get_jwt_identity())

        expense = Expense.query.filter_by(id=expense_id).first()
        if not expense or expense.user_id != user_id:
            return  error_response("Expense not found or unauthorized",404)
        
        data = request.get_json() or {}

        amount = _parse_amount(data.get("amount"))
        if amount is not None and amount <= 0:
            return error_response("Amount must be positive", 400)
        
        category = (data.get("category") or "").strip()
        description = (data.get("description") or "").strip() or None
        date_str = data.get("date")
        parsed_date = _parse_date(date_str) if date_str else None

        if date_str and parsed_date is None:
            return error_response("Invalid date (expected YYYY-MM-DD)",400)
        
        if amount is not None:
            expense.amount = amount
        if category:
            expense.category = category
        if description is not None:
            expense.description = description
        if parsed_date:
            expense.date = parsed_date
        
        db.session.commit()

        return  success_response(data=expense.to_dict(),message="Expense updated")
    
    @jwt_required()
    def delete(self, expense_id):
        user_id = int(get_jwt_identity())
        expense = Expense.query.filter_by(id=expense_id).first()

        if not expense or expense.user_id != user_id:
            return error_response("Expense not found or unauthorized",404)
        
        db.session.delete(expense)
        db.session.commit()

        return success_response(message="Expense deleted successfully")