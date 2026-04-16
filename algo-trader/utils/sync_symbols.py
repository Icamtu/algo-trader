import io
import os
import zipfile
import re
import logging
import requests
import sqlite3
import pandas as pd
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("sync_symbols")

# Database setup using environment variables from algo-trader
DATABASE_PATH = os.getenv("OPENALGO_DB_PATH", "/app/storage/openalgo.db")

shoonya_urls = {
    "NSE": "https://api.shoonya.com/NSE_symbols.txt.zip",
    "NFO": "https://api.shoonya.com/NFO_symbols.txt.zip",
    "CDS": "https://api.shoonya.com/CDS_symbols.txt.zip",
    "MCX": "https://api.shoonya.com/MCX_symbols.txt.zip",
    "BSE": "https://api.shoonya.com/BSE_symbols.txt.zip",
    "BFO": "https://api.shoonya.com/BFO_symbols.txt.zip",
}

def download_and_unzip(output_path):
    if not os.path.exists(output_path):
        os.makedirs(output_path)

    for key, url in shoonya_urls.items():
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                z = zipfile.ZipFile(io.BytesIO(response.content))
                z.extractall(output_path)
                logger.info(f"Downloaded and unzipped {key}")
        except Exception as e:
            logger.error(f"Failed to download {key}: {e}")

def get_db_connection():
    return sqlite3.connect(DATABASE_PATH)

def delete_symtoken_table():
    logger.info("Clearing symtoken table...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM symtoken")
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error clearing table: {e}")

def process_nse(output_path):
    file_path = os.path.join(output_path, "NSE_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Instrument", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "instrumenttype", "tick_size"]

    def get_openalgo_symbol(b):
        if "-EQ" in b: return b.replace("-EQ", "")
        if "-BE" in b: return b.replace("-BE", "")
        return b

    df["symbol"] = df["brsymbol"].apply(get_openalgo_symbol)
    df["exchange"] = df.apply(lambda r: "NSE_INDEX" if r["instrumenttype"] == "INDEX" else "NSE", axis=1)
    df["brexchange"] = df["exchange"]
    df["expiry"] = ""
    df["strike"] = -1.0
    df["instrumenttype"] = df["instrumenttype"].apply(lambda x: "EQ" if x in ["EQ", "BE"] else x)
    df["lotsize"] = pd.to_numeric(df["lotsize"], errors="coerce").fillna(0).astype(int)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 100

    # Normalization
    nse_idx_mask = df["exchange"] == "NSE_INDEX"
    df.loc[nse_idx_mask, "symbol"] = df.loc[nse_idx_mask, "symbol"].str.upper().str.replace(" ", "").str.replace("-", "")
    df.loc[nse_idx_mask, "symbol"] = df.loc[nse_idx_mask, "symbol"].replace({
        "NIFTY50": "NIFTY", "NIFTYINDEX": "NIFTY", "NIFTYBANK": "BANKNIFTY", "NIFTYFIN": "FINNIFTY",
        "NIFTYFINSERVICE": "FINNIFTY", "NIFTYFINANCIALSERVICES": "FINNIFTY", "NIFTYNEXT50": "NIFTYNXT50",
        "NIFTYMIDSELECT": "MIDCPNIFTY", "NIFTYMIDCAPSELECT": "MIDCPNIFTY"
    })
    return df

def process_nfo(output_path):
    file_path = os.path.join(output_path, "NFO_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Expiry", "Instrument", "OptionType", "StrikePrice", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "expiry", "instrumenttype", "optiontype", "strike", "tick_size"]

    def format_date(d):
        try: return datetime.strptime(d, "%d-%b-%Y").strftime("%d-%b-%y").upper()
        except: return ""

    df["expiry"] = df["expiry"].apply(format_date)
    df["instrumenttype"] = df.apply(lambda r: "FUT" if r["optiontype"] == "XX" else r["optiontype"], axis=1)

    def format_sym(r):
        exp = r["expiry"].replace("-", "") if r["expiry"] else ""
        if r["instrumenttype"] == "FUT": return f"{r['name']}{exp}FUT"
        st = int(float(r["strike"])) if float(r["strike"]).is_integer() else r["strike"]
        return f"{r['name']}{exp}{st}{r['instrumenttype']}"

    df["symbol"] = df.apply(format_sym, axis=1)
    df["exchange"] = "NFO"
    df["brexchange"] = "NFO"
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce").fillna(-1.0)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 100
    return df

