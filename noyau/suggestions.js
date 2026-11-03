// Suggestions de frais récurrents (page « Frais récurrents », choix du propriétaire du 03/11/2026 : « suggestion et à la
// main »). Règle (contrats/recurrents.md) : débits de la banque du même libellé, montant proche, à intervalle régulier
// (≈ 1 mois ou 4 semaines), vus au moins 3 fois, pas déjà liés à un frais. « Ignorer » est retenu.
// Tolérances proposées par Claude (à valider) : montant à ± 10 % de la médiane ; intervalle 26-35 jours (mois) ou
// 27-29 jours (4 semaines), sur au moins les deux tiers des écarts.
// État : suggestionsIgnorees: [libellés normalisés]

import { lister } from './donnees.js?v=1197e14a1b2e';
import { normaliserLibelle } from './libelles.js?v=1197e14a1b2e';
import { enDate } from './dates.js?v=1197e14a1b2e';

export const VUES_MIN = 3;
export const ignorees = (etat) => etat.suggestionsIgnorees ?? [];

const mediane = (v) => { const t = [...v].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };

/** [{ id (libellé normalisé), libelle, centimes (médiane), unite: 'mois' | 'semaines', pas, fois, derniere }] */
export function suggestionsFrais(etat) {
  const groupes = new Map();
  for (const l of lister(etat)) {
    if (l.supprime || l.sens !== 'sortie' || l.compte !== 'banque' || l.retrait || l.recurrentId) continue;
    const cle = normaliserLibelle(l.libelle);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(l);
  }
  const sortie = [];
  for (const [cle, lignes] of groupes) {
    if (lignes.length < VUES_MIN || ignorees(etat).includes(cle)) continue;
    const m = mediane(lignes.map((l) => l.centimes));
    const proches = lignes.filter((l) => Math.abs(l.centimes - m) <= m * 0.1).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (proches.length < VUES_MIN) continue;
    const ecarts = proches.slice(1).map((l, i) => Math.round((enDate(l.date) - enDate(proches[i].date)) / 86400000));
    const part = (min, max) => ecarts.filter((e) => e >= min && e <= max).length / ecarts.length;
    const unite = part(27, 29) >= 2 / 3 && part(30, 35) < 1 / 3 ? 'semaines' : part(26, 35) >= 2 / 3 ? 'mois' : null;
    if (!unite) continue;
    sortie.push({ id: cle, libelle: proches.at(-1).libelle, centimes: m, unite, pas: unite === 'semaines' ? 4 : 1, fois: proches.length, derniere: proches.at(-1).date });
  }
  return sortie.sort((a, b) => b.centimes - a.centimes);
}

export function ignorerSuggestion(etat, id) {
  return { ...etat, suggestionsIgnorees: [...new Set([...ignorees(etat), id])] };
}
