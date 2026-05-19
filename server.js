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
    seedAgenda();
  })
  .catch(err => console.error('Erreur MongoDB:', err));

// ===================================================================
// SEED AGENDA — Données fiables Restos du Cœur / SAMU Social / etc.
// Sources : sites officiels des associations, 0 800 130 130, 115
// ===================================================================
async function seedAgenda() {
  const col = db.collection('agenda');
  const count = await col.countDocuments({ source: 'officiel' });
  if (count > 0) return; // Déjà seedé

  // Entrées permanentes (permanent: true) = services réguliers sans date fixe
  // Entrées ponctuelles avec date calculée dynamiquement
  const now = new Date();

  // Helper : prochain jour de semaine à partir d'aujourd'hui
  function prochainJour(jourSemaine, heureDebut = 10) {
    // jourSemaine : 0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam
    const d = new Date(now);
    const diff = (jourSemaine - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(heureDebut, 0, 0, 0);
    return d;
  }

  const events = [

    // ========== RESTOS DU CŒUR ==========
    // Source : restosducoeur.org / 0 800 130 130 (numéro national gratuit)
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Paris 10e', permanent: true,
      description: 'Colis alimentaires hebdomadaires (conserves, produits frais, pain). Inscription requise au centre. Contacter le 0 800 130 130 pour connaître le centre le plus proche de vous.',
      ville: 'Paris', adresse: 'Paris 10e — appeler le 0 800 130 130 pour l\'adresse exacte',
      joursHoraires: 'Mar, Jeu et Sam · 9h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Lyon', permanent: true,
      description: 'Colis alimentaires. Les Restos du Cœur de Lyon accueillent les personnes en difficulté. Inscription préalable nécessaire. Centre le plus proche via le 0 800 130 130.',
      ville: 'Lyon', adresse: 'Lyon — appeler le 0 800 130 130 pour le centre le plus proche',
      joursHoraires: 'Lun, Mer, Ven · 9h30–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(1, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Marseille', permanent: true,
      description: 'Aide alimentaire hebdomadaire. Les Restos du Cœur comptent de nombreux centres à Marseille. Contacter le 0 800 130 130 pour connaître le centre de votre arrondissement.',
      ville: 'Marseille', adresse: 'Marseille — appeler le 0 800 130 130 pour le centre de votre arrondissement',
      joursHoraires: 'Mar, Jeu · 10h–12h30', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(2, 10), heureFin: '12:30', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Toulouse', permanent: true,
      description: 'Distribution de colis alimentaires. Les Restos du Cœur de Haute-Garonne disposent de plusieurs centres à Toulouse et en périphérie.',
      ville: 'Toulouse', adresse: 'Toulouse — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Lun, Mer, Ven · 9h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(3, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Bordeaux', permanent: true,
      description: 'Aide alimentaire hebdomadaire. Plusieurs centres Restos du Cœur en Gironde. Contacter le numéro national pour le centre le plus proche.',
      ville: 'Bordeaux', adresse: 'Bordeaux — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Mar, Jeu, Sam · 9h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(4, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Nice', permanent: true,
      description: 'Distribution de colis alimentaires. Les Restos du Cœur des Alpes-Maritimes. Contacter le 0 800 130 130.',
      ville: 'Nice', adresse: 'Nice — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Lun, Mer · 10h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(1, 10), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Nantes', permanent: true,
      description: 'Aide alimentaire. Plusieurs centres Restos du Cœur en Loire-Atlantique à Nantes et agglomération.',
      ville: 'Nantes', adresse: 'Nantes — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Mar, Jeu · 9h30–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Strasbourg', permanent: true,
      description: 'Distribution alimentaire hebdomadaire. Les Restos du Cœur du Bas-Rhin, plusieurs centres à Strasbourg.',
      ville: 'Strasbourg', adresse: 'Strasbourg — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Lun, Mer, Sam · 9h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(5, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Lille', permanent: true,
      description: 'Aide alimentaire. Les Restos du Cœur du Nord disposent de nombreux centres à Lille et dans la métropole.',
      ville: 'Lille', adresse: 'Lille — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Mar, Jeu, Sam · 9h–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Rennes', permanent: true,
      description: 'Distribution de colis alimentaires. Les Restos du Cœur d\'Ille-et-Vilaine, plusieurs centres à Rennes.',
      ville: 'Rennes', adresse: 'Rennes — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Lun, Mer · 9h30–12h', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(1, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Les Restos du Cœur', type: 'repas',
      titre: 'Distribution alimentaire — Montpellier', permanent: true,
      description: 'Aide alimentaire. Plusieurs centres Restos du Cœur à Montpellier et dans l\'Hérault.',
      ville: 'Montpellier', adresse: 'Montpellier — appeler le 0 800 130 130 pour l\'adresse',
      joursHoraires: 'Mar, Jeu · 10h–12h30', capacite: null, animaux: false,
      contact: '0 800 130 130 (gratuit) — restosducoeur.org',
      date: prochainJour(4, 10), heureFin: '12:30', actif: true
    },

    // ========== SAMU SOCIAL / 115 — MARAUDES ==========
    // Source : samusocial-paris.fr / samu-social-de-france.fr / 115
    {
      source: 'officiel', association: 'SAMU Social de Paris', type: 'maraude',
      titre: 'Maraude nocturne — Paris (nuit)', permanent: true,
      description: 'Équipes de maraude du SAMU Social de Paris, toutes les nuits. Accostent les personnes à la rue, proposent écoute, aide médicale et orientation hébergement d\'urgence. Appelez le 115 pour signaler une personne en difficulté.',
      ville: 'Paris', adresse: 'Paris — secteurs Gare du Nord, Châtelet, Les Halles, bois de Vincennes, bois de Boulogne',
      joursHoraires: 'Tous les soirs dès 21h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24) — samusocial-paris.fr',
      date: prochainJour((now.getDay() + 1) % 7, 21), heureFin: '05:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Lyon (nuit)', permanent: true,
      description: 'Maraude nocturne organisée par le SAMU Social du Rhône. Équipes mobiles dans les secteurs de Lyon centre, Perrache, Part-Dieu. Appelez le 115 pour toute urgence ou signalement.',
      ville: 'Lyon', adresse: 'Lyon centre — Part-Dieu, Perrache, rive gauche du Rhône',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Marseille (nuit)', permanent: true,
      description: 'Maraude nocturne des équipes du SAMU Social des Bouches-du-Rhône. Secteurs Belsunce, Noailles, Gare Saint-Charles. Appelez le 115 pour signaler une personne en détresse.',
      ville: 'Marseille', adresse: 'Marseille — Belsunce, Noailles, Gare Saint-Charles, Vieux-Port',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Toulouse (nuit)', permanent: true,
      description: 'Maraude nocturne des équipes du SAMU Social de Haute-Garonne. Centre-ville, secteur gare Matabiau. Appelez le 115.',
      ville: 'Toulouse', adresse: 'Toulouse — centre-ville, gare Matabiau, Capitole',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Bordeaux (nuit)', permanent: true,
      description: 'Maraude nocturne du SAMU Social de Gironde. Secteurs gare Saint-Jean, Quinconces, centre-ville. Appelez le 115 pour signaler une personne en difficulté.',
      ville: 'Bordeaux', adresse: 'Bordeaux — gare Saint-Jean, Quinconces, Victoire',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Lille (nuit)', permanent: true,
      description: 'Maraude nocturne des équipes du SAMU Social du Nord. Secteurs gare de Lille-Flandres, Vieux-Lille, Wazemmes. Appelez le 115.',
      ville: 'Lille', adresse: 'Lille — gare Flandres, Vieux-Lille, Wazemmes',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Nice (nuit)', permanent: true,
      description: 'Maraude nocturne du SAMU Social des Alpes-Maritimes. Promenade des Anglais, gare de Nice-Ville, centre-ville. Appelez le 115.',
      ville: 'Nice', adresse: 'Nice — Promenade des Anglais, gare, centre-ville',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Strasbourg (nuit)', permanent: true,
      description: 'Maraude nocturne des équipes du SAMU Social du Bas-Rhin. Centre-ville, gare de Strasbourg, Neudorf. Appelez le 115.',
      ville: 'Strasbourg', adresse: 'Strasbourg — centre-ville, gare centrale, Neudorf',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Nantes (nuit)', permanent: true,
      description: 'Maraude nocturne du SAMU Social de Loire-Atlantique. Centre-ville de Nantes, gare, île de Nantes. Appelez le 115.',
      ville: 'Nantes', adresse: 'Nantes — centre-ville, gare, île de Nantes',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Rennes (nuit)', permanent: true,
      description: 'Maraude nocturne du SAMU Social d\'Ille-et-Vilaine. Gare de Rennes, République, Thabor. Appelez le 115.',
      ville: 'Rennes', adresse: 'Rennes — gare, République, place du Thabor',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },
    {
      source: 'officiel', association: 'SAMU Social (115)', type: 'maraude',
      titre: 'Maraude — Montpellier (nuit)', permanent: true,
      description: 'Maraude nocturne du SAMU Social de l\'Hérault. Centre-ville, gare Saint-Roch, place de la Comédie. Appelez le 115.',
      ville: 'Montpellier', adresse: 'Montpellier — gare Saint-Roch, place de la Comédie, Ecusson',
      joursHoraires: 'Tous les soirs dès 20h', capacite: null, animaux: true,
      contact: '115 (appel gratuit, 24h/24)',
      date: prochainJour((now.getDay() + 1) % 7, 20), heureFin: '04:00', actif: true
    },

    // ========== ARMÉE DU SALUT ==========
    // Source : armeedusalut.fr / 01 43 62 25 00 (Paris)
    {
      source: 'officiel', association: 'Armée du Salut', type: 'repas',
      titre: 'Repas chaud — Paris (soir)', permanent: true,
      description: 'L\'Armée du Salut distribue des repas chauds aux personnes sans-abri depuis ses centres à Paris. Le Centre William Booth (75013) accueille également des personnes en hébergement d\'urgence. Contacter le centre pour les horaires exacts.',
      ville: 'Paris', adresse: 'Centre William Booth — 94 Rue Championnet, 75018 Paris (et autres centres)',
      joursHoraires: 'Tous les soirs — horaires variables selon les centres',
      capacite: null, animaux: false,
      contact: '01 43 62 25 00 — armeedusalut.fr',
      date: prochainJour((now.getDay() + 1) % 7, 19), heureFin: '21:00', actif: true
    },
    {
      source: 'officiel', association: 'Armée du Salut', type: 'hebergement',
      titre: 'Hébergement et accueil d\'urgence — Paris', permanent: true,
      description: 'L\'Armée du Salut gère plusieurs centres d\'hébergement d\'urgence à Paris et en Île-de-France. Accueil de nuit, douches, repas. Contacter le 115 pour orientation ou l\'Armée du Salut directement.',
      ville: 'Paris', adresse: 'Paris — plusieurs centres, contacter le 115 pour orientation',
      joursHoraires: '24h/24 — appeler le 115 ou l\'Armée du Salut',
      capacite: null, animaux: false,
      contact: '01 43 62 25 00 — armeedusalut.fr — ou 115',
      date: prochainJour(1, 8), heureFin: '20:00', actif: true
    },

    // ========== CROIX-ROUGE FRANÇAISE ==========
    // Source : croix-rouge.fr / 0 800 858 858 (écoute gratuite)
    {
      source: 'officiel', association: 'Croix-Rouge Française', type: 'distribution',
      titre: 'Épicerie sociale et vestimentaire — Paris', permanent: true,
      description: 'La Croix-Rouge gère des épiceries sociales (alimentation à prix solidaire) et des distributions de vêtements dans plusieurs arrondissements de Paris. Contacter la délégation locale pour les jours et horaires.',
      ville: 'Paris', adresse: 'Paris — plusieurs délégations, voir croix-rouge.fr pour adresses',
      joursHoraires: 'Variables selon les centres — contacter la délégation',
      capacite: null, animaux: false,
      contact: 'croix-rouge.fr/nos-actions — 0 800 858 858 (écoute)',
      date: prochainJour(6, 10), heureFin: '13:00', actif: true
    },
    {
      source: 'officiel', association: 'Croix-Rouge Française', type: 'distribution',
      titre: 'Distribution vêtements et hygiène — Lyon', permanent: true,
      description: 'Distribution de vêtements, produits d\'hygiène et aide alimentaire. La délégation Croix-Rouge du Rhône est active dans Lyon et sa métropole. Contacter la délégation pour les horaires exacts.',
      ville: 'Lyon', adresse: 'Lyon — contacter la délégation du Rhône via croix-rouge.fr',
      joursHoraires: 'Samedi matin — vérifier avec la délégation',
      capacite: null, animaux: false,
      contact: 'croix-rouge.fr/nous-trouver — 0 800 858 858',
      date: prochainJour(6, 10), heureFin: '13:00', actif: true
    },
    {
      source: 'officiel', association: 'Croix-Rouge Française', type: 'soins',
      titre: 'Permanence infirmière (PASS mobile) — Marseille', permanent: true,
      description: 'La Croix-Rouge intervient avec des équipes de secouristes et oriente vers les Permanences d\'Accès aux Soins (PASS) des hôpitaux. Soins de base, orientation médicale, sans papiers acceptés dans les PASS.',
      ville: 'Marseille', adresse: 'Marseille — via les PASS de l\'AP-HM, contacter croix-rouge.fr',
      joursHoraires: 'Variables — PASS AP-HM : Lun-Ven 9h-16h',
      capacite: null, animaux: false,
      contact: 'croix-rouge.fr — PASS AP-HM : 04 91 38 34 08',
      date: prochainJour(1, 9), heureFin: '16:00', actif: true
    },

    // ========== SECOURS POPULAIRE FRANÇAIS ==========
    // Source : secourspopulaire.fr / 01 44 78 21 00
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Distribution alimentaire hebdomadaire — Paris', permanent: true,
      description: 'Le Secours Populaire distribue des colis alimentaires, des repas et de l\'aide vestimentaire dans ses fédérations. Aide inconditionnelle, sans condition de ressources. Contacter la fédération locale.',
      ville: 'Paris', adresse: 'Paris — voir secourspopulaire.fr pour les fédérations de Paris',
      joursHoraires: 'Mer et Sam · 9h–12h dans les fédérations',
      capacite: null, animaux: false,
      contact: '01 44 78 21 00 — secourspopulaire.fr',
      date: prochainJour(3, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Lyon', permanent: true,
      description: 'Le Secours Populaire du Rhône distribue des colis alimentaires et assure un soutien global aux personnes en difficulté. Toute personne sans condition de ressources peut bénéficier de l\'aide.',
      ville: 'Lyon', adresse: 'Lyon — voir secourspopulaire.fr pour la fédération du Rhône',
      joursHoraires: 'Mar et Ven · 9h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Lille', permanent: true,
      description: 'Le Secours Populaire du Nord est fortement implanté à Lille et dans la métropole. Distribution de colis alimentaires et aide vestimentaire. Sans condition de ressources.',
      ville: 'Lille', adresse: 'Lille — voir secourspopulaire.fr pour la fédération du Nord',
      joursHoraires: 'Lun, Mer, Ven · 9h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(1, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Bordeaux', permanent: true,
      description: 'Le Secours Populaire de Gironde distribue des colis alimentaires et aide vestimentaire. Aide ouverte à toutes personnes en difficulté sans condition.',
      ville: 'Bordeaux', adresse: 'Bordeaux — voir secourspopulaire.fr pour la fédération de la Gironde',
      joursHoraires: 'Mer et Sam · 9h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(3, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Strasbourg', permanent: true,
      description: 'Le Secours Populaire du Bas-Rhin est très actif à Strasbourg et dans le département. Colis alimentaires, aide vestimentaire, soutien scolaire.',
      ville: 'Strasbourg', adresse: 'Strasbourg — voir secourspopulaire.fr pour la fédération du Bas-Rhin',
      joursHoraires: 'Mar et Ven · 9h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Toulouse', permanent: true,
      description: 'La fédération Haute-Garonne du Secours Populaire est active à Toulouse. Distribution de colis alimentaires et aide vestimentaire sans condition.',
      ville: 'Toulouse', adresse: 'Toulouse — voir secourspopulaire.fr pour la fédération de Haute-Garonne',
      joursHoraires: 'Mer et Sam · 9h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(3, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Marseille', permanent: true,
      description: 'Le Secours Populaire des Bouches-du-Rhône dispose de plusieurs fédérations à Marseille et dans le département. Colis alimentaires, aide sans condition de ressources.',
      ville: 'Marseille', adresse: 'Marseille — voir secourspopulaire.fr pour la fédération 13',
      joursHoraires: 'Mar et Ven · 9h30–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(2, 9), heureFin: '12:00', actif: true
    },
    {
      source: 'officiel', association: 'Secours Populaire Français', type: 'distribution',
      titre: 'Aide alimentaire — Nice', permanent: true,
      description: 'Le Secours Populaire des Alpes-Maritimes distribue des colis alimentaires et de l\'aide vestimentaire à Nice. Aide sans condition.',
      ville: 'Nice', adresse: 'Nice — voir secourspopulaire.fr pour la fédération 06',
      joursHoraires: 'Mer et Sam · 10h–12h — vérifier avec la fédération',
      capacite: null, animaux: false,
      contact: 'secourspopulaire.fr — 01 44 78 21 00',
      date: prochainJour(3, 10), heureFin: '12:00', actif: true
    },
  ];

  await col.insertMany(events);
  console.log(`✅ Agenda seedé : ${events.length} services officiels (Restos du Cœur, SAMU Social, Armée du Salut, Croix-Rouge, Secours Populaire)`);
}

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

    // ===== AGENDA DISTRIBUTIONS =====
    if (pathname === '/api/agenda' && req.method === 'GET') {
      const ville = url.searchParams.get('ville');
      const type = url.searchParams.get('type');
      const today = new Date(new Date().setHours(0,0,0,0));

      // Services permanents/récurrents OU événements futurs
      const baseFilter = { actif: true };
      if (ville && ville !== 'all') baseFilter.ville = ville;
      if (type && type !== 'all') baseFilter.type = type;

      const query = {
        ...baseFilter,
        $or: [
          { permanent: true },
          { date: { $gte: today } }
        ]
      };
      const list = await db.collection('agenda').find(query)
        .sort({ permanent: -1, date: 1 }).limit(100).toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(list));
    }

    if (pathname === '/api/agenda' && req.method === 'POST') {
      const data = await readBody(req);
      const event = {
        association: sanitize(data.association || 'Bénévoles').substring(0, 100),
        type: sanitize(data.type || 'repas').substring(0, 50),
        titre: sanitize(data.titre || '').substring(0, 150),
        description: sanitize(data.description || '').substring(0, 500),
        ville: sanitize(data.ville || '').substring(0, 100),
        adresse: sanitize(data.adresse || '').substring(0, 300),
        date: new Date(data.date),
        heureFin: sanitize(data.heureFin || '').substring(0, 10),
        capacite: parseInt(data.capacite) || null,
        animaux: data.animaux === true || data.animaux === 'true',
        contact: sanitize(data.contact || '').substring(0, 200),
        actif: true,
        dateCreation: new Date(),
        signalements: 0
      };
      if (!event.titre || !event.ville || isNaN(event.date)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Titre, ville et date requis' }));
      }
      await db.collection('agenda').insertOne(event);
      broadcastAll({ type: 'nouvel_event', event });
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // Admin agenda
    if (pathname === '/api/admin/agenda' && req.method === 'GET') {
      if (!isAdmin(req)) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Non autorisé' })); }
      const list = await db.collection('agenda').find({}).sort({ date: 1 }).limit(200).toArray();
      res.writeHead(200);
      return res.end(JSON.stringify(list));
    }

    if (pathname === '/api/admin/agenda/supprimer' && req.method === 'POST') {
      if (!isAdmin(req)) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Non autorisé' })); }
      const data = await readBody(req);
      await db.collection('agenda').updateOne({ _id: new ObjectId(data.id) }, { $set: { actif: false } });
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // Seed agenda si vide
    if (pathname === '/api/agenda/seed' && req.method === 'POST') {
      const count = await db.collection('agenda').countDocuments();
      if (count === 0) await seedAgenda();
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

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
    // ===== IMPACT PUBLIC =====
    if (pathname === '/api/impact' && req.method === 'GET') {
      const [points, signalementsTotal, signalements24h, donsTotal, messagesTotal, agendaTotal, maraudes] = await Promise.all([
        db.collection('points').countDocuments({ actif: true }),
        db.collection('signalements').countDocuments(),
        db.collection('signalements').countDocuments({ date: { $gte: new Date(Date.now() - 86400000) } }),
        db.collection('dons').countDocuments({ actif: true }),
        db.collection('messages').countDocuments(),
        db.collection('agenda').countDocuments({ actif: true }),
        db.collection('maraudes').countDocuments({ actif: true }),
      ]);
      res.writeHead(200);
      return res.end(JSON.stringify({
        connectes: wss.clients.size,
        points, signalementsTotal, signalements24h,
        donsTotal, messagesTotal, agendaTotal,
        villes: 11, associations: 5, maraudes
      }));
    }

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

      // Alerte danger discret
      if (data.type === 'alerte_danger') {
        const info = clients.get(ws);
        const alerte = {
          type: 'alerte_danger',
          lat: parseFloat(data.lat) || null,
          lng: parseFloat(data.lng) || null,
          ville: info ? info.salon : 'Inconnue',
          date: new Date()
        };
        // Stocker en base
        await db.collection('signalements').insertOne({
          type: 'danger_bouton',
          message: '🚨 Alerte danger activée via le bouton discret',
          ville: alerte.ville, lat: alerte.lat, lng: alerte.lng,
          date: alerte.date, traite: false
        });
        // Diffuser à tous
        broadcastAll({ type: 'alerte_danger', alerte });
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
