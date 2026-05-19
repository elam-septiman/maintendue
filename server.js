const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'elanprotect';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'elanprotect2026';

let db;

MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log('MongoDB connecté');
    seedPoints();
  })
  .catch(err => console.error('Erreur MongoDB:', err));

async function seedPoints() {
  const col = db.collection('points');
  const count = await col.countDocuments();
  if (count === 0) {
    await col.insertMany([
      { ville: 'Paris', nom: 'Resto du Coeur - Paris 13', type: 'repas', lat: 48.8276, lng: 2.3522, adresse: '53 Rue Corvisart, 75013 Paris', horaires: 'Lun-Sam 12h-14h', actif: true },
      { ville: 'Paris', nom: 'Douches municipales - Marais', type: 'douche', lat: 48.8566, lng: 2.3522, adresse: '2 Rue des Blancs Manteaux, 75004 Paris', horaires: 'Mer-Dim 8h-18h', actif: true },
      { ville: 'Paris', nom: 'Hébergement urgence SAMU Social', type: 'hebergement', lat: 48.8700, lng: 2.3460, adresse: 'Paris - Appel 115', horaires: '24h/24', actif: true },
      { ville: 'Paris', nom: 'Wifi gratuit Bibliothèque Pompidou', type: 'wifi', lat: 48.8607, lng: 2.3514, adresse: 'Place Georges-Pompidou, 75004', horaires: 'Lun-Dim 11h-21h', actif: true },
      { ville: 'Lyon', nom: 'Les Restos du Coeur - Lyon', type: 'repas', lat: 45.7500, lng: 4.8500, adresse: '10 Rue Domer, 69007 Lyon', horaires: 'Mar-Sam 11h30-13h', actif: true },
      { ville: 'Lyon', nom: 'Centre hébergement Croix-Rouge', type: 'hebergement', lat: 45.7640, lng: 4.8357, adresse: 'Lyon - Appel 115', horaires: '24h/24', actif: true },
      { ville: 'Marseille', nom: 'Soupe Populaire - Vieux Port', type: 'repas', lat: 43.2965, lng: 5.3698, adresse: 'Quai du Port, 13002 Marseille', horaires: 'Tous les soirs 19h', actif: true },
      { ville: 'Marseille', nom: 'Douches CCAS Marseille', type: 'douche', lat: 43.2987, lng: 5.3759, adresse: '128 La Canebière, 13001 Marseille', horaires: 'Lun-Ven 9h-16h', actif: true },
    ]);
    console.log('Points initialisés');
  }
}

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

function sanitize(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').trim();
}

