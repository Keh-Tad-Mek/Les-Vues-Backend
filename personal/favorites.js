import { eq, and } from "drizzle-orm";
import { auth } from "../auth/index.js";
import { db } from "../db/index.js";
import { favorites } from "../db/schema.js";
import { getCache, setCache, touchModified, getModified } from "../utils/cache.js";
import { getHeadersFromRequest } from "../utils/headers.js";

export const favoritesRoute = (app) => {

    app.post('/api/personal/favorites', async (req, res) => {
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
            .from(favorites)
            .where(and(eq(favorites.user_id, user_id), eq(favorites.movie_id, id)));

        if (existing.length > 0) {
            return res.status(409).json({ error: "Movie/Series already in favorites." });
        }

        try {
            const result = await db.insert(favorites).values({
                user_id: user_id,
                movie_id: id,
                title: title,
                backdrop_path: backDropPath,
                poster_path: posterPath,
                overview: overview,
                media_type: mediaType,
                rating: rating
            }).returning({
                movie_id: favorites.movie_id,
                title: favorites.title,
                backdrop_path: favorites.backdrop_path,
                poster_path: favorites.poster_path,
                overview: favorites.overview,
                media_type: favorites.media_type,
                rating: favorites.rating,
            });

            const cacheKey = `favorites:${user_id}`;
            touchModified(cacheKey);


            return res.status(200).json({ success: true, data: result[0] });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error." });
        }
    });

    app.get('/api/personal/favorites', async (req, res) => {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
            return res.status(401).json({ error: "You are unauthorized." });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        const user_id = session.user.id;
        const cacheKey = `favorites:${user_id}`;

        try {
            const cached = getCache(cacheKey);
            const lastMod = getModified(cacheKey);
            
            // 1. CACHE HIT
            if (cached && cached.cachedAt > lastMod) {
                const paginated = cached.data.slice(offset, offset + limit);
                
                if (paginated.length === 0 && page > 1) {
                    return res.status(404).json({ message: "No saved movies found." });
                }

                return res.status(200).json(safeData);
            }

            // 2. CACHE MISS / STALE
            const allMovies = await db.select({
                movie_id: favorites.movie_id,
                title: favorites.title,
                backdrop_path: favorites.backdrop_path,
                poster_path: favorites.poster_path,
                overview: favorites.overview,
                media_type: favorites.media_type,
                rating: favorites.rating
            })
            .from(favorites)
            .where(eq(favorites.user_id, user_id));

            setCache(cacheKey, allMovies);

            const paginated = allMovies.slice(offset, offset + limit);
            
            if (paginated.length === 0 && page > 1) {
                return res.status(404).json({ message: "No saved movies found." });
            }


            return res.status(200).json(paginated);

        } catch (error) {
            return res.status(500).json({ error: "Database error." });
        }
    });

    app.delete('/api/personal/favorites/:movieId', async (req, res) => {
        try {  
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) {
                return res.status(401).json({ error: "You are unauthorized." });
            }

            const movie_id = parseInt(req.params.movieId, 10);
            if (Number.isNaN(movie_id) || movie_id <= 0) {
                return res.status(400).json({ success: false, error: "Invalid movie ID." });
            }

            const deleted = await db.delete(favorites)
                .where(and(eq(favorites.user_id, session.user.id), eq(favorites.movie_id, movie_id)))
                .returning({ deletedId: favorites.movie_id });

            if (!deleted.length) {
                return res.status(404).json({ success: false, error: "Favorite not found." });
            }

            const cacheKey = `favorites:${session.user.id}`;
            touchModified(cacheKey); 

            return res.status(200).json({
                success: true,
                message: "Successfully removed from favorites.",
                data: deleted[0]
            });

        } catch (error) {
            return res.status(500).json({ success: false, error: "Internal server error." });
        }
    });
};
