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
    const { representante, razaosocial, cnpj, telefone, email, username } = req.body;

    try {
        // Directly attempt to update the cadastro; if no rows are affected, insert a new one
        const cadastro = await upsertCadastro({
            representante,
            razaosocial,
            cnpj,
            telefone,
            email,
            username
        });

        res.status(200).json(cadastro); // Send the successful response
    } catch (error) {
        console.error('Error in /cadastro:', error);
        res.status(500).json({ error: 'Failed to process cadastro.' });
    }
});




async function upsertCadastro(data) {
    const { representante, razaosocial, cnpj, telefone, email, username } = data;

    // Attempt to update the existing cadastro
    const result = await pool.query(
        `UPDATE cadastro 
         SET representante = $1, razaosocial = $2, cnpj = $3, telefone = $4, email = $5 
         WHERE username = $6 
         RETURNING *`,
        [representante, razaosocial, cnpj, telefone, email, username]
    );

    if (result.rows.length > 0) {
        // If the update was successful, return the updated row
        return { message: 'Cadastro updated successfully.', cadastro: result.rows[0] };
    }

    // If no rows were updated, insert a new cadastro
    const insertResult = await pool.query(
        `INSERT INTO cadastro (representante, razaosocial, cnpj, telefone, email, username)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [representante, razaosocial, cnpj, telefone, email, username]
    );

    return { message: 'Cadastro created successfully.', cadastro: insertResult.rows[0] };
}

















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







app.get('/get-user-info', async (req, res) => {
  const { username } = req.query;  // Get the username from query parameter

  try {
      // Query the cadastro table to get user data based on username
      const result = await pool.query(
          'SELECT username, razaosocial FROM cadastro WHERE username = $1',
          [username]
      );

      if (result.rows.length > 0) {
          const userData = result.rows[0];  // Get user data from result
          res.json(userData);  // Send back the user data as JSON
      } else {
          res.status(404).json({ error: 'User not found' });
      }
  } catch (error) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});








app.post('/check-cadastro', async (req, res) => {
    const { username } = req.body;

    try {
        // Query the cadastro table to check if the necessary fields are filled
        const result = await pool.query(
            'SELECT razaosocial FROM cadastro WHERE username = $1',
            [username]
        );

        if (result.rows.length > 0) {
            const cadastro = result.rows[0];
            
            // Check if 'razaosocial' is filled (you can add more conditions here as needed)
            if (cadastro.razaosocial) {
                return res.status(200).send({ cadastroFilled: true });
            } else {
                return res.status(400).send({ error: 'Cadastro is incomplete. Please complete your cadastro.' });
            }
        } else {
            return res.status(404).send({ error: 'Cadastro not found. Please complete your cadastro.' });
        }
    } catch (error) {
        console.error('Error checking cadastro:', error);
        return res.status(500).send({ error: 'Failed to check cadastro.' });
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








/// GET route: Fetch user data by username
app.get('/cadastropage', async (req, res) => {
  const username = req.query.username;  // Fetch username from the query string
  console.log('Received username from query:', username); // Log the received username

  if (!username) {
    console.log('No username provided in the query'); // Log if the username is missing
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  try {
    // Query the database using the 'username' field
    console.log('Executing database query for username:', username); // Log the query execution
    const result = await pool.query(
      'SELECT representante, razaosocial, cnpj, telefone, email FROM cadastro WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.log('No data found for username:', username); // Log if no data is found
      return res.json({ success: false, message: 'No data found for this username.' });
    }

    console.log('Data retrieved from the database:', result.rows[0]); // Log the data retrieved from the database
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error during database query:', error); // Log any errors during the query
    res.status(500).json({ success: false, message: 'Error fetching data.' });
  }
});






app.get('/orders', async (req, res) => {
    // Retrieve the username from the query parameters
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    try {
        // Use the username directly to fetch orders from the 'pedidos' table
        const result = await pool.query(
            'SELECT id, razaosocial, data, total, status FROM pedidos WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, message: 'No orders found for this username.' });
        }

        res.json({ success: true, orders: result.rows });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, message: 'Error fetching orders.' });
    }
});
