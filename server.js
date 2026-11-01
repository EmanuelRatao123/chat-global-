const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Liga à base de dados PostgreSQL do Render usando a variável de ambiente secreta
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Obrigatório no Render
});

// Cria a tabela de mensagens na base de dados quando o servidor inicia
pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50),
        text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => console.error("Erro ao criar tabela no Render:", err));

// Serve o ficheiro index.html que está na pasta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', async (socket) => {
    console.log('Novo utilizador ligado!');

    // Quando alguém entra, procura o histórico na base de dados e envia para ele
    try {
        const result = await pool.query('SELECT username, text FROM messages ORDER BY id ASC LIMIT 100');
        socket.emit('historico', result.rows);
    } catch (err) {
        console.error("Erro ao puxar histórico:", err);
    }

    // Quando o servidor recebe uma mensagem de alguém
    socket.on('mensagem', async (data) => {
        try {
            // Guarda na base de dados do Render
            await pool.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [data.username, data.text]);
            // Reenvia para todos os utilizadores online
            io.emit('mensagem', data);
        } catch (err) {
            console.error("Erro ao guardar mensagem:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Utilizador desligado.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});
