// Côté app du contrat de noms de l'écran « Accueil » (contrats/accueil.md, validé par le propriétaire le 02/11/2026).
// - valeursAccueil : tout ce que l'app envoie à l'écran Tool Design (variables des textes, liste « operations », jauges).
//   La liste contient TOUT l'historique, dépenses et entrées d'argent (demande du propriétaire) ; l'écran la fait défiler.
// - actions : ce que l'app fait quand l'écran lui envoie une action (ajouter-depense, basculer-banque, changer-periode).
// Aucun calcul de placement ici : l'écran (Tool Design) décide de tout l'affichage.

import { soldes, lister, ajouterManuel, nomAffiche } from './donnees.js?v=deb522bce8bf';
import { jauge } from './seuils.js?v=deb522bce8bf';
import { aClasser, iconeCategorie } from './categories.js?v=deb522bce8bf';
import { attentes, estEnAttente } from './attentes.js?v=deb522bce8bf';
import { revenusDuMois } from './reglages.js?v=deb522bce8bf';
import { lierLigne, recurrentPourPrelevement } from './recurrents.js?v=deb522bce8bf';
import { enEuros, enCentimes } from './montants.js?v=deb522bce8bf';

// Ligne qui ne compte pas dans le solde parce qu'elle est d'avant le solde de référence (déjà incluse dans le solde
// recopié de la banque) : la date le dit (03/11/2026, terme choisi par le propriétaire).
export const MENTION_AVANT = ' · Antérieure à ton solde de départ';
export const avantSoldeDepart = (etat, l) => !l.comptee && !l.supprime && !!etat.reference?.[l.compte];
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
 * ui : { periode, aujourdhui ('AAAA-MM-JJ'), saisieMode ('especes' | 'attente' | 'preleve' | 'prelevement'), saisieMessage, synchro, rappel }
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
    date: dateLongue(l.date) + (estEnAttente(l) ? ' · CB en attente' : avantSoldeDepart(etat, l) ? MENTION_AVANT : ''),
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
  // Revenus attendus ce mois-ci et pas encore arrivés (Réglages) : dès qu'un arrive, il sort de ce total (son virement
  // est déjà dans le solde).
  const attendu = ui.aujourdhui
    ? revenusDuMois(etat, ui.aujourdhui.slice(0, 7), lister(etat).filter((l) => !l.supprime && l.sens === 'entree')).filter((x) => !x.recu).reduce((t, x) => t + x.attendu, 0)
    : 0;
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
      'saisie-banque': ouiNon((ui.saisieMode ?? (ui.saisieBanque ? 'attente' : 'especes')) !== 'especes'),
      'attente-total': enAttente ? enEuros(enAttente) : '', // vide : la ligne « En attente » de la carte banque est cachée
      'attendu-total': attendu ? '+' + enEuros(attendu) : '', // vide : la ligne « Attendu » de la carte banque est cachée
      operations,
    },
    gaugeValues: { seuil: Math.min(pourcentage, 100), 'seuil-barre': Math.min(pourcentage, 100) },
  };
}

/**
 * Action « ajouter-depense » : saisies = { 'saisie-montant', 'saisie-description' } (texte tapé dans l'écran).
 * mode (03/11/2026, choix du propriétaire) : « especes » (retirée des espèces), « attente » (CB pas encore prélevée :
 * banque, en attente du prélèvement), « preleve » (CB déjà prélevée mais sans mail : banque, pas en attente),
 * « prelevement » (11/11/2026 : prélèvement bancaire sans mail ; lié au frais récurrent du même montant s'il est connu).
 * (banque: true = « attente », comme avant.)
 * Rend { etat, message, erreur (nom de la case en erreur, ou null), vider (vrai : vider les cases) }.
 */
export function ajouterDepense(etat, saisies, { mode, banque, maintenant, aujourdhui }) {
  const choix = mode ?? (banque ? 'attente' : 'especes');
  const surBanque = choix !== 'especes';
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
    compte: surBanque ? 'banque' : 'especes', sens: 'sortie',
    libelle: description || (surBanque ? 'Dépense banque' : 'Dépense en espèces'),
    date: aujourdhui, centimes, ts: maintenant, ...(choix === 'preleve' && { preleve: true }), ...(choix === 'prelevement' && { prelevement: true }),
  });
  let e = r.etat;
  let lie = null;
  if (choix === 'prelevement') {
    lie = recurrentPourPrelevement(e, { centimes, libelle: description });
    if (lie) e = lierLigne(e, r.id, lie);
  }
  const quoi = { especes: ' (espèces)', attente: ' (CB en attente)', preleve: ' (CB prélevée)', prelevement: ' (prélèvement)' }[choix];
  const frais = lie ? ' — frais récurrent « ' + e.recurrents.find((x) => x.id === lie).nom + ' »' : '';
  return { etat: e, message: 'Ajouté : ' + enEuros(-centimes) + quoi + frais, erreur: null, vider: true };
}

/**
 * Prélèvement choisi dans la liste des frais récurrents (11/11/2026) : une ligne à son nom, à son montant, aujourd'hui,
 * déjà débitée et liée à ce frais. Le montant se corrige ensuite dans « Modifier » si le prélèvement a changé.
 */
export function ajouterPrelevementRecurrent(etat, idRecurrent, { maintenant, aujourdhui }) {
  const frais = etat.recurrents.find((x) => x.id === idRecurrent);
  if (!frais) throw new Error('Frais récurrent introuvable.');
  const r = ajouterManuel(etat, { compte: 'banque', sens: 'sortie', libelle: frais.nom, date: aujourdhui, centimes: frais.centimes, ts: maintenant, prelevement: true });
  return { etat: lierLigne(r.etat, r.id, frais.id), message: 'Ajouté : ' + enEuros(-frais.centimes) + ' (prélèvement « ' + frais.nom + ' »)' };
}
