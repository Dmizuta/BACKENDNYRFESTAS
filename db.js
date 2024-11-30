const { Pool } = require('pg');

const pool = new Pool({
    host: ep-proud-thunder-a43p48q0.us-east-1.aws.neon.tech,      // Neon host URL
    port: 5432,                  // Default PostgreSQL port
    database: NYRFESTAS,   // Neon database name
    user: NYRFESTAS_owner,       // Neon username
    password: 4egYkhQoi7wD,   // Neon password
    ssl: true                    // Enable SSL
});

module.exports = pool;
