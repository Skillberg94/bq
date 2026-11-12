// Les 10 écrans Tool Design dans l'app (03/11/2026) : affichés par le lecteur, plein écran, à la place de la page
// provisoire. Les valeurs et les boutons passent par le noyau (noyau/ecrans.js) ; ce fichier ne fait que les relier :
//   - montrer l'écran demandé (accueil au départ, puis les pages du menu : « Aller à un autre écran du template ») ;
//   - lui envoyer ses valeurs à chaque changement ;
//   - recevoir les boutons, les lignes touchées et le texte des cases, et faire ce qui demande le navigateur
//     (synchro, fichiers, mot de passe).
// Les écrans ne sont présents que dans la version d'essai locale (site-essai/, node construire-site.mjs --essai) : sans
// eux, demarrerEcrans rend null et la page provisoire reste affichée.
import { valeursEcran, agir, uiDepart, uiPageOuverte, casesDeLaLigne, PAGES } from './noyau/ecrans.js?v=9ab47a314fd1';
import { dateLocale } from './noyau/dates.js?v=9ab47a314fd1';
import { dechiffrerOctets } from './noyau/ecrans-chiffres.js?v=9ab47a314fd1';

const $ = (id) => document.getElementById(id);
const VERSION = 'essai local · 3 nov. 2026';
// Envois des lignes touchées : l'app retient la ligne et le texte de départ des cases de la fenêtre qui s'ouvre.
const LIGNES_TOUCHEES = ['operation-touchee', 'categorie-touchee', 'emetteur-touche', 'frais-touche', 'objectif-touche', 'revenu-touche'];
// Journal des boutons reçus dans la console, sur l'ordinateur seulement (essais).
const JOURNAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// UX familière de Tool Design (lecteur version 2) : message et confirmation au style des écrans, fournis par le lecteur.
let uxLecteur = null;
let minuterie = null;
// bouton (facultatif) : { libelle, faire } — un bouton dans le message, ex. « Annuler » après une suppression
// (03/11/2026, comme les applications connues : pas de question, mais un moyen de revenir en arrière ; 5 secondes).
export function direMessage(texte, erreur = false, bouton = null) {
  if (uxLecteur && texte) return uxLecteur.message(texte, { error: erreur, ...(bouton && { button: { label: bouton.libelle, onPress: bouton.faire } }) });
  const e = $('ecrans-message');
  if (!e || !texte) return;
  e.textContent = texte;
  if (bouton) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = bouton.libelle;
    b.onclick = () => { e.hidden = true; clearTimeout(minuterie); bouton.faire(); };
    e.append(' ', b);
  }
  e.className = erreur ? 'erreur' : '';
  e.hidden = false;
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { e.hidden = true; }, bouton ? 5000 : erreur ? 4500 : 2800);
}

/** Petite fenêtre HTML pour un mot de passe (jamais dans un écran dessiné : la case reste celle du navigateur). */
export function demanderMotDePasse(titre) {
  return new Promise((ok) => {
    $('ecrans-dialogue-titre').textContent = titre;
    $('ecrans-dialogue-mdp').value = '';
    $('ecrans-dialogue').hidden = false;
    $('ecrans-dialogue-mdp').focus();
    const fin = (valeur) => { $('ecrans-dialogue').hidden = true; $('ecrans-dialogue-mdp').value = ''; ok(valeur); };
    $('ecrans-dialogue-ok').onclick = () => fin($('ecrans-dialogue-mdp').value);
    $('ecrans-dialogue-annuler').onclick = () => fin(null);
  });
}


/**
 * Petite fenêtre « Oui / Annuler » de l'app, à la place de la confirmation du navigateur (confirm) : celle-ci ne
 * s'affiche pas partout (refusée sans rien montrer dans certains navigateurs) et ne ressemble pas à l'app.
 */
