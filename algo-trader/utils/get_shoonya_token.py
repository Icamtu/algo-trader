import os
import json
import time
import pyotp
import requests
from urllib.parse import urlparse, parse_qs
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import InvalidSessionIdException, WebDriverException

# ==========================================================
# 1. CREDENTIALS (FROM ENVIRONMENT)
# ==========================================================
def scan_network_for_code(driver):
    """Scans Chrome performance logs for the 'code=' redirect URL."""
    try:
        logs = driver.get_log("performance")
        for entry in logs:
            try:
                message = json.loads(entry["message"])["message"]
                if message.get("method") == "Network.requestWillBeSent":
                    url = message.get("params", {}).get("request", {}).get("url", "")
                    if "code=" in url:
                        print(f"  >> Detected redirect URL: {url[:60]}...")
                        parsed = urlparse(url)
                        code = parse_qs(parsed.query).get("code", [None])[0]
                        if code:
                            return code
            except Exception:
                continue
    except Exception:
        pass
    return None

def fast_fill(driver, element, value, field_name=""):
    """Helper to click, clear, and send keys to a field."""
    try:
        element.click()
        time.sleep(0.1)
        element.clear()
        element.send_keys(value)
        time.sleep(0.1)
        # Force input event for Vue.js
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", element)
    except Exception as e:
        print(f"  >> Error filling {field_name}: {e}")

def get_shoonya_auth_code(user_id=None, password=None, totp_secret=None, broker_api_key=None):
    """Captures the OAuth code using robust performance log scanning."""
    # Prioritize passed params, fallback to environment
    uid = user_id or os.getenv("SHOONYA_USER_ID")
    pwd = (password or os.getenv("SHOONYA_PASSWORD", "")).strip('"')
    totp = totp_secret or os.getenv("SHOONYA_TOTP_SECRET")
    full_key = broker_api_key or os.getenv("BROKER_API_KEY")

    # Validate
    if not all([uid, pwd, totp, full_key]):
        print("  >> Error: Missing Shoonya credentials (SHOONYA_USER_ID, SHOONYA_PASSWORD, SHOONYA_TOTP_SECRET, BROKER_API_KEY)")
        return None

    client_id = full_key.split(":::")[1] if full_key and ":::" in full_key else full_key

    auth_url = f"https://trade.shoonya.com/OAuthlogin/investor-entry-level/login?api_key={client_id}&route_to={uid}&source=API"

    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.set_capability("goog:loggingPrefs", {"performance": "ALL", "browser": "ALL"})

    # Use the system-installed ARM64 Chromedriver for Oracle VM compatibility
    driver_path = "/usr/bin/chromedriver"
    if not os.path.exists(driver_path):
        from webdriver_manager.chrome import ChromeDriverManager
        driver_path = ChromeDriverManager().install()

    service = Service(executable_path=driver_path)
    driver = None
    try:
        print(f"  >> Launching browser for {uid}...")
        driver = webdriver.Chrome(service=service, options=options)
        wait = WebDriverWait(driver, 60)

        print(f"  >> Navigating to Auth URL...")
        driver.get(auth_url)

        # Wait for the first visible input (User ID)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input:not([type='hidden'])")))
        time.sleep(2)

        # Get all visible inputs
        all_inputs = driver.find_elements(By.CSS_SELECTOR, "input:not([type='hidden']):not([type='checkbox']):not([type='radio'])")
        visible_inputs = [inp for inp in all_inputs if inp.is_displayed()]

        if len(visible_inputs) < 3:
            print(f"  >> Error: Found only {len(visible_inputs)} visible inputs. Expected 3.")
            return None

        print("  >> Entering credentials...")
        fast_fill(driver, visible_inputs[0], uid, "UserID")
        fast_fill(driver, visible_inputs[1], pwd, "Password")

        otp_val = pyotp.TOTP(totp).now()
        fast_fill(driver, visible_inputs[2], otp_val, "TOTP")

        print("  >> Clicking LOGIN...")
        login_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='LOGIN']")))
        driver.execute_script("arguments[0].click();", login_btn)

        print("  >> Monitoring network for authorization code...")
        start_time = time.time()
        while time.time() - start_time < 60:
            auth_code = scan_network_for_code(driver)
            if auth_code:
                print(f"  >> CAPTURED_CODE={auth_code}")
                return auth_code

            # Check for error messages
            try:
                error_modal = driver.find_elements(By.CLASS_NAME, "v-card__text")
                for err in error_modal:
                    if "blocked" in err.text.lower():
                        print(f"  >> ERROR: {err.text}")
                        return f"ERROR: {err.text}"
                    if "invalid" in err.text.lower():
                        print(f"  >> ERROR: {err.text}")
            except:
                pass

            time.sleep(1)

        print("  >> ERROR: Timeout capturing auth code.")
        return None

    except Exception as e:
        print(f"  >> Selenium failure: {e}")
        return f"FAILURE: {str(e)}"
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    code = get_shoonya_auth_code()
    if code:
        print(f"Auth Success: {code}")
    else:
        print("Auth Failed")
