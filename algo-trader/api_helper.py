from NorenRestApiPy.NorenApi import NorenApi

class ShoonyaApiPy(NorenApi):
    def __init__(self):
        # Step 7: Modify host and websocket as per user instruction
        super().__init__(
            host='https://api.shoonya.com/NorenWClientAPI/',
            websocket='wss://api.shoonya.com/NorenWSAPI/'
        )
