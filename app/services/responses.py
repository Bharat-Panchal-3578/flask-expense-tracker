from flask import jsonify, Response
from typing import Any, Optional

def success_response(data:Any = None, message: Optional[str] = None, status_code:int = 200) -> tuple[Response, int]:
    payload = {"success": True}

    if message:
        payload["message"] = message
    
    if data is not None:
        payload["data"] = data

    return jsonify(payload), status_code

def error_response(message:str, status_code: int = 400, errors:Any = None) -> tuple[Response, int]:
    payload = {
        "success": False,
        "message": message
    }

    if errors:
        payload["errors"] = errors

    return jsonify(payload), status_code