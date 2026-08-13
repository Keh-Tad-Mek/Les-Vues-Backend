import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mountAuthRoutes } from './auth/index.js';
import { trendingMovieRoutes } from './movies/get_trending.js';
import { movieSearchRoutes } from './movies/search.js';
import { seriesRoutes } from './movies/seriesRoutes.js';

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

mountAuthRoutes(app);

app.use(express.json());

trendingMovieRoutes(app)

movieSearchRoutes(app)

seriesRoutes(app)

app.listen(3000);