export function demanderConfirmation(texte, oui = 'Oui') {
  if (uxLecteur) return uxLecteur.confirmer(texte, oui);
  return new Promise((ok) => {
    // Espace insécable avant « ? ! : ; » : la ponctuation ne passe jamais seule à la ligne.
    $('ecrans-confirmation-texte').textContent = texte.replace(/ ([?!:;])/g, ' $1');
    $('ecrans-confirmation-oui').textContent = oui;
    $('ecrans-confirmation').hidden = false;
    const fin = (valeur) => { $('ecrans-confirmation').hidden = true; ok(valeur); };
    $('ecrans-confirmation-oui').onclick = () => fin(true);
    $('ecrans-confirmation-annuler').onclick = () => fin(false);
  });
}

/**
 * app : ce que la page fournit — lecteur (promesse), etat(), changerEtat(etat), synchroniser(), texteSynchro(),
 * rappel(), pontRegle(), enregistrerPont(url, cle), sauvegarder(), restaurer(), annulerRestauration(),
 * restaurationAnnulable(), derniereSauvegarde(), exporter(format, periode), verrouiller(), changerMotDePasse().
 */
/**
 * Support de cet appareil, pour « Alléger les affichages » de Tool Design (07/11/2026) : iphone, ipad, android (téléphone),
 * tablet (tablette Android) ou web. Le même calcul est fait dans sw.js (sans le tactile, que le service worker ne voit pas).
 */
export function support(ua = navigator.userAgent, tactile = navigator.maxTouchPoints > 1) {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tactile)) return 'ipad';
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'android' : 'tablet';
  return 'web';
}

