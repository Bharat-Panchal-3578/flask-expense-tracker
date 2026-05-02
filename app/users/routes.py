from app.users import users_api
from app.users.views import RegisterView, LoginView, LogoutView, TokenRefreshView

users_api.add_resource(RegisterView, "/register")
users_api.add_resource(LoginView, "/login")
users_api.add_resource(LogoutView, "/logout")
users_api.add_resource(TokenRefreshView, "/refresh")