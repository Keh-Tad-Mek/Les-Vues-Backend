import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mountAuthRoutes } from './auth/index.js';
import { trendingMovieRoutes } from './movies/get_popular_movies.js';
import { movieSearchRoutes } from './movies/search_movies.js';

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

mountAuthRoutes(app);

app.use(express.json());

trendingMovieRoutes(app)

movieSearchRoutes(app)

app.listen(3000);