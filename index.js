const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL client for database connection
const jwt = require('jsonwebtoken'); // JWT for user authentication

const app = express();
app.use(express.json());
app.use(cors()); // Allows any origin to access the API

const JWT_SECRET = process.env.JWT_SECRET; // Secret key for JWT
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN; // Expiration time for JWT

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
            message: 'CONEXÃO COM DATABASE ESTABELECIDA!',
            data: result.rows,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'FALHA NA COMEXÃO COM A DATABASE.',
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
            message: 'FALHA AO BUSCAR OS DADOS DOS PRODUTOS.',
            error: error.message,
        });
    }
});



app.get('/product-buy/:id', async (req, res) => {
    const productCode = req.params.id;
    try {
        const result = await pool.query(
            'SELECT idprod, descricao, cxfechada, precofechada, precofrac, cxfracionada FROM produtos WHERE codproduto = $1',
            [productCode]
        );

        if (result.rows.length === 1) {
            // If only one product is found, return it as an object
            res.json(result.rows[0]);
        } else if (result.rows.length === 0) {
            // If no products are found, send a 404 status with a message
            res.status(404).json({
                status: 'error',
                message: `NENHUM PRODUTO ENCONTRADO COM ESTE CÓDIGO: ${productCode}`,
            });
        } else {
            // If multiple products are found (unexpected scenario), return the full array
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Error fetching product:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'FALHA AO BUSCAR OS DADOS DOS PRODUTOS.',
            error: error.message,
        });
    }
});


app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'NECESSÁRIO USUÁRIO E SENHA.' });
    }

    try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM registro WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'USUÁRIO JÁ EXISTE.' });
        }

        // Insert new user
        await pool.query('INSERT INTO registro (username, password, role) VALUES ($1, $2, $3)', [username, password, role]);
        res.json({ success: true, message: 'USUÁRIO REGISTRADO COM SUCESSO!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'FALHA NO SERVIDOR, TENTE MAIS TARDE.' });
    }
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate if both username and password are provided
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'NECESSÁRIO USUÁRIO E SENHA.' });
    }

    try {
        // Query the "registro" table for the user by username
        const result = await pool.query('SELECT username, password, role FROM registro WHERE username = $1', [username]);

        // Check if user exists in the "registro" table
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'USUÁRIO OU SENHA INVÁLIDOS.' });
        }

        const user = result.rows[0];

        // Compare the input password with the stored password in the "registro" table
        if (user.username !== username || user.password !== password) {
            return res.status(401).json({ success: false, message: 'USUÁRIO OU SENHA INVÁLIDOS.' });
        }

        // Query the "cadastro" table to get the customerId associated with this user
        const cadastroResult = await pool.query('SELECT id FROM cadastro WHERE username = $1', [username]);

        let customerId;

if (cadastroResult.rows.length > 0) {
    customerId = cadastroResult.rows[0].id;  // Set the customerId if found
} else {
    customerId = null;  // Explicitly set to null if no customerId is found
}


        // If authentication is successful, return user data and generate JWT token
        const token = jwt.sign({
            username: user.username,
            role: user.role,
            customerId  // Ensure the key name here is 'customerId' for consistency
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Send the response with the token
        res.json({
            success: true,
            message: 'Login successful.',
            user: { username: user.username, role: user.role, customerId }, // Returning 'customerId' here
            token
        });

    } catch (error) {
        console.error('Error during login:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'FALHA NO SERVIDOR, TENTE MAIS TARDE.' });
        }
    }
});



app.post('/check-cadastro', async (req, res) => {
    const {username} = req.body;

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
                return res.status(400).send({ error: 'CADASTRO INCOMPLETO.' });
            }
        } else {
            return res.status(404).send({ error: 'CADASTRO NÃO ENCONTRADO.' });
        }
    } catch (error) {
        console.error('PREENCHA SEU CADASTRO.', error);
        return res.status(500).send({ error: 'Failed to check cadastro.' });
    }
});




