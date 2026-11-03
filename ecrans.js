// Les 10 écrans Tool Design dans l'app (03/11/2026) : affichés par le lecteur, plein écran, à la place de la page
// provisoire. Les valeurs et les boutons passent par le noyau (noyau/ecrans.js) ; ce fichier ne fait que les relier :
//   - montrer l'écran demandé (accueil au départ, puis les pages du menu : « Aller à un autre écran du template ») ;
//   - lui envoyer ses valeurs à chaque changement ;
//   - recevoir les boutons, les lignes touchées et le texte des cases, et faire ce qui demande le navigateur
//     (synchro, fichiers, mot de passe).
// Les écrans ne sont présents que dans la version d'essai locale (site-essai/, node construire-site.mjs --essai) : sans
// eux, demarrerEcrans rend null et la page provisoire reste affichée.
import { valeursEcran, agir, uiDepart, casesDeLaLigne, PAGES } from './noyau/ecrans.js?v=d47024da74e0';
import { dateLocale } from './noyau/dates.js?v=d47024da74e0';
import { dechiffrerOctets } from './noyau/ecrans-chiffres.js?v=d47024da74e0';

const $ = (id) => document.getElementById(id);
const VERSION = 'essai local · 3 nov. 2026';
// Envois des lignes touchées : l'app retient la ligne et le texte de départ des cases de la fenêtre qui s'ouvre.
const LIGNES_TOUCHEES = ['operation-touchee', 'categorie-touchee', 'emetteur-touche', 'frais-touche', 'objectif-touche'];
// Journal des boutons reçus dans la console, sur l'ordinateur seulement (essais).
const JOURNAL = ['localhost', '127.0.0.1'].includes(location.hostname);

let minuterie = null;
// bouton (facultatif) : { libelle, faire } — un bouton dans le message, ex. « Annuler » après une suppression
// (03/11/2026, comme les applications connues : pas de question, mais un moyen de revenir en arrière ; 5 secondes).
export function direMessage(texte, erreur = false, bouton = null) {
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
 * Zone des écrans à la hauteur de tout l'écran du téléphone (03/11/2026, captures du propriétaire sur iPhone) : dans
 * l'app ajoutée à l'écran d'accueil, Safari annonce une fenêtre plus courte de la hauteur de la barre d'état (47 pt
 * sur son iPhone) ; « plein écran » s'arrêtait donc avant le bas (bande noire) et le dessin, centré dans cette zone
 * trop courte, remontait sous l'heure. L'app ajoutée à l'écran d'accueil occupe toujours tout l'écran : on prend la
 * hauteur de l'écran. Dans le navigateur (ordinateur, Safari ordinaire), la hauteur de la fenêtre, comme avant.
 * Deuxième essai (capture suivante du propriétaire : la zone avait bien la hauteur de l'écran, mais son bas restait
 * caché) : Safari coupe les éléments « fixes » à sa fenêtre trop courte. La zone est donc posée dans la page
 * (position absolue), et la page elle-même prend la hauteur de l'écran.
 * Seulement sur l'iPhone (navigator.standalone n'existe que là) : sur Android (03/11/2026, « ça ne va pas du tout »), la
 * barre de l'heure et la barre de navigation prennent leur place hors de la page ; la hauteur de tout l'écran faisait
 * passer le bas du dessin sous la barre de navigation. Android donne la bonne hauteur : celle de la fenêtre.
 */
function calerSurEcran(zone) {
  const caler = () => {
    const seule = navigator.standalone === true;
    const debout = innerHeight >= innerWidth;
    const [petit, grand] = [Math.min(screen.width, screen.height), Math.max(screen.width, screen.height)];
    const ecran = debout ? { l: petit, h: grand } : { l: grand, h: petit };
    // Seulement quand l'app prend toute la largeur de l'écran (pas une fenêtre réduite sur tablette).
    const toutEcran = seule && Math.abs(innerWidth - ecran.l) <= 2;
    const hauteur = (toutEcran ? Math.max(innerHeight, ecran.h) : innerHeight) + 'px';
    for (const e of [document.documentElement, document.body]) e.style.height = hauteur;
    zone.style.position = 'absolute';
    zone.style.bottom = 'auto';
    zone.style.height = hauteur;
    scrollTo(0, 0);
  };
  caler();
  addEventListener('resize', caler);
  addEventListener('orientationchange', () => setTimeout(caler, 300));
}

