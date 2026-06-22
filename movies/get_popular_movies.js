export const trendingMovieRoutes = (app) => {
    app.get('/api/movies/get_popular_movies', async (req, res) => {
        const page = req.query.page || 1;

        try {
            const response = await fetch(`${process.env.TMDB_BASE_URL}/3/trending/all/day?page=${page}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`
                }
            });

            const data = await response.json();
            const trending = data.results.filter(item => item.media_type !== "person");
            
            res.json({
                page: Number(page),
                results: trending
            });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch popular movies" });
        }
    });
};