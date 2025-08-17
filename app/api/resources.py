from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import create_access_token, create_refresh_token, set_refresh_cookies, jwt_required, get_jwt_identity, unset_jwt_cookies
from app.extensions import db
from .utils import _parse_amount, _parse_args, _parse_date
from sqlalchemy import or_, update
from sqlalchemy.exc import SQLAlchemyError
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
        user_id = int(get_jwt_identity())
        
        budgets = Budget.query.filter_by(user_id=user_id).all()
        return success_response([budget.to_dict() for budget in budgets],"Budgets fetched successfully")

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
            "categories": [{"category":"Groceries","limit":1000}, ...] 
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
        
        budget = Budget(
            user_id=user_id,
            name=name,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date
        )

        db.session.add(budget)
        db.session.flush()

        categories = data.get("categories") or []
        created_categories = []
        for category in categories:
            category_name = (category.get("category") or "").strip()
            if not category_name:
                continue

            limit = _parse_amount(category.get("limit"))
            if limit is None:
                limit = Decimal("0")
            budget_category = BudgetCategory(budget_id=budget.id,category=category_name,limit=limit)
            created_categories.append({"category":category_name,"limit":float(limit)})
            db.session.add(budget_category)
        db.session.commit()

        response_data = {
            "id":budget.id,
            "name":name,
            "period_type":period_type,
            "start_date":start_date.isoformat(),
            "end_date":end_date.isoformat(),
            "categories":created_categories
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

        data = request.get_json() or {}

        name = data.get("name") if "name" in data else None
        period_type = data.get("period_type") if "period_type" in data else None
        start_date_str = data.get("start_date") if "start_date" in data else None
        end_date_str = data.get("end_date") if "end_date" in data else None
        categories_payload = data.get("categories") if "categories" in data else None

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

        # Begin category validation & operations (if categories provided)
        try:
            if categories_payload is not None:
                if not isinstance(categories_payload, list):
                    return error_response("categories must be an array", 400)

                # Validate payload items and detect duplicate names within payload
                seen_names = {}
                payload_items = []  # each: {"id":..., "category":..., "category_normalized":..., "limit": Decimal}
                for idx, item in enumerate(categories_payload):
                    if not isinstance(item, dict):
                        return error_response("Each category must be an object", 400)

                    category_id = item.get("id", None)
                    raw_name = (item.get("category") or "").strip()
                    if not raw_name:
                        return error_response(f"Category name required for item at index {idx}", 400)
                    category_name_normalized = raw_name

                    raw_limit = item.get("limit", None)
                    parsed_limit = _parse_amount(raw_limit)
                    if parsed_limit is None:
                        parsed_limit = Decimal("0")
                    if parsed_limit < 0:
                        return error_response("Category limit must be >= 0", 400)

                    # duplicate name check within payload
                    if category_name_normalized in seen_names:
                        return error_response(f"Duplicate category name in payload: '{raw_name}'", 400)
                    seen_names[category_name_normalized] = True

                    payload_items.append({
                        "id": category_id,
                        "category": raw_name,
                        "category_normalized": category_name_normalized,
                        "limit": parsed_limit
                    })

                # Load existing categories for this budget
                existing_categories = budget.categories.all()
                existing_by_id = {c.id: c for c in existing_categories}
                existing_by_name = {c.category.strip(): c for c in existing_categories}

                # Ensure any provided ids belong to this budget
                for itm in payload_items:
                    if itm["id"] is not None:
                        if itm["id"] not in existing_by_id:
                            return error_response(f"Invalid category id: {itm['id']}", 400)

                # Ensure no name collisions between payload and other existing categories (excluding updates of same id)
                for itm in payload_items:
                    incoming_name = itm["category_normalized"]
                    incoming_id = itm["id"]
                    if incoming_name in existing_by_name:
                        existing_cat = existing_by_name[incoming_name]
                        # If the existing category is not the same row we're updating, that's a conflict
                        if incoming_id is None or existing_cat.id != incoming_id:
                            return error_response(f"Category name conflicts with existing category: '{itm['category']}'", 400)

                # Determine which to update, insert, delete
                payload_ids = {itm["id"] for itm in payload_items if itm["id"] is not None}
                existing_ids = set(existing_by_id.keys())

                ids_to_update = payload_ids & existing_ids
                items_to_insert = [itm for itm in payload_items if itm["id"] is None]
                ids_to_delete = existing_ids - payload_ids

                # Apply updates
                for update_id in ids_to_update:
                    item = next(x for x in payload_items if x.get("id") == update_id)
                    category_obj = existing_by_id[update_id]

                    new_name = item["category"].strip()
                    new_limit = item["limit"]

                    # update only if different
                    if category_obj.category != new_name:
                        category_obj.category = new_name
                    # category_obj.limit may be Decimal already; coerce for safe compare
                    try:
                        existing_limit_decimal = Decimal(str(category_obj.limit))
                    except Exception:
                        existing_limit_decimal = Decimal("0")
                    if existing_limit_decimal != new_limit:
                        category_obj.limit = new_limit

                # Apply inserts
                for item in items_to_insert:
                    created_category = BudgetCategory(
                        budget_id=budget.id,
                        category=item["category"].strip(),
                        limit=item["limit"]
                    )
                    db.session.add(created_category)

                # Apply deletes
                for delete_id in ids_to_delete:
                    delete_obj = existing_by_id[delete_id]
                    db.session.delete(delete_obj)

            # After categories validated and staged, apply budget-level updates
            if name is not None:
                name = (name or "").strip()
                if not name:
                    return error_response("name cannot be empty", 400)
                budget.name = name

            if period_type is not None:
                budget.period_type = period_type

            if start_date is not None:
                budget.start_date = start_date
            if end_date is not None:
                budget.end_date = end_date

            # Commit all changes atomically
            db.session.commit()

        except Exception as e:
            db.session.rollback()
            # avoid leaking internal exception details in production; returning message for debugging here
            return error_response("Failed to update budget: " + str(e), 500)

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

        current_budget = Budget.query.filter_by(user_id=user_id).order_by(Budget.id.desc()).first()

        if not current_budget:
            return error_response("No budget found")
        return success_response(current_budget.to_dict(),"Current budget fetched successfully!")