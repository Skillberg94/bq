// Page de test : état du téléphone, mémoire, connexion Gmail, export.
import { tableaux } from './noyau/tableaux.js?v=060df081ded8';
import { enCsv } from './noyau/csv.js?v=060df081ded8';
import { feuillesXlsx } from './noyau/xlsx.js?v=060df081ded8';
import { etatDeTest } from './donnees-test.js?v=060df081ded8';
import { charger, definirReference, soldes, lister, ajouterManuel, CLE_STOCKAGE } from './noyau/donnees.js?v=060df081ded8';
import { jauge, definirSeuilMois } from './noyau/seuils.js?v=060df081ded8';
import { dateLocale } from './noyau/dates.js?v=060df081ded8';
import { coffreExiste, lireEntete, ouvrirCoffre, lireCoffre, ecrireCoffre, installerCoffre, verifierMotDePasse, changerMotDePasse } from './noyau/coffre.js?v=060df081ded8';
import { lireCle, rangerCle, effacerCle, lireCleEcrans, rangerCleEcrans, effacerCleEcrans } from './porte-cles.js?v=060df081ded8';
import { cleEcrans, cleValide } from './noyau/ecrans-chiffres.js?v=060df081ded8';
import {
  creerSauvegarde, nomDeFichier, lireSauvegarde, ouvrirSauvegarde, restaurer, restaurationAnnulable, annulerRestauration, rappelSauvegarde,
} from './noyau/sauvegarde.js?v=060df081ded8';
import { synchroniser, apresTsPour, LIMITE } from './noyau/synchro.js?v=060df081ded8';
import { enCentimes, enEuros } from './noyau/montants.js?v=060df081ded8';
import { aClasser } from './noyau/categories.js?v=060df081ded8';
import { rappelJours } from './noyau/reglages.js?v=060df081ded8';
import { demarrerEcrans, demanderMotDePasse as demanderMdpEcran, demanderConfirmation } from './ecrans.js?v=060df081ded8';

window.BQ_DEMARRE = true; // tous les modules sont chargés (voir la sécurité du chargement dans index.html)
const $ = (id) => document.getElementById(id);
// Le message garde sa mise en forme de base (attribut data-base) en plus de sa couleur.
const dit = (id, texte, classe = 'info') => { const e = $(id); e.textContent = texte; e.className = (e.dataset.base ? e.dataset.base + ' ' : '') + classe; };
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

// ---- Coffre : toutes les vraies données (opérations, soldes, adresse et clé du pont) sont chiffrées dans le téléphone.
const stockage = {
  getItem: (cle) => lireLocal(cle),
  setItem: (cle, valeur) => { if (!ecrireLocal(cle, valeur)) throw new Error('mémoire du téléphone indisponible'); },
  removeItem: (cle) => { try { localStorage.removeItem(cle); } catch { /* rien */ } },
};
let cleDonnees = null;
let contenu = null; // { etat, pont: { url, cle } }
const enregistrer = () => ecrireCoffre(stockage, cleDonnees, contenu).catch((e) => dit('synchro', 'Enregistrement impossible : ' + e.message, 'ko'));

