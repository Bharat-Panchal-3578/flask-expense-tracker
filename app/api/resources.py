from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import create_access_token, create_refresh_token, set_refresh_cookies, jwt_required, get_jwt_identity, unset_jwt_cookies
from app.extensions import db
from .utils import _parse_amount, _parse_args, _parse_date
from .budget_utils import compute_budget_totals, compute_per_category, get_budget_type
from sqlalchemy import or_, update
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.models import User, Expense, Budget, BudgetCategory
from app.utils import success_response, error_response
from datetime import timedelta, date
from decimal import Decimal

class RegisterResource(Resource):
    def post(self):
        data = request.get_json() or {}

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
        data = request.get_json() or {}

        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "")

        if not username or not email or not password:
            return  error_response("Email and password are required",400)
        
        user = User.query.filter(or_(User.username == username, User.email == email)).first()
        if not user:
            return error_response("Invalid credentials",401)
        
        if not user.check_password(password):
            return error_response("Invalid password, try again",401)
        
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

        budget_id = request.args.get("budget_id",type=int)
        if budget_id is not None:
            budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()

            if not budget:
                return error_response("Invalid budget id or not owned by user",404)
            
            if not start_date or not end_date:
                start_date = budget.start_date
                end_date = budget.end_date

        query = Expense.query.filter_by(user_id=user_id)

        if budget_id:
            query = query.filter(Expense.budget_id == budget_id)
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
        
        if budget_id is not None:
            budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()

            if not budget:
                return error_response("Invalid budget_id or not owned by user",400)
            
            if parsed_date < budget.start_date or parsed_date > budget.end_date:
                return error_response("Expense date outside budget window",400)

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

        return success_response(data=expense.to_dict(),message="Expense created successfully!",status=201)
    
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
        
        if "budget_id" in data:
            new_budget_id = data.get("budget_id")
            if new_budget_id is not None:
                new_budget = Budget.query.filter_by(id=new_budget_id,user_id=user_id).first()

                if not new_budget:
                    return error_response("Invalid budget id or not owned by user.",400)
                
                check_date = parsed_date if parsed_date else expense.date
                if check_date < new_budget.start_date or check_date > new_budget.end_date:
                    return error_response("Expense date outside new budget window",400)
                expense.budget_id = new_budget_id
            else:
                expense.budget_id = None
        
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