app.get('/get-user-info', async (req, res) => {
    const { customerId } = req.query;  // Get the username from query parameter

    try {
        // Query the cadastro table to get user data based on username
        const result = await pool.query(
            'SELECT username, razaosocial, representante, cnpj, endereco FROM cadastro WHERE id = $1',
            [customerId]
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





app.post('/add-to-order', async (req, res) => {
    const { username, razaosocial, codproduto, descricao, quantidade, preco, representante, cnpj } = req.body;

    try {
        // Step 1: Check if there's an open draft order for the given razaosocial
        const result = await pool.query(
            'SELECT id, razaosocial FROM pedidos WHERE username = $1 AND status = 0', 
            [username]
        );
        const existingOrder = result.rows[0];

        let orderId;

        if (existingOrder) {
            if (existingOrder.razaosocial === razaosocial) {
                // If razaosocial matches, add the product to the existing order
                orderId = existingOrder.id;
            } else {
                // If razaosocial doesn't match, show an error message asking to save the order
                return res.status(400).send({ 
                    error: `FINALIZE O PEDIDO DO USUÁRIO >>>${existingOrder.razaosocial}<<< ANTES DE ABRIR UM NOVO PEDIDO.`
                });
            }
        } else {
            // Step 2: If no draft order exists, create a new one
            const newOrderResult = await pool.query(
                'INSERT INTO pedidos (username, razaosocial, representante, cnpj, data, total, status) VALUES ($1, $2, $3, $4, TO_TIMESTAMP(EXTRACT(EPOCH FROM NOW())), 0, 0) RETURNING id',
                [username, razaosocial, representante, cnpj]
            );
            const newOrder = newOrderResult.rows[0];
            orderId = newOrder.id;
        }

        // Step 3: Add product to order items
        await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco) VALUES ($1, $2, $3, $4, $5)',
            [orderId, codproduto, descricao, quantidade, preco]
        );

        // Step 4: Calculate the total price for the order
        const totalResult = await pool.query(
            'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
            [orderId]
        );

        const total = totalResult.rows[0].total || 0; // Se não houver itens, total será 0
        console.log('Calculated total:', total); // Log do total calculado

        // Step 5: Update the total in the pedidos table
        const updateResult = await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, orderId]
        );

        console.log('Update result:', updateResult); // Log do resultado da atualização

        res.status(200).send({ message: 'PRODUTO ADICIONADO COM SUCESSO!', orderId });
    } catch (error) {
        console.error('Error adding to order:', error);
        res.status(500).send({ error: 'FALHA AO ADICIONAR O PRODUTO.' });
    }
});


app.post('/add-to-order-admin', async (req, res) => {
    const { username, razaosocial, codproduto, descricao, quantidade, preco, customerId, representante, cnpj } = req.body;

    try {
        // Step 1: Check if there's an open draft order for the given razaosocial
        const result = await pool.query(
            'SELECT id, razaosocial FROM pedidos WHERE username = $1 AND status = 0', 
            [username]
                    
        );
        const existingOrder = result.rows[0];
       

        let orderId;

        if (existingOrder) {
            
            if (existingOrder.razaosocial === razaosocial) {
                // If razaosocial matches, add the product to the existing order
                orderId = existingOrder.id;
            } else {
                // If razaosocial doesn't match, show an error message asking to save the order
                return res.status(400).send({ 
                    error: `FINALIZE O PEDIDO DO USUÁRIO  >>>${existingOrder.razaosocial}<<< ANTES DE ABRIR UM NOVO PEDIDO.`
                });
            }
        } else {
            // Step 2: If no draft order exists, create a new one
            const newOrderResult = await pool.query(
               'INSERT INTO pedidos (username, razaosocial, representante, cnpj, data, total, status) VALUES ($1, $2, $3, $4, TO_TIMESTAMP(EXTRACT(EPOCH FROM NOW())), 0, 0) RETURNING id',
                [username, razaosocial, representante, cnpj]
            );
            const newOrder = newOrderResult.rows[0];
            orderId = newOrder.id;
        }

        // Step 3: Add product to order items
        await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco) VALUES ($1, $2, $3, $4, $5)',
            [orderId, codproduto, descricao, quantidade, preco]
        );


// Step 4: Calculate the total price for the order
const totalResult = await pool.query(
    'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
    [orderId]
);

const total = totalResult.rows[0].total || 0; // Se não houver itens, total será 0
console.log('Calculated total:', total); // Log do total calculado

// Step 5: Update the total in the pedidos table
const updateResult = await pool.query(
    'UPDATE pedidos SET total = $1 WHERE id = $2',
    [total, orderId]
);

        res.status(200).send({ message: 'PRODUTO ADICIONADO AO PEDIDO!', orderId });
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
        return res.status(400).json({ success: false, message: 'NECESSÁRIO USUÁRIO.' });
    }

    try {
        // Query the database using the 'username' field
        console.log('Executing database query for username:', username); // Log the query execution
        const result = await pool.query(
            'SELECT representante, razaosocial, cnpj, endereco, telefone, email FROM cadastro WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            console.log('No data found for username:', username); // Log if no data is found
            return res.json({ success: false, message: 'USUÁRIO NÃO ENCONTRADO.' });
        }

        console.log('Data retrieved from the database:', result.rows[0]); // Log the data retrieved from the database
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error during database query:', error); // Log any errors during the query
        res.status(500).json({ success: false, message: 'FALHA AO BUSCAR DADOS.' });
    }
});
































