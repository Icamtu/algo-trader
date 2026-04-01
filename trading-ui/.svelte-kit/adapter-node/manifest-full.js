export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.Bf6wgAGD.js",app:"_app/immutable/entry/app.JZUMLW10.js",imports:["_app/immutable/entry/start.Bf6wgAGD.js","_app/immutable/chunks/CjofsqLT.js","_app/immutable/chunks/BRmaRTq3.js","_app/immutable/chunks/BfI1E5Oe.js","_app/immutable/entry/app.JZUMLW10.js","_app/immutable/chunks/BRmaRTq3.js","_app/immutable/chunks/KTkD3cqX.js","_app/immutable/chunks/BCH_t-j-.js","_app/immutable/chunks/BfI1E5Oe.js","_app/immutable/chunks/D1J4gA1b.js","_app/immutable/chunks/CX3urbS-.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/api/algo-trader/pnl",
				pattern: /^\/api\/algo-trader\/pnl\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/pnl/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/positions",
				pattern: /^\/api\/algo-trader\/positions\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/positions/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/risk",
				pattern: /^\/api\/algo-trader\/risk\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/risk/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/strategies",
				pattern: /^\/api\/algo-trader\/strategies\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/strategies/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/strategies/[id]",
				pattern: /^\/api\/algo-trader\/strategies\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/strategies/_id_/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/strategies/[id]/start",
				pattern: /^\/api\/algo-trader\/strategies\/([^/]+?)\/start\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/strategies/_id_/start/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/strategies/[id]/stop",
				pattern: /^\/api\/algo-trader\/strategies\/([^/]+?)\/stop\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/strategies/_id_/stop/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/trades",
				pattern: /^\/api\/algo-trader\/trades\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/trades/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/trades/by-strategy/[strategy]",
				pattern: /^\/api\/algo-trader\/trades\/by-strategy\/([^/]+?)\/?$/,
				params: [{"name":"strategy","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/trades/by-strategy/_strategy_/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/trades/by-symbol/[symbol]",
				pattern: /^\/api\/algo-trader\/trades\/by-symbol\/([^/]+?)\/?$/,
				params: [{"name":"symbol","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/trades/by-symbol/_symbol_/_server.ts.js'))
			},
			{
				id: "/api/algo-trader/trades/open-positions",
				pattern: /^\/api\/algo-trader\/trades\/open-positions\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/algo-trader/trades/open-positions/_server.ts.js'))
			},
			{
				id: "/api/openalgo/websocket-session",
				pattern: /^\/api\/openalgo\/websocket-session\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/openalgo/websocket-session/_server.ts.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
