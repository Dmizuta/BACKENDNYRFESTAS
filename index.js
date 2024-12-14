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
        const result = await pool.query('SELECT * FROM produtos');
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
    const { representante, razaosocial, cnpj, telefone, email } = req.body;
  
    // Ensure all required fields are provided
    if (!representante || !razaosocial || !cnpj || !telefone || !email) {
      return res.status(400).json({ error: 'All fields are required!' });
    }
  
    try {
      const result = await pool.query(
        `INSERT INTO cadastro (representante, razaosocial, cnpj, telefone, email) 
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [representante, razaosocial, cnpj, telefone, email]
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
        const existingUser = await pool.query('SELECT * FROM registro WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }

        // Insert new user
        await pool.query('INSERT INTO registro (username, password) VALUES ($1, $2)', [username, password]);
        res.json({ success: true, message: 'User registered successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});











/*

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    // Validate if both username and password are provided
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
  
    try {
      // Query the database for the user by username
      const result = await pool.query('SELECT * FROM registro WHERE username = $1', [username]);
  
      // Check if user exists
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
  
      // Compare the input password with the stored password
      const user = result.rows[0];
      if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
  
      // If authentication is successful
      res.json({ success: true, message: 'Login successful.' });
  
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  });

*/







  app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate if both username and password are provided
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
      // Query the database for the user by username
      const result = await pool.query('SELECT * FROM registro WHERE username = $1', [username]);

      // Check if user exists
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      // Compare the input password with the stored password
      const user = result.rows[0];
      if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      // If authentication is successful, return user data (e.g., username)
      res.json({ success: true, message: 'Login successful.', user: { username: user.username } });

    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});
















app.post('/add-to-order', async (req, res) => {
    const { username, razaosocial, codproduto, descricao, quantidade, preco } = req.body;
  
    try {
        // Step 1: Check if there's an open order
        const result = await pool.query(
            'SELECT id FROM pedidos WHERE username = $1 AND status = 0',
            [username]
        );
        const existingOrder = result.rows[0];
  
        let orderId;
        if (existingOrder) {
            orderId = existingOrder.id;
        } else {
            // Step 2: Create a new order if none exists
            const newOrderResult = await pool.query(
                'INSERT INTO pedidos (username, razaosocial, data, total, status) VALUES ($1, $2, TO_TIMESTAMP(EXTRACT(EPOCH FROM NOW())), 0, 0) RETURNING id',
                [username, razaosocial]
            );
            const newOrder = newOrderResult.rows[0];
            orderId = newOrder.id;
        }
  
        // Step 3: Add product to order items
        await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco) VALUES ($1, $2, $3, $4, $5)',
            [orderId, codproduto, descricao, quantidade, preco]
        );
  
        res.status(200).send({ message: 'Product added to order', orderId });
    } catch (error) {
        console.error('Error adding to order:', error);
        res.status(500).send({ error: 'Failed to add product to order' });
    }
  });