

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.D-j3yupI.js","_app/immutable/chunks/BCH_t-j-.js","_app/immutable/chunks/BRmaRTq3.js","_app/immutable/chunks/CX3urbS-.js"];
export const stylesheets = [];
export const fonts = [];
