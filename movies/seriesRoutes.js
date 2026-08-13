import dotenv from 'dotenv';
dotenv.config();

const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

let requestCount = 0;
let queue = [];
let isProcessing = false;

const clearCache = () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
};

const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
        while (queue.length > 0) {
            if (requestCount >= 15) {
                console.log("[Queue] Hit 15 requests threshold. Pausing queue for 1 second...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                requestCount = 0;
            }

            queue.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));
            
            const currentTask = queue[0];
            const { cacheKey, endpoint } = currentTask;

            const batch = [];
            while (queue.length > 0 && queue[0].cacheKey === cacheKey) {
                batch.push(queue.shift());
            }

            try {
                // 1. Sanitize Base URL to avoid duplicate "/3"
                let rawBaseUrl = process.env.TMDB_BASE_URL || "https://api.themoviedb.org";
                let cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "").replace(/\/3$/, ""); 
                let targetUrl = `${cleanBaseUrl}${endpoint}`;

                // 2. Resolve Auth Token or API Key
                const token = process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_READ_TOKEN;
                const apiKey = process.env.TMDB_API_KEY || process.env.TMDB_KEY;

                const headers = {
                    "accept": "application/json"
                };

                if (token) {
                    const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
                    headers["Authorization"] = `Bearer ${cleanToken}`;
                } else if (apiKey) {
                    const separator = targetUrl.includes("?") ? "&" : "?";
                    targetUrl += `${separator}api_key=${apiKey.trim()}`;
                } else {
                    console.warn("[TMDB Warning] Neither TMDB_API_READ_ACCESS_TOKEN nor TMDB_API_KEY is configured!");
                }

                console.log(`[TMDB] Fetching: ${targetUrl}`);

                if (typeof fetch === "undefined") {
                    throw new Error("Fetch API is unavailable. Ensure Node v18+ is installed.");
                }

                const response = await fetch(targetUrl, {
                    method: "GET",
                    headers: headers
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`[TMDB API Error] Status: ${response.status} | Details: ${errText}`);
                    throw new Error(`TMDB API Error ${response.status}: ${errText}`);
                }

                const data = await response.json();

                cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });

                batch.forEach(req => req.resolve(data));
                
            } catch (error) {
                console.error(`[Queue Processing Error] Failed to fetch ${cacheKey}:`, error.message);
                batch.forEach(req => req.reject(error));
            } finally {
                requestCount++;
            }
        }
    } catch (err) {
        console.error("Queue loop encountered a fatal error:", err);
    } finally {
        isProcessing = false;
        // Resume processing if tasks were added while exiting
        if (queue.length > 0) {
            processQueue();
        }
    }
};

export const seriesRoutes = (app) => {
    app.get('/api/movies/get_series_info', async (req, res) => {
        clearCache();

        const { id, seasonNumber } = req.query;

        if (!id || id === "undefined" || id === "null") {
            return res.status(400).json({ error: "Missing or invalid series ID" });
        }

        const isSeasonData = seasonNumber !== undefined && seasonNumber !== ""; 
        
        const endpoint = isSeasonData ? `/3/tv/${id}/season/${seasonNumber}` : `/3/tv/${id}`;
        const cacheKey = isSeasonData ? `tv_${id}_season_${seasonNumber}` : `tv_${id}`;

        if (cache.has(cacheKey)) {
            const cachedEntry = cache.get(cacheKey);
            const isExpired = Date.now() - cachedEntry.timestamp > CACHE_TTL;

            if (!isExpired) {
                console.log(`[Cache Hit] Serving ${cacheKey} from cache.`);
                return res.json(cachedEntry.data);
            } else {
                cache.delete(cacheKey);
            }
        }

        try {
            const data = await new Promise((resolve, reject) => {
                queue.push({ cacheKey, endpoint, resolve, reject });
                processQueue();
            });

            res.json(data);
        } catch (error) {
            console.error("Endpoint catch wrapper hit for ID:", id, "| Reason:", error.message);
            res.status(500).json({ error: "Failed to fetch series info", details: error.message });
        }
    });
};