function isAdmin(req) {
  const token = req.headers['x-admin-token'] || '';
  return token === ADMIN_PASSWORD;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ===== API PUBLIQUE =====
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // Maraudes - position en temps réel
    if (pathname === '/api/maraudes' && req.method === 'GET') {
      const maraudes = await db.collection('maraudes')
        .find({ actif: true, dateMaj: { $gte: new Date(Date.now() - 3600000) } })
        .toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(maraudes));
    }

    if (pathname === '/api/maraudes' && req.method === 'POST') {
      const data = await readBody(req);
      const maraude = {
        nom: sanitize(data.nom || 'Équipe bénévole').substring(0, 100),
        ville: sanitize(data.ville || '').substring(0, 100),
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lng),
        contenu: sanitize(data.contenu || '').substring(0, 300),
        actif: true,
        dateMaj: new Date()
      };
      await db.collection('maraudes').updateOne(
        { token: data.token },
        { $set: maraude },
        { upsert: true }
      );
      broadcastAll({ type: 'maraude_update', maraude });
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // Points carte
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
      const data = await readBody(req);
      const signalement = {
        type: sanitize(data.type || 'inconnu'),
        message: sanitize(data.message || '').substring(0, 500),
        ville: sanitize(data.ville || 'Non précisée').substring(0, 100),
        lat: parseFloat(data.lat) || null,
        lng: parseFloat(data.lng) || null,
        date: new Date(),
        traite: false,
        signalements: 0
      };
      await db.collection('signalements').insertOne(signalement);
      broadcastAll({ type: 'signalement', signalement });
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // Messages tchat (historique)
    if (pathname === '/api/messages' && req.method === 'GET') {
      const salon = sanitize(url.searchParams.get('salon') || 'Paris');
      const messages = await db.collection('messages')
        .find({ salon, supprime: { $ne: true } })
        .sort({ date: -1 }).limit(50).toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(messages.reverse()));
    }

    // Signaler un message (modération communautaire)
    if (pathname === '/api/messages/signaler' && req.method === 'POST') {
      const data = await readBody(req);
      if (!data.id) { res.writeHead(400); return res.end(JSON.stringify({ error: 'ID requis' })); }
      try {
        await db.collection('messages').updateOne(
          { _id: new ObjectId(data.id) },
          { $inc: { signalements: 1 } }
        );
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      } catch { res.writeHead(400); return res.end(JSON.stringify({ error: 'ID invalide' })); }
    }

    // Dons - liste
    if (pathname === '/api/dons' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const ville = url.searchParams.get('ville');
      const sens = url.searchParams.get('sens'); // 'donne' ou 'cherche'
      const query = { actif: true };
      if (type && type !== 'all') query.categorie = type;
      if (ville && ville !== 'all') query.ville = ville;
      if (sens && sens !== 'all') query.sens = sens;
      const dons = await db.collection('dons').find(query).sort({ date: -1 }).limit(50).toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(dons));
    }

    // Dons - créer
    if (pathname === '/api/dons' && req.method === 'POST') {
      const data = await readBody(req);
      const don = {
        sens: data.sens === 'cherche' ? 'cherche' : 'donne',
        categorie: sanitize(data.categorie || 'autre').substring(0, 50),
        titre: sanitize(data.titre || '').substring(0, 100),
        description: sanitize(data.description || '').substring(0, 500),
        ville: sanitize(data.ville || 'Non précisée').substring(0, 100),
        contact: sanitize(data.contact || 'Tchat MainTendue').substring(0, 200),
        date: new Date(),
        actif: true,
        signalements: 0
      };
      if (!don.titre) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Titre requis' })); }
      await db.collection('dons').insertOne(don);
      broadcastAll({ type: 'nouveau_don', don });
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // Stats publiques
    if (pathname === '/api/stats' && req.method === 'GET') {
      const [points, signalements24h, dons, messages] = await Promise.all([
        db.collection('points').countDocuments({ actif: true }),
        db.collection('signalements').countDocuments({ date: { $gte: new Date(Date.now() - 86400000) } }),
        db.collection('dons').countDocuments({ actif: true }),
        db.collection('messages').countDocuments({ date: { $gte: new Date(Date.now() - 86400000) } }),
      ]);
      res.writeHead(200);
      return res.end(JSON.stringify({ points, signalements24h, dons, messages, connectes: wss.clients.size }));
    }

    // ===== API ADMIN =====
    if (pathname.startsWith('/api/admin/')) {
      if (!isAdmin(req)) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Non autorisé' }));
      }

      // Admin login check
      if (pathname === '/api/admin/login' && req.method === 'POST') {
        const data = await readBody(req);
        if (data.password === ADMIN_PASSWORD) {
          res.writeHead(200);
          return res.end(JSON.stringify({ ok: true, token: ADMIN_PASSWORD }));
        }
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Mot de passe incorrect' }));
      }

      // Stats admin
      if (pathname === '/api/admin/stats') {
        const [points, signalements, dons, messages, messagesSignales] = await Promise.all([
          db.collection('points').countDocuments({ actif: true }),
          db.collection('signalements').countDocuments(),
          db.collection('dons').countDocuments({ actif: true }),
          db.collection('messages').countDocuments(),
          db.collection('messages').countDocuments({ signalements: { $gte: 1 } }),
        ]);
        res.writeHead(200);
        return res.end(JSON.stringify({ points, signalements, dons, messages, messagesSignales, connectes: wss.clients.size }));
      }

      // Signalements admin
      if (pathname === '/api/admin/signalements' && req.method === 'GET') {
        const traite = url.searchParams.get('traite');
        const query = traite === 'true' ? { traite: true } : traite === 'false' ? { traite: false } : {};
        const list = await db.collection('signalements').find(query).sort({ date: -1 }).limit(100).toArray();
        res.writeHead(200);
        return res.end(JSON.stringify(list));
      }

      // Marquer signalement traité
      if (pathname === '/api/admin/signalements/traiter' && req.method === 'POST') {
        const data = await readBody(req);
        await db.collection('signalements').updateOne({ _id: new ObjectId(data.id) }, { $set: { traite: true } });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }

      // Messages signalés
      if (pathname === '/api/admin/messages/signales' && req.method === 'GET') {
        const list = await db.collection('messages').find({ signalements: { $gte: 1 } }).sort({ signalements: -1 }).limit(100).toArray();
        res.writeHead(200);
        return res.end(JSON.stringify(list));
      }

      // Supprimer message
      if (pathname === '/api/admin/messages/supprimer' && req.method === 'POST') {
        const data = await readBody(req);
        await db.collection('messages').updateOne({ _id: new ObjectId(data.id) }, { $set: { supprime: true } });
        broadcastAll({ type: 'message_supprime', id: data.id });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }

      // Points carte - ajouter
      if (pathname === '/api/admin/points' && req.method === 'POST') {
        const data = await readBody(req);
        const point = {
          ville: sanitize(data.ville).substring(0, 100),
          nom: sanitize(data.nom).substring(0, 200),
          type: sanitize(data.type).substring(0, 50),
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
          adresse: sanitize(data.adresse).substring(0, 300),
          horaires: sanitize(data.horaires).substring(0, 200),
          actif: true,
          dateAjout: new Date()
        };
        await db.collection('points').insertOne(point);
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }

      // Points carte - supprimer
      if (pathname === '/api/admin/points/supprimer' && req.method === 'POST') {
        const data = await readBody(req);
        await db.collection('points').updateOne({ _id: new ObjectId(data.id) }, { $set: { actif: false } });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }

      // Dons - liste admin
      if (pathname === '/api/admin/dons' && req.method === 'GET') {
        const list = await db.collection('dons').find({}).sort({ date: -1 }).limit(200).toArray();
        res.writeHead(200);
        return res.end(JSON.stringify(list));
      }

      // Dons - supprimer
      if (pathname === '/api/admin/dons/supprimer' && req.method === 'POST') {
        const data = await readBody(req);
        await db.collection('dons').updateOne({ _id: new ObjectId(data.id) }, { $set: { actif: false } });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }

      // Tous les points (admin)
      if (pathname === '/api/admin/points' && req.method === 'GET') {
        const list = await db.collection('points').find({}).sort({ dateAjout: -1 }).toArray();
        res.writeHead(200);
        return res.end(JSON.stringify(list));
      }

      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Route admin inconnue' }));
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

// ===== WEBSOCKET =====
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on('connection', (ws) => {
  clients.set(ws, { salon: 'Paris', pseudo: 'Anonyme' });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'join') {
        const salon = sanitize(data.salon || 'Paris');
        const pseudo = sanitize(data.pseudo || 'Anonyme').substring(0, 30);
        clients.set(ws, { salon, pseudo });
        const messages = await db.collection('messages')
          .find({ salon, supprime: { $ne: true } })
          .sort({ date: -1 }).limit(50).toArray();
        ws.send(JSON.stringify({ type: 'history', messages: messages.reverse() }));
        return;
      }

      if (data.type === 'message') {
        const info = clients.get(ws);
        const texte = sanitize(data.texte || '').substring(0, 500);
        if (!texte) return;
        // Anti-spam basique : pas plus de 3 messages en 5 secondes
        const now = Date.now();
        if (!info.lastMessages) info.lastMessages = [];
        info.lastMessages = info.lastMessages.filter(t => now - t < 5000);
        if (info.lastMessages.length >= 3) {
          ws.send(JSON.stringify({ type: 'erreur', message: 'Trop de messages, patientez.' }));
          return;
        }
        info.lastMessages.push(now);
        const msg = { salon: info.salon, pseudo: info.pseudo, texte, date: new Date(), signalements: 0 };
        const result = await db.collection('messages').insertOne(msg);
        msg._id = result.insertedId;
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            const ci = clients.get(client);
            if (ci && ci.salon === info.salon) {
              client.send(JSON.stringify({ type: 'message', msg }));
            }
          }
        });
      }
    } catch (e) {}
  });

  ws.on('close', () => clients.delete(ws));
});

function broadcastAll(payload) {
  const str = JSON.stringify(payload);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(str); });
}

server.listen(PORT, () => console.log(`MainTendue → http://localhost:${PORT}`));
