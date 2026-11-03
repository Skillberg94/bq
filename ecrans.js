// Les 10 écrans Tool Design dans l'app (03/11/2026) : affichés par le lecteur, plein écran, à la place de la page
// provisoire. Les valeurs et les boutons passent par le noyau (noyau/ecrans.js) ; ce fichier ne fait que les relier :
//   - montrer l'écran demandé (accueil au départ, puis les pages du menu : « Aller à un autre écran du template ») ;
//   - lui envoyer ses valeurs à chaque changement ;
//   - recevoir les boutons, les lignes touchées et le texte des cases, et faire ce qui demande le navigateur
//     (synchro, fichiers, mot de passe).
// Les écrans ne sont présents que dans la version d'essai locale (site-essai/, node construire-site.mjs --essai) : sans
// eux, demarrerEcrans rend null et la page provisoire reste affichée.
import { valeursEcran, agir, uiDepart, casesDeLaLigne, PAGES } from './noyau/ecrans.js?v=984083fc16fc';
import { dateLocale } from './noyau/dates.js?v=984083fc16fc';
import { dechiffrerOctets } from './noyau/ecrans-chiffres.js?v=984083fc16fc';

const $ = (id) => document.getElementById(id);
const VERSION = 'essai local · 3 nov. 2026';
// Envois des lignes touchées : l'app retient la ligne et le texte de départ des cases de la fenêtre qui s'ouvre.
const LIGNES_TOUCHEES = ['operation-touchee', 'categorie-touchee', 'emetteur-touche', 'frais-touche', 'objectif-touche'];
// Journal des boutons reçus dans la console, sur l'ordinateur seulement (essais).
const JOURNAL = ['localhost', '127.0.0.1'].includes(location.hostname);

let minuterie = null;
export function direMessage(texte, erreur = false) {
  const e = $('ecrans-message');
  if (!e || !texte) return;
  e.textContent = texte;
  e.className = erreur ? 'erreur' : '';
  e.hidden = false;
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { e.hidden = true; }, erreur ? 4500 : 2800);
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
 */
function calerSurEcran(zone) {
  const caler = () => {
    const seule = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
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
    $('ecrans-confirmation-texte').textContent = texte;
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
      if (r.message && !(page === 'accueil' && action === 'ajouter-depense')) direMessage(r.message, r.erreur);
      if (r.aller && PAGES.includes(r.aller)) {
        await montrer(r.aller);
      } else if (r.vider && !r.erreur) {
        // Le lecteur ne sait pas vider une case depuis l'app : l'écran est remonté (cases vides, fenêtres fermées).
        await montrer(page, { remonter: true });
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
