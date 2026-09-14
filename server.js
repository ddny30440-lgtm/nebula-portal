import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import wisp from 'wisp-server-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// where the transport modules live inside node_modules
const baremuxPath = path.join(
  __dirname,
  'node_modules',
  '@mercuryworkshop',
  'bare-mux',
  'dist'
);
const epoxyPath = path.join(
  __dirname,
  'node_modules',
  '@mercuryworkshop',
  'epoxy-transport',
  'dist'
);

const app = express();

// Custom UV config — must be registered BEFORE the /uv static middleware
// so it overrides the one shipped in the ultraviolet dist.
app.get('/uv/uv.config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`/*global Ultraviolet*/
self.__uv$config = {
    prefix: '/uv/service/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js',
};
`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uv', express.static(uvPath, { immutable: true, maxAge: '1h' }));
app.use('/baremux', express.static(baremuxPath, { immutable: true, maxAge: '1h' }));
app.use('/epoxy', express.static(epoxyPath, { immutable: true, maxAge: '1h' }));

// 404 for everything else
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const server = createServer(app);

// wisp tunnel — handles WebSocket upgrades for the proxy backend
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head, { logLevel: 'warn', pingInterval: 30 });
  } else {
    socket.end();
  }
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Nebula Portal running → http://localhost:${port}`);
});
