const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL client for database connection

const app = express();
app.use(express.json());
app.use(cors()); // Allows any origin to access the API

// Set up PostgreSQL connection using environment variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Using the environment variable for DB connection
    ssl: {
        rejectUnauthorized: false, // Allows SSL connection with Neon (for secure connection)
    },
});

// Test database connection and fetch data from the 'products' table
app.get('/test-db-connection', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products LIMIT 5');
        res.json({
            status: 'success',
            message: 'Database connection successful!',
            data: result.rows,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to connect to the database or fetch data',
            error: error.message,
        });
    }
});

// Endpoint to get products from the database
app.get('/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch products from the database',
            error: error.message,
        });
    }
});


app.post('/cadastro', async (req, res) => {
    const { representante, razaosocial, cnpj, inscrest, endereco, cidade, estado, telefone, email } = req.body;
  
    // Ensure all required fields are provided
    if (!representante || !razaosocial || !cnpj || !inscrest || !endereco || !cidade || !estado || !telefone || !email) {
      return res.status(400).json({ error: 'All fields are required!' });
    }
  
    try {
      const result = await pool.query(
        `INSERT INTO cadastro (representante, razaosocial, cnpj, inscest, endereco, cidade, estado, telefone, email) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [representante, razaosocial, cnpj, inscrest, endereco, cidade, estado, telefone, email]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error during POST /cadastro:', err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });
  
// Start the server on port 80
app.listen(80, () => {
    console.log('Servidor rodando na porta 80');
});








app.post('/register', async (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
  
    try {
      // Check if user already exists
      const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Username already exists.' });
      }
  
      // Insert new user
      await db.query('INSERT INTO usuarios (username, password) VALUES ($1, $2)', [username, password]);
      res.json({ success: true, message: 'User registered successfully.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  });
  







  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
  
    try {
      // Check if user exists
      const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      if (user.rows.length === 0 || user.rows[0].password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
  
      res.json({ success: true, message: 'Login successful.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  });
  