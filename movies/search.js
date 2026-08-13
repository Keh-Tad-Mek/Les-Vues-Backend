const cache = new Map();
let queue = []; // Changed to let so we can reassign it during filtering
const CACHE_TTL = 12 * 60 * 60 * 1000;
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'of', 'for', 'on', 'at', 'to', 'in',
    'and', 'or', 'but', 'nor', 'so', 'for', 'yet'
]);
let isProcessing = false;
let requestCount = 0

const queryCleanUp = (query) => {
    return query.toLowerCase()
        .split(' ')
        .filter(word => !STOP_WORDS.has(word))
        .join(' ');
}

const cleanExpiredCache = () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp >= CACHE_TTL) {
            cache.delete(key);
        }
    }
};

const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
        if (requestCount >= 15){
            await new Promise(resolve => setTimeout(resolve, 1000))
            requestCount = 0
        }

        const currentTask = queue[0];
        const { cacheKey, query, page } = currentTask;

        const matchingTasks = queue.filter(task => task.cacheKey === cacheKey);
        
        queue = queue.filter(task => task.cacheKey !== cacheKey);

        try {
            console.log(`Fetching TMDB for: "${query}" Page: ${page}. Fulfilling ${matchingTasks.length} queued request(s).`);

            const response = await fetch(`${process.env.TMDB_BASE_URL}/3/search/multi?query=${query}&page=${page}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`
                }
            });

            const data = await response.json();
            
            // Safely fallback to [] in case TMDB returns an error object without results
            const results = (data.results || []).filter(item => item.media_type !== "person");

            const finalResult = {
                result: results,
                page: Number(page)
            };

            // 6. Save to cache with a timestamp
            cache.set(cacheKey, {
                timestamp: Date.now(),
                data: finalResult
            });

            // 7. Hand the results to EVERY user who asked for it simultaneously
            matchingTasks.forEach(task => task.resolve(finalResult));

        } catch (error) {
            console.error("TMDB Fetch Error:", error);
            // If it fails, reject all users waiting for this specific query
            matchingTasks.forEach(task => task.reject(error));
        } finally{
            requestCount++
        }
    }

    // Queue is empty, turn off the processor
    isProcessing = false;
};

// THE EXPRESS ROUTE
export const movieSearchRoutes = (app) => {
    app.get('/api/movies/search', async (req, res) => {
        cleanExpiredCache()

        try {
            const rawQuery = req.query.query || '';
            const page = req.query.page || 1;
            const query = queryCleanUp(rawQuery);

            // If query is empty after cleanup (e.g., user just searched "the"), return empty early
            if (!query) {
                return res.json({ result: [], page: Number(page) });
            }

            // Create a unique key for grouping and caching (e.g., "batman_1")
            const cacheKey = `${query}_${page}`;

            // STEP 1: Check Cache First
            if (cache.has(cacheKey)) {
                const cachedData = cache.get(cacheKey);
                

                if (Date.now() - cachedData.timestamp < CACHE_TTL) {
                    console.log(`Cache hit for: ${cacheKey}`);
                    
                    return res.json(cachedData.data);
                } else {
                    // Cache expired, delete it and continue to queue
                    cache.delete(cacheKey);
                }
            }

            // STEP 2: Enqueue the Request
            // We create a Promise that suspends this specific Express response until the processor resolves it
            const result = await new Promise((resolve, reject) => {
                queue.push({ query, page, cacheKey, resolve, reject });
                queue.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));
                processQueue(); // Kickstart the processor if it isn't running
            });

            // STEP 3: Return the result once the processor calls resolve()
            res.json(result);

        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
};