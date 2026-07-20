const cache = new Map();


const queue = [];
let isProcessing = false;


const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
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

            cache.set(currentPage, result);

            batch.forEach(req => req.resolve(result));
            
        } catch (error) {
            batch.forEach(req => req.reject(error));
        }
    }

    isProcessing = false;
};

export const trendingMovieRoutes = (app) => {
    app.get('/api/movies/get_popular_movies', async (req, res) => {
        const page = Number(req.query.page) || 1;

        if (cache.has(page)) {
            return res.json(cache.get(page));
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