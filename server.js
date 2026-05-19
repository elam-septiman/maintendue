const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'maintendue';

let db;

// Connexion MongoDB
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log('MongoDB connecté');
    seedPoints();
  })
  .catch(err => console.error('Erreur MongoDB:', err));

// Points d'aide par défaut (seed)
async function seedPoints() {
  const col = db.collection('points');
  const count = await col.countDocuments();
  if (count === 0) {
    await col.insertMany([
      { ville: 'Paris', nom: 'Resto du Coeur - Paris 13', type: 'repas', lat: 48.8276, lng: 2.3522, adresse: '53 Rue Corvisart, 75013 Paris', horaires: 'Lun-Sam 12h-14h', actif: true },
      { ville: 'Paris', nom: 'Douches municipales - Marais', type: 'douche', lat: 48.8566, lng: 2.3522, adresse: '2 Rue des Blancs Manteaux, 75004 Paris', horaires: 'Mer-Dim 8h-18h', actif: true },
      { ville: 'Paris', nom: 'Hébergement d\'urgence SAMU Social', type: 'hebergement', lat: 48.8700, lng: 2.3460, adresse: 'Paris - Appel 115', horaires: '24h/24', actif: true },
      { ville: 'Paris', nom: 'Wifi gratuit Bibliothèque Pompidou', type: 'wifi', lat: 48.8607, lng: 2.3514, adresse: 'Place Georges-Pompidou, 75004', horaires: 'Lun-Dim 11h-21h', actif: true },
      { ville: 'Lyon', nom: 'Les Restos du Coeur - Lyon', type: 'repas', lat: 45.7500, lng: 4.8500, adresse: '10 Rue Domer, 69007 Lyon', horaires: 'Mar-Sam 11h30-13h', actif: true },
      { ville: 'Lyon', nom: 'Centre d\'hébergement Croix-Rouge', type: 'hebergement', lat: 45.7640, lng: 4.8357, adresse: 'Lyon - Appel 115', horaires: '24h/24', actif: true },
      { ville: 'Marseille', nom: 'Soupe Populaire - Vieux Port', type: 'repas', lat: 43.2965, lng: 5.3698, adresse: 'Quai du Port, 13002 Marseille', horaires: 'Tous les soirs 19h', actif: true },
      { ville: 'Marseille', nom: 'Douches CCAS Marseille', type: 'douche', lat: 43.2987, lng: 5.3759, adresse: '128 La Canebière, 13001 Marseille', horaires: 'Lun-Ven 9h-16h', actif: true },
    ]);
    console.log('Points d\'aide initialisés');
  }
}

// Types MIME
const mimes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

// Serveur HTTP
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // API REST
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Points d'aide sur la carte
    if (pathname === '/api/points' && req.method === 'GET') {
      const ville = url.searchParams.get('ville');
      const type = url.searchParams.get('type');
      const query = { actif: true };
      if (ville && ville !== 'all') query.ville = ville;
      if (type && type !== 'all') query.type = type;
      const points = await db.collection('points').find(query).toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(points));
    }

    // Signalement urgent
    if (pathname === '/api/signalement' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const signalement = {
            type: data.type || 'inconnu',
            message: (data.message || '').substring(0, 500),
            ville: (data.ville || 'Non précisée').substring(0, 100),
            lat: parseFloat(data.lat) || null,
            lng: parseFloat(data.lng) || null,
            date: new Date(),
            traite: false
          };
          await db.collection('signalements').insertOne(signalement);
          // Diffuser aux connectés WebSocket
          broadcastSignalement(signalement);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Données invalides' }));
        }
      });
      return;
    }

    // Messages tchat (historique)
    if (pathname === '/api/messages' && req.method === 'GET') {
      const salon = url.searchParams.get('salon') || 'general';
      const messages = await db.collection('messages')
        .find({ salon })
        .sort({ date: -1 })
        .limit(50)
        .toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(messages.reverse()));
    }

    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Route inconnue' }));
  }

  // Fichiers statiques
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// WebSocket - Tchat temps réel
const wss = new WebSocket.Server({ server });
const clients = new Map(); // ws -> { salon, pseudo }

wss.on('connection', (ws) => {
  clients.set(ws, { salon: 'general', pseudo: 'Anonyme' });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'join') {
        const salon = sanitize(data.salon || 'general');
        const pseudo = sanitize(data.pseudo || 'Anonyme').substring(0, 30);
        clients.set(ws, { salon, pseudo });
        // Envoyer l'historique
        const messages = await db.collection('messages')
          .find({ salon })
          .sort({ date: -1 })
          .limit(50)
          .toArray();
        ws.send(JSON.stringify({ type: 'history', messages: messages.reverse() }));
        return;
      }

      if (data.type === 'message') {
        const info = clients.get(ws);
        const texte = sanitize(data.texte || '').substring(0, 500);
        if (!texte) return;
        const msg = {
          salon: info.salon,
          pseudo: info.pseudo,
          texte,
          date: new Date()
        };
        await db.collection('messages').insertOne(msg);
        // Diffuser aux membres du même salon
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            const ci = clients.get(client);
            if (ci && ci.salon === info.salon) {
              client.send(JSON.stringify({ type: 'message', msg }));
            }
          }
        });
      }
    } catch (e) {
      // Message invalide, ignorer
    }
  });

  ws.on('close', () => clients.delete(ws));
});

function broadcastSignalement(signalement) {
  const payload = JSON.stringify({ type: 'signalement', signalement });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function sanitize(str) {
  return String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim();
}

server.listen(PORT, () => {
  console.log(`MainTendue lancé sur http://localhost:${PORT}`);
});
