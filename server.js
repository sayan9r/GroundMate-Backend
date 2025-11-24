import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from "./routes/auth.js"



dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL ,
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());


app.use("/api/auth",authRoutes);

const PORT = process.env.PORT || 3000
app.listen(PORT,()=> {
    console.log(`server is running on port ${PORT}`);
   // console.log("CLIENT_URL is:", process.env.CLIENT_URL);
});