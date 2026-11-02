// Page de test : état du téléphone, mémoire, connexion Gmail, export.
import { tableaux } from './noyau/tableaux.js';
import { enCsv } from './noyau/csv.js';
import { feuillesXlsx } from './noyau/xlsx.js';
import { etatDeTest } from './donnees-test.js';
import { charger, sauver, definirReference, soldes, lister } from './noyau/donnees.js';
import { synchroniser, apresTsPour, LIMITE } from './noyau/synchro.js';
import { enCentimes, enEuros } from './noyau/montants.js';
import { aClasser } from './noyau/categories.js';

const $ = (id) => document.getElementById(id);
const dit = (id, texte, classe = 'info') => { $(id).textContent = texte; $(id).className = classe; };
const lireLocal = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrireLocal = (cle, valeur) => { try { localStorage.setItem(cle, valeur); return true; } catch { return false; } };

// ---- 1. Ce téléphone
const installee = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const lignes = [
  ['App installée sur l\'écran d\'accueil', installee ? 'oui' : 'non (ouverte dans le navigateur)'],
  ['Adresse', location.origin],
  ['Fenêtres surgissantes (connexion Google)', 'à tester ci-dessous'],
];
for (const [nom, valeur] of lignes) {
  const tr = document.createElement('tr');
  const a = document.createElement('td'); a.className = 'petit'; a.textContent = nom;
  const b = document.createElement('td'); b.textContent = valeur;
  tr.append(a, b);
  $('etat').append(tr);
}

// ---- 2. Mémoire
const ouvertures = Number(lireLocal('bq-ouvertures') || 0) + 1;
const premiere = lireLocal('bq-premiere') || new Date().toLocaleString('fr-FR');
const marche = ecrireLocal('bq-ouvertures', String(ouvertures)) && ecrireLocal('bq-premiere', premiere);
$('memoire').className = marche ? 'ok' : 'ko';
$('memoire').textContent = marche ? 'Ouverture n° ' + ouvertures + ' · première ouverture : ' + premiere : 'La mémoire de l\'app est indisponible sur ce téléphone.';

// ---- 3. Gmail
$('expediteur').value = lireLocal('bq-expediteur') || '';

async function api(chemin, jeton) {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + chemin, { headers: { Authorization: 'Bearer ' + jeton } });
  if (!r.ok) throw new Error('Gmail a répondu ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}

// Texte codé (API Gmail) ou liste d'octets (pont Apps Script) : Extraction.decoderCorps gère les deux.
const decode = (donnees) => Extraction.decoderCorps(donnees);
function parties(p, type, sortie = []) {
  if (p.mimeType === type && p.body && p.body.data) sortie.push(decode(p.body.data));
  (p.parts || []).forEach((q) => parties(q, type, sortie));
  return sortie;
}
function texteDuMail(payload) {
  const html = parties(payload, 'text/html')[0];
  if (!html) return parties(payload, 'text/plain')[0] || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style,script').forEach((n) => n.remove());
  const morceaux = [];
  const marcheur = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (marcheur.nextNode()) morceaux.push(marcheur.currentNode.nodeValue.trim());
  return morceaux.filter(Boolean).join('\n');
}

const euros = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';

// Affiche un message Gmail complet (même format qu'il vienne de Google ou du pont Apps Script).
function afficherMessage(d) {
    const h = Object.fromEntries(d.payload.headers.map((x) => [x.name, x.value]));
    const texte = texteDuMail(d.payload);
    const op = Extraction.extraireOperation({ id: d.id, objet: h.Subject || '', texte });
    const bloc = document.createElement('div'); bloc.className = 'mail';
    const sujet = document.createElement('b'); sujet.textContent = h.Subject || '(sans objet)';
    const meta = document.createElement('span'); meta.className = 'petit'; meta.textContent = h.Date || '';
    const res = document.createElement('div'); res.className = op.ignore ? 'ignore' : 'compte';
    res.textContent = op.ignore
      ? 'IGNORÉ : ' + op.ignore + (op.libelle ? ' (' + op.libelle + ', ' + op.date + ', ' + euros(op.centimes) + ')' : '')
      : 'COMPTÉ : ' + (op.sens === 'sortie' ? 'dépense' : 'entrée') + ' · ' + op.libelle + ' · ' + op.date + ' · ' + euros(op.centimes) + (op.alerte ? ' ⚠ ' + op.alerte : '');
    const details = document.createElement('details');
    const resume = document.createElement('summary'); resume.className = 'petit'; resume.textContent = 'Texte du mail';
    const pre = document.createElement('pre'); pre.textContent = texte;
    details.append(resume, pre);
    bloc.append(sujet, meta, res, details);
    $('liste').append(bloc);
}

async function lireMails(jeton) {
  const expediteur = $('expediteur').value.trim();
  const recherche = expediteur ? 'from:' + expediteur : '';
  dit('gmail', 'Lecture des mails…');
  const trouves = await api('messages?maxResults=' + CONFIG.nombre + '&q=' + encodeURIComponent(recherche), jeton);
  $('liste').textContent = '';
  if (!trouves.messages) { dit('gmail', 'Connecté. Aucun mail trouvé pour cet expéditeur.', 'ok'); return; }
  for (const m of trouves.messages) afficherMessage(await api('messages/' + m.id + '?format=full', jeton));
  dit('gmail', 'Connecté. ' + trouves.messages.length + ' mail(s) lu(s).', 'ok');
}

$('connexion').onclick = () => {
  ecrireLocal('bq-expediteur', $('expediteur').value.trim());
  if (!window.google || !google.accounts) { dit('gmail', 'La bibliothèque Google n\'est pas encore chargée : réessaie.', 'ko'); return; }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.clientId,
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    callback: (rep) => {
      if (rep.error) { dit('gmail', 'Connexion refusée : ' + rep.error, 'ko'); return; }
      lireMails(rep.access_token).catch((e) => dit('gmail', e.message, 'ko'));
    },
    error_callback: (e) => dit('gmail', 'Connexion impossible : ' + (e.type || e.message) + ' (fenêtre fermée ou bloquée ?)', 'ko'),
  });
  dit('gmail', 'Ouverture de la fenêtre Google…');
  client.requestAccessToken();
};

