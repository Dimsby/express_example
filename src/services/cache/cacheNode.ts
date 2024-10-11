import NodeCache from "node-cache";

// in seconds
const defaultOptions = {
    stdTTL: 60,
    checkperiod: 120
}

export let cacheNode

export const initCacheNode = () => {
    cacheNode = new NodeCache(defaultOptions)
}
