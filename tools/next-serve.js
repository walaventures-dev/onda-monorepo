const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dir = __dirname;
const port = parseInt(process.env.PORT || '4200', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