// ---- 3 bis. Pont Apps Script (sans connexion Google : l'adresse et la clé restent dans ce téléphone)
$('pont-url').value = lireLocal('bq-pont-url') || '';
$('pont-cle').value = lireLocal('bq-pont-cle') || '';
$('pont-lire').onclick = async () => {
  const url = $('pont-url').value.trim();
  const cle = $('pont-cle').value.trim();
  if (!url || !cle) { dit('pont', 'Renseigne l\'adresse du pont et la clé.', 'ko'); return; }
  // La clé n'est jamais envoyée ailleurs que chez Google Apps Script.
  if (!url.startsWith('https://script.google.com/macros/s/')) { dit('pont', 'L\'adresse doit commencer par https://script.google.com/macros/s/', 'ko'); return; }
  ecrireLocal('bq-pont-url', url);
  ecrireLocal('bq-pont-cle', cle);
  try {
    dit('pont', 'Lecture via le pont…');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ cle, max: CONFIG.nombre }) });
    const rep = await r.json();
    if (rep.erreur) throw new Error(rep.erreur);
    $('liste').textContent = '';
    rep.messages.forEach(afficherMessage);
    dit('pont', rep.messages.length + ' mail(s) lu(s) via le pont, sans connexion Google.', 'ok');
  } catch (e) {
    dit('pont', 'Pont : ' + e.message, 'ko');
  }
};

// ---- 0. Mes comptes : vraies données, gardées dans ce téléphone, synchro automatique par le pont
const stockage = {
  getItem: (cle) => lireLocal(cle),
  setItem: (cle, valeur) => { if (!ecrireLocal(cle, valeur)) throw new Error('mémoire du téléphone indisponible'); },
};
let etat = (() => {
  const r = charger(stockage);
  if (r.corrompu) dit('synchro', 'Les données enregistrées sont abîmées : rien n\'a été écrasé.', 'ko');
  return r.etat;
})();
const enregistrer = () => sauver(stockage, etat);

function lireMessage(d) {
  const h = Object.fromEntries(d.payload.headers.map((x) => [x.name, x.value]));
  return { id: d.id, ts: Number(d.internalDate), objet: h.Subject || '', texte: texteDuMail(d.payload) };
}

function afficherComptes() {
  const s = soldes(etat);
  $('solde-banque').textContent = s.banque === null ? 'solde de départ à saisir' : enEuros(s.banque);
  $('solde-especes').textContent = s.especes === null ? 'solde de départ à saisir' : enEuros(s.especes);
  const lignes = lister(etat).slice(0, 10);
  $('operations').textContent = lignes.length ? '' : 'Aucune opération pour l\'instant.';
  for (const l of lignes) {
    const ligne = document.createElement('div'); ligne.className = 'op';
    const gauche = document.createElement('div');
    const lib = document.createElement('div'); lib.className = 'lib'; lib.textContent = l.emetteurReel || l.libelle;
    const date = document.createElement('div'); date.className = 'date';
    date.textContent = l.date.slice(8, 10) + '/' + l.date.slice(5, 7) + ' · ' + (l.compte === 'banque' ? 'banque' : 'espèces');
    const etiquettes = [l.retrait && 'retrait', l.aClasser && 'à classer', !l.comptee && 'hors solde'].filter(Boolean);
    for (const t of etiquettes) { const e = document.createElement('span'); e.className = 'tag'; e.textContent = t; date.append(e); }
    gauche.append(lib, date);
    const mt = document.createElement('div');
    mt.className = 'mt ' + (l.sens === 'sortie' ? 'moins' : 'plus');
    mt.textContent = enEuros(l.sens === 'sortie' ? -l.centimes : l.centimes, { signe: true });
    ligne.append(gauche, mt);
    $('operations').append(ligne);
  }
  const n = aClasser(etat).length;
  $('a-classer').textContent = n ? n + ' libellé(s) de dépense à classer dans une catégorie.' : '';
}

