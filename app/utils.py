from flask import jsonify

def success_response(data=None,message="ok",status=200):
    """Standard JSON successful responses"""
    return {
        'status':'success',
        'message':message,
        'data':data
    }, status

def error_response(message='Something went wrong',status=404):
    """Standard JSON for errors."""
    return {
        'status':'error',
        'message':message
    }, status