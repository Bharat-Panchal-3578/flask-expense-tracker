from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from flask import request

def _parse_date(s: str):
    if not s:
        return None
    try:
        return datetime.strptime(s,"%Y-%m-%d").date()
    except Exception:
        return None

def _parse_amount(val):
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    
    except (InvalidOperation, ValueError, TypeError):
        return None

def _parse_args():
    try:
        page = int(request.args.get("page",1))
    except (TypeError, ValueError):
        page = 1
    
    try:
        per_page = int(request.args.get("per_page",10))
    except (TypeError, ValueError):
        per_page = 10
    
    page = max(1,page)
    per_page = max(1,min(100,per_page))
    return page, per_page