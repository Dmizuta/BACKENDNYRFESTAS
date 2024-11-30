const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors()); // allows cross-origin requests

// Your product route
app.get('/produtos', async (req, res) => {
    return res.json([
        { id: 1, nome: "Chapéu", preco: 150.00, quantidade: 2 },
        { id: 2, nome: "Camiseta", preco: 50.00, quantidade: 5 },
        { id: 3, nome: "Calça", preco: 100.00, quantidade: 3 }
    ]);
});

// Use the Vercel handler for serverless functions
module.exports = (req, res) => {
    return app(req, res);
};
