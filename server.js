// Simple local server for API endpoints during development
// Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env.local manually
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
    console.log('✅ Loaded environment variables from .env.local');
}

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Import the text-to-speech handler
let textToSpeechHandler;
try {
    const ttsModule = require('./api/text-to-speech.js');
    textToSpeechHandler = ttsModule.default || ttsModule;
} catch (error) {
    console.error('Error loading text-to-speech handler:', error.message);
    console.log('Make sure api/text-to-speech.js exists');
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle API endpoints
    if (pathname === '/api/text-to-speech' && req.method === 'POST') {
        if (!textToSpeechHandler) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Text-to-speech handler not available' }));
            return;
        }
        
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                req.body = JSON.parse(body);
                await textToSpeechHandler(req, res);
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON', details: error.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            const ext = path.extname(filePath);
            const contentType = {
                '.html': 'text/html',
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            }[ext] || 'text/plain';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Local server running at http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/text-to-speech`);
    console.log(`🔑 Using keys from .env.local`);
    if (!process.env.GOOGLE_CLOUD_TTS_API_KEY) {
        console.log('⚠️  Warning: GOOGLE_CLOUD_TTS_API_KEY not found');
    } else {
        console.log('✅ GOOGLE_CLOUD_TTS_API_KEY loaded');
    }
});
