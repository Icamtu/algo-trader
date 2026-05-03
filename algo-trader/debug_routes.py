from fastapi_app import app

for route in app.routes:
    methods = getattr(route, 'methods', ['WS'])
    print(f"{route.path} [{','.join(methods)}]")
