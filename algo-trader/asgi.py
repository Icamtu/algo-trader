from asgiref.wsgi import WsgiToAsgi
from api import create_app

# Note: This file will be used by uvicorn to run the Flask app as an ASGI application
# Usage: uvicorn asgi:asgi_app --host 0.0.0.0 --port 18788 --workers 4

app = create_app()
asgi_app = WsgiToAsgi(app)