class BudgetListResource(Resource):
    @jwt_required()
    def get(self):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity", 401)

        budgets = Budget.query.filter_by(user_id=user_id).order_by(Budget.start_date.desc()).all()
        budgets_response = []

        for budget in budgets:
            budget_dict = budget.to_dict()

            overall = compute_budget_totals(budget)
            per_cat = compute_per_category(budget)

            budget_dict.update({
                "summary": {
                    "total_limit": float(overall["total_limit"]),
                    "total_spent": float(overall["total_spent"]),
                    "remaining": float(overall["remaining"]),
                    "percent_used": float(overall["percent_used"]),
                    "status": overall["status"]
                },
                "per_category": [
                    {
                        "id":c["id"],
                        "category": c["category"],
                        "planned": float(c["planned"]),
                        "spent": float(c["spent"]),
                        "remaining": float(c["remaining"]),
                        "percent_used": float(c["percent_used"]),
                        "status": c["status"]
                    } for c in per_cat["categories"]
                ],
                "unplanned": [
                    {
                        "category": c["category"],
                        "planned": float(c["planned"]),
                        "spent": float(c["spent"]),
                        "percent_used": float(c["percent_used"]),
                        "status": c["status"]
                    } for c in per_cat["unplanned"]
                ]
            })

            budgets_response.append(budget_dict)
        return success_response(budgets_response, "Budgets fetched successfully")

    @jwt_required()
    def post(self):
        """
            POST /api/budgets
            payload:
            {
            "name": "...",
            "period_type": "monthly",
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD",
            }
        """

        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity",401)
        
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        period_type = (data.get("period_type") or "").strip()
        start_date = _parse_date(data.get("start_date"))
        end_date = _parse_date(data.get("end_date"))

        if not name or not period_type or not start_date or not end_date:
            return error_response("name, period_type, start_date, end_date are required",400)
        
        if start_date > end_date:
            return error_response("start_date must <= end_date",400)
        
        allowed_periods = {"weekly","monthly","yearly","custom"}
        if period_type not in allowed_periods:
            return error_response("Invalid period_type",400)
        
        overlap = Budget.query.filter(
            Budget.user_id==user_id,
            Budget.start_date <= end_date,
            Budget.end_date >= start_date
            ).first()
        
        if overlap:
            return error_response("Budget window overlaps with an existing plan",400)
        
        if "categories" in data:
            return error_response("Do not include categories here. Use /api/budgets/<id>/categories instead.",400)
        
        budget = Budget(
            user_id=user_id,
            name=name,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date
        )

        db.session.add(budget)
        db.session.commit()

        response_data = {
            "id":budget.id,
            "name":name,
            "period_type":period_type,
            "start_date":start_date.isoformat(),
            "end_date":end_date.isoformat(),
            "categories": []
        }

        return success_response(response_data,"Budget created successfully",201)
    
    @jwt_required()
    def put(self, budget_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity", 401)

        # load budget + ownership
        budget = Budget.query.filter_by(id=budget_id).first()
        if not budget or budget.user_id != user_id:
            return error_response("Budget not found or unauthorized", 404)
        
        budget_type = get_budget_type(budget)
        if budget_type == "past":
            return error_response("Cannot update a past budget",400)

        data = request.get_json() or {}

        if "categories" in data:
            return error_response("Categories cannot be via this endpoint. Use category endpoints instead.",400)

        name = data.get("name") if "name" in data else None
        period_type = data.get("period_type") if "period_type" in data else None
        start_date_str = data.get("start_date") if "start_date" in data else None
        end_date_str = data.get("end_date") if "end_date" in data else None

        # parse dates
        start_date = _parse_date(start_date_str) if start_date_str is not None else None
        end_date = _parse_date(end_date_str) if end_date_str is not None else None

        if start_date_str is not None and start_date is None:
            return error_response("Invalid start_date (expected: YYYY-MM-DD)", 400)
        if end_date_str is not None and end_date is None:
            return error_response("Invalid end_date (expected: YYYY-MM-DD)", 400)

        # proposed final window after update
        new_start = start_date if start_date is not None else budget.start_date
        new_end = end_date if end_date is not None else budget.end_date

        if new_start > new_end:
            return error_response("Start date must <= end date", 400)

        # validate period_type
        allowed_periods = {"weekly", "monthly", "yearly", "custom"}
        if period_type is not None:
            period_type = (period_type or "").strip()
            if period_type not in allowed_periods:
                return error_response("Invalid period_type", 400)

        # overlap check (exclude the budget being edited)
        overlap = Budget.query.filter(
            Budget.user_id == user_id,
            Budget.id != budget_id,
            Budget.start_date <= new_end,
            Budget.end_date >= new_start
        ).first()
        if overlap:
            return error_response("Budget window overlaps with an existing plan", 400)

        # ensure no linked expenses fall outside new window if dates changed
        if new_start != budget.start_date or new_end != budget.end_date:
            outside = Expense.query.filter(
                Expense.budget_id == budget_id,
                or_(Expense.date < new_start, Expense.date > new_end)
            ).first()
            if outside:
                return error_response(
                    "Cannot change dates: existing expenses for this budget fall outside the new date range",
                    400
                )

        try:
            if name is not None:
                name = (name or "").strip()
                if not name:
                    return error_response("name cannot be empty",400)
                budget.name = name
            
            if period_type is not None:
                budget.period_type = period_type
            
            if start_date is not None:
                budget.start_date = start_date
            if end_date is not None:
                budget.end_date = end_date

            db.session.commit()

        except Exception as e:
            db.session.rollback()
            return error_response("Failed to update budget:",e)

        # Build final response payload from committed state
        categories = []
        for category in budget.categories.all():
            categories.append({
                "id": category.id,
                "category": category.category,
                "limit": float(category.limit)
            })

        response_data = {
            "id": budget.id,
            "name": budget.name,
            "period_type": budget.period_type,
            "start_date": budget.start_date.isoformat(),
            "end_date": budget.end_date.isoformat(),
            "total_limit": float(budget.total_limit()),
            "categories": categories
        }

        return success_response(response_data, "Budget updated successfully")
    
    @jwt_required()
    def delete(self,budget_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity",401)
        
        budget = Budget.query.filter_by(id=budget_id).first()
        if not budget or budget.user_id != user_id:
            return error_response("Budget not found or unauthorized",404)
        
        try:
            db.session.query(Expense).filter(
                Expense.budget_id == budget_id,
                Expense.user_id == user_id
            ).update({Expense.budget_id: None}, synchronize_session=False)

            db.session.delete(budget)
            db.session.commit()

        except SQLAlchemyError as e:
            return error_response("Failed to delete budget: "+str(e),500)
        return success_response("Budget deleted successfully")

class CurrentBudgetResource(Resource):
    @jwt_required()
    def get(self):
        user_id = int(get_jwt_identity())
        today = date.today()

        current_budget = Budget.query.filter(
            Budget.user_id==user_id,
            Budget.start_date <= today,
            Budget.end_date >= today
        ).order_by(Budget.id.desc()).first()

        if not current_budget:
            return error_response("No budget found")
        
        overall = compute_budget_totals(current_budget)
        per_cat = compute_per_category(current_budget)

        response = current_budget.to_dict()
        response.update({
            "summary":{
                "total_limit": float(overall["total_limit"]),
                "total_spent": float(overall["total_spent"]),
                "remaining": float(overall["remaining"]),
                "percent_used": float(overall["percent_used"]),
                "status": overall["status"]
            },
            "per_category": [
                {
                    "id":c["id"],
                    "category": c["category"],
                    "planned": float(c["planned"]),
                    "spent": float(c["spent"]),
                    "remaining": float(c["remaining"]),
                    "percent_used": float(c["percent_used"]),
                    "status": c["status"]
                } for c in per_cat["categories"]
            ],
            "unplanned": [
                {
                    "category": c["category"],
                    "spent": float(c["spent"]),
                    "planned": float(c["planned"]),
                    "percent_used": float(c["percent_used"]),
                    "status": c["status"]
                } for c in per_cat["unplanned"]
            ]
        })
        return success_response(response,"Current budget fetched successfully!")
    
class BudgetCategoryListResource(Resource):
    @jwt_required()
    def get(self,budget_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)

        except Exception:
            return error_response("Invalid token identity",400)
        
        budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()
        if not budget:
            return error_response("Budget not found or unauthorized")
        
        categories = BudgetCategory.query.filter_by(budget_id=budget_id).all()

        data = [
            {
                "id":category.id,
                "name":category.category,
                "limit": category.limit
            }
            for category in categories
        ]

        return success_response(data,"Categories fetched successfully")
    
    @jwt_required()
    def post(self,budget_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity",400)
        
        budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()
        if not budget:
            return error_response("Budget not found or unauthorized")
        
        if budget.end_date < date.today():
            return error_response("Cannot modify past budgets",400)
        
        data = request.get_json()
        if not data or "category" not in data or "limit" not in data:
            return error_response("Category and limit are required",400)
        
        category_name = (data.get("category") or "").strip()
        category_limit = data.get("limit")

        if not category_name:
            return error_response("Invalid category name",400)
        
        try:
            category_limit = float(category_limit)
            if category_limit < 0:
                return error_response("Limit must be greater than 0",400)
        
        except ValueError:
            return error_response("Limit must be a valid number",400)
        
        existing = BudgetCategory.query.filter_by(budget_id=budget.id,category=category_name).first()
        if existing:
            return error_response("Category already exists in this budget",400)
        
        new_category = BudgetCategory(
            budget_id=budget.id,
            category=category_name,
            limit=category_limit
        )

        db.session.add(new_category)
        db.session.commit()

        return success_response({"id":new_category.id,"category":new_category.category,"limit":new_category.limit},"Category created successfully",201)

class BudgetCategoryResource(Resource):
    @jwt_required()
    def put(self,budget_id,category_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity",400)
        
        budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()
        if not budget:
            return error_response("Budget not found or unauthorized")
        
        if get_budget_type(budget) == "past":
            return error_response("Cannot modify a past budget",400)
        
        category = BudgetCategory.query.filter_by(id=category_id,budget_id=budget_id).first()
        if not category:
            return error_response("Category not found in this budget")

        data = request.get_json() or {}
        if (("name" not in data) and ("limit" not in data)):
            return error_response("No update fields provided (expected 'name' and/or 'limit')",400)
        
        new_name = None
        if "name" in data:
            new_name = (data.get("name") or "").strip()

            if not new_name:
                return error_response("Invalid category name",400)
            
            conflict = BudgetCategory.query.filter(
                BudgetCategory.budget_id == budget_id,
                BudgetCategory.category == new_name,
                BudgetCategory.id != category_id
            ).first()

            if conflict:
                return error_response(f"Category name conflicts with existing category: '{new_name}'",400)
        
        new_limit = None        
        if "limit" in data:
            parsed_limit = _parse_amount(data.get("limit"))

            if parsed_limit is None:
                return error_response("Invalid limit(expected Numeric)",400)
            
            if parsed_limit < 0:
                return error_response("Limit must be non-negative",400)
            
            new_limit = parsed_limit
        
        old_name = category.category
        expense_update_needed = (new_name is not None and new_name != old_name)

        try:
            if new_name is not None:
                category.category = new_name
            if new_limit is not None:
                category.limit = new_limit
            if expense_update_needed:
                db.session.query(Expense).filter(
                    Expense.budget_id == budget_id,
                    Expense.category == old_name
                ).update({Expense.category: new_name}, synchronize_session=False)
            
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return error_response("Category name conflicts with existing category",400)
        
        except Exception:
            db.session.rollback()
            return error_response("Failed to update category",500)
        
        response = {
            "id": category.id,
            "category":category.category,
            "limit":float(category.limit)
        }

        return success_response(response, "Category updated successfully")

    @jwt_required()
    def delete(self,budget_id,category_id):
        identity = get_jwt_identity()
        try:
            user_id = int(identity)
        except Exception:
            return error_response("Invalid token identity",400)
        
        budget = Budget.query.filter_by(id=budget_id,user_id=user_id).first()
        if not budget:
            return error_response("Budget not found")
        
        if get_budget_type(budget) == "past":
            return error_response("Cannot modify expired budgets",400)
        
        category = BudgetCategory.query.filter_by(id=category_id,budget_id=budget_id).first()
        if not category:
            return error_response("Category not found")
        
        expense_exists = Expense.query.filter_by(budget_id=budget_id, category=category.category).first()
        if expense_exists:
            return error_response("Cannot delete category with existing expenses",400)
        
        db.session.delete(category)
        db.session.commit()

        return success_response(data=
            {
                "id":category.id,
                "category":category.category,
                "limit":category.limit
            },
            message="Category deleted successfully")