def process_cds(output_path):
    file_path = os.path.join(output_path, "CDS_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Expiry", "Instrument", "OptionType", "StrikePrice", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "expiry", "instrumenttype", "optiontype", "strike", "tick_size"]
    def format_date(d):
        try: return datetime.strptime(d, "%d-%b-%Y").strftime("%d-%b-%y").upper()
        except: return ""
    df["expiry"] = df["expiry"].apply(format_date)
    df["instrumenttype"] = df.apply(lambda r: "FUT" if r["optiontype"] == "XX" else r["optiontype"], axis=1)
    def format_sym(r):
        exp = r["expiry"].replace("-", "") if r["expiry"] else ""
        if r["instrumenttype"] == "FUT": return f"{r['name']}{exp}FUT"
        st = f"{float(r['strike']):.4f}".rstrip('0').rstrip('.')
        return f"{r['name']}{exp}{st}{r['instrumenttype']}"
    df["symbol"] = df.apply(format_sym, axis=1)
    df["exchange"] = "CDS"
    df["brexchange"] = "CDS"
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce").fillna(-1.0)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 10000
    return df

def process_mcx(output_path):
    file_path = os.path.join(output_path, "MCX_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Expiry", "Instrument", "OptionType", "StrikePrice", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "expiry", "instrumenttype", "optiontype", "strike", "tick_size"]
    def format_date(d):
        try: return datetime.strptime(d, "%d-%b-%Y").strftime("%d-%b-%y").upper()
        except: return ""
    df["expiry"] = df["expiry"].apply(format_date)
    df["instrumenttype"] = df.apply(lambda r: "FUT" if r["optiontype"] == "XX" else r["optiontype"], axis=1)
    def format_sym(r):
        exp = r["expiry"].replace("-", "") if r["expiry"] else ""
        if r["instrumenttype"] == "FUT": return f"{r['name']}{exp}FUT"
        st = int(float(r["strike"])) if float(r["strike"]).is_integer() else r["strike"]
        return f"{r['name']}{exp}{st}{r['instrumenttype']}"
    df["symbol"] = df.apply(format_sym, axis=1)
    df["exchange"] = "MCX"
    df["brexchange"] = "MCX"
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce").fillna(-1.0)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 100
    return df

def process_bse(output_path):
    file_path = os.path.join(output_path, "BSE_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Instrument", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "instrumenttype", "tick_size"]
    df["symbol"] = df["brsymbol"]
    df["exchange"] = "BSE"
    df["brexchange"] = "BSE"
    df["expiry"] = ""
    df["strike"] = -1.0
    df["lotsize"] = pd.to_numeric(df["lotsize"], errors="coerce").fillna(0).astype(int)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 100
    return df

def process_bfo(output_path):
    file_path = os.path.join(output_path, "BFO_symbols.txt")
    if not os.path.exists(file_path): return pd.DataFrame()
    df = pd.read_csv(file_path, usecols=["Exchange", "Token", "LotSize", "Symbol", "TradingSymbol", "Expiry", "Instrument", "OptionType", "StrikePrice", "TickSize"])
    df.columns = ["exchange", "token", "lotsize", "name", "brsymbol", "expiry", "instrumenttype", "optiontype", "strike", "tick_size"]
    def format_date(d):
        try: return datetime.strptime(d, "%d-%b-%Y").strftime("%d-%b-%y").upper()
        except: return ""
    df["expiry"] = df["expiry"].apply(format_date)
    df["instrumenttype"] = df.apply(lambda r: "FUT" if r["optiontype"] == "XX" else r["optiontype"], axis=1)
    def format_sym(r):
        exp = r["expiry"].replace("-", "") if r["expiry"] else ""
        if r["instrumenttype"] == "FUT": return f"{r['name']}{exp}FUT"
        st = int(float(r["strike"])) if float(r["strike"]).is_integer() else r["strike"]
        return f"{r['name']}{exp}{st}{r['instrumenttype']}"
    df["symbol"] = df.apply(format_sym, axis=1)
    df["exchange"] = "BFO"
    df["brexchange"] = "BFO"
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce").fillna(-1.0)
    df["tick_size"] = pd.to_numeric(df["tick_size"], errors="coerce") / 100
    return df

def run_sync():
    logger.info("Starting Master Contract Sync...")
    output_path = "/tmp/shoonya_symbols"
    try:
        download_and_unzip(output_path)
        delete_symtoken_table()

        conn = get_db_connection()

        processors = [process_nse, process_nfo, process_cds, process_mcx, process_bse, process_bfo]
        cols_to_keep = ["symbol", "brsymbol", "name", "exchange", "brexchange", "token", "expiry", "strike", "lotsize", "instrumenttype", "tick_size"]

        for proc in processors:
            df = proc(output_path)
            if not df.empty:
                df_filtered = df[cols_to_keep]
                df_filtered.to_sql("symtoken", conn, if_exists="append", index=False)
                logger.info(f"Inserted {len(df_filtered)} records for an exchange.")

        conn.commit()
        conn.close()

        # Cleanup
        for f in os.listdir(output_path):
            os.remove(os.path.join(output_path, f))
        os.rmdir(output_path)

        logger.info("Sync completed successfully.")
        return True
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return False

if __name__ == "__main__":
    run_sync()
