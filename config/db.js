import {Pool} from "pg";
import dotenv from 'dotenv';

dotenv.config();

// const pool = new Pool({
//     host: process.env.DB_HOST, 
//     port:  process.env.DB_PORT,
//     database: process.env.DB_NAME,
//     user:process.env.DB_USER,
//     password: process.env.DB_PASSWORD

// });

const pool = new Pool({
    connectionString : process.env.DATABASE_URL,
    ssl: 
        process.env.NODE_ENV === "production" ? {rejectUnauthorized:false} : false,

});

pool.on("connect", ()=> {
    console.log("connected to databse");
});

pool.on("error", ()=> {
    console.error("unexpected from client ", err);
    // process.exit(-1);
});

export default pool;