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

////////////////////////////////////////////////////////////////////////////

/*
// Endpoint to get products from the database
app.get('/products', async (req, res) => {
    const { epoca } = req.query; // Captura o parâmetro de consulta 'epoca'
    try {
        let query = 'SELECT * FROM produtos'; // No stock filter anymore
        const queryParams = [];

        // Se 'epoca' for fornecido, adicione à consulta
        if (epoca) {
            query += ' WHERE epoca = $1';  // Only filter by epoca if provided
            queryParams.push(epoca);
        }

        query += ' ORDER BY idprod ASC';
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'FALHA AO BUSCAR OS DADOS DOS PRODUTOS.',
            error: error.message,
        });
    }
});
*/
/////////////////////////////////////////////////////////////////////////////////////////////////

// Endpoint to get products from the database
app.get('/products', async (req, res) => {
    const { epoca } = req.query; // Captura o parâmetro de consulta 'epoca'
    try {
        let query = 'SELECT * FROM produtos WHERE estoque IN (0, 1)';

       


        const queryParams = [];

console.log('produtos:', queryParams);

        // Se 'epoca' for fornecido, adicione à consulta
        if (epoca) {
            query += ' AND epoca = $1';
            queryParams.push(epoca);
        }

        console.log ('epoca:', epoca);

        query += ' ORDER BY idprod ASC';
        const result = await pool.query(query, queryParams);
        res.json(result.rows);

        console.log('parametros:', queryParams);

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'FALHA AO BUSCAR OS DADOS DOS PRODUTOS.',
            error: error.message,
        });
    }
});


////////////////////////////////////////////////////////////////////////////

/*
// Endpoint to get products from the database
app.get('/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produtos WHERE estoque = 1 ORDER BY idprod ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'FALHA AO BUSCAR OS DADOS DOS PRODUTOS.',
            error: error.message,
        });
    }
});
*/
////////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/product-buy/:id', async (req, res) => {
    const productCode = req.params.id;
    try {
        const result = await pool.query(
            'SELECT idprod, descricao, cxfechada, precofechada, precofrac, cxfracionada, ipi, estoque FROM produtos WHERE codproduto = $1',
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
    const { username, razaosocial, codproduto, descricao, quantidade, preco, representante, cnpj, ipi } = req.body;

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






                const duplicateCheck = await pool.query(
                    'SELECT * FROM pedidoitens WHERE idpedido = $1 AND codproduto = $2', 
                    [orderId, codproduto]
                );

                if (duplicateCheck.rows.length > 0) {
                    // If product already exists, return an error message
                    return res.status(400).send({ 
                        error: `O PRODUTO >>>${codproduto}<<< JÁ FOI ADICIONADO A ESTE PEDIDO.`
                    });
                }



            } else {
                // If razaosocial doesn't match, show an error message asking to save the order
                return res.status(400).send({ 
                    error: `FINALIZE O PEDIDO DO USUÁRIO >>>${existingOrder.razaosocial}<<< E TENTE NOVAMENTE.`
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






        const newItemResult = await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco, ipi) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [orderId, codproduto, descricao, quantidade, preco, ipi]
        );
        const newItemId = newItemResult.rows[0].id;

        const ipiTaxResult = await pool.query(
            'SELECT ipi_tax FROM pedidos WHERE id = $1', 
            [orderId]
        );
        
        const ipiTax = ipiTaxResult.rows[0]?.ipi_tax || 0;
        console.log('IpiTax:', ipiTax);

        const totalResult = await pool.query(
            `SELECT SUM((quantidade * preco) + (quantidade * preco * $1 * ipi)) AS total 
             FROM pedidoitens 
             WHERE idpedido = $2`,
            [ipiTax, orderId]
        );

        const total = totalResult.rows[0]?.total || 0;
        console.log('Calculated total:', total);

        const updateResult = await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, orderId]
        );

       /* const ipivalue = ipiTax * preco;
        const subtotal = (quantidade * preco) + (quantidade * preco * ipiTax);

        await pool.query(
            'UPDATE pedidoitens SET ipivalue = $1, subtotal = $2 WHERE id = $3',
            [ipivalue, subtotal, newItemId]
        );*/

        console.log('Update result:', updateResult);
        res.status(200).send({ message: 'PRODUTO ADICIONADO COM SUCESSO!', orderId });
    } catch (error) {
        console.error('Error adding to order:', error);
        res.status(500).send({ error: 'FALHA AO ADICIONAR O PRODUTO.' });
    }
});



