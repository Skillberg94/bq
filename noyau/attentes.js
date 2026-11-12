// Paiements CB en attente de prélèvement (choix du propriétaire, 03/11/2026) : la banque ne retire pas tout de suite
// l'argent d'un paiement par carte. Le propriétaire le saisit sur l'accueil avec la case « CB en attente » (l'ancienne
// « Dépense banque ») : il compte tout de suite dans le solde et le seuil. Quand un prélèvement de la banque du MÊME
// montant arrive (mail), il le valide : la ligne de la banque prend la description et la catégorie saisies, la saisie
// disparaît (une seule ligne reste, rien n'est compté deux fois). Plusieurs saisies du même montant : la plus ancienne
// d'abord.
// Une saisie en attente = dépense saisie à la main sur le compte banque, pas supprimée.

import { lister } from './donnees.js?v=1e063d13622f';
import { categorieDe } from './categories.js?v=1e063d13622f';
import { effective } from './soldes.js?v=1e063d13622f';

const LIBELLE_PAR_DEFAUT = 'Dépense banque';

export const estEnAttente = (l) => l.source === 'manuel' && l.compte === 'banque' && l.sens === 'sortie' && !l.supprime && !l.preleve;
// CB prélevée saisie ou marquée à la main : un prélèvement du même montant qui arrive ensuite est AJOUTÉ (07/11/2026, choix
// du propriétaire : ce peut être une autre CB du même montant ; un doublon éventuel se supprime à la main).

/** Saisies en attente, de la plus ancienne à la plus récente. */
export function attentes(etat) {
  return lister(etat).filter(estEnAttente).reverse();
}

/** Valide les saisies en attente par les prélèvements reçus (ids des lignes de mail). Rend { etat, validees }. */
export function validerAttentes(etat, idsMails) {
  let e = etat;
  const validees = [];
  const libres = attentes(etat);
  for (const id of idsMails) {
    const brute = e.operations.find((o) => o.id === id);
    if (!brute || (brute.source !== 'mail' && brute.source !== 'notification')) continue;
    const op = effective(e, brute);
    if (op.compte !== 'banque' || op.sens !== 'sortie') continue;
    const i = libres.findIndex((a) => a.centimes === op.centimes);
    if (i < 0) continue;
    const [a] = libres.splice(i, 1);
    const categorie = categorieDe(e, e.operations.find((o) => o.id === a.id));
    // Ce que le propriétaire a écrit (description, sinon le texte saisi) devient la description de la ligne de la banque.
    const texte = a.description || (a.libelle !== LIBELLE_PAR_DEFAUT ? a.libelle : '');
    const repris = {
      ...(texte && { description: texte }),
      ...(categorie && { categorie }),
    };
    e = {
      ...e,
      ajouts: {
        ...e.ajouts,
        [id]: { ...(e.ajouts[id] ?? {}), ...repris, attenteValidee: a.id },
        [a.id]: { ...(e.ajouts[a.id] ?? {}), supprime: true, valideePar: id },
      },
    };
    validees.push({ attente: a.id, mail: id, centimes: op.centimes });
  }
  return { etat: e, validees };
}
