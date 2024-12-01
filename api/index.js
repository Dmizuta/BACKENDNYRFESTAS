const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Test route to check if the API is working
app.get('/', (req, res) => {
    return res.send('Backend is working!'); // This should help test the basic server
});

// Your existing '/produtos' route
app.get('/produtos', (req, res) => {
    return res.json([
        { id: 1, nome: "Chapéu", preco: 150.00, quantidade: 2 },
        { id: 2, nome: "Camiseta", preco: 50.00, quantidade: 5 },
        { id: 3, nome: "Calça", preco: 100.00, quantidade: 3 }
    ]);
});

// Export the app as a Vercel handler function
module.exports = (req, res) => {
    return app(req, res);
};
