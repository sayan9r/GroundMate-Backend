import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';



const router = express.Router();

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

//contact us 
router.post('/contactus',async(req,res)=> {
    const {name,email,message} = req.body;
    if(!name  || !email || !message){
        return res.status(400).json({message:'please provide all details !'});
    }
    const newMessage = await pool.query(
        'INSERT INTO contactus (name,email,message) VALUES ($1,$2,$3) ',
        [name,email,message]
    )

    return res.status(201).json({Message:newMessage.rows[0]});
    
});

// Create Game
router.post('/creategame',protect,async(req,res) => {
    const {sportType,city,teamLength,date,startTime,description} = req.body;
    if(!sportType || !city || !teamLength || !date || !startTime || !description){
        return res.status(400).json({message:'please provide all details !'});
    }
    try{
    const userId = req.user.id;
    const result = await pool.query('SELECT email FROM users WHERE id = $1',[userId]);
    const userEmail = result.rows[0]?.email;
    const newGame = await pool.query(
        'INSERT INTO creategame (email,sportType,city,teamLength,gameDate,startTime,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,email,sportType,city,teamLength,gameDate,startTime,description',
        [userEmail,sportType,city,teamLength,date,startTime,description]
    )
    res.status(201).json({
      message: 'Game created successfully!',
      game: newGame.rows[0],
    });

    }catch(err){
        console.error(err);
       res.status(500).json({ message: 'Server error' });
    }
    
})

//see last created game
router.get('/lastcreategame',protect,async(req,res) => {
    try{
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM creategame WHERE email = (SELECT email FROM users WHERE id  = $1)  ORDER BY id DESC LIMIT 1',
    [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No game found for this user" });
    }
    res.json(result.rows[0]);

    }catch(err){
    console.error("Error fetching last created game:", err);
    res.status(500).json({ message: "Server error" });
    }
})

//se all created games 
router.get('/allcreategame',protect,async(req,res) => {

    try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM creategame WHERE email = (SELECT email FROM users WHERE id  = $1)',
        [userId]
    );
    res.json(result.rows);

    }catch(err){
        console.error(err);
        res.status(500).json({ message: "Server error" });

    }
})

//[join Game] all game except the user created
router.get('/joingame',protect,async(req,res) => {
    const userId = req.user.id;
    try {
    
    const result = await pool.query(`
      SELECT * 
      FROM creategame 
      WHERE  email != (SELECT email FROM users WHERE id  = $1)`,
        [userId]
    );
    res.json(result.rows);

    }catch(err){
        console.error(err);
        res.status(500).json({ message: "Server error" });

    }
})


//Called when a user clicks Join.
router.post('/joinrequest', protect, async (req, res) => {
  const { gameId } = req.body;
  const requesterId = req.user.id;

  try {
    await pool.query(
      'INSERT INTO join_requests (game_id, requester_id, status, created_at) VALUES ($1, $2, $3, NOW())',
      [gameId, requesterId, 'pending']
    );
    res.status(201).json({ message: "Join request sent successfully" });
  } catch (err) {
    console.error("Error creating join request:", err);
    res.status(500).json({ message: "Server error" });
  }
});


//Called by the creator to view all requests for a game.
router.get('/game-requests/:gameId', protect, async (req, res) => {
  const { gameId } = req.params;

  try {
    const result = await pool.query(
      `SELECT jr.id, u.name, u.email, jr.status
       FROM join_requests jr
       JOIN users u ON u.id = jr.requester_id
       WHERE jr.game_id = $1`,
      [gameId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching join requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// wher user clicked on accept or reject
router.put('/update-requests/:id', protect, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'

  try {
    await pool.query('UPDATE join_requests SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: `Request ${status}` });
  } catch (err) {
    console.error("Error updating join request:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// see the requested user if rejected or acepted
router.get("/joinstatus/:gameId", protect, async (req, res) => {
   const { gameId } = req.params;
  const userId = req.user.id; // from auth middleware

  try {
    const result = await pool.query(
      "SELECT status FROM join_requests WHERE game_id = $1 AND requester_id = $2 ",
      [gameId, userId]
    );
    const Length = result.rows.length;
    if (Length === 0) {
      return res.json({ status: "pending" });
    }

    const { status } = result.rows[Length-1];
    res.json({ status }); // could be 'pending', 'accepted', 'rejected'
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching join status" });
  }
});

router.get('/total-accepted/:gameId',protect, async(req,res) => {
    const { gameId } = req.params;
    try{
        const res1 = await pool.query('SELECT teamlength FROM creategame WHERE id = $1',[gameId]);
           if (res1.rows.length === 0) {
             return res.status(404).json({ message: "Game not found" });
            }

        const teamLength = res1.rows[0].teamlength;

        const res2 = await pool.query("SELECT COUNT(*) FROM join_requests WHERE game_id = $1 AND status = 'accepted'",
                    [gameId]);
        const acceptedCount = parseInt(res2.rows[0].count) + 1; // +1 for user who create the game
        
        res.json({ acceptedCount, teamLength, teamFull: acceptedCount >= teamLength });

    } catch(err) {
        console.error("Error checking total accepted:", err);
        res.status(500).json({ message: "Server error" });

    }
})

// render to start game 
router.get('/startgame/:gameId', protect, async (req, res) => {
  const { gameId } = req.params;

  try {
    const game = await pool.query(
      'SELECT * FROM creategame WHERE id = $1',
      [gameId]
    );
    const createduser = await pool.query(
      'SELECT name FROM users WHERE email = (SELECT email FROM creategame WHERE id = $1)',
      [gameId]
    );

    const acceptedPlayers = await pool.query(
      `SELECT u.id, u.name, u.email , u.contact_no
       FROM join_requests jr 
       JOIN users u ON u.id = jr.requester_id 
       WHERE jr.game_id = $1 AND jr.status = 'accepted'`,
      [gameId]
    );
     

    res.json({
      game: game.rows[0],
      createduser: createduser.rows[0],
      players: acceptedPlayers.rows,
    });
  } catch (err) {
    console.error("Error fetching start game data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// all joined game 
router.get('/myjoinedgames',protect,async (req,res) => {
  const userId = req.user.id;

   try {
    const result = await pool.query(`
      SELECT 
        g.id,
        g.sporttype AS game,
        g.city,
        g.gamedate,
        g.starttime,
        g.teamlength,
        g.id,
        u.name AS host_name,
        jr.status AS join_status,
        (
          SELECT COUNT(*) 
          FROM join_requests 
          WHERE game_id = g.id AND status = 'accepted'
        ) AS accepted_players
      FROM join_requests jr
      JOIN creategame g ON jr.game_id = g.id
      JOIN users u ON g.email = u.email
      WHERE jr.requester_id = $1
      ORDER BY g.gamedate DESC, g.starttime DESC
    `, [userId]);
  //   const result = await pool.query(`
  //     SELECT * FROM creategame WHERE id = (SELECT game_id FROM join_requests WHERE status = 'accepted' AND requester_id = $1 )`,
  //   [userId]
  // );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching joined games:", err);
    res.status(500).json({ message: "Server error" });
  }

});














export default router;