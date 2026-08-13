const cache = new Map();

const CACHE_TTL = 12 * 60 * 60 * 1000;
let requestCount = 0


const queue = [];
let isProcessing = false;

const clearCache = () => {
    const now = Date.now()
    for (const [pageNumber, cachedEntry] of cache.entries()) {
        if (now - cachedEntry.timestamp > CACHE_TTL) {
            cache.delete(pageNumber)
        }
    }
}


const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
        if (requestCount >= 15){
            await new Promise(resolve => setTimeout(resolve, 1000))
            requestCount = 0
        }

        const currentPage = queue[0].page;

        const batch = [];
        while (queue.length > 0 && queue[0].page === currentPage) {
            batch.push(queue.shift());
        }

        try {
            const response = await fetch(`${process.env.TMDB_BASE_URL}/3/trending/all/day?page=${currentPage}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`
                }
            });

            if (!response.ok) throw new Error("TMDB API Error");

            const data = await response.json();
            const trending = data.results.filter(item => item.media_type !== "person");

            const result = {
                page: currentPage,
                results: trending
            };

            cache.set(currentPage, {
                data: result,
                timestamp: Date.now()
            });
            

            batch.forEach(req => req.resolve(result));
            
        } catch (error) {
            batch.forEach(req => req.reject(error));
        } finally{
            requestCount++
        }
    }

    isProcessing = false;
};


export const trendingMovieRoutes = (app) => {
    app.get('/api/movies/get_popular_movies', async (req, res) => {
        clearCache();

        const page = Number(req.query.page) || 1;

        if (cache.has(page)) {
            const cachedEntry = cache.get(page);
            const isExpired = Date.now() - cachedEntry.timestamp > CACHE_TTL

            if (!isExpired){
                return res.json(cache.get(page).data);
            }

            else{
                cache.delete(page);
            }
        }

        try {
            const data = await new Promise((resolve, reject) => {
                queue.push({ page, resolve, reject });

                queue.sort((a, b) => a.page - b.page);

                processQueue();
            });

            res.json(data);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch popular movies" });
        }
    });
};