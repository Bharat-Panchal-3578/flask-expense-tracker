from flask import render_template
from . import auth

@auth.route('/register')
def register():
    return render_template("register.html")