// Écran du mot de passe : création (première fois) ou ouverture (clé absente du téléphone). Rend la clé de données.
function demanderMotDePasse(creation) {
  $('verrou').hidden = false;
  $('chargement').hidden = true; // l'écran du mot de passe passe devant le chargement
  $('mdp2').hidden = !creation;
  $('verrou-sauvegarde').hidden = false; // restaurer depuis l'écran du mot de passe (nouveau téléphone, données effacées)
  $('mdp').autocomplete = creation ? 'new-password' : 'current-password';
  $('verrou-titre').textContent = creation ? 'Crée ton mot de passe' : 'Saisis ton mot de passe';
  $('verrou-explication').textContent = creation
    ? 'Il chiffre tes données dans ce téléphone et, plus tard, tes designs. Tu ne le saisis qu\'une fois : ensuite l\'app s\'ouvre directement. Oublié et clé perdue = données chiffrées perdues : choisis-en un dont tu te souviendras.'
    : 'La clé n\'est plus dans ce téléphone (verrouillage, ou données du site effacées).';
  return new Promise((resoudre) => {
    $('mdp-ok').onclick = async () => {
      const mdp = $('mdp').value;
      motDePasseOuverture = mdp; // gardé en mémoire le temps d'ouvrir les écrans chiffrés (jamais écrit)
      try {
        verifierMotDePasse(mdp, creation ? $('mdp2').value : undefined);
        dit('verrou-message', creation ? 'Chiffrement de tes données…' : 'Vérification…');
        $('mdp-ok').disabled = true;
        let cle;
        if (creation) {
          const ancien = charger(stockage);
          const actuel = { etat: ancien.etat, pont: { url: lireLocal('bq-pont-url') || '', cle: lireLocal('bq-pont-cle') || '' } };
          // Des données en clair abîmées ne sont jamais effacées.
          const aEffacer = ['bq-pont-url', 'bq-pont-cle', ...(ancien.corrompu ? [] : [CLE_STOCKAGE])];
          cle = await installerCoffre(stockage, mdp, actuel, aEffacer);
        } else {
          cle = await ouvrirCoffre(mdp, lireEntete(stockage));
        }
        $('mdp').value = '';
        $('mdp2').value = '';
        $('verrou').hidden = true;
        $('chargement').hidden = false;
        resoudre(cle);
      } catch (e) {
        dit('verrou-message', e.message, 'ko');
      } finally {
        $('mdp-ok').disabled = false;
      }
    };
  });
}

async function ouvrirApp() {
  if (!coffreExiste(stockage)) {
    cleDonnees = await demanderMotDePasse(true);
  } else {
    cleDonnees = await lireCle();
    if (cleDonnees) {
      try { await lireCoffre(stockage, cleDonnees); } catch { cleDonnees = null; } // clé rangée qui ne correspond plus
    }
    if (!cleDonnees) cleDonnees = await demanderMotDePasse(false);
  }
  try { await rangerCle(cleDonnees); } catch { /* sans IndexedDB : le mot de passe sera redemandé à chaque ouverture */ }
  contenu = (await lireCoffre(stockage, cleDonnees)) ?? { etat: charger(stockage).etat, pont: { url: '', cle: '' } };
  // La page provisoire n'est montrée qu'à la fin, s'il n'y a pas d'écrans Tool Design (voir la fin du fichier).
}

// ---- Sauvegarde et restauration
const dateFr = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const lireFichier = (champ) => new Promise((ok, ko) => {
  const f = champ.files && champ.files[0];
  if (!f) { ko(new Error('Choisis d\'abord le fichier de sauvegarde.')); return; }
  f.text().then(ok, ko);
});

/** Ouvre la sauvegarde choisie, demande confirmation, remplace les données, range la clé et recharge l'app. */
async function restaurerDepuis(champFichier, champMdp, zone, avecConfirmation) {
  try {
    const fichier = lireSauvegarde(await lireFichier(champFichier));
    dit(zone, 'Ouverture de la sauvegarde…');
    const o = await ouvrirSauvegarde(fichier, champMdp.value);
    const r = o.resume;
    const resume = 'Sauvegarde du ' + dateFr(r.cree) + ' : ' + r.operations + ' opération(s)'
      + (r.banque === null ? '' : ', banque ' + enEuros(r.banque)) + (r.especes === null ? '' : ', espèces ' + enEuros(r.especes)) + '.';
    if (avecConfirmation && !confirm(resume + '\n\nRemplacer tes données actuelles ? Une copie de sécurité est gardée.')) { dit(zone, 'Restauration annulée.'); return; }
    await restaurer(stockage, fichier, o.cle);
    try { await rangerCle(o.cle); } catch { /* le mot de passe sera redemandé */ }
    champMdp.value = '';
    dit(zone, 'Restauré. ' + resume + ' Ouverture…', 'ok');
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    dit(zone, e.message, 'ko');
  }
}
$('verrou-restaurer').onclick = () => restaurerDepuis($('verrou-fichier'), $('verrou-fichier-mdp'), 'verrou-restauration', !!lireLocal('banque-donnees-chiffrees-v1'));
$('resto-ok').onclick = () => restaurerDepuis($('resto-fichier'), $('resto-mdp'), 'resto-message', true);
$('resto-annuler').onclick = async () => {
  if (!confirm('Revenir aux données d\'avant la dernière restauration ? Le mot de passe de ces données te sera demandé.')) return;
  try {
    annulerRestauration(stockage);
    await effacerCle().catch(() => {});
    location.reload();
  } catch (e) {
    dit('resto-message', e.message, 'ko');
  }
};

