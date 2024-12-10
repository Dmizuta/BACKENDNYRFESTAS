const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg'); // Import PostgreSQL client for database connection

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

// New: Endpoint to insert customer data into the 'cadastro' table
app.post('/api/customers', async (req, res) => {
    const { name, email, phone } = req.body; // Expecting these fields in the request body
    try {
        const result = await pool.query(
            'INSERT INTO cadastro (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
            [name, email, phone]
        );
        res.status(201).json({
            status: 'success',
            message: 'Customer added successfully!',
            data: result.rows[0], // Returning the inserted row
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to insert customer data',
            error: error.message,
        });
    }
});

// Start the server on port 80
app.listen(80, () => {
    console.log('Servidor rodando na porta 80');
});
