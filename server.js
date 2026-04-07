/**
 * Rotina Foguete — servidor local
 * Sem dependências externas. Rode com: node server.js
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT       = 8080;
const STATE_FILE = path.join(__dirname, 'state.json');
const HTML_FILE  = path.join(__dirname, 'index.html');

// ── helpers ────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10_000_000) req.destroy(); });
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));
}

// ── servidor ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const ip  = req.socket.remoteAddress;
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url}  (${ip})`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  // GET /api/ping — identifica que este é o servidor Rotina Foguete
  if (url === '/api/ping' && req.method === 'GET') {
    sendJSON(res, 200, { rotina: true });
    return;
  }

  // GET /api/state
  if (url === '/api/state' && req.method === 'GET') {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf8');
        send(res, 200, 'application/json; charset=utf-8', data);
      } else {
        sendJSON(res, 404, null);
      }
    } catch (e) {
      console.error('Erro ao ler state:', e.message);
      sendJSON(res, 500, null);
    }
    return;
  }

  // POST /api/state
  if (url === '/api/state' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      JSON.parse(body); // valida JSON
      fs.writeFileSync(STATE_FILE, body, 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      console.error('Erro ao salvar state:', e.message);
      sendJSON(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // GET / ou /index.html → serve o app
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      send(res, 200, 'text/html; charset=utf-8', html);
    } catch (e) {
      send(res, 404, 'text/plain', 'index.html não encontrado');
    }
    return;
  }

  send(res, 404, 'text/plain', 'Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  // Tenta exibir o IP da rede local
  let localIP = 'SEU-IP-AQUI';
  try {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
      }
    }
  } catch(e) {}

  console.log('\n🚀 Rotina Foguete rodando!\n');
  console.log(`   Notebook  → http://localhost:${PORT}`);
  console.log(`   Celular / TV → http://${localIP}:${PORT}`);
  console.log('\n   (Ctrl+C para parar)\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Porta ${PORT} já está em uso. Feche o outro processo ou mude PORT no server.js.\n`);
  } else {
    console.error('Erro no servidor:', err);
  }
  process.exit(1);
});