async function sauvegarder(partager) {
  try {
    dit('sauvegarde-message', 'Préparation…');
    const maintenant = Date.now();
    const { fichier, contenu: aJour } = await creerSauvegarde(stockage, cleDonnees, contenu, maintenant);
    const blob = new Blob([JSON.stringify(fichier)], { type: 'application/json' });
    const r = await livrer(nomDeFichier(maintenant), blob, partager);
    if (r.ok) { contenu = aJour; await enregistrer(); afficherRappel(); } // date notée seulement si le fichier est bien parti
    dit('sauvegarde-message', r.message, r.ok ? 'ok' : 'ko');
  } catch (e) {
    dit('sauvegarde-message', 'Sauvegarde impossible : ' + e.message, 'ko');
  }
}
$('sauvegarde-partager').onclick = () => sauvegarder(true);
$('sauvegarde-telecharger').onclick = () => sauvegarder(false);
function afficherRappel() {
  const texte = rappelJours(contenu.etat) === null ? null : rappelSauvegarde(contenu, Date.now(), rappelJours(contenu.etat));
  $('rappel-sauvegarde').textContent = texte ? texte + ' Pense à en faire une (menu, Sauvegarde).' : '';
  $('resto-annuler-bloc').hidden = !restaurationAnnulable(stockage);
}

// Mot de passe tapé à l'ouverture (écran du mot de passe) : sert une fois à tirer la clé des écrans, puis est oublié.
let motDePasseOuverture = null;
/** Clé des écrans publiés chiffrés : celle gardée dans le téléphone, sinon tirée du mot de passe de l'app (une fois). */
async function cleDesEcrans(coffre) {
  const rangee = await lireCleEcrans();
  if (rangee && (await cleValide(rangee, coffre.controle))) return rangee;
  let mdp = motDePasseOuverture;
  motDePasseOuverture = null;
  for (let essai = 0; essai < 5; essai++) {
    if (!mdp) {
      // La petite fenêtre passe devant le chargement en or (qui reste derrière).
      mdp = await demanderMdpEcran(essai === 0 ? 'Mot de passe de l’app (une seule fois, pour ouvrir les écrans)' : 'Mot de passe incorrect, réessaie');
      if (mdp === null) throw new Error('écrans non ouverts (mot de passe non saisi)');
    }
    const cle = await cleEcrans(mdp, coffre.sel, coffre.iterations);
    mdp = null;
    if (await cleValide(cle, coffre.controle)) {
      try { await rangerCleEcrans(cle); } catch { /* sans IndexedDB : redemandé à la prochaine ouverture */ }
      return cle;
    }
  }
  throw new Error('mot de passe des écrans incorrect');
}

$('verrouiller').onclick = async () => {
  // Confirmation : un appui involontaire ne doit rien verrouiller.
  if (!confirm('Verrouiller l\'app ? Ton mot de passe sera redemandé à la prochaine ouverture.')) return;
  await effacerCle().catch(() => {});
  await effacerCleEcrans().catch(() => {});
  location.reload();
};

