// Petits réglages des pages Soldes, Sauvegarde et Réglages (03/11/2026).
//   - Corrections de solde : corriger = nouveau solde de référence à cet instant ; l'écart est gardé (historique).
//   - Libellés ignorés (virements entre mes comptes…) : liste modifiable ; un mail dont le libellé contient un de ces
//     textes est ignoré à la synchro, et les opérations de mail déjà là qui le contiennent ne sont plus comptées.
//     Les deux de départ sont aussi écrits dans l'extraction des mails (test-gmail).
//   - Rappel de sauvegarde : tous les 3, 7, 14 ou 30 jours, ou jamais.
// État : corrections: [{ id, compte, ts, ancien (centimes ou null), nouveau }], libellesIgnores: [{ id, texte }],
//        reglages: { rappelJours?: number | null }

import { definirReference, soldes } from './donnees.js?v=1e063d13622f';
import { normaliserLibelle } from './libelles.js?v=1e063d13622f';
import { ajouterMois, joursDuMois, moisDe } from './dates.js?v=1e063d13622f';
import { effective } from './soldes.js?v=1e063d13622f';
import { RAPPEL_JOURS } from './sauvegarde.js?v=1e063d13622f';

export const IGNORES_DEPART = [{ id: 'i-cpt-depot', texte: 'VIR VERS CPT DEPOT PART' }, { id: 'i-livret-a', texte: 'VIR VERS LIVRET A' }];
export const RAPPELS = [3, 7, 14, 30, null];

export const correctionsDe = (etat) => etat.corrections ?? [];
export const libellesIgnores = (etat) => etat.libellesIgnores ?? IGNORES_DEPART;
export const rappelJours = (etat) => (etat.reglages && 'rappelJours' in etat.reglages ? etat.reglages.rappelJours : RAPPEL_JOURS);

export function corrigerSolde(etat, compte, centimes, ts) {
  const ancien = soldes(etat)[compte];
  const suivant = definirReference(etat, compte, centimes, ts);
  return { ...suivant, corrections: correctionsDe(etat).concat([{ id: 'k' + ts.toString(36), compte, ts, ancien, nouveau: centimes }]) };
}

export function ajouterIgnore(etat, texte) {
  const t = String(texte ?? '').trim();
  if (!t) throw new Error('Écris le texte à ignorer.');
  const liste = libellesIgnores(etat);
  if (liste.some((x) => normaliserLibelle(x.texte) === normaliserLibelle(t))) throw new Error('Ce libellé est déjà ignoré.');
  const id = 'i' + Date.now().toString(36);
  // Les opérations de mail déjà là qui le contiennent ne sont plus comptées (masquées comme une ligne supprimée, en
  // retenant par quel libellé : le retirer de la liste les fait revenir).
  const ajouts = { ...etat.ajouts };
  for (const brute of etat.operations) {
    const a = ajouts[brute.id] ?? {};
    if ((brute.source !== 'mail' && brute.source !== 'notification') || a.supprime || !contient(effective(etat, brute).libelle, t)) continue;
    ajouts[brute.id] = { ...a, supprime: true, ignorePar: id };
  }
  return { ...etat, ajouts, libellesIgnores: liste.concat([{ id, texte: t }]) };
}

export function supprimerIgnore(etat, id) {
  const ajouts = Object.fromEntries(Object.entries(etat.ajouts).map(([k, a]) => {
    if (a.ignorePar !== id) return [k, a];
    const { supprime, ignorePar, ...reste } = a;
    return [k, reste];
  }));
  return { ...etat, ajouts, libellesIgnores: libellesIgnores(etat).filter((x) => x.id !== id) };
}

/** Vrai si le libellé contient un des textes ignorés (sans tenir compte des majuscules, points et espaces en trop). */
const sansPoints = (t) => normaliserLibelle(String(t).replace(/\./g, ' '));
const contient = (libelle, texte) => sansPoints(libelle ?? '').includes(sansPoints(texte));
export function estIgnore(etat, libelle) {
  return libellesIgnores(etat).some((x) => contient(libelle, x.texte));
}

// Revenus attendus (demande du propriétaire, 03/11/2026 : d'abord un seul « revenu attendu par mois », puis « pouvoir en
// ajouter plusieurs si on a plusieurs travails, les modifier, les supprimer » ; certains revenus sont payés « une somme par
// jour », sur « le nombre de jours du mois précédent »). Ils servent à estimer l'économie du mois tant qu'ils ne sont pas arrivés.
// Chaque revenu : { id, nom, centimes, unite: 'mois' | 'jour', reperage: 'montant' | 'libelle' | 'les-deux', libelle }.
// Repérage (choisi à la saisie, demande du propriétaire) : il est arrivé dès qu'une entrée du mois a le bon montant (à
// TOLERANCE_REVENU près), contient le mot du virement, ou les deux à la fois.
export const UNITES_REVENU = ['mois', 'jour'];
export const REPERAGES_REVENU = ['montant', 'libelle', 'les-deux'];
export const TOLERANCE_REVENU = 0.1;

