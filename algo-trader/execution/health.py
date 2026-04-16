import requests

def check_openalgo(url="http://openalgo-web:5000"):
    try:
        r = requests.get(url, timeout=3)
        return r.status_code == 200
    except:
        return False
