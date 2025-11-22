import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const protect = async(req,res,next) => {
    try {
        const token  = req.cookies?.token;
        if(!token){
            return res.status(401).json({message:'not authorizes , no token '})
        }
        const decode  = jwt.verify(token,process.env.JWT_SECRET);
        const user = await pool.query("SELECT id,name,city,contact_no,email FROM users WHERE id = $1",
            [decode.id]
        );
        if(user.rows.length === 0){
            return res.status(401).json({message: 'not authorized , users not found'});
        }
        req.user = user.rows[0];
        next();
       
    }catch(error){
        console.error(error);
        res.status(401).json({messgae:'not authorizes , token failed'})
            
    }
}