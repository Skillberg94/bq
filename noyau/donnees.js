// Données de l'app : opérations, ajouts du propriétaire, soldes de référence, sauvegarde.
// Toutes les fonctions rendent un NOUVEL état (rien n'est modifié sur place).
//
// État : {
//   version: 1,
//   reference: { banque?: {centimes, ts}, especes?: {centimes, ts} },
//   operations: [{ id, source: 'mail'|'manuel', compte: 'banque'|'especes', sens: 'sortie'|'entree',
//                  libelle, date: 'AAAA-MM-JJ', centimes (>0), ts (ms) }],
//   ajouts: { [id]: { emetteurReel?, description?, categorie?, retrait?, supprime?, corrige?: {libelle?, date?, centimes?, sens?, compte?} } }
//     // à côté de l'opération d'origine (jamais modifiée pour une ligne de mail)
// }
// ts = moment où l'opération touche le solde : date d'arrivée du mail (internalDate de Gmail) ou moment de la saisie.

import { compteDansSolde, effective, estRetrait, retraitCompte, soldes } from './soldes.js?v=060df081ded8';
import { categoriesParDefaut, categorieDe } from './categories.js?v=060df081ded8';
import { recurrentDe } from './recurrents.js?v=060df081ded8';

export { soldes };

export const CLE_STOCKAGE = 'banque-donnees-v1';
const CHAMPS_AJOUTS = ['emetteurReel', 'description', 'categorie'];
const CHAMPS_MANUEL = ['libelle', 'date', 'centimes', 'sens', 'compte'];

// Règle de départ, d'après les vrais libellés de la banque (« RETRAIT D'ESPECES CB CASH SERVICES », « … LA BANQUE POSTA »,
// « … AEROPORT DE PAR », 02/11/2026). Le propriétaire peut la supprimer ou en ajouter d'autres.
export const REGLES_DEPART = [{ id: 'g-retrait-especes', champ: 'libelle', contient: "RETRAIT D'ESPECES", action: 'retrait' }];

export function vide() {
  return {
    version: 1, reference: {}, operations: [], ajouts: {},
    categories: categoriesParDefaut(), emetteurs: {}, recurrents: [], seuils: { moisCentimes: null },
    regles: REGLES_DEPART.map((r) => ({ ...r })),
    synchro: { dernierTs: 0, ignores: [], derniere: null },
  };
}

