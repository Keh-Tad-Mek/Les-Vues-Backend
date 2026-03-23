import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mountAuthRoutes } from './auth/index.js';

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

mountAuthRoutes(app);

app.use(express.json());

app.listen(3000);