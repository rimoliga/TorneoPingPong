const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Cargar las variables del archivo .env
require('dotenv').config();

const PORT = 3000;

const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const pathname = rawUrl.split('?')[0].split('#')[0];

    if (pathname === '/' || pathname === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error cargando index.html');
                return;
            }

            // 2. MAGIA: Reemplazar los marcadores con las variables del .env
            let modifiedHtml = data
                .replace('__API_KEY__', process.env.FIREBASE_API_KEY)
                .replace('__AUTH_DOMAIN__', process.env.FIREBASE_AUTH_DOMAIN)
                .replace('__PROJECT_ID__', process.env.FIREBASE_PROJECT_ID)
                .replace('__STORAGE_BUCKET__', process.env.FIREBASE_STORAGE_BUCKET)
                .replace('__MESSAGING_SENDER_ID__', process.env.FIREBASE_MESSAGING_SENDER_ID)
                .replace('__APP_ID__', process.env.FIREBASE_APP_ID);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(modifiedHtml);
        });
    } else {
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(pathname);
        } catch {
            res.writeHead(400);
            res.end('Bad Request');
            return;
        }

        const relativeInputPath = decodedPath.replace(/^[/\\]+/, '');
        const normalizedPath = path.normalize(relativeInputPath);
        if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith('..')) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const filePath = path.join(__dirname, normalizedPath);
        const basePath = path.resolve(__dirname);
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(basePath + path.sep)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const extname = path.extname(filePath);
        let contentType = 'text/html';
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
            case '.png': contentType = 'image/png'; break;
            case '.jpg': contentType = 'image/jpg'; break;
            case '.svg': contentType = 'image/svg+xml'; break;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code == 'ENOENT') {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    res.writeHead(500);
                    res.end('Server Error: ' + err.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

console.log(`🚀 Servidor de desarrollo corriendo en http://localhost:${PORT}`);
server.listen(PORT);