// Endpoint to fetch orders for a specific username
app.get('/orders', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'NECESSÁRIO USUÁRIO.' });
    }

    try {
        /*const result = await pool.query(
            'SELECT id, razaosocial, data, total, status FROM pedidos WHERE username = $1',
            [username]*/



            const result = await pool.query(
                'SELECT id, razaosocial, data, total, status FROM pedidos WHERE username = $1 ORDER BY id DESC', // Add ORDER BY clause
                [username]


        );

        if (result.rows.length === 0) {
            return res.json([]);  // Return an empty array if no orders found
        }

        // Send the orders directly as an array
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'FALHA AO BUSCAR DADOS.' });
    }
});



// Endpoint to fetch orders for a specific username
app.get('/orders-admin', async (req, res) => {



  /*  const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'NECESSÁRIO USUÁRIO.' });
    }
*/



    try {

        const result = await pool.query(`
            SELECT DISTINCT ON (pedidos.id)
                pedidos.id, 
                pedidos.username,          
                cadastro.representante,    
                pedidos.razaosocial, 
                pedidos.data, 
                pedidos.total, 
                pedidos.status
            FROM 
                pedidos
            LEFT JOIN 
                cadastro 
            ON 
                pedidos.username = cadastro.username
            ORDER BY pedidos.id DESC; -- Add the ORDER BY clause here
        `);
/*
const result = await pool.query(`
    SELECT DISTINCT ON (pedidos.id)
    pedidos.id, 
    pedidos.username,          
    cadastro.representante,    
    pedidos.razaosocial, 
    pedidos.data, 
    pedidos.total, 
    pedidos.status
FROM 
    pedidos
LEFT JOIN 
    cadastro 
ON 
    pedidos.username = cadastro.username;

 `);
*/
        
        if (result.rows.length === 0) {
            return res.json([]);  // Return an empty array if no orders found
        }

        // Send the orders directly as an array
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'FALHA AO BUSCAR DADOS DOS PEDIDOS.' });
    }
});



// Create or update cadastro (user)
app.post('/cadastro', async (req, res) => {
    const { representante, razaosocial, cnpj, endereco, telefone, email, username } = req.body;

    try {
        // Directly attempt to update the cadastro; if no rows are affected, insert a new one
        const cadastro = await upsertCadastro({
            representante,
            razaosocial,
            cnpj,
            endereco,
            telefone,
            email,
            username
        });

        // Send the successful response with the customerId
        res.status(200).json({
            message: cadastro.message,    // Success message
            customerId: cadastro.cadastro.id // Send the customerId back to frontend
        });
    } catch (error) {
        console.error('Error in /cadastro:', error);
        res.status(500).json({ error: 'Failed to process cadastro.' });
    }
});

