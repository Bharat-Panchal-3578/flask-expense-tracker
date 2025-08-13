from flask import jsonify

def success_response(data=None,message="ok",status=200):
    """Standard JSON successful responses"""

    payload = {
        "status":"success",
        "message":message,
        "data":data
    }

    response = jsonify(payload)
    response.status_code = status
    return response

def error_response(message='Something went wrong',status=404):
    """Standard JSON for errors."""
    payload = {
        "status":"error",
        "message":message
    }

    response = jsonify(payload)
    response.status_code = status
    return response