let derniereTentative = 0;
let enCours = false;
async function synchroAuto(forcer = false) {
  const url = lireLocal('bq-pont-url');
  const cle = lireLocal('bq-pont-cle');
  if (!url || !cle) { dit('synchro', 'Pour la synchro, renseigne d\'abord le pont (section 3 bis).', 'ko'); return; }
  if (enCours || (!forcer && Date.now() - derniereTentative < 30000)) return;
  enCours = true;
  derniereTentative = Date.now();
  dit('synchro', 'Synchro…');
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ cle, max: LIMITE, apresTs: apresTsPour(etat) }) });
    const rep = await r.json();
    if (rep.erreur) throw new Error(rep.erreur);
    const res = synchroniser(etat, rep.messages, { lire: lireMessage, extraire: Extraction.extraireOperation, maintenant: Date.now() });
    etat = res.etat;
    enregistrer();
    afficherComptes();
    const p = res.rapport;
    let texte = 'Synchro de ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' : ' + p.ajoutees.length + ' nouvelle(s) opération(s)';
    if (p.ignorees.length) texte += ', ' + p.ignorees.length + ' ignorée(s)';
    if (p.erreurs.length) texte += ', ' + p.erreurs.length + ' illisible(s), relue(s) à la prochaine synchro';
    if (p.alertes.length) texte += ', ' + p.alertes.length + ' à vérifier (signe du montant)';
    if (p.limiteAtteinte) texte += '. Attention : ' + LIMITE + ' alertes reçues d\'un coup, il peut en manquer.';
    dit('synchro', texte, p.erreurs.length || p.limiteAtteinte ? 'ko' : 'ok');
  } catch (e) {
    dit('synchro', 'Synchro impossible : ' + e.message, 'ko');
  } finally {
    enCours = false;
  }
}

$('synchro-maintenant').onclick = () => synchroAuto(true);
$('depart-ok').onclick = () => {
  try {
    let saisis = 0;
    for (const [compte, champ] of [['banque', 'depart-banque'], ['especes', 'depart-especes']]) {
      const valeur = $(champ).value.trim();
      if (!valeur) continue;
      etat = definirReference(etat, compte, enCentimes(valeur), Date.now());
      saisis += 1;
    }
    if (!saisis) throw new Error('Saisis au moins un montant.');
    enregistrer();
    afficherComptes();
    $('depart-banque').value = '';
    $('depart-especes').value = '';
    dit('depart-message', 'Solde de départ enregistré.', 'ok');
  } catch (e) {
    dit('depart-message', e.message, 'ko');
  }
};
// À l'ouverture de l'app et à chaque retour dedans (au plus une fois toutes les 30 secondes).
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') synchroAuto(); });
afficherComptes();
synchroAuto();

// ---- 4. Export
async function livrer(nom, blob, partager) {
  const fichier = new File([blob], nom, { type: blob.type });
  if (partager) {
    if (!(navigator.canShare && navigator.canShare({ files: [fichier] }))) return 'Le partage de fichiers n\'est pas disponible ici : utilise « télécharger ».';
    try { await navigator.share({ files: [fichier] }); return 'Fichier partagé : ' + nom; }
    catch (e) { return e.name === 'AbortError' ? 'Partage annulé.' : 'Partage impossible : ' + e.message; }
  }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
  return 'Téléchargement lancé : ' + nom;
}

const tables = () => tableaux(etatDeTest(), '2026-10-31');

async function exporter(format, partager) {
  try {
    dit('export', 'Préparation…');
    let blob, nom;
    if (format === 'csv') {
      blob = new Blob([enCsv(tables()[0])], { type: 'text/csv;charset=utf-8' });
      nom = 'bq-exemple-operations.csv';
    } else {
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      blob = await writeExcelFile(feuillesXlsx(tables())).toBlob();
      nom = 'bq-exemple.xlsx';
    }
    dit('export', await livrer(nom, blob, partager), 'ok');
  } catch (e) {
    dit('export', 'Erreur : ' + e.message, 'ko');
  }
}

$('xlsx-partager').onclick = () => exporter('xlsx', true);
$('xlsx-telecharger').onclick = () => exporter('xlsx', false);
$('csv-partager').onclick = () => exporter('csv', true);
$('csv-telecharger').onclick = () => exporter('csv', false);