// ---- 3 bis. Pont Apps Script (sans connexion Google : l'adresse et la clé sont chiffrées dans ce téléphone)
$('pont-lire').onclick = async () => {
  const url = $('pont-url').value.trim();
  const cle = $('pont-cle').value.trim();
  if (!url || !cle) { dit('pont', 'Renseigne l\'adresse du pont et la clé.', 'ko'); return; }
  // La clé n'est jamais envoyée ailleurs que chez Google Apps Script.
  if (!url.startsWith('https://script.google.com/macros/s/')) { dit('pont', 'L\'adresse doit commencer par https://script.google.com/macros/s/', 'ko'); return; }
  contenu.pont = { url, cle };
  await enregistrer();
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

// ---- Lecteur Tool Design (brique 13, test de l'enveloppe) : chargé seulement quand on le demande.
let vueLecteur = null;
let lecteurEnCours = null;
function chargerLecteur() {
  if (window.BQLecteurPret) return window.BQLecteurPret;
  if (lecteurEnCours) return lecteurEnCours;
  lecteurEnCours = new Promise((ok, ko) => {
    window.BQ_LECTEUR_BASE = 'lecteur/';
    // Empreinte du lecteur fabriqué (construire-site.mjs) : un lecteur refait n'est jamais pris dans le cache.
    fetch('lecteur/version.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((v) => {
      const script = document.createElement('script');
      script.src = 'lecteur/lecteur.js' + (v.empreinte ? '?v=' + v.empreinte : '');
      script.onload = () => window.BQLecteurPret.then(ok, ko);
      script.onerror = () => ko(new Error('lecteur introuvable'));
      document.head.append(script);
    });
  });
  return lecteurEnCours;
}
$('lecteur-afficher').onclick = async () => {
  try {
    dit('lecteur-message', 'Chargement du lecteur…');
    const [lecteur, design] = await Promise.all([chargerLecteur(), fetch('lecteur/ecran-test.design.json').then((r) => r.json())]);
    $('lecteur-zone').hidden = false;
    if (vueLecteur) vueLecteur.demonter();
    vueLecteur = lecteur.monter($('lecteur-zone'), {
      design,
      gaugeValues: { 'jauge-test': Number($('lecteur-jauge').value) },
      onAction: (action) => dit('lecteur-message', 'Action reçue du design : ' + action, 'ok'),
    });
    dit('lecteur-message', 'Écran affiché par le lecteur. Touche le bouton bleu ou bouge le curseur.', 'ok');
  } catch (e) {
    dit('lecteur-message', 'Lecteur : ' + e.message, 'ko');
  }
};
$('lecteur-jauge').oninput = () => vueLecteur?.mettreAJour({ gaugeValues: { 'jauge-test': Number($('lecteur-jauge').value) } });

// ---- 0. Mes comptes : vraies données, chiffrées dans ce téléphone, synchro automatique par le pont
function lireMessage(d) {
  const h = Object.fromEntries(d.payload.headers.map((x) => [x.name, x.value]));
  return { id: d.id, ts: Number(d.internalDate), objet: h.Subject || '', texte: texteDuMail(d.payload) };
}

// Écran d'accueil provisoire (brique 12a) : soldes, dernières dépenses, saisie, seuil de dépense.
const dateLongue = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
function nomCategorie(l) {
  if (l.retrait) return 'retrait';
  if (!l.categorie) return 'à classer';
  return contenu.etat.categories.find((c) => c.id === l.categorie)?.nom ?? 'à classer';
}

function afficherComptes() {
  const etat = contenu.etat;
  const s = soldes(etat);
  for (const [id, v] of [['solde-banque', s.banque], ['solde-especes', s.especes]]) {
    $(id).textContent = v === null ? 'solde de départ à saisir (menu)' : enEuros(v);
    $(id).className = 'montant' + (v === null ? ' vide' : '');
  }
  const depenses = lister(etat); // tout l'historique, dépenses et entrées (demande du propriétaire)
  $('depenses').textContent = depenses.length ? '' : "Aucune dépense pour l'instant.";
  for (const l of depenses) {
    const ligne = document.createElement('div');
    ligne.className = 'ligne' + (l.source === 'manuel' ? ' saisie' : ''); // saisie à la main : fond d'une autre couleur
    const milieu = document.createElement('div'); milieu.className = 'milieu';
    const lib = document.createElement('div'); lib.className = 'lib'; lib.textContent = l.emetteurReel || l.libelle;
    const date = document.createElement('div'); date.className = 'date';
    date.textContent = dateLongue(l.date) + ' · ' + nomCategorie(l);
    const etiquettes = [
      l.compte === 'especes' && 'Espèces',
      l.source === 'manuel' && l.compte === 'banque' && 'Saisie banque',
      l.retrait && 'Retrait',
      !l.comptee && 'hors solde',
    ].filter(Boolean);
    for (const t of etiquettes) { const e = document.createElement('span'); e.className = 'badge'; e.textContent = t; date.append(e); }
    milieu.append(lib, date);
    const mt = document.createElement('div'); mt.className = 'mt'; mt.textContent = enEuros(l.sens === 'sortie' ? -l.centimes : l.centimes, { signe: true });
    if (l.sens !== 'sortie') mt.style.color = '#6ee7a0';
    ligne.append(milieu, mt);
    $('depenses').append(ligne);
  }
  const n = aClasser(etat).length;
  $('a-classer').textContent = n ? n + ' libellé(s) de dépense à classer dans une catégorie.' : '';
  afficherJauge();
}