/*
        // Step 3: Add product to order items
        await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco, ipi) VALUES ($1, $2, $3, $4, $5, $6)',
            [orderId, codproduto, descricao, quantidade, preco, ipi]
        );

        // Step 4: Calculate the total price for the order
        const totalResult = await pool.query(
            `SELECT SUM((quantidade * preco) + (quantidade * preco * 0.13 * ipi)) AS total 
     FROM pedidoitens 
     WHERE idpedido = $1`,
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

*/




app.post('/add-to-order-admin', async (req, res) => {
    const { username, razaosocial, codproduto, descricao, quantidade, preco, representante, cnpj, ipi } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, razaosocial FROM pedidos WHERE username = $1 AND status = 0', 
            [username]
        );
        const existingOrder = result.rows[0];
        let orderId;

        if (existingOrder) {
            if (existingOrder.razaosocial === razaosocial) {
                orderId = existingOrder.id;

                const duplicateCheck = await pool.query(
                    'SELECT * FROM pedidoitens WHERE idpedido = $1 AND codproduto = $2', 
                    [orderId, codproduto]
                );

                if (duplicateCheck.rows.length > 0) {
                    return res.status(400).send({ 
                        error: `O PRODUTO >>>${codproduto}<<< JÁ FOI ADICIONADO A ESTE PEDIDO.`
                    });
                }
            } else {
                return res.status(400).send({ 
                    error: `FINALIZE O PEDIDO DO USUÁRIO >>>${existingOrder.razaosocial}<<< E TENTE NOVAMENTE.`
                });
            }
        } else {
            const newOrderResult = await pool.query(
                'INSERT INTO pedidos (username, razaosocial, representante, cnpj, data, total, status) VALUES ($1, $2, $3, $4, TO_TIMESTAMP(EXTRACT(EPOCH FROM NOW())), 0, 0) RETURNING id',
                [username, razaosocial, representante, cnpj]
            );
            orderId = newOrderResult.rows[0].id;
        }

        const newItemResult = await pool.query(
            'INSERT INTO pedidoitens (idpedido, codproduto, descricao, quantidade, preco, ipi) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [orderId, codproduto, descricao, quantidade, preco, ipi]
        );
        const newItemId = newItemResult.rows[0].id;

        const ipiTaxResult = await pool.query(
            'SELECT ipi_tax FROM pedidos WHERE id = $1', 
            [orderId]
        );
        
        const ipiTax = ipiTaxResult.rows[0]?.ipi_tax || 0;
        console.log('IpiTax:', ipiTax);

        const totalResult = await pool.query(
            `SELECT SUM((quantidade * preco) + (quantidade * preco * $1 * ipi)) AS total 
             FROM pedidoitens 
             WHERE idpedido = $2`,
            [ipiTax, orderId]
        );

        const total = totalResult.rows[0]?.total || 0;
        console.log('Calculated total:', total);

        const updateResult = await pool.query(
            'UPDATE pedidos SET total = $1 WHERE id = $2',
            [total, orderId]
        );

       /* const ipivalue = ipiTax * preco;
        const subtotal = (quantidade * preco) + (quantidade * preco * ipiTax);

        await pool.query(
            'UPDATE pedidoitens SET ipivalue = $1, subtotal = $2 WHERE id = $3',
            [ipivalue, subtotal, newItemId]
        );*/

        console.log('Update result:', updateResult);
        res.status(200).send({ message: 'PRODUTO ADICIONADO COM SUCESSO!', orderId });
    } catch (error) {
        console.error('Error adding to order:', error);
        res.status(500).send({ error: 'FALHA AO ADICIONAR O PRODUTO.' });
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



///////////////////////////////////////////////////////////////////////////////////////////////////


    app.get('/ordersrep', async (req, res) => {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ message: 'NECESSÁRIO USUÁRIO.' });
        }

        try {
            // Step 1: Get the representante name from registro table
            const representanteResult = await pool.query(
                'SELECT representante FROM registro WHERE username = $1',
                [username]
            );

            if (representanteResult.rows.length === 0) {
                return res.status(404).json({ message: 'USUÁRIO NÃO ENCONTRADO.' });
            }

            let representante = representanteResult.rows[0].representante;


            console.log("REPRESENTANTE 01:", representante);





    /*
    const ordersResult = await pool.query(
        `SELECT id, razaosocial, data, total, status, representante 
        FROM pedidos 
        WHERE username = $1 OR representante = $2
        ORDER BY id DESC`,
        [username, cleanedRepresentante]
    );*/

    const ordersResult = await pool.query(
        `SELECT id, razaosocial, data, total, status, representante 
        FROM pedidos 

  WHERE username = $1 
        OR RIM(REGEXP_REPLACE(representante, '\s*\(.*?\)', '', 'g')) = $2
     ORDER BY id DESC`,
    [username, representante]


      
    );

    console.log("RES:", ordersResult.rows[1]);





            res.json(ordersResult.rows);
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ message: 'FALHA AO BUSCAR DADOS.' });
        }
    });


