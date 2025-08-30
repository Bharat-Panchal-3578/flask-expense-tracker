from flask import Blueprint
from flask_restful import Api
from .resources import RegisterResource, LoginResource, TokenRefreshResource, LogoutResource, ExpenseListResource, BudgetListResource, CurrentBudgetResource, BudgetCategoryListResource, BudgetCategoryResource
api_bp = Blueprint('api',__name__)
api = Api(api_bp)

api.add_resource(RegisterResource,"/register")
api.add_resource(LoginResource, "/login")
api.add_resource(TokenRefreshResource,"/refresh")
api.add_resource(LogoutResource,"/logout")
api.add_resource(ExpenseListResource,"/expenses","/expenses/<int:expense_id>")
api.add_resource(BudgetListResource,"/budgets","/budgets/<int:budget_id>")
api.add_resource(CurrentBudgetResource,"/budgets/current")
api.add_resource(BudgetCategoryListResource,"/budgets/<int:budget_id>/categories")
api.add_resource(BudgetCategoryResource,"/budgets/<int:budget_id>/categories/<int:category_id>")