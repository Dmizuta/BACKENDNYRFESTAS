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





app.post('/test', async (req, res) => {
    const { A, B } = req.body; // Extract A and B from the request body
  
    // Validate that both fields are provided
    if (!A || !B) {
      return res.status(400).json({ error: 'Both fields A and B are required!' });
    }
  
    try {
      // Insert the data into the test table
      const result = await pool.query(
        'INSERT INTO test (A, B) VALUES ($1, $2) RETURNING *',
        [A, B]
      );
      res.status(201).json(result.rows[0]); // Return the inserted row
    } catch (err) {
      console.error('Error during POST /test:', err); // Log errors for debugging
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });
  










// Start the server on port 80
app.listen(80, () => {
    console.log('Servidor rodando na porta 80');
});