const periodeChoisie = () => lireLocal('bq-periode') || 'mois';
function afficherJauge() {
  const j = jauge(contenu.etat, periodeChoisie(), dateLocale(Date.now()));
  $('periode').value = periodeChoisie();
  const reste = $('jauge-reste');
  if (j.seuil === null) {
    $('jauge-pct').textContent = '—';
    $('jauge-chiffres').textContent = enEuros(j.depense) + ' dépensés';
    $('barre-plein').style.width = '0';
    $('barre').className = 'barre';
    reste.className = 'reste';
    reste.textContent = 'Seuil non réglé.';
    $('seuil-regler').textContent = 'Régler le seuil mensuel';
    return;
  }
  const pct = Math.round((j.depense / j.seuil) * 100);
  $('jauge-pct').textContent = pct + ' %';
  $('jauge-chiffres').textContent = enEuros(j.depense) + ' / ' + enEuros(j.seuil);
  $('barre-plein').style.width = Math.min(pct, 100) + '%';
  $('barre').className = 'barre' + (j.depasse ? ' depasse' : '');
  reste.className = 'reste' + (j.depasse ? ' depasse' : '');
  reste.textContent = j.depasse ? 'Dépassement : ' : 'Reste à dépenser : ';
  const b = document.createElement('b'); b.textContent = enEuros(Math.abs(j.reste)); reste.append(b);
  $('seuil-regler').textContent = 'Modifier le seuil mensuel (' + enEuros(contenu.etat.seuils.moisCentimes) + ')';
}

$('periode').onchange = () => { ecrireLocal('bq-periode', $('periode').value); afficherJauge(); };

$('seuil-regler').onclick = async () => {
  const actuel = contenu.etat.seuils.moisCentimes;
  const reponse = prompt('Seuil de dépense par mois, en euros (les frais récurrents n’y sont pas comptés) :', actuel === null ? '' : (actuel / 100).toFixed(2).replace('.', ','));
  if (reponse === null) return;
  try {
    const c = enCentimes(reponse);
    if (c <= 0) throw new Error('Le seuil doit être un montant positif.');
    contenu.etat = definirSeuilMois(contenu.etat, c);
    await enregistrer();
    afficherJauge();
  } catch (e) {
    alert(e.message);
  }
};

$('saisie-ajouter').onclick = async () => {
  try {
    const centimes = enCentimes($('saisie-montant').value);
    if (centimes <= 0) throw new Error('Saisis un montant positif, par exemple 4,20.');
    const banque = $('saisie-banque').checked;
    const maintenant = Date.now();
    const description = $('saisie-description').value.trim();
    contenu.etat = ajouterManuel(contenu.etat, {
      compte: banque ? 'banque' : 'especes', sens: 'sortie',
      libelle: description || (banque ? 'Dépense banque' : 'Dépense en espèces'),
      date: dateLocale(maintenant), centimes, ts: maintenant,
    }).etat;
    await enregistrer();
    afficherComptes();
    $('saisie-montant').value = '';
    $('saisie-description').value = '';
    $('saisie-banque').checked = false;
    dit('saisie-message', 'Ajouté : ' + enEuros(-centimes) + (banque ? ' (banque)' : ' (espèces)'), 'ok');
  } catch (e) {
    dit('saisie-message', e.message, 'ko');
  }
};

