// Seuil de dépense et jauge.
// Règles validées le 02/11/2026 :
//   - le propriétaire saisit un seuil par MOIS (du 1er au dernier jour) ;
//   - seuil du jour = seuil du mois ÷ nombre de jours du mois ; seuil de la semaine = seuil du jour × 7 (4A) ;
//   - semaine = du lundi au dimanche ;
//   - la jauge compte les dépenses (banque et espèces), pas les entrées d'argent, pas les retraits au distributeur,
//     pas les frais récurrents (ils sont distincts du seuil), pas les lignes supprimées.
// État : seuils: { moisCentimes: number | null }

import { effective, estRetrait } from './soldes.js';
import { recurrentDe } from './recurrents.js';

const pad = (n) => String(n).padStart(2, '0');
const enDate = (s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))));
const enTexte = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const joursDuMois = (s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 0)).getUTCDate();

export const PERIODES = ['jour', 'semaine', 'mois'];

export function definirSeuilMois(etat, centimes) {
  if (centimes !== null && (!Number.isInteger(centimes) || centimes < 0)) throw new Error('seuil invalide (centimes entiers, positifs)');
  return { ...etat, seuils: { ...etat.seuils, moisCentimes: centimes } };
}

/** Début et fin (inclus) de la période qui contient la date. */
export function bornes(periode, date) {
  if (!PERIODES.includes(periode)) throw new Error('période inconnue : ' + periode);
  if (periode === 'jour') return { debut: date, fin: date };
  if (periode === 'mois') return { debut: date.slice(0, 8) + '01', fin: date.slice(0, 8) + pad(joursDuMois(date)) };
  const d = enDate(date);
  const decalage = (d.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(d.getTime() - decalage * 86400000);
  return { debut: enTexte(lundi), fin: enTexte(new Date(lundi.getTime() + 6 * 86400000)) };
}

/** Seuil de la période qui contient la date, en centimes (null si aucun seuil mensuel n'est défini). */
export function seuilPour(etat, periode, date) {
  const mois = etat.seuils.moisCentimes;
  if (mois === null || mois === undefined) return null;
  if (periode === 'mois') return mois;
  const jour = Math.round(mois / joursDuMois(date));
  return periode === 'jour' ? jour : jour * 7;
}

/** Dépenses comptées dans le seuil sur une période. */
export function depensesPeriode(etat, periode, date) {
  const { debut, fin } = bornes(periode, date);
  let total = 0;
  for (const brute of etat.operations) {
    const op = effective(etat, brute);
    const a = etat.ajouts[op.id] ?? {};
    if (a.supprime || op.sens !== 'sortie' || estRetrait(etat, brute)) continue;
    if (op.date < debut || op.date > fin) continue;
    if (recurrentDe(etat, brute)) continue;
    total += op.centimes;
  }
  return total;
}

/** Ce qu'affiche la jauge : seuil, dépensé, reste (négatif si dépassé). */
export function jauge(etat, periode, date) {
  const { debut, fin } = bornes(periode, date);
  const seuil = seuilPour(etat, periode, date);
  const depense = depensesPeriode(etat, periode, date);
  return {
    periode, debut, fin, seuil, depense,
    reste: seuil === null ? null : seuil - depense,
    ratio: seuil ? depense / seuil : null,
    depasse: seuil !== null && depense > seuil,
  };
}
