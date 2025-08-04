// index.js
console.log("Rune server is alive. More features coming soon.");
const http = require('http');

// Create server
const server = http.createServer((req, res) => {
  if (req.url === '/rune' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('📡 Incoming data:', body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Rune received your transmission.');
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Rune is listening...');
  }
});

// Set the port from environment variable (Render needs this)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Rune server is up and listening on port ${PORT}`);
});