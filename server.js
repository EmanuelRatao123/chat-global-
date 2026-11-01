const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Conecta ao PostgreSQL do Render usando a variável de ambiente secreta
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Obrigatório no Render
});

// Cria a tabela de mensagens no banco de dados quando o servidor inicia
pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50),
        text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => console.error("Erro ao criar tabela no Render:", err));

// Serve a pasta 'public' onde ficará o visual do site
app.use(express.static('public'));

io.on('connection', async (socket) => {
    console.log('Novo usuário conectado!');

    // Quando alguém entra, busca o histórico do banco de dados e envia para ele
    try {
        const result = await pool.query('SELECT username, text FROM messages ORDER BY id ASC LIMIT 100');
        socket.emit('historico', result.rows);
    } catch (err) {
        console.error("Erro ao puxar histórico:", err);
    }

    // Quando o servidor recebe uma mensagem de alguém
    socket.on('mensagem', async (data) => {
        try {
            // Salva no banco de dados do Render
            await pool.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [data.username, data.text]);
            // Reenvia para todos os usuários logados
            io.emit('mensagem', data);
        } catch (err) {
            console.error("Erro ao salvar mensagem:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectou.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
