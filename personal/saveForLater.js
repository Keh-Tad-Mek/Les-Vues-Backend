import { eq, and } from "drizzle-orm";
import { auth } from "../auth/index.js";
import { db } from "../db/index.js";
import { saveForLater } from "../db/schema.js";
import { getCache, setCache, touchModified, getModified } from "../utils/cache.js";

export const saveForLaterRoute = (app) => {

    app.post('/api/personal/saveForLater', async (req, res) => {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
            return res.status(401).json({ error: "You are unauthorized." });
        }

        const user_id = session.user.id;
        const { id, backDropPath, posterPath, overview, mediaType, rating } = req.body;
        const title = req.body.title || req.body.name;

        if (!(id && typeof id === 'number' && title && typeof title === 'string' &&
            backDropPath && typeof backDropPath === 'string' && backDropPath[0] === '/' &&
            posterPath && typeof posterPath === 'string' && posterPath[0] === '/' &&
            overview && typeof overview === 'string' &&
            mediaType && (mediaType === 'tv' || mediaType === 'movie') &&
            rating && typeof rating === 'number' && rating >= 0 && rating <= 10
        )) {
            return res.status(400).json({ error: "Invalid movie data" });
        }

        const existing = await db.select()
            .from(saveForLater)
            .where(and(eq(saveForLater.user_id, user_id), eq(saveForLater.movie_id, id)));

        if (existing.length > 0) {
            return res.status(409).json({ error: "Movie/Series already saved." });
        }

        try {
            const result = await db.insert(saveForLater).values({
                user_id: user_id,
                movie_id: id,
                title: title,
                backdrop_path: backDropPath,
                poster_path: posterPath,
                overview: overview,
                media_type: mediaType,
                rating: rating
            }).returning({
                movie_id: saveForLater.movie_id,
                title: saveForLater.title,
                backdrop_path: saveForLater.backdrop_path,
                poster_path: saveForLater.poster_path,
                overview: saveForLater.overview,
                media_type: saveForLater.media_type,
                rating: saveForLater.rating,
            });


            const cacheKey = `saved:${user_id}`;
            touchModified(cacheKey);


            return res.status(200).json({ success: true, data: result[0] });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error." });
        }
    });

    app.get('/api/personal/saveForLater', async (req, res) => {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
            return res.status(401).json({ error: "You are unauthorized." });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        const user_id = session.user.id;
        const cacheKey = `saved:${user_id}`;

        try {
            const cached = getCache(cacheKey);
            const lastMod = getModified(cacheKey);

            // 1. CACHE HIT: Valid and fresh
            if (cached && cached.cachedAt > lastMod) {
                const paginated = cached.data.slice(offset, offset + limit);

                if (paginated.length === 0 && page > 1) {
                    return res.status(404).json({ message: "No saved movies found." });
                }

                console.log("FROM CACHE")
                return res.status(200).json(paginated); // Return array for frontend
            }

            const allMovies = await db.select({
                movie_id: saveForLater.movie_id,
                title: saveForLater.title,
                backdrop_path: saveForLater.backdrop_path,
                poster_path: saveForLater.poster_path,
                overview: saveForLater.overview,
                media_type: saveForLater.media_type,
                rating: saveForLater.rating
            })
                .from(saveForLater)
                .where(eq(saveForLater.user_id, user_id));

            setCache(cacheKey, allMovies);

            const paginated = allMovies.slice(offset, offset + limit);

            if (paginated.length === 0 && page > 1) {
                return res.status(404).json({ message: "No saved movies found." });
            }

            return res.status(200).json(paginated); // Return array for frontend

        } catch (error) {
            return res.status(500).json({ error: "Database error." });
        }
    });

    app.delete('/api/personal/saveForLater/:movieId', async (req, res) => {
        try {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session?.user?.id) {
                return res.status(401).json({ success: false, error: "Unauthorized access." });
            }

            const movie_id = parseInt(req.params.movieId, 10);
            if (Number.isNaN(movie_id) || movie_id <= 0) {
                return res.status(400).json({ success: false, error: "Invalid movie ID." });
            }

            const deleted = await db.delete(saveForLater)
                .where(and(eq(saveForLater.user_id, session.user.id), eq(saveForLater.movie_id, movie_id)))
                .returning({ deletedId: saveForLater.movie_id });

            if (!deleted.length) {
                return res.status(404).json({ success: false, error: "Movie not found." });
            }

            // Mark cache as out-of-date
            const cacheKey = `saved:${session.user.id}`;
            touchModified(cacheKey);

            return res.status(200).json({
                success: true,
                message: "Successfully removed from saved movies.",
                data: deleted[0]
            });

        } catch (error) {
            return res.status(500).json({ success: false, error: "Internal server error." });
        }
    });
};