let derniereTentative = 0;
let enCours = false;
let ecrans = null; // écrans Tool Design (version d'essai locale), voir la fin du fichier
async function synchroAuto(forcer = false) {
  if (!contenu) return null; // coffre pas encore ouvert (écran du mot de passe affiché)
  const { url, cle } = contenu.pont;
  if (!url || !cle) {
    dit('synchro', 'Pour la synchro, règle d\'abord le pont (adresse et clé).', 'ko');
    return { ok: false, message: 'Pour la synchro, règle d\'abord le pont (Réglages, « Régler le pont »).' };
  }
  if (enCours || (!forcer && Date.now() - derniereTentative < 30000)) return null;
  enCours = true;
  derniereTentative = Date.now();
  dit('synchro', 'Synchro…');
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ cle, max: LIMITE, apresTs: apresTsPour(contenu.etat) }) });
    const rep = await r.json();
    if (rep.erreur) throw new Error(rep.erreur);
    const res = synchroniser(contenu.etat, rep.messages, { lire: lireMessage, extraire: Extraction.extraireOperation, maintenant: Date.now() });
    contenu.etat = res.etat;
    await enregistrer();
    afficherComptes();
    const p = res.rapport;
    let texte = 'Synchro de ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' : ' + p.ajoutees.length + ' nouvelle(s) opération(s)';
    if (p.ignorees.length) texte += ', ' + p.ignorees.length + ' ignorée(s)';
    if (p.erreurs.length) texte += ', ' + p.erreurs.length + ' illisible(s), relue(s) à la prochaine synchro';
    if (p.alertes.length) texte += ', ' + p.alertes.length + ' à vérifier (signe du montant)';
    if (p.validees?.length) texte += ', ' + p.validees.length + (p.validees.length > 1 ? ' paiements CB en attente validés' : ' paiement CB en attente validé');
    if (p.limiteAtteinte) texte += '. Attention : ' + LIMITE + ' alertes reçues d\'un coup, il peut en manquer.';
    dit('synchro', texte, p.erreurs.length || p.limiteAtteinte ? 'ko' : 'ok');
    return { ok: !(p.erreurs.length || p.limiteAtteinte), message: texte };
  } catch (e) {
    dit('synchro', 'Synchro impossible : ' + e.message, 'ko');
    return { ok: false, message: 'Synchro impossible : ' + e.message };
  } finally {
    enCours = false;
    ecrans?.rafraichir();
  }
}