/**
 * Petite fenêtre « Oui / Annuler » de l'app, à la place de la confirmation du navigateur (confirm) : celle-ci ne
 * s'affiche pas partout (refusée sans rien montrer dans certains navigateurs) et ne ressemble pas à l'app.
 */
export function demanderConfirmation(texte, oui = 'Oui') {
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
export async function demarrerEcrans(app) {
  // Écrans en clair (version d'essai locale : designs/sources.json) ou chiffrés (site publié : designs/coffre.json, puis
  // chaque fichier « .bin » ouvert avec la clé des écrans ; images et polices deviennent des adresses locales « blob: »).
  let sources;
  let lireDesign;
  const designs = new Map();
  const enClair = await fetch('designs/sources.json', { cache: 'no-cache' }).catch(() => null);
  if (enClair?.ok) {
    sources = await enClair.json();
    lireDesign = (page) => {
      if (!designs.has(page)) designs.set(page, fetch('designs/' + page + '.design.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('écran introuvable : ' + page); return r.json(); }));
      return designs.get(page);
    };
  } else {
    const r = await fetch('designs/coffre.json', { cache: 'no-cache' }).catch(() => null);
    if (!r?.ok) return null;
    const coffre = await r.json();
    const cle = await app.cleEcrans(coffre);
    const ouvrir = async (chemin) => {
      const f = await fetch(chemin, { cache: 'no-cache' });
      if (!f.ok) throw new Error('fichier d’écran introuvable : ' + chemin);
      return dechiffrerOctets(cle, await f.arrayBuffer());
    };
    const table = JSON.parse(new TextDecoder().decode(await ouvrir('designs/sources.bin')));
    const enAdresse = async (chemin, type) => URL.createObjectURL(new Blob([await ouvrir(chemin)], { type }));
    const images = Object.fromEntries(await Promise.all(Object.entries(table.images).map(async ([k, c]) => [k, await enAdresse(c, 'image/png')])));
    const polices = Object.fromEntries(await Promise.all(Object.entries(table.polices).map(async ([f, cs]) => [f, await Promise.all(cs.map((c) => enAdresse(c, 'font/ttf')))])));
    sources = { images, polices };
    lireDesign = (page) => {
      if (!designs.has(page)) designs.set(page, ouvrir('designs/' + page + '.bin').then((o) => JSON.parse(new TextDecoder().decode(o))));
      return designs.get(page);
    };
  }
  const lecteur = await app.lecteur();
  // Les autres écrans se chargent pendant qu'on regarde l'accueil (changement de page sans attente).
  const prechargement = () => PAGES.forEach((p) => lireDesign(p).catch(() => {}));

  const zone = $('ecrans');
  document.querySelector('header.entete').style.display = 'none'; // « hidden » ne suffit pas : l'en-tête est en display: flex
  $('app').hidden = true;
  zone.hidden = false;
  document.body.classList.add('avec-ecrans');
  calerSurEcran(zone);

  let page = 'accueil';
  let ui = uiDepart(dateLocale(Date.now()));
  let saisies = {};
  let dernier = null;
  let erreurs = {};
  let vue = null;
  let occupe = false;
  // Hauteur du clavier du téléphone quand il est ouvert (pixels), 0 sinon.
  let clavier = 0;
  // Nombre de demandes « vider les cases » envoyées au lecteur.
  let vidages = 0;

  const contexte = (valeurs = {}) => ({
    aujourdhui: dateLocale(Date.now()), maintenant: Date.now(), saisies, dernier, valeurs,
    synchro: app.texteSynchro(), rappel: app.rappel() ?? '', dateDe: dateLocale, version: VERSION,
    derniereSauvegarde: app.derniereSauvegarde(), restaurationAnnulable: app.restaurationAnnulable(), pontRegle: app.pontRegle(),
  });
  const valeurs = () => {
    const v = valeursEcran(page, app.etat(), ui, contexte());
    return { linkVariables: v.linkVariables, gaugeValues: v.gaugeValues, chartData: v.chartData, inputStates: erreurs, buttonStates: v.buttonStates, appPicks: v.appPicks, keyboardInset: clavier };
  };
  const rafraichir = () => vue?.mettreAJour(valeurs());

  // Menu latéral au glissé, comme les applications connues (demande du propriétaire, 03/11/2026) : un glissé vers la
  // droite l'ouvre, vers la gauche le range. Le glissé doit être net (au moins 70 px, deux fois plus horizontal que
  // vertical, en moins de 0,7 s) : un défilement de haut en bas ne l'ouvre jamais. L'écran reçoit un événement
  // (« ouvrir-menu », « fermer-menu ») auquel répond le logo de l'en-tête.
  let evenements = 0;
  let glisse = null;
  zone.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    glisse = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true, capture: true });
  // Reconnu pendant que le doigt bouge, sans attendre qu'il se lève : l'iPhone interrompt souvent un geste parti près
  // du bord de l'écran (fin du toucher jamais reçue ; le glissé ne marchait pas sur l'iPhone du propriétaire).
  zone.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const g = glisse;
    if (!g || g.envoye || !t || !vue || e.touches.length !== 1) return;
    if (Date.now() - g.at > 700) { glisse = null; return; }
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    g.envoye = true;
    vue.mettreAJour({ linkEvent: { name: dx > 0 ? 'ouvrir-menu' : 'fermer-menu', times: ++evenements } });
  }, { passive: true, capture: true });
  const finGlisse = () => { glisse = null; };
  zone.addEventListener('touchend', finGlisse, { passive: true, capture: true });
  zone.addEventListener('touchcancel', finGlisse, { passive: true, capture: true });

  // Clavier ouvert (03/11/2026, « pouvoir encore monter et descendre quand je saisis, même sur un écran sans
  // défilement ») : l'écran peut défiler de la hauteur du clavier, comme dans les applications du téléphone. La fenêtre
  // visible rétrécit quand le clavier s'ouvre ; moins de 80 px d'écart : pas de clavier (barre du navigateur).
  // L'iPhone, lui, fait remonter toute la page pour montrer la case (et on ne pouvait plus la bouger) : ce décalage
  // (visualViewport.offsetTop) est compensé, la page reste à sa place et c'est le lecteur qui remonte la case au-dessus
  // du clavier et laisse défiler l'écran.
  if (window.visualViewport) {
    // iPhone (03/11/2026, « seule la moitié de l'écran défile avec le clavier ») : l'iPhone fait remonter la page de deux
    // façons (la partie visible glisse, et parfois la page elle-même défile) : les deux sont compensées (pageTop). Et
    // la hauteur cachée par le clavier se mesure sur la zone des écrans elle-même (sur l'iPhone, elle est plus haute que
    // la fenêtre annoncée). Sur Android rien ne change : la page ne bouge pas et la zone a la hauteur de la fenêtre.
    const mesurer = () => {
      const decale = Math.round(visualViewport.pageTop ?? visualViewport.offsetTop + scrollY);
      zone.style.transform = decale > 0 ? `translateY(${decale}px)` : '';
      const ecart = Math.round(zone.getBoundingClientRect().height - visualViewport.height);
      const h = ecart >= 80 ? ecart : 0;
      if (h === clavier) return;
      clavier = h;
      vue?.mettreAJour({ keyboardInset: clavier });
    };
    visualViewport.addEventListener('resize', mesurer);
    visualViewport.addEventListener('scroll', mesurer);
    addEventListener('scroll', mesurer);
  }

  // Changement de page : le même lecteur reçoit le nouveau dessin (plus rapide que de tout refaire). « remonter » refait
  // le lecteur : c'est le seul moyen de vider les cases et de refermer les fenêtres de l'écran.
  async function montrer(nouvelle, { remonter = false } = {}) {
    const design = await lireDesign(nouvelle);
    page = nouvelle;
    saisies = {};
    dernier = null;
    erreurs = {};
    ui = { ...ui, objectifs: { ...ui.objectifs, fenetre: null } }; // aucune fenêtre ouverte sur un écran qui s'ouvre
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
        await montrer(r.aller);
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

  await montrer('accueil');
  prechargement();
  return { rafraichir };
}
