
def calculate(df, p=10):
    return df['close'].rolling(p).mean()
