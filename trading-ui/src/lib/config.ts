const getHost = () => {
    if (typeof window !== "undefined") {
        return window.location.hostname;
    }
    return "localhost";
};

const getProtocol = () => {
    if (typeof window !== "undefined") {
        return window.location.protocol;
    }
    return "http:";
};

const host = getHost();
const protocol = getProtocol();
const wsProtocol = protocol === "https:" ? "wss:" : "ws:";

const apiHost = import.meta.env.VITE_API_HOST || host;
const isLocal = host === "localhost" || host === "127.0.0.1";

export const CONFIG = {
    // Force direct IP connection as requested, bypassing relative proxy paths which can be flaky on Tailscale
    API_BASE_URL: `http://${apiHost}:18788`,
    WS_URL: `${wsProtocol}//${apiHost}:5002`,
    API_KEY: import.meta.env.VITE_OPENALGO_API_KEY || "27a2bb73aed5e918033e3d1bd6f40ba68fa7e13cb7ffcffd32ff8455969fbe9c"
};
