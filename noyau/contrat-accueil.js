// Côté app du contrat de noms de l'écran « Accueil » (contrats/accueil.md, validé par le propriétaire le 02/11/2026).
// - valeursAccueil : tout ce que l'app envoie à l'écran Tool Design (variables des textes, liste « operations », jauges).
//   La liste contient TOUT l'historique, dépenses et entrées d'argent (demande du propriétaire) ; l'écran la fait défiler.
// - actions : ce que l'app fait quand l'écran lui envoie une action (ajouter-depense, basculer-banque, changer-periode).
// Aucun calcul de placement ici : l'écran (Tool Design) décide de tout l'affichage.

import { soldes, lister, ajouterManuel, nomAffiche } from './donnees.js?v=984083fc16fc';
import { jauge } from './seuils.js?v=984083fc16fc';
import { aClasser, iconeCategorie } from './categories.js?v=984083fc16fc';
import { attentes, estEnAttente } from './attentes.js?v=984083fc16fc';
import { enEuros, enCentimes } from './montants.js?v=984083fc16fc';

export const PERIODES = ['jour', 'semaine', 'mois'];
export const LIBELLES_PERIODES = { jour: "Aujourd'hui", semaine: 'Semaine en cours', mois: 'Mois en cours' };
export const periodeSuivante = (p) => PERIODES[(PERIODES.indexOf(p) + 1) % PERIODES.length];

const dateLongue = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const ouiNon = (b) => (b ? 'oui' : 'non');

function typeLigne(l) {
  if (l.retrait) return 'retrait';
  if (l.compte === 'especes') return 'especes';
  if (l.source === 'manuel') return 'saisie-banque';
  return 'banque';
}

function nomCategorie(etat, l) {
  if (l.retrait) return 'retrait';
  if (!l.categorie) return 'à classer';
  return etat.categories.find((c) => c.id === l.categorie)?.nom ?? 'à classer';
}

/**
 * Valeurs envoyées à l'écran d'accueil.
 * ui : { periode, aujourdhui ('AAAA-MM-JJ'), saisieBanque (bool), saisieMessage, synchro, rappel }
 * Rend { linkVariables, gaugeValues } (noms exacts de DesignView / du lecteur).
 */
export function valeursAccueil(etat, ui) {
  const s = soldes(etat);
  const j = jauge(etat, ui.periode, ui.aujourdhui);
  const pourcentage = j.seuil ? Math.round((j.depense / j.seuil) * 100) : 0;
  // Tout l'historique, dépenses ET entrées d'argent (demande du propriétaire), du plus ancien au plus récent : dans une
  // liste Tool Design la dernière saisie est la plus récente, et l'écran la met en bas (la liste part du bas).
  const operations = lister(etat).reverse().map((l) => ({
    id: l.id,
    sens: l.sens === 'sortie' ? 'depense' : 'entree',
    libelle: nomAffiche(l),
    date: dateLongue(l.date) + (estEnAttente(l) ? ' · CB en attente' : ''),
    montant: enEuros(l.sens === 'sortie' ? -l.centimes : l.centimes, { signe: true }),
    categorie: l.sens === 'sortie' ? nomCategorie(etat, l) : 'Entrée',
    'categorie-id': l.sens !== 'sortie' ? 'entree' : l.retrait ? 'retrait' : l.categorie ?? 'a-classer',
    type: typeLigne(l),
    // Icône choisie pour la catégorie (03/11/2026 : l'écran choisit l'image d'après {icone}).
    icone: l.sens !== 'sortie' ? 'virement' : l.retrait ? 'retrait' : iconeCategorie(etat, l.categorie),
    // Fenêtre « Modifier l'opération » ouverte en touchant la ligne (libellé de la banque toujours visible).
    'libelle-banque': l.source === 'manuel' ? 'saisie à la main' : l.libelle,
    'modif-description': nomAffiche(l), 'modif-montant': enEuros(l.centimes).replace(' €', ''),
    'modif-date': l.date.slice(8, 10) + '/' + l.date.slice(5, 7) + '/' + l.date.slice(0, 4),
  }));
  const enAttente = attentes(etat).reduce((t, l) => t + l.centimes, 0);
  return {
    linkVariables: {
      'solde-banque': s.banque === null ? 'à saisir' : enEuros(s.banque),
      'solde-especes': s.especes === null ? 'à saisir' : enEuros(s.especes),
      periode: LIBELLES_PERIODES[ui.periode],
      'seuil-pourcentage': j.seuil === null ? '—' : pourcentage + ' %',
      'seuil-depense': enEuros(j.depense),
      'seuil-total': j.seuil === null ? 'non réglé' : enEuros(j.seuil),
      reste: j.reste === null ? '—' : enEuros(Math.abs(j.reste)),
      'reste-libelle': j.depasse ? 'Dépassement' : 'Reste à dépenser',
      depasse: ouiNon(j.depasse),
      'a-classer': String(aClasser(etat).length),
      'rappel-sauvegarde': ui.rappel ?? '',
      synchro: ui.synchro ?? '',
      'saisie-message': ui.saisieMessage ?? '',
      'saisie-banque': ouiNon(ui.saisieBanque),
      'attente-total': enAttente ? enEuros(enAttente) : '', // vide : la ligne « En attente » de la carte banque est cachée
      operations,
    },
    gaugeValues: { seuil: Math.min(pourcentage, 100), 'seuil-barre': Math.min(pourcentage, 100) },
  };
}

/**
 * Action « ajouter-depense » : saisies = { 'saisie-montant', 'saisie-description' } (texte tapé dans l'écran).
 * Rend { etat, message, erreur (nom de la case en erreur, ou null), vider (vrai : vider les cases) }.
 */
export function ajouterDepense(etat, saisies, { banque, maintenant, aujourdhui }) {
  let centimes;
  try {
    if (!String(saisies['saisie-montant'] ?? '').trim()) throw new Error('Tape le montant, par exemple 4,20.');
    centimes = enCentimes(saisies['saisie-montant']);
    if (centimes <= 0) throw new Error('Saisis un montant positif, par exemple 4,20.');
  } catch (e) {
    return { etat, message: e.message, erreur: 'saisie-montant', vider: false };
  }
  const description = String(saisies['saisie-description'] ?? '').trim();
  const r = ajouterManuel(etat, {
    compte: banque ? 'banque' : 'especes', sens: 'sortie',
    libelle: description || (banque ? 'Dépense banque' : 'Dépense en espèces'),
    date: aujourdhui, centimes, ts: maintenant,
  });
  return { etat: r.etat, message: 'Ajouté : ' + enEuros(-centimes) + (banque ? ' (CB en attente)' : ' (espèces)'), erreur: null, vider: true };
}
