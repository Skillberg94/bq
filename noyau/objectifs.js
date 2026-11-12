// Objectifs d'épargne (page « Objectifs », choix du propriétaire du 03/11/2026) :
//   - plusieurs objectifs (nom, icône, montant visé, date souhaitée en texte libre) ;
//   - chacun reçoit une PART DU RESTE de chaque mois (en %), la somme des parts ne dépasse pas 100 % ;
//   - reste d'un mois = entrées d'argent − dépenses du mois (frais récurrents compris, hors retraits au distributeur) :
//     « autant mettre ce qu'il reste chaque mois direct, c'est plus simple » ;
//   - « à ce rythme : atteint dans N mois (mois d'arrivée) » à la place de « il faut X € / mois ».
// L'épargne d'un objectif = somme, sur chaque mois TERMINÉ depuis sa création, de sa part du reste (un mois négatif ne
// retire rien). Rien n'est déplacé sur un compte : c'est une répartition pour se projeter.
// Changer la part ne vaut qu'à partir du mois en cours : les mois passés gardent la part qu'ils avaient (historique).
// État : objectifs: [{ id, nom, icone, cibleCentimes, date, part (0-100, actuelle), cree: 'AAAA-MM',
//                     parts?: [{ depuis: 'AAAA-MM', part }] }]

import { lister } from './donnees.js?v=1e063d13622f';
import { ajouterMois, moisDe } from './dates.js?v=1e063d13622f';

const estDepense = (l) => !l.supprime && l.sens === 'sortie' && !l.retrait;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const objectifsDe = (etat) => etat.objectifs ?? [];

function verifier(etat, o, sansId = null) {
  if (!o.nom || !o.nom.trim()) throw new Error('Donne un nom à l\'objectif.');
  if (!Number.isInteger(o.cibleCentimes) || o.cibleCentimes <= 0) throw new Error('Le montant visé doit être un montant positif.');
  if (typeof o.part !== 'number' || o.part < 0 || o.part > 100) throw new Error('La part doit être entre 0 et 100 %.');
  const autres = objectifsDe(etat).filter((x) => x.id !== sansId).reduce((s, x) => s + x.part, 0);
  if (autres + o.part > 100) throw new Error('Les parts des objectifs dépasseraient 100 % (il reste ' + Math.max(0, 100 - autres) + ' %).');
}

export function ajouterObjectif(etat, { nom, icone = 'diamant', cibleCentimes, date = '', part = 0 }, aujourdhui) {
  const cree = moisDe(aujourdhui);
  const o = { id: 'o' + (objectifsDe(etat).length + 1) + '-' + Date.now().toString(36), nom: nom?.trim(), icone, cibleCentimes, date: String(date).trim(), part, cree, parts: [{ depuis: cree, part }] };
  verifier(etat, o);
  return { etat: { ...etat, objectifs: objectifsDe(etat).concat([o]) }, id: o.id };
}

export function modifierObjectif(etat, id, champs, aujourdhui) {
  const o = objectifsDe(etat).find((x) => x.id === id);
  if (!o) throw new Error('objectif introuvable : ' + id);
  const suivant = { ...o, ...champs, ...(champs.nom !== undefined && { nom: champs.nom.trim() }) };
  if (champs.part !== undefined && champs.part !== o.part) {
    // La nouvelle part vaut à partir de ce mois-ci (remplace un changement déjà fait ce mois-ci).
    const depuis = moisDe(aujourdhui);
    suivant.parts = partsDe(o).filter((x) => x.depuis < depuis).concat([{ depuis, part: champs.part }]);
  }
  verifier(etat, suivant, id);
  return { ...etat, objectifs: objectifsDe(etat).map((x) => (x.id === id ? suivant : x)) };
}

export function supprimerObjectif(etat, id) {
  if (!objectifsDe(etat).some((x) => x.id === id)) throw new Error('objectif introuvable : ' + id);
  return { ...etat, objectifs: objectifsDe(etat).filter((x) => x.id !== id) };
}

/** Entrées, dépenses (frais récurrents compris) et reste d'un mois 'AAAA-MM'. */
export function bilanDuMois(etat, mois, lignes = lister(etat)) {
  const du = lignes.filter((l) => !l.supprime && moisDe(l.date) === mois);
  const entrees = du.filter((l) => l.sens === 'entree').reduce((s, l) => s + l.centimes, 0);
  const depenses = du.filter(estDepense).reduce((s, l) => s + l.centimes, 0);
  return { mois, entrees, depenses, reste: entrees - depenses };
}

/** Mois terminés depuis 'AAAA-MM' (compris) jusqu'au mois d'avant aujourd'hui. */
function moisTermines(depuis, aujourdhui) {
  const liste = [];
  for (let m = depuis; m < moisDe(aujourdhui) && liste.length < 600; m = moisDe(ajouterMois(m + '-01', 1, 1))) liste.push(m);
  return liste;
}

const partsDe = (o) => o.parts ?? [{ depuis: o.cree, part: o.part }];
/** Part (en %) qu'avait l'objectif pour un mois 'AAAA-MM'. */
export function partDuMois(o, mois) {
  return partsDe(o).filter((x) => x.depuis <= mois).at(-1)?.part ?? 0;
}

/** Épargne mise de côté pour un objectif (centimes). */
export function epargneObjectif(etat, o, aujourdhui, lignes = lister(etat)) {
  let total = 0;
  for (const m of moisTermines(o.cree, aujourdhui)) total += Math.round((Math.max(0, bilanDuMois(etat, m, lignes).reste) * partDuMois(o, m)) / 100);
  return total;
}

/** « 6 mois (mai 2027) » : mois pour atteindre la cible à ce rythme (part en centimes par mois), ou un texte d'état. */
export function dureeObjectif(restant, partParMois, aujourdhui) {
  if (restant <= 0) return 'atteint';
  if (!partParMois || partParMois <= 0) return 'pas de part ce mois-ci';
  const n = Math.ceil(restant / partParMois);
  const arrivee = ajouterMois(aujourdhui.slice(0, 8) + '01', n, 1);
  return enAnneesEtMois(n) + ' (' + MOIS[Number(arrivee.slice(5, 7)) - 1] + ' ' + arrivee.slice(0, 4) + ')';
}

/** « 5 mois », « 1 an », « 2 ans et 3 mois » (demande du propriétaire : au-delà d'un an, en années et en mois). */
export function enAnneesEtMois(n) {
  if (n < 12) return n + ' mois';
  const a = Math.floor(n / 12), m = n % 12;
  return a + (a > 1 ? ' ans' : ' an') + (m ? ' et ' + m + ' mois' : '');
}

/** Économie totale (somme des restes positifs et négatifs) depuis un mois 'AAAA-MM' jusqu'au mois d'avant aujourd'hui. */
export function economieDepuis(etat, depuis, aujourdhui, lignes = lister(etat)) {
  return moisTermines(depuis, aujourdhui).reduce((s, m) => s + bilanDuMois(etat, m, lignes).reste, 0);
}
