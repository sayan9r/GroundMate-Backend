import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import routes from "./routes/index.js";



dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL ,
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());


app.use("/api",routes);

export default app;
