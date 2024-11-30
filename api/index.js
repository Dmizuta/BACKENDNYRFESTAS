const express = require('express');
require('dotenv').config();
const cors = require('cors');


const app = express();
app.use(express.json());

app.use(cors()); // permite que qualquer origem acesse a API



app.get('/produtos', async (req, res) => {

    return res.json(
        [
            {
                "id": 1,
                "nome": "Chapéu",
                "preco": 150.00,
                "quantidade": 2
            },
            {
                "id": 2,
                "nome": "Camiseta",
                "preco": 50.00,
                "quantidade": 5
            },
            {
                "id": 3,
                "nome": "Calça",
                "preco": 100.00,
                "quantidade": 3
            },
        ]
    );
});


app.listen(80, () => {
    console.log('Servidor rodando na porta 80');
});
