// Servidor local do TCC: entrega o site e repassa /v4/... para o football-data.org.
// Uso: node servidor.js   →   http://localhost:8321
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.env.PORT) || 8321;
const RAIZ = __dirname;
const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4a': 'audio/mp4',
    '.json': 'application/json',
};

// Chave gravada em chave-api.txt (fica só neste PC: não vai ao GitHub nem ao navegador).
function chaveDoArquivo() {
    try { return /\b[a-f0-9]{32}\b/i.exec(fs.readFileSync(path.join(RAIZ, 'chave-api.txt'), 'utf8'))?.[0] || ''; }
    catch (e) { if (e.code !== 'ENOENT') console.error('chave-api.txt:', e.message); return ''; }
}

async function repassar(req, res) {
    try {
        const r = await fetch('https://api.football-data.org' + req.url, {
            headers: { 'X-Auth-Token': chaveDoArquivo() || req.headers['x-auth-token'] || '' },
            signal: AbortSignal.timeout(14000),
        });
        res.writeHead(r.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
        console.error('Falha na API:', e.message);
        res.writeHead(502);
        res.end();
    }
}

function arquivo(req, res) {
    let nome;
    try { nome = decodeURIComponent(req.url.split('?')[0]); }
    catch { res.writeHead(400); return res.end(); }
    if (nome === '/') nome = '/index.html';
    const alvo = path.join(RAIZ, nome);
    // a chave e arquivos ocultos nunca são entregues pelo site
    if (/(^|[\\/])(\.|chave)/i.test(path.relative(RAIZ, alvo))) { res.writeHead(404); return res.end('Não encontrado'); }
    if (!alvo.startsWith(RAIZ + path.sep)) { res.writeHead(403); return res.end(); }

    fs.stat(alvo, (erro, st) => {
        if (erro || !st.isFile()) { res.writeHead(404); return res.end('Não encontrado'); }
        const cab = { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
        let inicio = 0, fim = st.size - 1, status = 200;
        const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (faixa && (faixa[1] || faixa[2])) {          // vídeos precisam de Range
            if (faixa[1]) { inicio = +faixa[1]; if (faixa[2]) fim = Math.min(+faixa[2], fim); }
            else inicio = Math.max(0, st.size - +faixa[2]);
            if (inicio > fim) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
            status = 206;
            cab['Content-Range'] = `bytes ${inicio}-${fim}/${st.size}`;
        }
        cab['Content-Length'] = Math.max(0, fim - inicio + 1);
        res.writeHead(status, cab);
        if (req.method === 'HEAD' || !st.size) return res.end();
        const fluxo = fs.createReadStream(alvo, { start: inicio, end: fim });
        fluxo.on('error', () => res.destroy());
        res.on('close', () => fluxo.destroy());
        fluxo.pipe(res);
    });
}

async function noticias(req, res) {
    let time = '';
    try {
        const u = new URL(req.url, 'http://localhost');
        time = (u.searchParams.get('time') || '').trim();
    } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'URL inválida' }));
    }

    if (!time || time.length > 60) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Parâmetro time inválido ou superior a 60 caracteres' }));
    }

    const googleUrl = new URL('https://news.google.com/rss/search');
    googleUrl.searchParams.set('q', `"${time}" futebol`);
    googleUrl.searchParams.set('hl', 'pt-BR');
    googleUrl.searchParams.set('gl', 'BR');
    googleUrl.searchParams.set('ceid', 'BR:pt-419');

    try {
        const r = await fetch(googleUrl.href, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(10000),
        });

        if (!r.ok) {
            res.writeHead(r.status >= 400 && r.status < 600 ? r.status : 502, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Falha na resposta do Google Notícias' }));
        }

        const xml = await r.text();
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;

        const cleanCdata = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        const unescapeXml = s => s
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
            const it = match[1];
            const getTag = tag => {
                const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
                return m ? unescapeXml(cleanCdata(m[1])) : '';
            };
            const titulo = getTag('title');
            const link = getTag('link');
            const fonte = getTag('source');
            const data = getTag('pubDate');

            if (link && link.startsWith('https://')) {
                items.push({ titulo, link, fonte, data });
            }
        }

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(items));
    } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Falha ou tempo limite ao obter notícias: ' + e.message }));
    }
}

http.createServer((req, res) => {
    if (req.url === '/chave-status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ temChave: Boolean(chaveDoArquivo()) }));
    }
    if (req.url.startsWith('/noticias')) return noticias(req, res);
    if (req.url.startsWith('/v4/')) return repassar(req, res);
    return arquivo(req, res);
})
    .listen(PORTA, '127.0.0.1', () => console.log(`TCC no ar: http://localhost:${PORTA}  (Ctrl+C para parar)`));
