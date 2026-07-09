export const movieSearchRoutes = (app) => {
    app.get('/api/movies/search', async(req, res)=>{
        const { query } = req.query
        const { page } = req.query
        const response = await fetch(`${process.env.TMDB_BASE_URL}/3/search/multi?query=${query}&page=${page}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`
            }
        })

        const data = await response.json()
        const results = data.results.filter(item => item.media_type !== "person")
        console.log(results)
        res.json({
            result: results,
            page: Number(page)
        })
    })
}