
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/algo-trader" | "/api/algo-trader/pnl" | "/api/algo-trader/positions" | "/api/algo-trader/risk" | "/api/algo-trader/strategies" | "/api/algo-trader/strategies/[id]" | "/api/algo-trader/strategies/[id]/start" | "/api/algo-trader/strategies/[id]/stop" | "/api/algo-trader/trades" | "/api/algo-trader/trades/by-strategy" | "/api/algo-trader/trades/by-strategy/[strategy]" | "/api/algo-trader/trades/by-symbol" | "/api/algo-trader/trades/by-symbol/[symbol]" | "/api/algo-trader/trades/open-positions" | "/api/openalgo" | "/api/openalgo/websocket-session";
		RouteParams(): {
			"/api/algo-trader/strategies/[id]": { id: string };
			"/api/algo-trader/strategies/[id]/start": { id: string };
			"/api/algo-trader/strategies/[id]/stop": { id: string };
			"/api/algo-trader/trades/by-strategy/[strategy]": { strategy: string };
			"/api/algo-trader/trades/by-symbol/[symbol]": { symbol: string }
		};
		LayoutParams(): {
			"/": { id?: string; strategy?: string; symbol?: string };
			"/api": { id?: string; strategy?: string; symbol?: string };
			"/api/algo-trader": { id?: string; strategy?: string; symbol?: string };
			"/api/algo-trader/pnl": Record<string, never>;
			"/api/algo-trader/positions": Record<string, never>;
			"/api/algo-trader/risk": Record<string, never>;
			"/api/algo-trader/strategies": { id?: string };
			"/api/algo-trader/strategies/[id]": { id: string };
			"/api/algo-trader/strategies/[id]/start": { id: string };
			"/api/algo-trader/strategies/[id]/stop": { id: string };
			"/api/algo-trader/trades": { strategy?: string; symbol?: string };
			"/api/algo-trader/trades/by-strategy": { strategy?: string };
			"/api/algo-trader/trades/by-strategy/[strategy]": { strategy: string };
			"/api/algo-trader/trades/by-symbol": { symbol?: string };
			"/api/algo-trader/trades/by-symbol/[symbol]": { symbol: string };
			"/api/algo-trader/trades/open-positions": Record<string, never>;
			"/api/openalgo": Record<string, never>;
			"/api/openalgo/websocket-session": Record<string, never>
		};
		Pathname(): "/" | "/api/algo-trader/pnl" | "/api/algo-trader/positions" | "/api/algo-trader/risk" | "/api/algo-trader/strategies" | `/api/algo-trader/strategies/${string}` & {} | `/api/algo-trader/strategies/${string}/start` & {} | `/api/algo-trader/strategies/${string}/stop` & {} | "/api/algo-trader/trades" | `/api/algo-trader/trades/by-strategy/${string}` & {} | `/api/algo-trader/trades/by-symbol/${string}` & {} | "/api/algo-trader/trades/open-positions" | "/api/openalgo/websocket-session";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}