/*
app.get('/orders', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'NECESSÁRIO USUÁRIO.' });
    }

    try {
        // Step 1: Get the representante name from registro table
        const representanteResult = await pool.query(
            'SELECT representante FROM registro WHERE username = $1',
            [username]
        );

        if (representanteResult.rows.length === 0) {
            return res.status(404).json({ message: 'USUÁRIO NÃO ENCONTRADO.' });
        }

        const representante = representanteResult.rows[0].representante;

        // Step 2: Fetch orders for both username and representante
        const ordersResult = await pool.query(
            `SELECT id, razaosocial, data, total, status 
             FROM pedidos 
             WHERE username = $1 OR representante = $2
             ORDER BY id DESC`, 
            [username, representante]
        );

        res.json(ordersResult.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'FALHA AO BUSCAR DADOS.' });
    }
});


*/



















// Endpoint to fetch orders for a specific username
app.get('/userorders', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'NECESSÁRIO USUÁRIO.' });
    }

    try {
      



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
    const { razaosocial, cnpj, endereco, representante, telefone, email} = req.body;  // Extract data from request body

    try {
        // SQL query to update customer data using the primary key (id)
        const result = await pool.query(
            `UPDATE cadastro 
             SET representante = $1, razaosocial = $2, cnpj = $3, endereco = $4 ,telefone = $5, email = $6 
             WHERE id = $7;`,
            [representante, razaosocial, cnpj, endereco, telefone, email, customerId]  // Use the values from the form and the customer id
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
            //`SELECT * FROM cadastro WHERE username = $1 AND (razaosocial ILIKE $2 OR cnpj ILIKE $2)`,

            `SELECT * FROM cadastro 
            WHERE username = $1 
            AND (razaosocial ILIKE $2 OR cnpj ILIKE $2) 
            ORDER BY razaosocial ASC`,  // Sorting alphabetically

            [username, `%${searchTerm}%`]
        );
        res.json({ success: true, data: customers.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});


app.get('/allcustomers', async (req, res) => {
  

    try {
        const customers = await pool.query('SELECT * FROM cadastro ORDER BY username ASC');
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
        const productsQuery = 'SELECT * FROM pedidoitens WHERE idpedido = $1 ORDER BY id';
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
            'INSERT INTO pedidosdel (id, username, razaosocial, data, total, status, representante, cnpj, observacoes, ipitotal, ipi_tax) ' +
            'SELECT id, username, razaosocial, data, total, status, representante, cnpj, observacoes, ipitotal, ipi_tax FROM pedidos WHERE id = $1',
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

        // Step 1: Fetch the current IPI tax from the 'pedidos' table
        const ipiQuery = 'SELECT ipi_tax FROM pedidos WHERE id = $1'; // Assuming 'ipi_tax' is the field holding the IPI rate
        const ipiResult = await pool.query(ipiQuery, [orderId]);

        // Check if IPI value is available
        if (ipiResult.rows.length === 0) {
            return res.status(404).json({ message: 'IPI não encontrado para o pedido' });
        }

        const ipiTax = ipiResult.rows[0].ipi_tax; // Get the IPI value

        // Step 2: Calculate the total price for the order with the fetched IPI
        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(quantidade * preco * (1 + ipi * $1)), 0) AS total FROM pedidoitens WHERE idpedido = $2',
            [ipiTax, orderId]  // Use the fetched IPI value
        );

        const total = totalResult.rows[0].total;
        console.log('Novo total calculado:', total); // Log do novo total

        // Step 3: Atualiza o total na tabela pedidos
        await pool.query('UPDATE pedidos SET total = $1 WHERE id = $2', [total, orderId]);

        return res.status(200).json({ message: 'Item deletado com sucesso', newTotal: total });

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

        // Se nenhum item for encontrado, apenas retorna um array vazio
        return res.json(itensResult.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao buscar itens do pedido' });
    }
});




















app.patch('/editproduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Step 1: Update quantity in pedidoitens
        const updateResult = await pool.query(
            'UPDATE pedidoitens SET quantidade = $1 WHERE id = $2',
            [quantity, productId]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Step 2: Get idpedido and ipi from updated product
        const productData = (await pool.query(
            'SELECT idpedido, ipi, codproduto FROM pedidoitens WHERE id = $1',
            [productId]
        )).rows[0];

        const { idpedido, ipi, codproduto } = productData;


        const { cxfechada, precofechada, precofrac } = (await pool.query(
            'SELECT cxfechada, precofechada, precofrac FROM produtos WHERE codproduto = $1',
            [codproduto]
        )).rows[0];

           
        const chosenPrice = quantity >= cxfechada ? precofechada : precofrac;


        // set the chosenprice
        const setChosenPrice = await pool.query(
            'UPDATE pedidoitens SET preco = $1 WHERE id = $2',
            [chosenPrice, productId]
        );
               
        // Step 3: Get the ipi_tax from the pedidos table
        const pedidoData = (await pool.query(
            'SELECT ipi_tax FROM pedidos WHERE id = $1',
            [idpedido]
        )).rows[0];

      
        const ipiTax = pedidoData ? pedidoData.ipi_tax : 0; // Default to 0 if not found



        // Step 4: Calculate the new total for the order with updated IPI
        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(quantidade * preco * (1 + ipi * $1)), 0) AS total FROM pedidoitens WHERE idpedido = $2',
            [ipiTax, idpedido ]  // Use the updated ipi_tax value
        );

        const total = totalResult.rows[0].total;

        // Step 5: Update the total in pedidos table
        await pool.query('UPDATE pedidos SET total = $1 WHERE id = $2', [total, idpedido]);

        // Step 6: Send response with updated product details and total

return res.status(200).json({
    message: 'Quantity updated successfully',
    updatedProduct: { 
        ipiTax, 
        idpedido, 
        quantity, 
        ipi, 
        total,
        cxfechada, 
        precofechada, 
        precofrac
    }
});

        

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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








app.patch("/revertOrder", async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: "Order ID is required." });
    }

    try {
        // Get the current order status
        const checkQuery = "SELECT status FROM pedidos WHERE id = $1";
        const result = await pool.query(checkQuery, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Order not found." });
        }

        const currentStatus = result.rows[0].status;

        // If the status is already 0 or 1, no need to revert
        if (currentStatus === 0 || currentStatus === 1) {
            return res.status(400).json({ message: "Order is already in an allowed state. No action needed." });
        }

        // Perform the update only if the status is 2
        const updateQuery = `
            UPDATE pedidos SET status = 1 WHERE id = $1
            RETURNING *;
        `;

        const updateResult = await pool.query(updateQuery, [orderId]);

        if (updateResult.rows.length > 0) {
            return res.status(200).json({ message: "Order successfully reverted to status 0." });
        } else {
            return res.status(500).json({ error: "Failed to update order." });
        }
    } catch (error) {
        console.error("Error updating order:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});









app.patch("/receiveOrder", async (req, res) => {
    const { orderId } = req.body;

    if (!orderId || isNaN(orderId)) {
        return res.status(400).json({ error: "Valid Order ID is required." });
    }

    try {
        const updateQuery = `
            UPDATE pedidos 
            SET status = 3 
            WHERE id = $1
            RETURNING *;
        `;

        const updateResult = await pool.query(updateQuery, [orderId]);

        if (updateResult.rows.length > 0) {
            return res.status(200).json({ message: "Order updated successfully." });
        } else {
            return res.status(404).json({ error: "Order not found." });
        }
    } catch (error) {
        console.error("Error updating order:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});









app.patch("/finishOrder", async (req, res) => {
    const { orderId, observation } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: "Order ID is required." });
    }

    try {
        // Get the current order status
        const checkQuery = "SELECT status FROM pedidos WHERE id = $1";
        const result = await pool.query(checkQuery, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Order not found." });
        }

        const currentStatus = result.rows[0].status;

        // If the order is already finished (status = 2), do not update status
        const shouldFinishOrder = currentStatus === 0 || currentStatus === 1;

        // Perform a single UPDATE query
        const updateQuery = `
            UPDATE pedidos 
            SET observacoes = COALESCE($1, observacoes),
                status = CASE WHEN $2 THEN 2 ELSE status END
            WHERE id = $3
            RETURNING *;
        `;

        const updateResult = await pool.query(updateQuery, [observation, shouldFinishOrder, orderId]);

        if (updateResult.rows.length > 0) {
            return res.status(200).json({ message: "Order updated successfully." });
        } else {
            return res.status(500).json({ error: "Failed to update order." });
        }
    } catch (error) {
        console.error("Error updating order:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});




///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post("/update-ipi", async (req, res) => {
    try {
        const { orderId, newIPI } = req.body;

        console.log("Received Data:", req.body); // Log the received request data

        if (!orderId || newIPI === undefined) {
            return res.status(400).json({ error: "Missing orderId or newIPI" });
        }

        // Log before proceeding with the status query
        console.log("Checking status for orderId:", orderId);

        // Step 1: Check if order is in "open" state
        const statusQuery = `SELECT status FROM pedidos WHERE id = $1`;
        const statusResult = await pool.query(statusQuery, [orderId]);

        console.log("Status Query Result:", statusResult.rows); // Log the result of the status query

        if (statusResult.rows.length === 0 || statusResult.rows[0].status === undefined) {
            return res.status(403).json({
                error: "Order status not found. Cannot update IPI."
            });
        }

        console.log("Current Order Status:", statusResult.rows[0].status); // Log the status value

        if (statusResult.rows[0].status !== 0) {
            return res.status(403).json({
                error: "O Pedido não pode ser alterado, pois.",
                currentStatus: statusResult.rows[0].status
            });
        }

        // Log the values before updating IPI and calculating the total
        console.log("Order is in open state. Updating IPI to:", newIPI);

        // Step 2: Update the ipi_tax in pedidos table
        const updateIpiQuery = `UPDATE pedidos SET ipi_tax = $1 WHERE id = $2`;
        await pool.query(updateIpiQuery, [newIPI, orderId]);

        console.log("IPI updated successfully for orderId:", orderId);

        // Step 3: Calculate the new total for the order with updated IPI
        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(quantidade * preco * (1 + ipi * $1)), 0) AS total FROM pedidoitens WHERE idpedido = $2',
            [newIPI, orderId]
        );

        console.log("Total calculation result:", totalResult.rows); // Log the result of total calculation

        const newTotal = totalResult.rows[0].total;

        // Step 4: Update the total field in the pedidos table
        await pool.query('UPDATE pedidos SET total = $1 WHERE id = $2', [newTotal, orderId]);

        console.log("Total updated successfully for orderId:", orderId);

            // Final response
            res.json({ message: `IPI updated to ${newIPI * 100}% and total updated to ${newTotal}` });
            const responseMessage = { message: `IPI updated to ${newIPI * 100}% and total updated to ${newTotal}` };
console.log("Response Sent:", responseMessage); 
res.json(responseMessage);


    } catch (error) {
        console.error("Error updating IPI:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


/*
app.post("/update-ipi", async (req, res) => {
    try {
        const { orderId, newIPI } = req.body;

        console.log("Received Data:", req.body); // Debugging log

        if (!orderId || newIPI === undefined) {
            return res.status(400).json({ error: "Missing orderId or newIPI" });
        }

        // Step 1: Check if order is in "open" state
        const statusQuery = `SELECT status FROM pedidos WHERE id = $1`;
        const statusResult = await pool.query(statusQuery, [orderId]);



// Log the entire result object
console.log("Status Query Result:", statusResult);

// Log the rows specifically to see the status
console.log("Status Result:", statusResult.rows);


        
        
        if (statusResult.rows.length === 0 || statusResult.rows[0].status === undefined) {
            return res.status(403).json({
                error: "Order status not found. Cannot update IPI."
            });
        }
        

        if (statusResult.rows[0].value !== "0") {
            return res.status(403).json({ error: "Order is not in open state. Cannot update IPI."});
        }




        // Step 2: Update the ipi_tax in pedidos table
        const updateIpiQuery = `UPDATE pedidos SET ipi_tax = $1 WHERE id = $2`;
        await pool.query(updateIpiQuery, [newIPI, orderId]);

        // Step 3: Calculate the new total for the order with updated IPI
        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(quantidade * preco * (1 + ipi * $1)), 0) AS total FROM pedidoitens WHERE idpedido = $2',
            [newIPI, orderId]
        );

        const newTotal = totalResult.rows[0].total;

        // Step 4: Update the total field in the pedidos table
        await pool.query('UPDATE pedidos SET total = $1 WHERE id = $2', [newTotal, orderId]);

        res.json({ message: `IPI atualizado para ${newIPI * 100}% e total atualizado para ${newTotal}` });
    } catch (error) {
        console.error("Erro ao atualizar IPI:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
*/
/*
app.post("/update-ipi", async (req, res) => {
    try {
        const { orderId, newIPI } = req.body;

        console.log("Received Data:", req.body); // Debugging log

        if (!orderId || newIPI === undefined) {
            return res.status(400).json({ error: "Missing orderId or newIPI" });
        }

        // Step 1: Update the ipi_tax in pedidos table
        const updateIpiQuery = `UPDATE pedidos SET ipi_tax = $1 WHERE id = $2`;
        await pool.query(updateIpiQuery, [newIPI, orderId]);

        // Step 2: Calculate the new total for the order with updated IPI
        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(quantidade * preco * (1 + ipi * $1)), 0) AS total FROM pedidoitens WHERE idpedido = $2',
            [newIPI, orderId]  // Use the updated IPI value
        );

        const newTotal = totalResult.rows[0].total;

        // Step 3: Update the total field in the pedidos table
        await pool.query('UPDATE pedidos SET total = $1 WHERE id = $2', [newTotal, orderId]);

        res.json({ message: `IPI atualizado para ${newIPI * 100}% e total atualizado para ${newTotal}` });
    } catch (error) {
        console.error("Erro ao atualizar IPI:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});*/



// DELETE endpoint to remove a customer by ID
app.delete("/deleteCustomer/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query("DELETE FROM cadastro WHERE id = $1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }

        res.json({ success: true, message: "Customer deleted successfully!" });
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