async function upsertCadastro(data) {
    const { representante, razaosocial, cnpj, endereco, telefone, email, username } = data;

    // Attempt to update the existing cadastro
    const result = await pool.query(
        `UPDATE cadastro 
         SET representante = $1, razaosocial = $2, cnpj = $3, endereco = $4, telefone = $5, email = $6 
         WHERE username = $7 
         RETURNING *`,
        [representante, razaosocial, cnpj, endereco, telefone, email, username]
    );

    if (result.rows.length > 0) {
        // If the update was successful, return the updated row
        return { message: 'CADASTRO ATUALIZADO COM SUCESSO!', cadastro: result.rows[0] };
    }

    // If no rows were updated, insert a new cadastro
    const insertResult = await pool.query(
        `INSERT INTO cadastro (representante, razaosocial, cnpj, endereco, telefone, email, username)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [representante, razaosocial, cnpj, endereco, telefone, email, username]
    );

    return { message: 'CADASTRO CRIADO COM SUCESSO!', cadastro: insertResult.rows[0] };
}


app.post('/cadastrorep', async (req, res) => {
    const { representante, razaosocial, cnpj, endereco, telefone, email, username } = req.body;

    // Validate required fields
    if (!representante || !razaosocial || !cnpj || !endereco || !telefone || !email || !username) {
        return res.status(400).json({ success: false, error: 'Todos os campos são obrigatórios.' });
    }
/*
    // Basic CNPJ validation (14 numeric digits)
    if (!/^\d{14}$/.test(cnpj)) {
        return res.status(400).json({ success: false, error: 'CNPJ inválido.' });
    }
*/
    try {
        // Insert data into the database
        const result = await pool.query(
            'INSERT INTO cadastro (representante, razaosocial, cnpj, endereco, telefone, email, username) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [representante, razaosocial, cnpj, endereco, telefone, email, username]
        );

        res.json({
            success: true,
            message: 'Cadastro criado com sucesso!',
            data: { representante, razaosocial, cnpj, endereco, telefone, email, username }
        });
    } catch (error) {
        // Handle database errors (e.g., unique constraints)
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'CNPJ ou username já cadastrado.' });
        }

        res.status(500).json({ success: false, error: 'Erro interno do servidor. Tente novamente mais tarde.' });
    }
});
/*
//create cadastro (representante)
app.post('/cadastrorep', async (req, res) => {
    const { representante, razaosocial, cnpj, endereco, telefone, email, username } = req.body;

    try {
        // Validate the data (e.g., check if CNPJ is valid)
        const result = await pool.query(
            'INSERT INTO cadastro (representante, razaosocial, cnpj ,endereco ,telefone, email, username) VALUES ($1, $2, $3, $4, $5, $6)',
            [representante, razaosocial, cnpj, endereco, telefone, email, username]
        );

        res.json({ success: true, message: 'CADASTRO CRIADO COM SUCESSO!' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'VERIFIQUE OS CAMPOS E TENTE NOVAMENTE.' });
    }
});

*/

//update cadastro (representante)
app.put('/updatecadastro/:id', async (req, res) => {
    const customerId = req.params.id;  // Extract the customer id from the URL
    const { razaosocial, cnpj ,endereco ,representante, telefone, email, username } = req.body;  // Extract data from request body

    try {
        // SQL query to update customer data using the primary key (id)
        const result = await pool.query(
            `UPDATE cadastro 
             SET representante = $1, razaosocial = $2, cnpj = $3, endereco = $4 ,telefone = $5, email = $6, username = $7 
             WHERE id = $8;`,
            [representante, razaosocial, cnpj, endereco, telefone, email, username, customerId]  // Use the values from the form and the customer id
        );

        if (result.rowCount === 0) {
            // If no rows are updated, it means the customer wasn't found
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        // Successfully updated the customer data
        res.json({ success: true, message: 'CLIENTE ATUALIZADO COM SUCESSO!' });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});









//update cadastro (admin)
app.put('/updatecadastroadmin/:id', async (req, res) => {
    const customerId = req.params.id;  // Extract the customer id from the URL
    const { razaosocial, cnpj, endereco, representante, telefone, email, username } = req.body;  // Extract data from request body

    try {
        // SQL query to update customer data using the primary key (id)
        const result = await pool.query(
            `UPDATE cadastro 
             SET representante = $1, razaosocial = $2, cnpj = $3, endereco = $4 ,telefone = $5, email = $6, username = $7 
             WHERE id = $8;`,
            [representante, razaosocial, cnpj, endereco, telefone, email, username, customerId]  // Use the values from the form and the customer id
        );

        if (result.rowCount === 0) {
            // If no rows are updated, it means the customer wasn't found
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        // Successfully updated the customer data
        res.json({ success: true, message: 'CLIENTE ATUALIZADO COM SUCESSO!' });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});




// cadastro list
app.get('/customers', async (req, res) => {
    const username = req.query.username;
    const searchTerm = req.query.searchTerm || '';  // Optional filter query for search

    try {
        const customers = await pool.query(
            `SELECT * FROM cadastro WHERE username = $1 AND (razaosocial ILIKE $2 OR cnpj ILIKE $2)`,
            [username, `%${searchTerm}%`]
        );
        res.json({ success: true, data: customers.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});


app.get('/allcustomers', async (req, res) => {
  

    try {
        const customers = await pool.query('SELECT * FROM cadastro');
        res.json({ success: true, data: customers.rows });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});




// Start the server on port 80
app.listen(80, () => {
    console.log('Servidor rodando na porta 80');
});




// Endpoint to fetch order details with products
app.get('/order-details/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        // Fetch order details
        const orderQuery = 'SELECT * FROM pedidos WHERE id = $1';
        const orderResult = await pool.query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'PEDIDO NÃO ENCONTRADO.' });
        }

        const order = orderResult.rows[0];

        // Fetch products associated with the order
        const productsQuery = 'SELECT * FROM pedidoitens WHERE idpedido = $1';
        const productsResult = await pool.query(productsQuery, [orderId]);

        // Combine order details with products
        const orderDetails = {
            ...order,
            products: productsResult.rows
        };

        res.json(orderDetails);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'FALHA NA BUSCA DOS DETALHES DOS PEDIDOS.' });
    }
});







app.post("/submit-order", async (req, res) => {
    const { orderId, observation } = req.body;
  console.log(orderId, observation);
    try {
      
      const updateQuery = `
        UPDATE pedidos 
        SET status = 1, observacoes = $1
        WHERE id = $2;
      `;
      const result = await pool.query(updateQuery, [observation, orderId]);
  
      /* Check if the order was updated*/
      if (result.rowCount === 0) {
        return res.status(404).send({ error: "Order not found." });
      }
  
      res.status(200).send({ message: "Order updated successfully!" });
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).send({ error: "Failed to update the order." });
    }
  });
  









  app.patch("/save-notes", async (req, res) => {
    const { orderId, observation } = req.body;

    try {
        const updateQuery = `
            UPDATE pedidos 
            SET observacoes = $1
            WHERE id = $2;
        `;
        const result = await pool.query(updateQuery, [observation, orderId]);

        // Check if the order was updated
        if (result.rowCount === 0) {
            return res.status(404).send({ error: "Order not found." });
        }

        res.status(200).send({ message: "Notes updated successfully!" });
    } catch (error) {
        console.error("Error updating notes:", error);
        res.status(500).send({ error: "Failed to update notes." });
    }
});






// Endpoint para deletar um item do pedido com backup
app.delete('/delete-order', async (req, res) => {
    const { orderId } = req.body; // Lê os dados do corpo da requisição

    try {
        // Step 1: Inserir o pedido na tabela de backup
        const backupResult = await pool.query(
            'INSERT INTO pedidosdel (id, username, razaosocial, data, total, status, representante, cnpj, observacoes) ' +
            'SELECT id, username, razaosocial, data, total, status, representante, cnpj, observacoes FROM pedidos WHERE id = $1',
            [orderId]
        );
        

        // Verifica se o pedido foi copiado para o backup
        if (backupResult.rowCount === 0) {
            return res.status(500).json({ message: 'Erro ao fazer backup do pedido' });
        }

        // Step 2: Deletar o pedido da tabela original
        const deleteResult = await pool.query(
            'DELETE FROM pedidos WHERE id = $1',
            [orderId]
        );

        // Verifica se o pedido foi deletado
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        return res.status(200).json({ message: 'Pedido deletado com sucesso e backup feito' });
    } catch (error) {
        console.error('Erro ao deletar pedido:', error);
        return res.status(500).json({ message: 'Erro ao deletar pedido' });
    }
});
















/*

// Endpoint para deletar um item do pedido
app.delete('/delete-order', async (req, res) => {
    const { orderId } = req.body; // Lê os dados do corpo da requisição

    try {
        // Query para deletar o item da tabela pedidoitens
        const result = await pool.query(
            'DELETE FROM pedidos WHERE id = $1',
            [orderId]
        );

        // Verifica se alguma linha foi afetada
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        return res.status(200).json({ message: 'Pedido deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar pedido:', error);
        return res.status(500).json({ message: 'Erro ao deletar pedido' });
    }
});

*/




// Endpoint para deletar um item do pedido
app.delete('/delete-product', async (req, res) => {
    const { orderId, productId } = req.body; // Lê os dados do corpo da requisição

    try {
        // Query para deletar o item da tabela pedidoitens
        const result = await pool.query(
            'DELETE FROM pedidoitens WHERE idpedido = $1 AND id = $2',
            [orderId, productId]
        );

        // Verifica se alguma linha foi afetada
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Item não encontrado' });
        }

        return res.status(200).json({ message: 'Item deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar item:', error);
        return res.status(500).json({ message: 'Erro ao deletar item' });
    }
});




// Endpoint para buscar os itens do pedido
app.get('/modalproducts/:id', async (req, res) => {
    const orderId = req.params.id;

    try {
        // Busca os itens do pedido
        const itensResult = await pool.query('SELECT * FROM pedidoitens WHERE idpedido = $1', [orderId]);

        if (itensResult.rows.length === 0) {
            return res.status(404).json({ message: 'Nenhum item encontrado para este pedido' });
        }

        // Retorna os itens do pedido
        res.json(itensResult.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar itens do pedido' });
    }
});





/*

app.patch('/editproduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Update quantity in pedidoitens
        const result = await pool.query(
            'UPDATE pedidoitens SET quantidade = $1 WHERE id = $2',
            [quantity, productId]
        );

        // Get idpedido associated with the updated item
        const idPedido = (await pool.query(
            'SELECT idpedido FROM pedidoitens WHERE id = $1',
            [productId]
        )).rows[0].idpedido;

        // Calculate the new total for the order
        const totalResult = await pool.query(
            'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
            [idPedido]
        );

        const total = totalResult.rows[0].total || 0; // If no items, total is 0

        // Update the total in the pedidos table
        await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, idPedido]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = result.rows[0];
        res.status(200).json({ message: 'Quantity updated successfully', updatedProduct, newTotal: total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
*/





app.patch('/editproduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Update quantity in pedidoitens
        const result = await pool.query(
            'UPDATE pedidoitens SET quantidade = $1 WHERE id = $2',
            [quantity, productId]
        );

        // Get idpedido associated with the updated item
        const idPedido = (await pool.query(
            'SELECT idpedido FROM pedidoitens WHERE id = $1',
            [productId]
        )).rows[0].idpedido;

        // Calculate the new total for the order
        const totalResult = await pool.query(
            'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
            [idPedido]
        );

        const total = totalResult.rows[0].total || 0; // If no items, total is 0

        // Update the total in the pedidos table
        await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, idPedido]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = result.rows[0];
        res.status(200).json({ message: 'Quantity updated successfully', updatedProduct });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



/*
app.patch('/editproduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Update quantity in pedidoitens
        const result = await pool.query(
            'UPDATE pedidoitens SET quantidade = $1 WHERE id = $2',
            [quantity, productId]
        );

        // Get idpedido associated with the updated item
        const idPedido = (await pool.query(
            'SELECT idpedido FROM pedidoitens WHERE id = $1',
            [productId]
        )).rows[0].idpedido;

        // Calculate the new total for the order
        const totalResult = await pool.query(
            'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
            [idPedido]
        );

        const total = totalResult.rows[0].total || 0; // If no items, total is 0

        // Update the total in the pedidos table
        await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, idPedido]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Fetch all products for this order
        const updatedProducts = await pool.query(
            'SELECT * FROM pedidoitens WHERE idpedido = $1 ORDER BY id',
            [idPedido]
        );

        res.status(200).json({
            message: 'Quantity updated successfully',
            updatedProduct: result.rows[0],
            updatedProducts: updatedProducts.rows, // Return all products in order
            total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

*/





/*
app.patch('/editproduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Update quantity in pedidoitens
        const result = await pool.query(
            'UPDATE pedidoitens SET quantidade = $1 WHERE id = $2',
            [quantity, productId]
        );

        // Get idpedido associated with the updated item
        const idPedido = (await pool.query(
            'SELECT idpedido FROM pedidoitens WHERE id = $1',
            [productId]
        )).rows[0].idpedido;

        // Calculate the new total for the order
        const totalResult = await pool.query(
            'SELECT SUM(quantidade * preco) AS total FROM pedidoitens WHERE idpedido = $1',
            [idPedido]
        );

        const total = totalResult.rows[0].total || 0; // If no items, total is 0

        // Update the total in the pedidos table
        await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, idPedido]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = result.rows[0];
        res.status(200).json({ message: 'Quantity updated successfully', updatedProduct });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
*/





app.post('/displayName', (req, res) => {
    const { customerId } = req.body;

    if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
    }

    const query = 'SELECT razaosocial FROM cadastro WHERE id = $1';
    
    pool.query(query, [customerId])
        .then(result => {
            const customer = result.rows[0];
            if (customer) {
                res.status(200).json(customer);
            } else {
                res.status(404).json({ error: 'Customer not found' });
            }
        })
        .catch(error => {
            console.error('Error fetching customer:', error);
            res.status(500).json({ error: 'Server error' });
        });
});
















// Endpoint to get the status of an order
app.post('/orderStatus', async (req, res) => {
    const { orderId } = req.body;  // Extract the orderId from the request body

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required.' });
    }

    try {
        // Query the database for the order status
        const result = await pool.query(
            'SELECT status FROM pedidos WHERE id = $1',
            [orderId]
        );

        // If the order was not found, return an empty array or an error message
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Retrieve the status from the query result
        const orderStatus = result.rows[0].status;

        // Return the status as a response
        res.json({ status: orderStatus });

    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Failed to fetch order status.' });
    }
});



app.post('/checkOtherOpenedOrdersadmin', async (req, res) => {
    const { username } = req.body;

    try {
        // Check if the user has any other orders with status 0 (Aberto)
        const result = await pool.query(
            'SELECT COUNT(*) FROM pedidos WHERE username = $1 AND status = 0',
            [username]
        );

        const count = result.rows[0].count;

        // If no other orders with status 0, allow reverting
        if (parseInt(count) === 0) {
            return res.json({ canRevert: true });
        }

        res.json({ canRevert: false });
    } catch (error) {
        console.error('Error checking open orders:', error);
        res.status(500).json({ message: 'Error checking open orders.' });
    }
});


app.post('/checkOtherOpenedOrders', async (req, res) => {
    const { username } = req.body;

    try {
        // Check if the user has any other orders with status 0 (Aberto)
        const result = await pool.query(
            'SELECT COUNT(*) FROM pedidos WHERE username = $1 AND status = 0',
            [username]
        );

        const count = result.rows[0].count;

        // If no other orders with status 0, allow reverting
        if (parseInt(count) === 0) {
            return res.json({ canRevert: true });
        }

        res.json({ canRevert: false });
    } catch (error) {
        console.error('Error checking open orders:', error);
        res.status(500).json({ message: 'Error checking open orders.' });
    }
});


app.post('/revertOrder', async (req, res) => {
    const { orderId } = req.body;

    try {
        // Update the order status from 1 (submitted) to 0 (draft)
        const result = await pool.query(
            'UPDATE pedidos SET status = 0 WHERE id = $1',
            [orderId]
        );

        res.json({ message: 'Order status reverted to draft.' });
    } catch (error) {
        console.error('Error reverting order status:', error);
        res.status(500).json({ message: 'Error reverting order status.' });
    }
});




app.post('/getUsernameByOrderId', async (req, res) => {
    const { orderId } = req.body; // Retrieve the orderId from the request body

    try {
        // Query to fetch the username from the 'pedidos' table where the 'id' matches the provided orderId
        const result = await pool.query(
            'SELECT username FROM pedidos WHERE id = $1', 
            [orderId]
        );

        // If no matching order is found, return a 404 error
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Extract the username from the query result
        const { username } = result.rows[0];

        // Send the username back as a response
        res.json({ username });
    } catch (error) {
        console.error('Error fetching username:', error);
        res.status(500).json({ message: 'Error fetching username.' });
    }
});
