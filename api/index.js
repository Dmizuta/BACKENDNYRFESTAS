const express = require('express');
require('dotenv').config();
const cors = require('cors');

// Initialize the Express app
const app = express();
app.use(express.json());
app.use(cors()); // Allows any origin to access the API

// Define your API endpoint
app.get('/produtos', async (req, res) => {
    return res.json([
        { id: 1, nome: "Chapéu", preco: 150.0, quantidade: 2 },
        { id: 2, nome: "Camiseta", preco: 50.0, quantidade: 5 },
        { id: 3, nome: "Calça", preco: 100.0, quantidade: 3 },
    ]);
});

// Export the Express app for Vercel to handle it as a serverless function
module.exports = app;
