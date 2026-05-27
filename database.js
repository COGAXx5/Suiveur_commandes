const { Pool } = require('pg');

// Connexion sécurisée à Supabase
const connectionString = process.env.DATABASE_URL || "postgresql://postgres.uxgnxlizlcxqzrlttedt:061576938200mM&@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Exportation de la méthode de requête pour le fichier server.js
module.exports = {
  query: (text, params) => pool.query(text, params)
};