$('synchro-maintenant').onclick = () => synchroAuto(true);
$('depart-ok').onclick = async () => {
  try {
    let saisis = 0;
    for (const [compte, champ] of [['banque', 'depart-banque'], ['especes', 'depart-especes']]) {
      const valeur = $(champ).value.trim();
      if (!valeur) continue;
      contenu.etat = definirReference(contenu.etat, compte, enCentimes(valeur), Date.now());
      saisis += 1;
    }
    if (!saisis) throw new Error('Saisis au moins un montant.');
    await enregistrer();
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
// Rien ne s'affiche ni ne se synchronise avant l'ouverture du coffre.
await ouvrirApp();
$('pont-url').value = contenu.pont.url;
$('pont-cle').value = contenu.pont.cle;
afficherComptes();
afficherRappel();
synchroAuto();

// ---- 4. Export
async function livrer(nom, blob, partager) {
  const fichier = new File([blob], nom, { type: blob.type });
  if (partager) {
    if (!(navigator.canShare && navigator.canShare({ files: [fichier] }))) return { ok: false, message: "Le partage de fichiers n'est pas disponible ici : utilise « télécharger »." };
    try { await navigator.share({ files: [fichier] }); return { ok: true, message: 'Fichier partagé : ' + nom }; }
    catch (e) { return { ok: false, message: e.name === 'AbortError' ? 'Partage annulé.' : 'Partage impossible : ' + e.message }; }
  }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
  return { ok: true, message: 'Téléchargement lancé : ' + nom };
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
    const r = await livrer(nom, blob, partager);
    dit('export', r.message, r.ok ? 'ok' : 'ko');
  } catch (e) {
    dit('export', 'Erreur : ' + e.message, 'ko');
  }
}

$('xlsx-partager').onclick = () => exporter('xlsx', true);
$('xlsx-telecharger').onclick = () => exporter('xlsx', false);
$('csv-partager').onclick = () => exporter('csv', true);
$('csv-telecharger').onclick = () => exporter('csv', false);

// ---- 5. Écrans Tool Design (version d'essai locale : site-essai/, avec les dessins du template « suivi-depense »).
// Sans les dessins (site publié), rien ne change : la page provisoire ci-dessus reste affichée.
function periodeExport(periode) {
  const auj = dateLocale(Date.now());
  if (periode === 'annee') return { debut: auj.slice(0, 4) + '-01-01', fin: auj.slice(0, 4) + '-12-31', nom: auj.slice(0, 4) };
  if (periode === 'mois') return { debut: auj.slice(0, 8) + '01', fin: auj.slice(0, 8) + '31', nom: auj.slice(0, 7) };
  return null;
}
async function exporterDonnees(format, periode) {
  const p = periodeExport(periode);
  const etat = contenu.etat;
  // Période choisie : seules les opérations de la période partent (frais, catégories et soldes restent ceux d'aujourd'hui).
  const choisi = p ? { ...etat, operations: etat.operations.filter((o) => o.date >= p.debut && o.date <= p.fin) } : etat;
  const t = tableaux(choisi, dateLocale(Date.now()));
  const nom = 'bq-export-' + (p ? p.nom : 'tout') + '-' + dateLocale(Date.now());
  if (format === 'csv') return livrer(nom + '.csv', new Blob([enCsv(t[0])], { type: 'text/csv;charset=utf-8' }), true).then(repli(nom + '.csv', () => new Blob([enCsv(t[0])], { type: 'text/csv;charset=utf-8' })));
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const blob = await writeExcelFile(feuillesXlsx(t)).toBlob();
  return livrer(nom + '.xlsx', blob, true).then(repli(nom + '.xlsx', () => blob));
}
// Partage d'abord (Fichiers, iCloud Drive sur l'iPhone) ; sans partage (ordinateur), téléchargement.
const repli = (nom, blob) => (r) => (r.ok || !/pas disponible/.test(r.message) ? r : livrer(nom, blob(), false));

function choisirFichier() {
  return new Promise((ok) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = '.json,application/json';
    champ.onchange = () => ok(champ.files && champ.files[0] ? champ.files[0] : null);
    champ.click();
  });
}

