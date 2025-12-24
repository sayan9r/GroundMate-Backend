import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';



const router = express.Router();

// Health/status route to confirm server is running
router.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server started' });
});

const cookieOptions = {
    httpOnly : true ,
    // secure : process.env.NODE_ENV == "production" ,
    // sameSite : "Strict",
    secure: process.env.NODE_ENV === "production" ? true : false, // false for localhost
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Lax for local dev
    maxAge : 30 * 24 * 60 * 60 * 1000  // for 30 days
}

const generateToken =(id) => {
    return jwt.sign({ id },process.env.JWT_SECRET,{
        expiresIn : '30d'
    });
}

// Register

router.post('/register',async(req,res)=> {
    const {name,city,contact_no,email,password} = req.body;
    if(!name || !city || !contact_no || !email || !password){
        return res.status(400).json({message:'please provide all details !'});
    }

    const userExist = await pool.query('SELECT * FROM users WHERE email = $1',[email]);

    if(userExist.rows.length > 0 ){
        return res.status(400).json({message:'User already exist'});
    }
    const hashPassword = await bcrypt.hash(password,10);
    const newUser = await pool.query(
        'INSERT INTO users (name,city,contact_no,email,password) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email',
        [name,city,contact_no,email,hashPassword]
    )

    const token = generateToken(newUser.rows[0].id);

    res.cookie('token',token,cookieOptions);

    return res.status(201).json({user:newUser.rows[0]});
    
});

// Login 

router.post('/login',async(req,res)=> {
    const {email,password} = req.body;
    if( !email || !password){
        return res.status(400).json({message:'please provide all details !'});
    }
    const user = await pool.query('SELECT * FROM users WHERE email = $1',[email]);

    if(user.rows.length === 0 ){
        return res.status(400).json({message:'please register first'});
    }
    const userData = user.rows[0];
    const isMatch = await bcrypt.compare(password,userData.password);
    if(!isMatch){
        return res.status(400).json({message:'invalid password. try again'});
    }
    const token = generateToken(userData.id);
    res.cookie('token',token,cookieOptions);
    res.json({user: 
        {
        id:userData.id,
        name : userData.name,
        city : userData.city,
        contact_no : userData.contact_no,
        email : userData.email
        }
    });

})

//Me
router.get('/me',protect, async(req,res) => {
    res.json(req.user);
    //return info of the logged in user from protect middlewear
})

//Logout
router.post('/logout', protect, async(req,res) => {
    res.cookie('token','',{...cookieOptions,maxAge:1});
    res.json({message:'Logged out successfully'});
})





export default router;