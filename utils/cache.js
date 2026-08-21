const cache = new Map();
const lastModified = new Map();

export function getCache(key) {
    return cache.get(key);
}

export function setCache(key, data) {
    cache.set(key, { data, cachedAt: Date.now() });
}

export function touchModified(key) {
    lastModified.set(key, Date.now());
}

export function getModified(key) {
    return lastModified.get(key) || 0;
}

export function invalidateCache(key) {
    cache.delete(key);
}