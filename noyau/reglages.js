// Petits réglages des pages Soldes, Sauvegarde et Réglages (03/11/2026).
//   - Corrections de solde : corriger = nouveau solde de référence à cet instant ; l'écart est gardé (historique).
//   - Libellés ignorés (virements entre mes comptes…) : liste modifiable ; un mail dont le libellé contient un de ces
//     textes est ignoré à la synchro, et les opérations de mail déjà là qui le contiennent ne sont plus comptées.
//     Les deux de départ sont aussi écrits dans l'extraction des mails (test-gmail).
//   - Rappel de sauvegarde : tous les 3, 7, 14 ou 30 jours, ou jamais.
// État : corrections: [{ id, compte, ts, ancien (centimes ou null), nouveau }], libellesIgnores: [{ id, texte }],
//        reglages: { rappelJours?: number | null }

import { definirReference, soldes } from './donnees.js?v=1197e14a1b2e';
import { normaliserLibelle } from './libelles.js?v=1197e14a1b2e';
import { effective } from './soldes.js?v=1197e14a1b2e';
import { RAPPEL_JOURS } from './sauvegarde.js?v=1197e14a1b2e';

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
    if (brute.source !== 'mail' || a.supprime || !contient(effective(etat, brute).libelle, t)) continue;
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

export function definirRappel(etat, jours) {
  if (!RAPPELS.includes(jours)) throw new Error('rappel invalide');
  return { ...etat, reglages: { ...(etat.reglages ?? {}), rappelJours: jours } };
}
