class PaperBroker:
    """
    Deprecated local paper broker.

    Use OpenAlgo Sandbox/Analyzer for paper and front-test execution so
    execution, P&L, positions, holdings, and analyzer logs all come from the
    same platform instead of being duplicated in algo-trader.
    """

    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "PaperBroker is deprecated. Configure OpenAlgo Sandbox/Analyzer and "
            "use OpenAlgoClient for paper/front-test execution."
        )
