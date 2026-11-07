// Calcul des soldes. Aucune écriture, aucune donnée stockée ici.
//
// Règle (validée le 02/11/2026) : solde d'un compte = solde de référence saisi par le propriétaire
// + les opérations arrivées APRÈS le moment de cette référence (op.ts > référence.ts), hors lignes supprimées.
// Un mail plus ancien que la référence reste dans la liste mais ne change pas le solde.
// Un retrait au distributeur (dépense banque marquée « retrait ») baisse la banque et augmente les espèces.

import { normaliserLibelle } from './libelles.js?v=b9eea6c08f0e';

/** L'opération telle que le propriétaire la voit : ses corrections (libellé, date, montant, sens, compte) passent avant l'original. */
export function effective(etat, op) {
  const c = etat.ajouts[op.id]?.corrige;
  return c ? { ...op, ...c } : op;
}

/** Une opération compte-t-elle dans le solde de son compte ? */
export function compteDansSolde(etat, brute) {
  const op = effective(etat, brute);
  const ref = etat.reference[op.compte];
  if (!ref) return false;
  if (etat.ajouts[op.id]?.supprime) return false;
  return op.ts > ref.ts;
}

/** Une règle automatique reconnaît-elle cette ligne ? (mot contenu dans le libellé de la banque et/ou l'objet du mail) */
function reglecorrespond(regle, op) {
  const mot = normaliserLibelle(regle.contient);
  const dansLibelle = normaliserLibelle(op.libelle).includes(mot);
  const dansObjet = normaliserLibelle(op.objet ?? '').includes(mot);
  return regle.champ === 'libelle' ? dansLibelle : regle.champ === 'objet' ? dansObjet : dansLibelle || dansObjet;
}

/**
 * Une dépense de la banque est-elle un retrait au distributeur ? Le choix du propriétaire sur la ligne prime
 * (oui ou non) ; sans choix, une règle automatique peut la reconnaître. Jamais pour une entrée ni pour les espèces.
 */
export function estRetrait(etat, brute) {
  const op = effective(etat, brute);
  if (op.compte !== 'banque' || op.sens !== 'sortie') return false;
  const a = etat.ajouts[op.id];
  if (a && 'retrait' in a) return !!a.retrait;
  return (etat.regles ?? []).some((r) => reglecorrespond(r, op));
}

/** Une opération est-elle un retrait qui alimente les espèces ? */
export function retraitCompte(etat, brute) {
  const op = effective(etat, brute);
  const ref = etat.reference.especes;
  if (!ref) return false;
  if (etat.ajouts[op.id]?.supprime || !estRetrait(etat, brute)) return false;
  return op.ts > ref.ts;
}

/** Soldes en centimes ; null tant que le propriétaire n'a pas saisi de solde de référence. */
export function soldes(etat) {
  const resultat = { banque: null, especes: null };
  for (const compte of ['banque', 'especes']) {
    const ref = etat.reference[compte];
    if (!ref) continue;
    let total = ref.centimes;
    for (const brute of etat.operations) {
      const op = effective(etat, brute);
      if (op.compte === compte && compteDansSolde(etat, brute)) total += op.sens === 'entree' ? op.centimes : -op.centimes;
      if (compte === 'especes' && retraitCompte(etat, brute)) total += op.centimes;
    }
    resultat[compte] = total;
  }
  return resultat;
}