function verifierOperation(op) {
  if (!['banque', 'especes'].includes(op.compte)) throw new Error('compte inconnu : ' + op.compte);
  if (!['sortie', 'entree'].includes(op.sens)) throw new Error('sens inconnu : ' + op.sens);
  if (!Number.isInteger(op.centimes) || op.centimes <= 0) throw new Error('montant invalide (centimes entiers, positifs)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date)) throw new Error('date invalide (AAAA-MM-JJ)');
}

function trouver(etat, id) {
  const op = etat.operations.find((o) => o.id === id);
  if (!op) throw new Error('opération introuvable : ' + id);
  return op;
}

/** Solde de référence d'un compte, à un instant donné (le propriétaire peut recaler à tout moment). */
export function definirReference(etat, compte, centimes, ts) {
  if (!['banque', 'especes'].includes(compte)) throw new Error('compte inconnu : ' + compte);
  if (!Number.isInteger(centimes)) throw new Error('montant invalide (centimes entiers)');
  return { ...etat, reference: { ...etat.reference, [compte]: { centimes, ts } } };
}

/** Ajoute les opérations de mail pas encore connues (anti-doublon par identifiant, y compris les lignes supprimées). */
export function fusionnerMails(etat, nouvelles) {
  const connus = new Set(etat.operations.map((o) => o.id));
  const ajoutees = [];
  for (const m of nouvelles) {
    if (connus.has(m.id)) continue;
    const op = { id: m.id, source: 'mail', compte: 'banque', sens: m.sens, libelle: m.libelle, date: m.date, centimes: m.centimes, ts: m.ts, ...(m.objet && { objet: m.objet }) };
    verifierOperation(op);
    connus.add(m.id);
    ajoutees.push(op);
  }
  return { etat: { ...etat, operations: etat.operations.concat(ajoutees) }, ajoutees };
}

/** Saisie à la main : dépense en espèces, ou dépense banque (case cochée) si la liaison mail a un problème. */
export function ajouterManuel(etat, { compte, sens = 'sortie', libelle, date, centimes, ts }) {
  const op = { id: 'm-' + ts + '-' + etat.operations.length, source: 'manuel', compte, sens, libelle, date, centimes, ts };
  verifierOperation(op);
  return { etat: { ...etat, operations: etat.operations.concat([op]) }, id: op.id };
}

/**
 * Modifie une ligne : tous les champs sont modifiables (propriétaire, 02/11/2026).
 * Ligne manuelle : la ligne elle-même est changée. Ligne de mail : l'original est gardé tel quel et la
 * correction est rangée à côté (ajouts[id].corrige), ce qui permet de la rétablir.
 */
export function modifier(etat, id, champs) {
  const op = trouver(etat, id);
  const ajouts = { ...(etat.ajouts[id] ?? {}) };
  let nouvelleOp = op;
  const corrige = { ...(ajouts.corrige ?? {}) };
  for (const [cle, valeur] of Object.entries(champs)) {
    if (CHAMPS_AJOUTS.includes(cle)) ajouts[cle] = valeur;
    else if (CHAMPS_MANUEL.includes(cle)) {
      if (op.source === 'manuel') nouvelleOp = { ...nouvelleOp, [cle]: valeur };
      else corrige[cle] = valeur;
    } else throw new Error('champ inconnu : ' + cle);
  }
  if (Object.keys(corrige).length) ajouts.corrige = corrige;
  verifierOperation({ ...nouvelleOp, ...corrige });
  return {
    ...etat,
    operations: etat.operations.map((o) => (o.id === id ? nouvelleOp : o)),
    ajouts: { ...etat.ajouts, [id]: ajouts },
  };
}

/** Annule toutes les corrections de libellé, date, montant, sens, compte d'une ligne de mail (retour à l'original). */
export function retablir(etat, id) {
  trouver(etat, id);
  const { corrige, ...reste } = etat.ajouts[id] ?? {};
  return { ...etat, ajouts: { ...etat.ajouts, [id]: reste } };
}

/** Supprime une ligne (masquée : une nouvelle synchro ne la réimporte pas). */
export function supprimer(etat, id) {
  trouver(etat, id);
  return { ...etat, ajouts: { ...etat.ajouts, [id]: { ...(etat.ajouts[id] ?? {}), supprime: true } } };
}

/**
 * Marque une dépense banque comme retrait au distributeur (l'argent passe de la banque aux espèces), ou comme
 * « pas un retrait » (false : une règle automatique ne la reprendra pas). null = revenir à la décision des règles.
 */
export function marquerRetrait(etat, id, oui = true) {
  const op = effective(etat, trouver(etat, id));
  if (op.compte !== 'banque' || op.sens !== 'sortie') throw new Error('seule une dépense de la banque peut être un retrait');
  const { retrait, ...reste } = etat.ajouts[id] ?? {};
  return { ...etat, ajouts: { ...etat.ajouts, [id]: oui === null ? reste : { ...reste, retrait: !!oui } } };
}

/**
 * Nom affiché d'une ligne (03/11/2026) : la description du propriétaire si elle existe, sinon le vrai émetteur saisi,
 * sinon le libellé de la banque (jamais perdu : il reste visible dans le détail).
 */
export const nomAffiche = (l) => l.description || l.emetteurReel || l.libelle;

/** Liste pour l'écran : la plus récente d'abord ; chaque ligne dit si elle compte dans le solde. */
export function lister(etat, { avecSupprimees = false } = {}) {
  return etat.operations
    .map((brute) => {
      const op = effective(etat, brute);
      const { corrige, ...a } = etat.ajouts[op.id] ?? {};
      const categorie = categorieDe(etat, brute);
      return {
        ...op, ...a, supprime: !!a.supprime, retrait: estRetrait(etat, brute), corrigee: !!corrige,
        // Un retrait n'est pas une dépense : pas besoin de catégorie.
        categorie, aClasser: op.sens === 'sortie' && !categorie && !estRetrait(etat, brute), recurrentId: recurrentDe(etat, brute),
        comptee: compteDansSolde(etat, brute), alimenteEspeces: retraitCompte(etat, brute),
      };
    })
    .filter((l) => avecSupprimees || !l.supprime)
    .sort((a, b) => (a.date === b.date ? b.ts - a.ts : a.date < b.date ? 1 : -1));
}

/** Sauvegarde en fichier (export) et lecture (import). */
export function exporter(etat) {
  return JSON.stringify(etat, null, 2);
}

export function importer(texte) {
  let e;
  try {
    e = JSON.parse(texte);
  } catch {
    throw new Error('fichier illisible');
  }
  if (!e || e.version !== 1 || !Array.isArray(e.operations) || typeof e.reference !== 'object' || typeof e.ajouts !== 'object') {
    throw new Error('ce fichier n\'est pas une sauvegarde de cette app');
  }
  e.operations.forEach(verifierOperation);
  // Une sauvegarde plus ancienne (sans catégories, seuils, etc.) reçoit les valeurs de départ.
  const depart = vide();
  return { ...depart, ...e, seuils: { ...depart.seuils, ...(e.seuils ?? {}) } };
}

/** Stockage du téléphone (localStorage). Le « stockage » est passé en paramètre : testable sans navigateur. */
export function sauver(stockage, etat) {
  stockage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
}

export function charger(stockage) {
  const texte = stockage.getItem(CLE_STOCKAGE);
  if (texte == null) return { etat: vide(), corrompu: false };
  try {
    return { etat: importer(texte), corrompu: false };
  } catch {
    // On ne remplace rien : l'appelant décide (proposer l'import d'une sauvegarde).
    return { etat: vide(), corrompu: true };
  }
}
