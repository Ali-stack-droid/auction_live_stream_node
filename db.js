require("dotenv").config();
const sql = require("mssql");

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true", // Disable encryption if using self-hosted SQL Server
    enableArithAbort: true,
  },
};

// Create a function to connect to the database
async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log("Connected to SQL Server");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
}

module.exports = { sql, connectDB };