async function lancerEcrans() {
  try {
    return await demarrerEcrans({
      lecteur: chargerLecteur,
      cleEcrans: cleDesEcrans,
      etat: () => contenu.etat,
      changerEtat: async (etat) => { contenu.etat = etat; await enregistrer(); afficherComptes(); },
      synchroniser: (forcer) => synchroAuto(forcer).then((r) => r ?? { ok: true, message: 'Synchro déjà en cours…' }),
      texteSynchro: () => $('synchro').textContent,
      rappel: () => (rappelJours(contenu.etat) === null ? '' : rappelSauvegarde(contenu, Date.now(), rappelJours(contenu.etat)) ?? ''),
      pontRegle: () => !!(contenu.pont.url && contenu.pont.cle),
      enregistrerPont: async (url, cle) => {
        // La clé n'est jamais envoyée ailleurs que chez Google Apps Script.
        if (!url.startsWith('https://script.google.com/macros/s/')) return { ok: false, message: 'L\'adresse doit commencer par https://script.google.com/macros/s/' };
        contenu.pont = { url, cle: cle || contenu.pont.cle };
        if (!contenu.pont.cle) return { ok: false, message: 'Tape aussi la clé secrète du pont.' };
        await enregistrer();
        return synchroAuto(true).then((r) => r ?? { ok: true, message: 'Pont enregistré.' });
      },
      sauvegarder: async () => {
        const maintenant = Date.now();
        const { fichier, contenu: aJour } = await creerSauvegarde(stockage, cleDonnees, contenu, maintenant);
        const blob = new Blob([JSON.stringify(fichier)], { type: 'application/json' });
        const r = await livrer(nomDeFichier(maintenant), blob, true).then(repli(nomDeFichier(maintenant), () => blob));
        if (r.ok) { contenu = aJour; await enregistrer(); afficherRappel(); } // date notée seulement si le fichier est bien parti
        return r;
      },
      restaurer: async () => {
        const f = await choisirFichier();
        if (!f) return { ok: false, message: 'Aucun fichier choisi.' };
        const fichier = lireSauvegarde(await f.text());
        const mdp = await demanderMdpEcran('Mot de passe de cette sauvegarde');
        if (mdp === null) return { ok: false, message: 'Restauration annulée.' };
        const o = await ouvrirSauvegarde(fichier, mdp);
        const r = o.resume;
        if (!(await demanderConfirmation('Sauvegarde du ' + dateFr(r.cree) + ' : ' + r.operations + ' opération(s).\n\nRemplacer tes données actuelles ? Une copie de sécurité est gardée.', 'Oui, remplacer'))) return { ok: false, message: 'Restauration annulée.' };
        await restaurer(stockage, fichier, o.cle);
        try { await rangerCle(o.cle); } catch { /* le mot de passe sera redemandé */ }
        setTimeout(() => location.reload(), 900);
        return { ok: true, message: 'Restauré. Ouverture…' };
      },
      annulerRestauration: async () => {
        if (!restaurationAnnulable(stockage)) return { ok: false, message: 'Aucune restauration à annuler.' };
        if (!(await demanderConfirmation('Revenir aux données d\'avant la dernière restauration ? Le mot de passe de ces données te sera demandé.', 'Oui, revenir'))) return { ok: false, message: 'Rien n\'a changé.' };
        annulerRestauration(stockage);
        await effacerCle().catch(() => {});
        location.reload();
        return { ok: true, message: 'Retour aux données d\'avant…' };
      },
      restaurationAnnulable: () => restaurationAnnulable(stockage),
      derniereSauvegarde: () => contenu.sauvegarde?.derniere ?? null,
      exporter: exporterDonnees,
      verrouiller: async () => { await effacerCle().catch(() => {}); await effacerCleEcrans().catch(() => {}); location.reload(); return { ok: true, message: 'Verrouillage…' }; },
      changerMotDePasse: async () => {
        const ancien = await demanderMdpEcran('Mot de passe actuel');
        if (ancien === null) return { ok: false, message: 'Rien n’a changé.' };
        const nouveau = await demanderMdpEcran('Nouveau mot de passe (10 caractères minimum)');
        if (nouveau === null) return { ok: false, message: 'Rien n’a changé.' };
        const confirmation = await demanderMdpEcran('Le nouveau, une deuxième fois');
        if (confirmation === null) return { ok: false, message: 'Rien n’a changé.' };
        try {
          cleDonnees = await changerMotDePasse(stockage, ancien, nouveau, confirmation);
          try { await rangerCle(cleDonnees); } catch { /* le mot de passe sera redemandé à la prochaine ouverture */ }
          return { ok: true, message: 'Mot de passe changé. Les sauvegardes déjà faites gardent l’ancien.' };
        } catch (e) {
          return { ok: false, message: e.message };
        }
      },
    });
  } catch (e) {
    // Écrans impossibles à afficher : on garde la page provisoire, avec la raison.
    $('app').hidden = false;
    document.querySelector('header.entete').style.display = '';
    document.body.classList.remove('avec-ecrans');
    $('ecrans').hidden = true;
    dit('synchro', 'Écrans Tool Design : ' + e.message, 'ko');
    return null;
  }
}
// ?provisoire dans l'adresse : la page provisoire, même avec les écrans (pour comparer, ou en secours).
// ?donnees-essai, sur l'ordinateur seulement (localhost) : remplace les données par des données inventées.
const parametres = new URLSearchParams(location.search);
if (parametres.has('donnees-essai') && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  const { etatEssai } = await import('./donnees-essai.js?v=060df081ded8');
  contenu.etat = etatEssai(dateLocale(Date.now()));
  await enregistrer();
  history.replaceState(null, '', location.pathname);
}
if (!parametres.has('provisoire')) ecrans = await lancerEcrans();
// Sans écrans (site publié, ?provisoire, ou erreur) : la page provisoire. Le chargement en or disparaît dans tous les cas.
if (!ecrans) $('app').hidden = false;
$('chargement').hidden = true;
