// Séries de données pour les graphiques (le dessin vient plus tard, avec les graphiques de Tool Design).
// Règle générale : « dépense » = sortie d'argent non supprimée, hors retrait au distributeur (l'argent change de poche,
// il n'est pas dépensé). Les entrées d'argent ne sont jamais des dépenses.

import { lister } from './donnees.js?v=d8ff5a67c218';
import { normaliserLibelle } from './categories.js?v=d8ff5a67c218';
import { bornes, depensesPeriode, seuilPour } from './seuils.js?v=d8ff5a67c218';
import { ajouterJours, ajouterMois, moisDe } from './dates.js?v=d8ff5a67c218';
import { effective, estRetrait } from './soldes.js?v=d8ff5a67c218';

const estDepense = (l) => !l.supprime && l.sens === 'sortie' && !l.retrait;

function nomCategorie(etat, id) {
  return id === null ? 'À classer' : etat.categories.find((c) => c.id === id)?.nom ?? 'À classer';
}

/** Dépenses par catégorie entre deux dates (incluses), de la plus grosse à la plus petite : camembert. */
export function depensesParCategorie(etat, debut, fin, { sansRecurrents = false } = {}) {
  const totaux = new Map();
  for (const l of lister(etat)) {
    if (!estDepense(l) || l.date < debut || l.date > fin) continue;
    if (sansRecurrents && l.recurrentId) continue;
    totaux.set(l.categorie, (totaux.get(l.categorie) ?? 0) + l.centimes);
  }
  return [...totaux.entries()]
    .map(([categorie, centimes]) => ({ categorie, nom: nomCategorie(etat, categorie), centimes }))
    .sort((a, b) => b.centimes - a.centimes);
}

/**
 * Dépenses des `nombre` dernières périodes (jour, semaine ou mois), la dernière contenant `date` : barres.
 * depenseSeuil = ce qui compte dans le seuil (hors frais récurrents) ; depenseTotale = tout, frais récurrents compris.
 */
export function depensesParPeriode(etat, periode, date, nombre) {
  const lignes = lister(etat).filter(estDepense);
  const resultat = [];
  for (let k = nombre - 1; k >= 0; k--) {
    const repere = periode === 'jour' ? ajouterJours(date, -k) : periode === 'semaine' ? ajouterJours(date, -7 * k) : ajouterMois(date, -k, 1);
    const { debut, fin } = bornes(periode, repere);
    resultat.push({
      debut, fin,
      depenseTotale: lignes.filter((l) => l.date >= debut && l.date <= fin).reduce((s, l) => s + l.centimes, 0),
      depenseSeuil: depensesPeriode(etat, periode, repere),
      seuil: seuilPour(etat, periode, repere),
    });
  }
  return resultat;
}

/**
 * Solde en fin de chaque jour, de `debut` à `fin` : courbe. Vide tant qu'il n'y a pas de solde de référence.
 * Le solde de référence est exact au moment où il a été saisi (ou corrigé) : les opérations d'APRÈS s'ajoutent jour
 * après jour ; celles d'AVANT y sont déjà comptées, on les retire donc pour les jours où elles n'avaient pas encore eu
 * lieu (sinon, après une correction, tout le passé de la courbe devenait plat à la valeur corrigée — 03/11/2026).
 */
export function evolutionSolde(etat, compte, debut, fin) {
  const ref = etat.reference[compte];
  if (!ref) return [];
  const mouvements = [];
  const ajouter = (op, centimes) => mouvements.push({ date: op.date, apres: op.ts > ref.ts, centimes });
  for (const brute of etat.operations) {
    const op = effective(etat, brute);
    if (op.compte !== compte || etat.ajouts[op.id]?.supprime) continue;
    ajouter(op, op.sens === 'entree' ? op.centimes : -op.centimes);
  }
  if (compte === 'especes') {
    for (const brute of etat.operations) {
      const op = effective(etat, brute);
      if (!etat.ajouts[op.id]?.supprime && estRetrait(etat, brute)) ajouter(op, op.centimes);
    }
  }
  const points = [];
  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) {
    let c = ref.centimes;
    for (const m of mouvements) {
      if (m.apres && m.date <= d) c += m.centimes;
      else if (!m.apres && m.date > d) c -= m.centimes;
    }
    points.push({ date: d, centimes: c });
    if (points.length > 5000) break;
  }
  return points;
}

/** Les émetteurs où l'argent est le plus dépensé (le vrai émetteur saisi prime sur le libellé de la banque). */
export function topEmetteurs(etat, debut, fin, n = 5) {
  const groupes = new Map();
  for (const l of lister(etat)) {
    if (!estDepense(l) || l.date < debut || l.date > fin) continue;
    const nom = l.emetteurReel || l.libelle;
    const cle = normaliserLibelle(nom);
    const g = groupes.get(cle) ?? { emetteur: nom, centimes: 0, lignes: 0 };
    g.centimes += l.centimes;
    g.lignes += 1;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => b.centimes - a.centimes).slice(0, n);
}

/** Entrées d'argent et dépenses pour chacun des `nombre` derniers mois (le dernier contenant `date`). */
export function entreesDepensesParMois(etat, date, nombre) {
  const lignes = lister(etat).filter((l) => !l.supprime);
  const resultat = [];
  for (let k = nombre - 1; k >= 0; k--) {
    const mois = moisDe(ajouterMois(date, -k, 1));
    const duMois = lignes.filter((l) => moisDe(l.date) === mois);
    resultat.push({
      mois,
      entrees: duMois.filter((l) => l.sens === 'entree').reduce((s, l) => s + l.centimes, 0),
      depenses: duMois.filter(estDepense).reduce((s, l) => s + l.centimes, 0),
    });
  }
  return resultat;
}
