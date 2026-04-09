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

// Ensure we don't default to localhost if accessed remotely
const apiHost = host === "localhost" || host === "127.0.0.1" ? "100.66.171.30" : host;

export const CONFIG = {
    API_BASE_URL: `${protocol}//${apiHost}:5001`,
    WS_URL: `${wsProtocol}//${apiHost}:8765`,
    API_KEY: import.meta.env.VITE_OPENALGO_API_KEY || "27a2bb73aed5e918033e3d1bd6f40ba68fa7e13cb7ffcffd32ff8455969fbe9c"
};