/** Les revenus ; un ancien « revenu attendu » unique (avant le 03/11/2026) devient le premier, repéré au montant. */
export function revenus(etat) {
  if (etat.reglages?.revenus) return etat.reglages.revenus;
  const ancien = etat.reglages?.revenuAttendu;
  return ancien ? [{ id: 'rev1', nom: 'Revenu', centimes: ancien, unite: 'mois', reperage: 'montant', libelle: '' }] : [];
}
function verifierRevenu({ nom, centimes, unite, reperage, libelle }) {
  const r = { nom: String(nom ?? '').trim(), centimes, unite: unite ?? 'mois', reperage: reperage ?? 'montant', libelle: String(libelle ?? '').trim() };
  if (!r.nom) throw new Error('Donne un nom au revenu (exemple : Salaire, Prime).');
  if (!Number.isInteger(r.centimes) || r.centimes <= 0) throw new Error('Tape le montant du revenu (exemple : 1 850 ou 38,50).');
  if (!UNITES_REVENU.includes(r.unite)) throw new Error('unité de revenu invalide');
  if (!REPERAGES_REVENU.includes(r.reperage)) throw new Error('repérage de revenu invalide');
  if (r.reperage !== 'montant' && !r.libelle) throw new Error('Tape le mot du virement (exemple : SALAIRE), ou choisis « Montant ».');
  return r;
}
const avecRevenus = (etat, liste) => {
  const { revenuAttendu: _ancien, ...reste } = etat.reglages ?? {};
  return { ...etat, reglages: { ...reste, revenus: liste } };
};
export function ajouterRevenu(etat, champs) {
  const liste = revenus(etat);
  let n = liste.length + 1;
  while (liste.some((r) => r.id === 'rev' + n)) n += 1;
  const r = { id: 'rev' + n, ...verifierRevenu(champs) };
  return { etat: avecRevenus(etat, liste.concat([r])), id: r.id };
}
export function modifierRevenu(etat, id, champs) {
  const liste = revenus(etat);
  const avant = liste.find((r) => r.id === id);
  if (!avant) throw new Error('Revenu introuvable.');
  return avecRevenus(etat, liste.map((r) => (r.id === id ? { id, ...verifierRevenu({ ...avant, ...champs }) } : r)));
}
export function supprimerRevenu(etat, id) {
  if (!revenus(etat).some((r) => r.id === id)) throw new Error('Revenu introuvable.');
  return avecRevenus(etat, revenus(etat).filter((r) => r.id !== id));
}
/** Montant attendu pour le mois 'AAAA-MM' : par jour, × le nombre de jours du mois précédent. */
export function montantAttendu(r, mois) {
  if (r.unite !== 'jour') return r.centimes;
  const avant = ajouterMois(mois + '-01', -1, 1);
  return r.centimes * joursDuMois(Number(avant.slice(0, 4)), Number(avant.slice(5, 7)));
}
const bonMontant = (centimes, attendu) => Math.abs(centimes - attendu) <= attendu * TOLERANCE_REVENU;
/**
 * Revenus du mois et leur arrivée (une entrée ne sert qu'à un seul revenu).
 * - Repéré au montant : la première entrée du mois au bon montant ; il est arrivé en entier ou pas du tout.
 * - Repéré aux deux : une entrée au bon montant ET au bon libellé (choix du 03/11/2026).
 * - Repéré au libellé : les entrées du mois qui portent le libellé s'additionnent (12/11/2026 : un revenu peut
 *   arriver en plusieurs fois) ; il est arrivé quand une entrée a le bon montant ou que le total l'atteint, sinon il reste
 *   le reste à recevoir.
 * Rend [{ revenu, attendu, recu: première ligne | null, recus: [lignes], recuCentimes, reste }].
 */
export function revenusDuMois(etat, mois, entrees) {
  const prises = new Set();
  return revenus(etat).map((r) => {
    const attendu = montantAttendu(r, mois);
    const libres = entrees.filter((l) => !prises.has(l.id) && moisDe(l.date) === mois);
    let recus;
    if (r.reperage === 'libelle') {
      recus = libres.filter((x) => contient(x.libelle, r.libelle));
    } else {
      // Au montant, ou aux deux (choix du 03/11/2026 : libellé ET bon montant) : une seule entrée, au bon montant.
      const l = libres.find((x) => bonMontant(x.centimes, attendu) && (r.reperage === 'montant' || contient(x.libelle, r.libelle)));
      recus = l ? [l] : [];
    }
    recus.forEach((l) => prises.add(l.id));
    const recuCentimes = recus.reduce((s, l) => s + l.centimes, 0);
    const complet = recus.some((l) => bonMontant(l.centimes, attendu)) || recuCentimes >= attendu - attendu * TOLERANCE_REVENU;
    const reste = recus.length === 0 ? attendu : complet ? 0 : attendu - recuCentimes;
    return { revenu: r, attendu, recu: recus[0] ?? null, recus, recuCentimes, reste };
  });
}
/**
 * Entrées retenues pour le mois : les vraies entrées, plus le montant attendu de chaque revenu pas encore arrivé.
 * Rend { centimes, prevu } (prevu : au moins un revenu compté sans être arrivé).
 */
export function entreesRetenues(etat, reelles, mois, entrees) {
  const manquants = revenusDuMois(etat, mois, entrees).filter((x) => x.reste > 0);
  return { centimes: reelles + manquants.reduce((s, x) => s + x.reste, 0), prevu: manquants.length > 0 };
}

export function definirRappel(etat, jours) {
  if (!RAPPELS.includes(jours)) throw new Error('rappel invalide');
  return { ...etat, reglages: { ...(etat.reglages ?? {}), rappelJours: jours } };
}