// Écrans publiés compressés (gzip) avant d'être chiffrés (07/11/2026) ; un écran non compressé passe tel quel.
async function decompresser(octets) {
  const o = new Uint8Array(octets);
  if (o[0] !== 0x1f || o[1] !== 0x8b) return octets;
  return new Response(new Blob([o]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export async function demarrerEcrans(app) {
  // Écrans en clair (version d'essai locale : designs/sources.json) ou chiffrés (site publié : designs/coffre.json, puis
  // chaque fichier « .bin » ouvert avec la clé des écrans ; images et polices deviennent des adresses locales « blob: »).
  let sources;
  let lireDesign;
  const designs = new Map();
  const enClair = await fetch('designs/sources.json', { cache: 'no-cache' }).catch(() => null);
  if (enClair?.ok) {
    sources = await enClair.json();
    sources = { ...sources, images: { ...sources.images, ...(sources.allegees?.[support()] ?? {}) } };
    lireDesign = (page) => {
      if (!designs.has(page)) designs.set(page, fetch('designs/' + page + '.design.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('écran introuvable : ' + page); return r.json(); }));
      return designs.get(page);
    };
  } else {
    const r = await fetch('designs/coffre.json', { cache: 'no-cache' }).catch(() => null);
    if (!r?.ok) return null;
    const coffre = await r.json();
    window.BQ_NOTER?.('écrans : coffre lu');
    const cle = await app.cleEcrans(coffre);
    window.BQ_NOTER?.('écrans : clé prête');
    const ouvrir = async (chemin) => {
      const f = await fetch(chemin, { cache: 'no-cache' });
      if (!f.ok) throw new Error('fichier d’écran introuvable : ' + chemin);
      return dechiffrerOctets(cle, await f.arrayBuffer());
    };
    const table = JSON.parse(new TextDecoder().decode(await ouvrir('designs/sources.bin')));
    // Images allégées pour ce support (Tool Design, 07/11/2026), sinon celles d'origine.
    table.images = { ...table.images, ...(table.allegees?.[support()] ?? {}) };
    const enAdresse = async (chemin, type) => URL.createObjectURL(new Blob([await ouvrir(chemin)], { type }));
    const images = Object.fromEntries(await Promise.all(Object.entries(table.images).map(async ([k, c]) => [k, await enAdresse(c, 'image/png')])));
    const polices = Object.fromEntries(await Promise.all(Object.entries(table.polices).map(async ([f, cs]) => [f, await Promise.all(cs.map((c) => enAdresse(c, 'font/ttf')))])));
    sources = { images, polices };
    window.BQ_NOTER?.('écrans : ' + Object.keys(images).length + ' images (' + support() + ') et ' + Object.keys(polices).length + ' polices déchiffrées');
    lireDesign = (page) => {
      if (!designs.has(page)) designs.set(page, ouvrir('designs/' + page + '.bin').then(decompresser).then((o) => JSON.parse(new TextDecoder().decode(o))));
      return designs.get(page);
    };
  }
  window.BQ_NOTER?.('écrans : attente du lecteur');
  const lecteur = await app.lecteur();
  window.BQ_NOTER?.('écrans : lecteur reçu');
  if (lecteur.message && lecteur.confirmer) uxLecteur = lecteur;
  // Les autres écrans se chargent pendant qu'on regarde l'accueil (changement de page sans attente).
  const prechargement = () => PAGES.forEach((p) => lireDesign(p).catch(() => {}));

  const zone = $('ecrans');
  document.querySelector('header.entete').style.display = 'none'; // « hidden » ne suffit pas : l'en-tête est en display: flex
  $('app').hidden = true;
  zone.hidden = false;
  document.body.classList.add('avec-ecrans');

  let page = 'accueil';
  let pret = false;
  const accueilPret = (comment) => {
    if (pret) return;
    pret = true;
    $('chargement').hidden = true;
    window.BQ_AFFICHEE?.('accueil ' + comment);
  };
  let ui = uiDepart(dateLocale(Date.now()));
  let saisies = {};
  let dernier = null;
  let erreurs = {};
  let vue = null;
  let occupe = false;
  // Nombre de demandes « vider les cases » envoyées au lecteur.
  let vidages = 0;

  const contexte = (valeurs = {}) => ({
    aujourdhui: dateLocale(Date.now()), maintenant: Date.now(), saisies, dernier, valeurs,
    synchro: app.texteSynchro(), rappel: app.rappel() ?? '', dateDe: dateLocale, version: VERSION,
    derniereSauvegarde: app.derniereSauvegarde(), restaurationAnnulable: app.restaurationAnnulable(), pontRegle: app.pontRegle(),
  });
  const valeurs = () => {
    const v = valeursEcran(page, app.etat(), ui, contexte());
    return { linkVariables: v.linkVariables, gaugeValues: v.gaugeValues, chartData: v.chartData, inputStates: erreurs, buttonStates: v.buttonStates, appPicks: v.appPicks };
  };
  const rafraichir = () => vue?.mettreAJour(valeurs());

  // Glissé du menu, clavier et hauteur de l'écran : faits par le lecteur (UX familière de Tool Design).

  // Changement de page : le même lecteur reçoit le nouveau dessin (plus rapide que de tout refaire). « remonter » refait
  // le lecteur : c'est le seul moyen de vider les cases et de refermer les fenêtres de l'écran.
  async function montrer(nouvelle, { remonter = false, saut = false } = {}) {
    const design = await lireDesign(nouvelle);
    page = nouvelle;
    saisies = {};
    dernier = null;
    erreurs = {};
    ui = { ...ui, objectifs: { ...ui.objectifs, fenetre: null } }; // aucune fenêtre ouverte sur un écran qui s'ouvre
    if (!saut) ui = uiPageOuverte(nouvelle, ui, dateLocale(Date.now()));
    if (vue && !remonter) { vue.mettreAJour({ design, ...valeurs() }); return; }
    if (vue) vue.demonter();
    vue = lecteur.monter(zone, {
      design,
      fontLibrary: sources.polices,
      imageLibrary: sources.images,
      ...valeurs(),
      onAction: (action) => recevoir(action, {}),
      onLinkMessage: (nom, v) => recevoir(nom, v ?? {}),
      onInput: (nom, texte) => {
        saisies = { ...saisies, [nom]: texte };
        dernier = nom;
        const erreurEffacee = !!erreurs[nom];
        if (erreurEffacee) erreurs = {};
        // Objectifs : ce qui reste à mettre de côté, la durée et le bouton grisé suivent la frappe.
        if (erreurEffacee || page === 'objectifs') rafraichir();
      },
      onGoToDesign: (nom) => { if (PAGES.includes(nom)) montrer(nom).catch((e) => direMessage(e.message, true)); },
      onGoBack: () => montrer('accueil').catch(() => {}),
      onReady: () => accueilPret('dessiné'),
    });
  }

  async function effet(e) {
    if (e.type === 'synchroniser') return app.synchroniser(true);
    if (e.type === 'pont') return app.enregistrerPont(e.url, e.cle);
    if (e.type === 'sauvegarder') return app.sauvegarder();
    if (e.type === 'restaurer') return app.restaurer();
    if (e.type === 'annuler-restauration') return app.annulerRestauration();
    if (e.type === 'exporter') return app.exporter(e.format, e.periode);
    if (e.type === 'verrouiller') return app.verrouiller();
    if (e.type === 'changer-mot-de-passe') return app.changerMotDePasse();
    return null;
  }

  async function recevoir(action, valeursLigne) {
    if (JOURNAL) console.debug('[écrans]', page, action, valeursLigne, { ...saisies }, occupe ? '(occupé)' : '');
    if (occupe) return;
    const r = agir(page, app.etat(), ui, action, contexte(valeursLigne));
    if (!r) return;
    occupe = true;
    try {
      if (r.confirmer && !(await demanderConfirmation(r.confirmer, r.confirmerOui ?? 'Oui'))) return;
      ui = r.ui;
      if (LIGNES_TOUCHEES.includes(action)) {
        saisies = { ...saisies, ...casesDeLaLigne(page, app.etat(), ui, valeursLigne.id, contexte()) };
        dernier = null;
      }
      for (const nom of r.oublier ?? []) delete saisies[nom];
      erreurs = r.erreurCase ? { [r.erreurCase]: 'error' } : {};
      if (r.etat !== app.etat()) await app.changerEtat(r.etat);
      if (r.effet) {
        const fait = await effet(r.effet);
        if (fait?.message) direMessage(fait.message, !fait.ok);
      }
      // L'ajout d'une dépense sur l'accueil a son propre message dans l'écran ; le reste s'affiche en bas.
      const annuler = r.annuler && { libelle: 'Annuler', faire: () => recevoir(r.annuler.action, { id: r.annuler.id }) };
      if (r.message && !(page === 'accueil' && action === 'ajouter-depense')) direMessage(r.message, r.erreur, annuler);
      if (r.aller && PAGES.includes(r.aller)) {
        await montrer(r.aller, { saut: true });
      } else if (r.vider && !r.erreur) {
        // Cases vidées et fenêtres de l'écran refermées par le lecteur lui-même (03/11/2026 : refaire l'écran pour les
        // vider montrait un instant un écran noir après « Ajouter »).
        const noms = Array.isArray(r.vider) ? r.vider : [];
        for (const nom of noms) delete saisies[nom];
        vue?.mettreAJour({ ...valeurs(), resetInputs: { names: noms, closePopups: true, times: ++vidages } });
      } else {
        rafraichir();
      }
    } catch (e) {
      direMessage(e.message, true);
    } finally {
      occupe = false;
    }
  }

  // Boîte noire du démarrage (index.html) : la toile du moteur (création, taille, contexte de dessin perdu).
  if (window.BQ_NOTER) {
    const suivre = (toile) => {
      if (toile.dataset.bqSuivie) return;
      toile.dataset.bqSuivie = '1';
      window.BQ_NOTER('toile créée ' + toile.width + 'x' + toile.height);
      toile.addEventListener('webglcontextlost', () => window.BQ_NOTER('CONTEXTE DE DESSIN PERDU'));
      toile.addEventListener('webglcontextrestored', () => window.BQ_NOTER('contexte de dessin retrouvé'));
    };
    new MutationObserver(() => zone.querySelectorAll('canvas').forEach(suivre)).observe(zone, { childList: true, subtree: true });
    zone.querySelectorAll('canvas').forEach(suivre);
  }
  // Le chargement en or reste devant tant que l'accueil n'est pas dessiné (polices et images chargées) : plus d'écran
  // noir ou à moitié dessiné à l'ouverture (07/11/2026). Au plus 25 s, au cas où le signal n'arriverait pas.
  setTimeout(() => accueilPret('au bout de 25 s, sans signal'), 25000);
  await montrer('accueil');
  window.BQ_NOTER?.('écrans : accueil monté');
  prechargement();
  return { rafraichir };
}
