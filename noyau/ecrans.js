// Côté app des 10 écrans Tool Design (contrats/*.md) : ce que l'app envoie à chaque écran, et ce qu'elle fait de chaque
// bouton. Aucun calcul de placement : l'écran (Tool Design) décide de tout l'affichage.
//   valeursEcran(page, etat, ui, ctx) -> { linkVariables, gaugeValues, chartData }
//   agir(page, etat, ui, action, ctx)  -> { etat, ui, message?, effet?, aller?, vider? }
// ui : choix de l'écran gardés par l'app (période, filtres, ligne touchée…) ; ctx : { aujourdhui, maintenant, synchro,
// rappel, saisies (texte des cases), dernier (dernière case tapée), valeurs (envoi d'une ligne touchée), ... }.
// effet : ce que la page du navigateur doit faire elle-même (synchro, fichier, mot de passe…).

import { lister, supprimer as supprimerLigne, modifier, nomAffiche, remettre, supprimerDefinitivement, corbeille } from './donnees.js?v=deb522bce8bf';
const modifierLigne = modifier;
import { soldes } from './soldes.js?v=deb522bce8bf';
import { bornes, jauge, definirSeuilMois, niveauAlerte, definirAlerte, seuilsCategories, definirSeuilCategorie, depensesCategorie, seuilPour } from './seuils.js?v=deb522bce8bf';
import { aClasser, classerEmetteur, oublierEmetteur, ajouterCategorie, modifierCategorie, supprimerCategorie, iconeCategorie, normaliserLibelle, ENTREES, nomEntrees, modifierEntrees } from './categories.js?v=deb522bce8bf';
import { apercuFrais, resteAPrevoir, soldeApresFraisAVenir, ajouterRecurrent, modifierRecurrent, supprimerRecurrent, creerDepuisLigne, recurrentDe } from './recurrents.js?v=deb522bce8bf';
import { suggestionsFrais, ignorerSuggestion } from './suggestions.js?v=deb522bce8bf';
import { attentes, estEnAttente } from './attentes.js?v=deb522bce8bf';
import { objectifsDe, ajouterObjectif, modifierObjectif, supprimerObjectif, bilanDuMois, epargneObjectif, dureeObjectif } from './objectifs.js?v=deb522bce8bf';
import { depensesParCategorie, depensesParPeriode, evolutionSolde, topEmetteurs, entreesDepensesParMois } from './stats.js?v=deb522bce8bf';
import { ajouterRegle, supprimerRegle } from './regles.js?v=deb522bce8bf';
import { correctionsDe, corrigerSolde, libellesIgnores, ajouterIgnore, supprimerIgnore, rappelJours, definirRappel, revenus, revenusDuMois, ajouterRevenu, modifierRevenu, supprimerRevenu, entreesRetenues } from './reglages.js?v=deb522bce8bf';
import { enEuros, enCentimes } from './montants.js?v=deb522bce8bf';
import { ajouterJours, ajouterMois, enDate, moisDe, joursDuMois } from './dates.js?v=deb522bce8bf';
import { valeursAccueil, ajouterDepense, ajouterPrelevementRecurrent, periodeSuivante, avantSoldeDepart, MENTION_AVANT } from './contrat-accueil.js?v=deb522bce8bf';
import { lierLigne, recurrentPourPrelevement } from './recurrents.js?v=deb522bce8bf';

export const PAGES = ['accueil', 'operations', 'categories', 'recurrents', 'seuils', 'objectifs', 'statistiques', 'soldes', 'sauvegarde', 'reglages'];

// ---- Petites mises en forme
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ouiNon = (b) => (b ? 'oui' : 'non');
const jourMois = (d) => Number(d.slice(8, 10)) + ' ' + MOIS_COURTS[Number(d.slice(5, 7)) - 1];
const dateLongue = (d) => jourMois(d) + ' ' + d.slice(0, 4);
const nomMois = (m) => MOIS_LONGS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const enNombre = (c) => String(Math.round(c) / 100); // « 2500 », « 514.14 » : pour les calculs « = … » de l'écran
const pourcent = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const euros = (c) => enEuros(c);
const signe = (c) => enEuros(c, { signe: true });
const nbJours = (debut, fin) => Math.round((enDate(fin) - enDate(debut)) / 86400000) + 1;
const nomCat = (etat, id) => (id ? etat.categories.find((c) => c.id === id)?.nom ?? 'à classer' : 'à classer');

/** Texte d'une case « JJ/MM/AAAA » -> 'AAAA-MM-JJ'. */
export function lireDate(texte) {
  const m = String(texte ?? '').trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) throw new Error('Date illisible : « ' + (texte ?? '') + ' » (exemple : 12/10/2026).');
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || j < 1 || j > joursDuMois(a, mo)) throw new Error('Cette date n\'existe pas : ' + texte);
  return a + '-' + String(mo).padStart(2, '0') + '-' + String(j).padStart(2, '0');
}

/** Montant tapé dans une case (vide = null). */
function montant(texte, nom = 'montant') {
  if (texte === undefined || texte === null || String(texte).trim() === '') return null;
  try { return enCentimes(texte); } catch { throw new Error('Le ' + nom + ' est illisible (exemple : 12,50).'); }
}

// ---- Période choisie (Opérations, Statistiques) : { type: 'mois' | 'annee' | 'semaine' | 'dates' | 'tout', repere, debut?, fin? }
// « tout » (Opérations seulement, 03/11/2026) : toutes les lignes, depuis le début ; les flèches n'y changent rien.
export const periodeDefaut = (aujourdhui) => ({ type: 'mois', repere: aujourdhui });

export function bornesChoix(p) {
  if (p.type === 'tout') return { debut: '0000-01-01', fin: '9999-12-31', libelle: 'DEPUIS LE DÉBUT' };
  if (p.type === 'annee') return { debut: p.repere.slice(0, 4) + '-01-01', fin: p.repere.slice(0, 4) + '-12-31', libelle: p.repere.slice(0, 4) };
  if (p.type === 'semaine') { const b = bornes('semaine', p.repere); return { ...b, libelle: ('Semaine du ' + jourMois(b.debut)).toUpperCase() }; }
  if (p.type === 'dates') return { debut: p.debut, fin: p.fin, libelle: (jourMois(p.debut) + ' → ' + dateLongue(p.fin)).toUpperCase() };
  const b = bornes('mois', p.repere);
  return { ...b, libelle: nomMois(p.repere).toUpperCase() };
}

export function decaler(p, sens) {
  if (p.type === 'tout') return p;
  if (p.type === 'annee') return { ...p, repere: ajouterMois(p.repere, 12 * sens, 1) };
  if (p.type === 'semaine') return { ...p, repere: ajouterJours(p.repere, 7 * sens) };
  if (p.type === 'dates') { const n = nbJours(p.debut, p.fin) * sens; return { ...p, debut: ajouterJours(p.debut, n), fin: ajouterJours(p.fin, n) }; }
  return { ...p, repere: ajouterMois(p.repere, sens, 1) };
}

/** Boutons de période communs. Re-cliquer sur le choix en cours le décoche : retour au mois (demande du propriétaire). */
function choisirPeriode(p, action, ctx) {
  const types = { 'periode-tout': 'tout', 'periode-annee': 'annee', 'periode-mois': 'mois', 'periode-semaine': 'semaine' };
  if (types[action]) return p.type === types[action] ? periodeDefaut(ctx.aujourdhui) : { type: types[action], repere: ctx.aujourdhui };
  if (action === 'periode-precedente') return decaler(p, -1);
  if (action === 'periode-suivante') return decaler(p, 1);
  if (action === 'valider-dates') {
    const debut = lireDate(ctx.saisies['date-debut']);
    const fin = lireDate(ctx.saisies['date-fin']);
    if (fin < debut) throw new Error('La date de fin est avant la date de début.');
    return { type: 'dates', repere: fin, debut, fin };
  }
  return null;
}

// ---- Lignes d'opérations (accueil, Opérations)
function typeLigne(l) {
  if (l.retrait) return 'retrait';
  if (l.compte === 'especes') return 'especes';
  if (l.source === 'manuel') return 'saisie-banque';
  return 'banque';
}
const enJJMMAAAA = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
/** Nom de l'icône d'une ligne (03/11/2026 : les écrans choisissent l'image d'après {icone}). */
const iconeLigne = (etat, l) => (l.sens !== 'sortie' ? iconeCategorie(etat, ENTREES) : l.retrait ? 'retrait' : iconeCategorie(etat, l.categorie));
function ligneOperation(etat, l) {
  return {
    id: l.id,
    sens: l.sens === 'sortie' ? 'depense' : 'entree',
    libelle: nomAffiche(l),
    date: dateLongue(l.date) + (avantSoldeDepart(etat, l) ? MENTION_AVANT : ''),
    montant: signe(l.sens === 'sortie' ? -l.centimes : l.centimes),
    // L'étiquette montre toujours la catégorie (07/11/2026, demande du propriétaire) ; « CB en attente » reste dans la date
    // et le statut a sa propre ligne dans la fiche (statut ci-dessous).
    categorie: l.sens !== 'sortie' ? 'Entrée' : l.retrait ? 'retrait' : nomCat(etat, l.categorie),
    'categorie-id': l.sens !== 'sortie' ? 'entree' : l.retrait ? 'retrait' : l.categorie ?? 'a-classer',
    icone: iconeLigne(etat, l),
    type: typeLigne(l),
    // Cases de la fenêtre « Modifier l'opération », remplies par la ligne touchée.
    'modif-description': nomAffiche(l), 'modif-montant': euros(l.centimes).replace(' €', ''), 'modif-date': enJJMMAAAA(l.date),
    'libelle-banque': l.source === 'manuel' ? 'saisie à la main' : l.libelle,
    emetteur: l.emetteurReel || '—',
    description: l.description || '—', // ligne « Description » de la fiche (ce que le propriétaire écrit dans Modifier)
    objet: l.objet || (l.source === 'manuel' ? 'Saisie à la main' : '—'),
    compte: l.compte === 'especes' ? 'Espèces' : 'Banque',
    // Statut d'une dépense banque saisie à la main : le toucher dans la fiche le change (basculer-statut). Les autres : —.
    statut: estCbAMain(l) ? STATUTS[statutDe(l)] : '—',
  };
}
// Statut montré par la fiche ouverte (11/11/2026) : lu en direct par l'écran, il change dès qu'on le touche, fiche ouverte.
// Nom du bouton « Récurrent » de la fiche ouverte (11/11/2026) : il bascule.
const boutonRecurrent = (etat, id) => { const l = id && lister(etat).find((x) => x.id === id); return l && l.recurrentId ? 'Pas récurrent' : 'Récurrent'; };
const statutFiche = (etat, id) => { const l = id && lister(etat).find((x) => x.id === id); return l ? ligneOperation(etat, l).statut : '—'; };
const estCbAMain = (l) => l.source === 'manuel' && l.compte === 'banque' && l.sens === 'sortie' && !l.retrait;
// Trois statuts, dans l'ordre où le toucher les fait passer (11/11/2026, demande du propriétaire).
// Premier choix de la fenêtre « Quel prélèvement ? » (11/11/2026, demande du propriétaire) : un prélèvement qui n'est pas un frais récurrent.
const PRELEVEMENT_UNIQUE = 'prelevement-unique';
const STATUTS = { attente: 'CB en attente', preleve: 'CB prélevée', prelevement: 'Prélèvement' };
const statutDe = (l) => (l.prelevement ? 'prelevement' : l.preleve ? 'preleve' : 'attente');

// =====================================================================================================================
// Valeurs envoyées à chaque écran
// =====================================================================================================================

function vOperations(etat, ui, ctx) {
  const u = ui.operations;
  const b = bornesChoix(u.periode);
  const lignes = lister(etat).filter((l) => l.date >= b.debut && l.date <= b.fin).filter((l) => {
    if (u.type === 'depenses' && l.sens !== 'sortie') return false;
    if (u.type === 'entrees' && l.sens !== 'entree') return false;
    if (u.type === 'especes' && l.compte !== 'especes') return false;
    if (u.categorie === 'toutes') return true;
    if (u.categorie === 'a-classer') return l.aClasser;
    return l.sens === 'sortie' && !l.retrait && l.categorie === u.categorie;
  });
  const depense = lignes.filter((l) => l.sens === 'sortie' && !l.retrait).reduce((s, l) => s + l.centimes, 0);
  const recu = lignes.filter((l) => l.sens === 'entree').reduce((s, l) => s + l.centimes, 0);
  return { linkVariables: {
    'periode-libelle': b.libelle, 'total-depense': euros(depense), 'total-recu': euros(recu),
    // Arrivée depuis Catégories (choix du propriétaire, 03/11/2026 : « nouvelle ligne en haut, les lignes en haut du
    // cadre », seulement depuis Catégories) : la liste « operations-recentes » de l'écran, qui part du haut avec la plus
    // récente en haut ; l'autre liste, au même endroit, reste vide (et inversement). Les deux reçoivent les lignes du
    // plus ancien au plus récent : c'est l'écran qui met la plus récente du côté choisi.
    // 04/11/2026 (demande du propriétaire) : toujours ainsi dans Opérations, plus seulement depuis Catégories (l'accueil
    // garde l'ordre inverse : plus récente en bas).
    operations: [], 'operations-recentes': lignes.reverse().map((l) => ligneOperation(etat, l)),
    // Fenêtre « Changer la catégorie » (fenêtre de détail) : toutes les catégories, nouvelles comprises.
    'choix-categories': etat.categories.map((c) => ({ id: c.id, nom: c.nom, icone: iconeCategorie(etat, c.id) })),
    'statut-fiche': statutFiche(etat, u.touchee),
    'recurrent-bouton': boutonRecurrent(etat, u.touchee),
  } };
}

function vSeuils(etat, ui, ctx) {
  const a = ctx.aujourdhui;
  const [jj, js, jm] = ['jour', 'semaine', 'mois'].map((p) => jauge(etat, p, a));
  const seuil = jm.seuil;
  const finMois = bornes('mois', a).fin;
  const joursRestants = nbJours(a, finMois);
  const alerte = niveauAlerte(etat);
  const ratio = seuil ? jm.depense / seuil : 0;
  let message = 'Règle ton seuil du mois pour suivre tes dépenses.', niveau = 'aucune';
  if (seuil) {
    const p = Math.round(ratio * 100);
    if (ratio > 1) { message = 'Seuil dépassé : ' + p + ' % du mois'; niveau = 'rouge'; }
    else if (p >= alerte) { message = 'Seuil proche : ' + p + ' % du mois'; niveau = 'orange'; }
    else { message = 'Tout va bien : ' + p + ' % du mois'; }
  }
  const parCat = seuilsCategories(etat);
  const reparti = Object.values(parCat).reduce((s, c) => s + c, 0);
  const ids = [...etat.categories.map((c) => c.id), null];
  const lignes = ids.map((id) => {
    const dep = depensesCategorie(etat, id, jm.debut, jm.fin);
    const s = id ? parCat[id] : undefined;
    const r = s ? dep / s : null;
    return {
      id: id ?? 'a-classer', icone: iconeCategorie(etat, id), nom: id ? nomCat(etat, id) : 'À classer', depense: euros(dep),
      seuil: s ? euros(s) : 'pas de seuil',
      'seuil-categorie': s ? enNombre(s) : '', // % entier : il est aussi écrit dans la ligne, où « 26.7 » (point) ne se lirait pas à la française.
      'seuil-categorie-pourcent': s && seuil ? String(Math.round((s * 100) / seuil)) : '',
      etat: s ? Math.round(r * 100) + ' %' : '—',
      niveau: !s ? 'aucun' : r > 1 ? 'rouge' : r * 100 >= alerte ? 'orange' : 'vert',
      _dep: dep,
    };
  }).filter((l) => l.id !== 'a-classer' || l._dep > 0).map(({ _dep, ...l }) => l);
  // Mois passés (6 au plus), seulement à partir du mois de la première opération : pas de mois vides avant l'app.
  const premiere = etat.operations.reduce((d, o) => (d === null || o.date < d ? o.date : d), null);
  const passes = premiere === null ? [] : depensesParPeriode(etat, 'mois', a, 7).slice(0, -1).reverse().filter((m) => m.fin >= premiere);
  return {
    linkVariables: {
      'seuil-mois': seuil === null ? 'non réglé' : euros(seuil), 'seuil-jour': jj.seuil === null ? '—' : euros(jj.seuil), 'seuil-semaine': js.seuil === null ? '—' : euros(js.seuil),
      'seuil-mois-nombre': seuil === null ? '0' : enNombre(seuil),
      'depense-jour': euros(jj.depense), 'depense-semaine': euros(js.depense), 'depense-mois': euros(jm.depense),
      'reste-mois': jm.reste === null ? '—' : enEuros(jm.reste), 'jours-restants': String(joursRestants),
      'reste-par-jour': jm.reste === null ? '—' : enEuros(Math.round(jm.reste / joursRestants)), depasse: ouiNon(jm.depasse),
      'alerte-message': message, 'alerte-niveau': niveau,
      reparti: euros(reparti), 'reparti-pourcent': String(pourcent(reparti, seuil)), libre: seuil === null ? '—' : enEuros(seuil - reparti),
      'libre-pourcent': String(seuil ? 100 - pourcent(reparti, seuil) : 0), 'reparti-trop': ouiNon(seuil !== null && reparti > seuil),
      'seuils-categories': lignes,
      'mois-passes': passes.map((m) => ({
        mois: majuscule(nomMois(m.debut)), depense: euros(m.depenseSeuil), seuil: m.seuil === null ? '—' : euros(m.seuil),
        etat: m.seuil === null ? '—' : m.depenseSeuil > m.seuil ? 'Dépassé' : 'Respecté', niveau: m.seuil !== null && m.depenseSeuil > m.seuil ? 'rouge' : 'vert',
      })),
    },
    gaugeValues: Object.fromEntries([['jauge-jour', jj], ['jauge-semaine', js], ['jauge-mois', jm]].map(([n, j]) => [n, j.seuil ? Math.min(100, pourcent(j.depense, j.seuil)) : 0])),
  };
}

function vCategories(etat, ui, ctx) {
  const mois = bornes('mois', ctx.aujourdhui);
  const lignes = lister(etat);
  const aClasserLignes = lignes.filter((l) => l.aClasser).reverse();
  const emetteurs = Object.entries(etat.emetteurs).map(([cle, v]) => ({
    id: cle, emetteur: lignes.find((l) => normaliserLibelle(l.libelle) === cle)?.libelle ?? cle,
    categorie: nomCat(etat, v.categorie), icone: iconeCategorie(etat, v.categorie),
  })).sort((a, b) => a.emetteur.localeCompare(b.emetteur, 'fr'));
  return { linkVariables: {
    'a-classer': aClasserLignes.map((l) => ({ id: l.id, libelle: nomAffiche(l), date: dateLongue(l.date), montant: signe(-l.centimes), sens: 'depense' })),
    // En tête : « Entrées d'argent » (toutes les entrées) ; puis les catégories de dépenses.
    categories: [{ id: ENTREES, nom: nomEntrees(etat), filtre: (l) => l.sens === 'entree' }, ...etat.categories.map((c) => ({ id: c.id, nom: c.nom, filtre: (l) => l.sens === 'sortie' && !l.retrait && l.categorie === c.id }))].map((c) => {
      const du = lignes.filter(c.filtre);
      return { id: c.id, nom: c.nom, icone: iconeCategorie(etat, c.id), nombre: String(du.length),
        depense: euros(du.filter((l) => l.date >= mois.debut && l.date <= mois.fin).reduce((s, l) => s + l.centimes, 0)) };
    }),
    emetteurs,
  }, buttonStates: ui.categories.touchee === ENTREES ? { 'demander-suppression': 'disabled' } : {} };
}

// Frais ramenés au mois : 4 semaines -> × 13 / 12 (52 semaines par an).
const parMois = (r) => (r.periodicite.unite === 'semaines' ? Math.round((r.centimes * 52) / (12 * r.periodicite.pas)) : Math.round(r.centimes / r.periodicite.pas));
function periodiciteTexte(p) {
  if (p.unite === 'semaines') return p.pas === 1 ? 'toutes les semaines' : 'toutes les ' + p.pas + ' semaines';
  return p.pas === 1 ? 'tous les mois' : 'tous les ' + p.pas + ' mois';
}
/** Économie estimée du mois en cours = entrées du mois − (seuil + frais par mois). */
function economieDuMois(etat, aujourdhui) {
  const totalFrais = etat.recurrents.reduce((s, r) => s + parMois(r), 0);
  const seuil = seuilPour(etat, 'mois', aujourdhui) ?? 0;
  // Revenu attendu (Réglages) tant que le vrai salaire n'est pas arrivé.
  const mois = moisDe(aujourdhui);
  const { centimes: entrees, prevu: entreesPrevues } = entreesRetenues(etat, bilanDuMois(etat, mois).entrees, mois, lister(etat).filter((l) => !l.supprime && l.sens === 'entree'));
  return { totalFrais, seuil, entrees, entreesPrevues, prevu: seuil + totalFrais, economie: entrees - seuil - totalFrais };
}

function vRecurrents(etat, ui, ctx) {
  const a = ctx.aujourdhui;
  const e = economieDuMois(etat, a);
  const apercu = apercuFrais(etat, a);
  const fin = bornes('mois', a).fin;
  // Un frais sans date connue (jamais vu passer) compte à venir ce mois-ci (comme dans resteAPrevoir).
  const aVenir = apercu.filter((f) => !f.prochain || f.prochain <= fin);
  const apres = soldeApresFraisAVenir(etat, a);
  const dans7 = ajouterJours(a, 7);
  const parCat = new Map();
  for (const r of etat.recurrents) {
    const g = parCat.get(r.categorie) ?? { total: 0, nombre: 0 };
    g.total += parMois(r); g.nombre += 1; parCat.set(r.categorie, g);
  }
  return { linkVariables: {
    'total-mois': euros(e.totalFrais), 'a-venir': euros(resteAPrevoir(etat, a)) + ' (' + aVenir.length + ' frais)',
    'solde-apres': apres === null ? 'solde à saisir' : enEuros(apres),
    'seuil-mois': e.seuil ? euros(e.seuil) : 'non réglé', 'total-prevu': euros(e.prevu),
    'entrees-mois': euros(e.entrees) + (e.entreesPrevues ? ' (prévu)' : ''), economie: enEuros(e.economie), 'economie-negative': ouiNon(e.economie < 0),
    suggestions: suggestionsFrais(etat).map((s) => ({ id: s.id, emetteur: s.libelle, montant: euros(s.centimes), periodicite: periodiciteTexte(s), fois: String(s.fois), icone: 'forfait' })), // l'écran écrit « vu {fois} fois »
    recurrents: etat.recurrents.map((r) => {
      const f = apercu.find((x) => x.id === r.id);
      return {
        id: r.id, nom: r.nom, montant: euros(r.centimes), periodicite: periodiciteTexte(r.periodicite),
        dernier: f.dernierDebit ? dateLongue(f.dernierDebit) : 'pas encore vu', prochain: f.prochain ? dateLongue(f.prochain) + (f.enRetard ? ' (en retard)' : '') : 'ce mois-ci (date pas encore connue)',
        bientot: ouiNon(f.prochain && f.prochain >= a && f.prochain <= dans7), categorie: nomCat(etat, r.categorie),
        icone: r.categorie ? iconeCategorie(etat, r.categorie) : 'forfait', unite: r.periodicite.unite,
        // Montant « 29,90 » : pas de calcul dans cette case, écrit à la française. (04/11/2026 : ce commentaire était en fin de
        // ligne et cachait « tous les » et le libellé à suivre : la fenêtre les montrait vides, et un nouvel enregistrement les effaçait.)
        'frais-nom': r.nom, 'frais-montant': euros(r.centimes).replace(' €', ''), 'frais-pas': String(r.periodicite.pas), 'frais-libelle': r.libelles[0] ?? '',
      };
    }),
    'par-categorie': [...parCat.entries()].map(([id, g]) => ({ id: id ?? 'a-classer', nom: id ? nomCat(etat, id) : 'Sans catégorie', icone: id ? iconeCategorie(etat, id) : 'forfait', total: euros(g.total), nombre: String(g.nombre) })), // l'écran écrit « {total} / mois » et « {nombre} frais »
  } };
}

function vObjectifs(etat, ui, ctx) {
  const a = ctx.aujourdhui;
  const lignes = lister(etat);
  const e = economieDuMois(etat, a);
  const ceMois = bilanDuMois(etat, moisDe(a), lignes).reste;
  const moisAvecDonnees = [...new Set(lignes.map((l) => moisDe(l.date)))];
  const annee = moisAvecDonnees.filter((m) => m.slice(0, 4) === a.slice(0, 4)).reduce((s, m) => s + bilanDuMois(etat, m, lignes).reste, 0);
  const total = moisAvecDonnees.reduce((s, m) => s + bilanDuMois(etat, m, lignes).reste, 0);
  const base = Math.max(0, e.economie);
  const objectifs = objectifsDe(etat);
  const partTotale = objectifs.reduce((s, o) => s + o.part, 0);
  // Fenêtre Nouvel objectif / Modifier ouverte : ce qui reste à mettre de côté se recalcule pendant qu'on tape la part,
  // Créer / Enregistrer se grisent si elle dépasse, et la durée suit (demande du propriétaire, 03/11/2026).
  const u = ui.objectifs;
  const enCours = u.fenetre === 'objectif' ? objectifs.find((o) => o.id === u.touche) : null;
  const prefixe = u.fenetre === 'nouveau' ? 'nouveau-' : 'objectif-';
  let libreP = 100 - partTotale;
  let dureeSaisie = '';
  let depasse = false;
  if (u.fenetre === 'nouveau' || enCours) {
    const saisies = ctx.saisies ?? {};
    let tape = null;
    try { tape = eurosOuPourcent({ ...ctx, saisies }, prefixe + 'part', prefixe + 'part-pourcent', base).pourcent; } catch { tape = null; }
    libreP = 100 - partTotale + (enCours ? enCours.part : 0) - (tape ?? 0);
    depasse = libreP < -0.05;
    let cible = null;
    try { cible = montant(saisies[prefixe + 'cible']); } catch { cible = null; }
    const partEuros = Math.round((base * (tape ?? 0)) / 100);
    const epargne = enCours ? epargneObjectif(etat, enCours, a, lignes) : 0;
    if (cible && cible > 0 && partEuros > 0) dureeSaisie = cible - epargne <= 0 ? '0 mois (objectif atteint)' : dureeObjectif(cible - epargne, partEuros, a);
  }
  const libreTexte = (Math.round(Math.abs(libreP) * 10) / 10).toString().replace('.', ',');
  return {
    buttonStates: depasse ? { [u.fenetre === 'nouveau' ? 'creer-objectif' : 'enregistrer-objectif']: 'disabled' } : {},
    linkVariables: {
    'economise-mois': enEuros(ceMois), 'economise-mois-negatif': ouiNon(ceMois < 0),
    'economise-annee': enEuros(annee), 'economise-annee-negatif': ouiNon(annee < 0),
    'economise-total': enEuros(total), 'economise-total-negatif': ouiNon(total < 0),
    'entrees-mois': euros(e.entrees) + (e.entreesPrevues ? ' (prévu)' : ''), 'total-prevu': euros(e.prevu), economie: enEuros(e.economie), 'economie-negative': ouiNon(e.economie < 0),
    'economie-nombre': enNombre(base), 'nouveau-epargne-nombre': '0',
    'reparti-pourcent': String(partTotale), reparti: euros(Math.round((base * partTotale) / 100)), 'reparti-complet': ouiNon(partTotale >= 100),
    libre: enEuros(Math.round((base * libreP) / 100)), 'libre-pourcent': (libreP < 0 ? '−' : '') + libreTexte,
    'duree-saisie': dureeSaisie,
    objectifs: objectifs.map((o) => {
      const epargne = epargneObjectif(etat, o, a, lignes);
      const part = Math.round((base * o.part) / 100);
      const restant = o.cibleCentimes - epargne;
      const duree = dureeObjectif(restant, part, a);
      return {
        id: o.id, nom: o.nom, icone: o.icone, epargne: euros(epargne), cible: euros(o.cibleCentimes),
        // L'écran écrit lui-même « {pourcent} % » et « {part-pourcent} % ({part} €) » : nombres seuls ici.
        pourcent: String(Math.min(100, pourcent(epargne, o.cibleCentimes))), date: o.date || '—', 'part-pourcent': String(o.part), part: euros(part).replace(' €', ''),
        duree: restant <= 0 ? '0 mois (objectif atteint)' : part > 0 ? duree : '— (pas de part ce mois-ci)', atteint: ouiNon(restant <= 0),
        'objectif-nom': o.nom, 'objectif-cible': enNombre(o.cibleCentimes), 'objectif-date': o.date, 'objectif-part': enNombre(part),
        'objectif-part-pourcent': String(o.part), 'objectif-epargne-nombre': enNombre(epargne),
        'objectif-mois': restant > 0 && part > 0 ? String(Math.ceil(restant / part)) : '',
      };
    }),
  } };
}

// Jeu de données d'un graphique (même forme que dans Tool Design) ; jamais vide (l'écran exige au moins une catégorie).
function jeu(nom, categories, series) {
  if (!categories.length) categories = ['Aucune donnée'], series = series.map((s) => ({ ...s, valeurs: [0] }));
  return {
    name: nom,
    categories: categories.map((c, i) => ({ id: 'c' + (i + 1), name: String(c).slice(0, 80), parent: null })),
    series: series.map((s) => ({ id: s.id, name: s.name, parent: null, values: Object.fromEntries(s.valeurs.map((v, i) => ['c' + (i + 1), Math.round(v) / 100])) })),
  };
}

function vStatistiques(etat, ui, ctx) {
  const a = ctx.aujourdhui;
  const p = ui.statistiques.periode;
  const b = bornesChoix(p);
  const lignes = lister(etat).filter((l) => !l.supprime && l.sens === 'sortie' && !l.retrait);
  const du = (d, f) => lignes.filter((l) => l.date >= d && l.date <= f);
  const dep = du(b.debut, b.fin);
  const total = dep.reduce((s, l) => s + l.centimes, 0);
  const avant = bornesChoix(decaler(p, -1));
  const totalAvant = du(avant.debut, avant.fin).reduce((s, l) => s + l.centimes, 0);
  const finCompte = b.fin < a ? b.fin : a;
  const jours = finCompte >= b.debut ? nbJours(b.debut, finCompte) : 1;
  const grosse = dep.reduce((m, l) => (!m || l.centimes > m.centimes ? l : m), null);
  const evol = totalAvant ? Math.round(((total - totalAvant) / totalAvant) * 100) : null;
  const parCat = depensesParCategorie(etat, b.debut, b.fin);
  const mois = depensesParPeriode(etat, 'mois', a, 12);
  const ed = entreesDepensesParMois(etat, a, 6);
  // Solde en fin de chaque mois (ou aujourd'hui pour le mois en cours), sur 6 mois.
  const finsDeMois = ed.map((m) => { const f = bornes('mois', m.mois + '-01').fin; return f < a ? f : a; });
  const debut6 = ed[0].mois + '-01';
  const courbe = (compte) => { const pts = evolutionSolde(etat, compte, debut6, a); return finsDeMois.map((d) => pts.find((x) => x.date === d)?.centimes ?? 0); };
  const objectifs = objectifsDe(etat);
  const top = topEmetteurs(etat, b.debut, b.fin, 5);
  return {
    linkVariables: {
      'periode-libelle': b.libelle, 'depense-periode': euros(total), 'moyenne-jour': euros(Math.round(total / jours)),
      'plus-grosse': grosse ? euros(grosse.centimes) : '—', 'nombre-operations': String(dep.length),
      evolution: evol === null ? '—' : (evol > 0 ? '+' : evol < 0 ? '−' : '') + Math.abs(evol) + ' %', 'evolution-sens': evol !== null && evol > 0 ? 'hausse' : 'baisse',
      'depense-categories': euros(total),
    },
    chartData: {
      'graphique-categories': jeu('graphique-categories', parCat.map((c) => c.nom), [{ id: 's1', name: 'Dépenses', valeurs: parCat.map((c) => c.centimes) }]),
      'graphique-mois': jeu('graphique-mois', mois.map((m) => MOIS_COURTS[Number(m.debut.slice(5, 7)) - 1]), [
        { id: 'dans', name: 'Dans le seuil', valeurs: mois.map((m) => (m.seuil === null ? m.depenseSeuil : Math.min(m.depenseSeuil, m.seuil))) },
        { id: 'depasse', name: 'Au-dessus du seuil', valeurs: mois.map((m) => (m.seuil === null ? 0 : Math.max(0, m.depenseSeuil - m.seuil))) },
      ]),
      'graphique-entrees': jeu('graphique-entrees', ed.map((m) => MOIS_COURTS[Number(m.mois.slice(5, 7)) - 1]), [
        { id: 'entrees', name: 'Entrées', valeurs: ed.map((m) => m.entrees) }, { id: 'depenses', name: 'Dépenses', valeurs: ed.map((m) => m.depenses) },
      ]),
      'graphique-solde': jeu('graphique-solde', ed.map((m) => MOIS_COURTS[Number(m.mois.slice(5, 7)) - 1]), [
        { id: 'banque', name: 'Banque', valeurs: courbe('banque') }, { id: 'especes', name: 'Espèces', valeurs: courbe('especes') },
      ]),
      'graphique-objectifs': jeu('graphique-objectifs', objectifs.map((o) => o.nom), [
        { id: 's1', name: 'Atteint', valeurs: objectifs.map((o) => Math.min(100, pourcent(epargneObjectif(etat, o, a), o.cibleCentimes)) * 100) },
      ]),
      'graphique-emetteurs': jeu('graphique-emetteurs', top.map((t) => t.emetteur), [{ id: 's1', name: 'Dépensé', valeurs: top.map((t) => t.centimes) }]),
    },
  };
}

function vSoldes(etat, ui, ctx) {
  const a = ctx.aujourdhui;
  const s = soldes(etat);
  const lignes = lister(etat);
  const dernier = (compte) => { const l = lignes.find((x) => x.compte === compte || (compte === 'especes' && x.alimenteEspeces)); return l ? dateLongue(l.date) : '—'; };
  const debut = ajouterJours(a, -29);
  const pts = evolutionSolde(etat, 'banque', debut, a);
  const vals = pts.map((p) => p.centimes);
  const apres = soldeApresFraisAVenir(etat, a);
  // Mouvements des espèces, avec le solde après chacun (du plus récent au plus ancien).
  const mouvements = lignes.filter((l) => l.comptee && (l.compte === 'especes' || l.alimenteEspeces)).slice(0, 30).map((l) => {
    const entree = l.alimenteEspeces || l.sens === 'entree';
    return { id: l.id, libelle: nomAffiche(l), date: dateLongue(l.date), montant: signe(entree ? l.centimes : -l.centimes), sens: entree ? 'entree' : 'depense', icone: l.alimenteEspeces ? 'retrait' : 'piece', _d: l.date };
  });
  const especes = evolutionSolde(etat, 'especes', mouvements.at(-1)?._d ?? a, a);
  const corrections = correctionsDe(etat).slice().reverse();
  return {
    linkVariables: {
      'solde-banque': s.banque === null ? 'à saisir' : enEuros(s.banque), 'solde-especes': s.especes === null ? 'à saisir' : enEuros(s.especes),
      'dernier-banque': dernier('banque'), 'dernier-especes': dernier('especes'),
      'solde-total': s.banque === null && s.especes === null ? '—' : enEuros((s.banque ?? 0) + (s.especes ?? 0)),
      'solde-apres': apres === null ? '—' : enEuros(apres), synchro: ctx.synchro ?? '',
      'variation-mois': vals.length ? signe(vals.at(-1) - vals[0]) : '—',
      'solde-min': vals.length ? enEuros(Math.min(...vals)) : '—', 'solde-max': vals.length ? enEuros(Math.max(...vals)) : '—',
      'mouvements-especes': mouvements.map(({ _d, ...m }) => ({ ...m, apres: (() => { const p = especes.find((x) => x.date === _d); return p ? euros(p.centimes) : ''; })() })),
      // Paiements CB en attente de prélèvement (bloc sous Mes soldes).
      attentes: attentes(etat).reverse().map((l) => ({ id: l.id, libelle: nomAffiche(l), date: dateLongue(l.date), categorie: nomCat(etat, l.categorie), montant: signe(-l.centimes) })),
      'attente-total': euros(attentes(etat).reduce((t, l) => t + l.centimes, 0)),
      corrections: corrections.map((k) => ({
        id: k.id, compte: k.compte === 'banque' ? 'Banque' : 'Espèces', date: dateLongue(ctx.dateDe(k.ts)),
        ancien: k.ancien === null ? '—' : enEuros(k.ancien), nouveau: enEuros(k.nouveau), ecart: k.ancien === null ? '—' : signe(k.nouveau - k.ancien),
      })),
    },
    // 30 jours, une date écrite par semaine (les autres noms vides), comme dans le dessin.
    chartData: { 'graphique-solde-mois': jeu('graphique-solde-mois', pts.map((p, i) => (i % 7 === 0 ? jourMois(p.date) : '')), [{ id: 'banque', name: 'Banque', valeurs: vals }]) },
  };
}

function vSauvegarde(etat, ui, ctx) {
  const d = ctx.derniereSauvegarde;
  const jours = rappelJours(etat);
  const ecart = d ? Math.floor((ctx.maintenant - d) / 86400000) : null;
  return { linkVariables: {
    'derniere-sauvegarde': d ? (ecart === 0 ? "aujourd'hui" : 'il y a ' + ecart + (ecart > 1 ? ' jours' : ' jour')) + ' (' + dateLongue(ctx.dateDe(d)) + ')' : 'jamais',
    'rappel-depasse': ouiNon(jours !== null && (ecart === null || ecart >= jours)),
    'restauration-annulable': ouiNon(ctx.restaurationAnnulable),
  } };
}

const CHAMPS_REGLE = { libelle: 'dans le libellé', objet: "dans l'objet", tous: "dans le libellé et l'objet" };
function vReglages(etat, ui, ctx) {
  return { linkVariables: {
    synchro: ctx.synchro || 'pas encore faite', 'pont-etat': ctx.pontRegle ? 'connecté' : 'à régler', 'pont-ok': ouiNon(ctx.pontRegle),
    regles: (etat.regles ?? []).map((r) => ({ id: r.id, mot: r.contient, champ: CHAMPS_REGLE[r.champ] ?? r.champ })),
    ignores: libellesIgnores(etat).map((x) => ({ id: x.id, texte: x.texte })),
    // Corbeille (03/11/2026) : les opérations supprimées, à remettre dans la liste ou à supprimer pour de bon.
    corbeille: corbeille(etat).map((l) => ({
      id: l.id, libelle: nomAffiche(l),
      detail: dateLongue(l.date) + ' · ' + (l.sens === 'entree' ? '+' : '−') + euros(l.centimes) + ' · ' + (l.compte === 'banque' ? 'Banque' : 'Espèces'),
    })),
    'corbeille-info': corbeille(etat).length ? 'Remets une opération dans la liste, ou supprime-la pour de bon.' : 'La corbeille est vide.',
    version: ctx.version ?? '',
    // Revenus attendus (03/11/2026) : une ligne par revenu ; le détail dit combien et s'il est déjà arrivé ce mois-ci.
    revenus: revenusDuMois(etat, moisDe(ctx.aujourdhui), lister(etat).filter((l) => !l.supprime && l.sens === 'entree')).map(({ revenu: r, attendu, recu }) => ({
      id: r.id, nom: r.nom,
      detail: (r.unite === 'jour' ? euros(r.centimes) + ' par jour · ' + euros(attendu) + ' ce mois' : euros(r.centimes) + ' par mois') + ' · ' + (recu ? 'arrivé le ' + jourMois(recu.date) : 'attendu'),
      'revenu-nom': r.nom, 'revenu-montant': euros(r.centimes).replace(' €', ''), 'revenu-libelle': r.libelle,
    })),
    'revenus-info': revenus(etat).length ? 'Touche un revenu pour le modifier ou le supprimer.' : 'Aucun revenu : ajoute ton salaire, une prime…',
  } };
}

/**
 * Accueil : « Dernières opérations » fonctionne comme l'Historique d'Opérations (03/11/2026) : chaque ligne porte aussi
 * les champs de la fenêtre de détail (libellé banque, émetteur, objet, compte, catégorie…), et la liste des catégories
 * pour « Changer la catégorie ». La date garde la mention « CB en attente » de l'accueil.
 */
function vAccueil(etat, ui, ctx) {
  const v = valeursAccueil(etat, { ...ui.accueil, aujourdhui: ctx.aujourdhui, synchro: ctx.synchro, rappel: ctx.rappel });
  const parId = new Map(lister(etat).map((l) => [l.id, l]));
  v.linkVariables.operations = v.linkVariables.operations.map((ligne) => ({ ...ligneOperation(etat, parId.get(ligne.id)), date: ligne.date }));
  v.linkVariables['choix-categories'] = etat.categories.map((c) => ({ id: c.id, nom: c.nom, icone: iconeCategorie(etat, c.id) }));
  // Frais récurrents proposés par le bouton « Prélèvement » (11/11/2026).
  v.linkVariables['statut-fiche'] = statutFiche(etat, ui.accueil.touchee);
  v.linkVariables['recurrent-bouton'] = boutonRecurrent(etat, ui.accueil.touchee);
  // La liste de l'écran part du haut et se cale en haut à l'ouverture (11/11/2026, demande du propriétaire) : elle montre les
  // lignes dans l'ordre inverse de la liste reçue, d'où la liste envoyée à l'envers (« Prélèvement unique » en dernier = en haut).
  v.linkVariables['choix-prelevements'] = [{ id: PRELEVEMENT_UNIQUE, nom: 'Prélèvement unique', montant: 'Saisir le montant ›' }, ...etat.recurrents.map((x) => ({ id: x.id, nom: x.nom, montant: enEuros(-x.centimes) }))].reverse();
  return v;
}

const VALEURS = {
  accueil: vAccueil,
  operations: vOperations, categories: vCategories, recurrents: vRecurrents, seuils: vSeuils, objectifs: vObjectifs,
  statistiques: vStatistiques, soldes: vSoldes, sauvegarde: vSauvegarde, reglages: vReglages,
};

export function valeursEcran(page, etat, ui, ctx) {
  const v = VALEURS[page]?.(etat, ui, ctx) ?? {};
  return { linkVariables: v.linkVariables ?? {}, gaugeValues: v.gaugeValues ?? {}, chartData: v.chartData ?? {}, buttonStates: v.buttonStates ?? {}, appPicks: choixCoches(page, etat, ui) };
}

/**
 * Boutons « Choix » à montrer cochés (03/11/2026) : le choix enregistré ou en cours, par nom d'action. L'écran les
 * coche comme au toucher (le bouton reste touchable : re-toucher décoche, l'app revient alors au choix par défaut).
 */
export function choixCoches(page, etat, ui) {
  const per = (p) => 'periode-' + p.type;
  if (page === 'operations') { const u = ui.operations; return [per(u.periode), 'type-' + u.type, 'categorie-' + u.categorie]; }
  if (page === 'statistiques') return [per(ui.statistiques.periode)];
  if (page === 'accueil') return ['mode-' + (ui.accueil.saisieMode ?? 'especes')];
  if (page === 'seuils') return ['alerte-' + niveauAlerte(etat)];
  if (page === 'sauvegarde') return ['rappel-' + (rappelJours(etat) ?? 'jamais'), 'export-periode-' + ui.sauvegarde.exportPeriode];
  if (page === 'reglages') {
    const u = ui.reglages;
    const r = revenus(etat).find((x) => x.id === u.revenu);
    return ['regle-champ-' + (u.champRegle ?? 'tous'), 'nouveau-revenu-unite-' + (u.nouveauUnite ?? 'mois'), 'nouveau-revenu-reperage-' + (u.nouveauReperage ?? 'montant'),
      ...(r ? ['revenu-unite-' + (u.revenuUnite ?? r.unite), 'revenu-reperage-' + (u.revenuReperage ?? r.reperage)] : [])];
  }
  if (page === 'recurrents') {
    const u = ui.recurrents;
    const r = etat.recurrents.find((x) => x.id === u.touche);
    const cat = u.categorie !== undefined ? u.categorie : r?.categorie;
    return [
      ...(r ? ['frais-unite-' + (u.unite ?? r.periodicite.unite), ...(cat ? ['frais-categorie-' + cat] : [])] : []),
      'nouveau-unite-' + (u.nouveauUnite ?? 'mois'), ...(u.nouveauCategorie ? ['nouveau-categorie-' + u.nouveauCategorie] : []),
    ];
  }
  if (page === 'categories') {
    const u = ui.categories;
    return [...(u.touchee ? ['icone-categorie-' + (u.icone ?? iconeCategorie(etat, u.touchee))] : []), ...(u.nouvelleIcone ? ['icone-nouvelle-' + u.nouvelleIcone] : [])];
  }
  if (page === 'objectifs') {
    const u = ui.objectifs;
    const o = objectifsDe(etat).find((x) => x.id === u.touche);
    return [...(o ? ['objectif-icone-' + (u.icone ?? o.icone)] : []), 'nouveau-icone-' + (u.nouvelleIcone ?? 'diamant')];
  }
  return [];
}

/** Choix de départ des écrans. */
export function uiDepart(aujourdhui) {
  return {
    accueil: { periode: 'mois', saisieMode: 'especes', saisieMessage: '', touchee: null },
    operations: { periode: periodeDefaut(aujourdhui), type: 'tout', categorie: 'toutes', touchee: null },
    statistiques: { periode: periodeDefaut(aujourdhui) },
    seuils: { categorie: null },
    categories: { touchee: null, icone: null, emetteur: null, nouvelleIcone: null },
    recurrents: { touche: null, categorie: undefined, unite: undefined, nouveauCategorie: null, nouveauUnite: 'mois' },
    objectifs: { touche: null, icone: null, nouvelleIcone: 'diamant', fenetre: null },
    soldes: { compte: 'banque' },
    sauvegarde: { exportPeriode: 'tout' },
    reglages: { champRegle: 'tous', revenu: null, revenuUnite: undefined, revenuReperage: undefined, nouveauUnite: 'mois', nouveauReperage: 'montant' },
  };
}

/**
 * Texte de départ des cases d'une fenêtre ouverte en touchant une ligne (l'écran les remplit lui-même avec la ligne ;
 * l'app retient la même chose, car elle ne reçoit que ce qui est tapé ensuite).
 */
/**
 * Page ouverte par le menu (pas par un saut de l'app) : une vue d'une catégorie ouverte depuis Catégories ne reste pas
 * collée à Opérations, qui revient à ses choix de départ (mois, tout, toutes les catégories, plus récent en bas).
 */
export function uiPageOuverte(page, ui, aujourdhui) {
  if (page === 'operations' && ui.operations.depuisCategorie) return { ...ui, operations: uiDepart(aujourdhui).operations };
  return ui;
}

export function casesDeLaLigne(page, etat, ui, id, ctx) {
  const v = valeursEcran(page, etat, ui, ctx).linkVariables;
  const listes = { reglages: 'revenus', seuils: 'seuils-categories', categories: 'categories', recurrents: 'recurrents', objectifs: 'objectifs', operations: 'operations', accueil: 'operations' };
  const ligne = [...(v[listes[page]] ?? []), ...(page === 'operations' ? v['operations-recentes'] : [])].find((l) => l.id === id);
  if (!ligne) return {};
  if (page === 'categories') return { nom: ligne.nom };
  return Object.fromEntries(Object.entries(ligne).filter(([k]) => /^(seuil-categorie|frais-|objectif-|modif-|revenu-)/.test(k)));
}

// =====================================================================================================================
// Actions des boutons
// =====================================================================================================================

const avec = (ui, page, champs) => ({ ...ui, [page]: { ...ui[page], ...champs } });
const PREFIXE_CATEGORIE = (action, prefixe) => (action.startsWith(prefixe) ? action.slice(prefixe.length) : null);

/** Choix d'une case parmi deux reliées (euros ↔ %) : celle tapée en dernier fait foi. */
function eurosOuPourcent(ctx, nomEuros, nomPourcent, base) {
  const pct = ctx.saisies[nomPourcent];
  if (ctx.dernier === nomPourcent && pct !== undefined && String(pct).trim() !== '') {
    const p = Number(String(pct).replace(',', '.'));
    if (!Number.isFinite(p) || p < 0) throw new Error('Pourcentage illisible.');
    return { centimes: Math.round((base * p) / 100), pourcent: p };
  }
  const c = montant(ctx.saisies[nomEuros]);
  return { centimes: c, pourcent: c === null || !base ? null : Math.round((c * 1000) / base) / 10 };
}

/**
 * Fenêtre « Modifier l'opération » (Opérations et accueil) : description (ce qui s'affiche ; vide = le libellé de la
 * banque), montant, date. Le libellé de la banque n'est jamais changé.
 */
function modifierDepuisFenetre(etat, id, ctx) {
  const l = lister(etat).find((x) => x.id === id);
  if (!l) throw new Error('Opération introuvable.');
  const description = String(ctx.saisies['modif-description'] ?? nomAffiche(l)).trim();
  const c = montant(ctx.saisies['modif-montant'] ?? enEuros(l.centimes).replace(' €', ''));
  if (!c || c <= 0) throw new Error('Tape le montant (exemple : 12,50).');
  const date = lireDate(ctx.saisies['modif-date'] ?? l.date.slice(8, 10) + '/' + l.date.slice(5, 7) + '/' + l.date.slice(0, 4));
  // Seuls les champs changés sont écrits (une ligne de la banque garde son original à côté).
  const champs = {
    ...(c !== l.centimes && { centimes: c }), ...(date !== l.date && { date }),
    ...(description !== nomAffiche(l) && { description: description === l.libelle ? '' : description }),
  };
  if (!Object.keys(champs).length) return { message: 'Rien n’a changé.' };
  return { etat: modifier(etat, id, champs), message: 'Opération modifiée.' };
}

function aOperations(etat, ui, action, ctx) {
  const u = ui.operations;
  const p = choisirPeriode(u.periode, action, ctx);
  if (p) return { ui: avec(ui, 'operations', { periode: p }) };
  if (action === 'operation-touchee') return { ui: avec(ui, 'operations', { touchee: ctx.valeurs.id }) };
  const types = { 'type-tout': 'tout', 'type-depenses': 'depenses', 'type-entrees': 'entrees', 'type-especes': 'especes' };
  if (types[action]) return { ui: avec(ui, 'operations', { type: u.type === types[action] ? 'tout' : types[action] }) };
  const cat = action === 'categorie-choisie' ? null : PREFIXE_CATEGORIE(action, 'categorie-'); // « categorie-choisie » : choix de la fenêtre, pas un filtre
  if (cat) { const c = cat === 'toutes' ? 'toutes' : cat; return { ui: avec(ui, 'operations', { categorie: u.categorie === c ? 'toutes' : c }) }; }
  const id = u.touchee;
  // Une question au style de l'app (03/11/2026, choix du propriétaire), puis la ligne va dans la corbeille (Réglages) et
  // le message propose encore « Annuler » quelques secondes. vider : la fenêtre de la ligne se ferme.
  if (action === 'supprimer-operation' && id) return { etat: supprimerLigne(etat, id, ctx.maintenant), ui: avec(ui, 'operations', { touchee: null }), message: 'Opération supprimée.', annuler: { action: 'annuler-suppression', id }, confirmer: 'Supprimer cette opération ? Tu la retrouveras dans la corbeille (Réglages).', confirmerOui: 'Supprimer', vider: [] };
  if (action === 'rendre-recurrent' && id) {
    const l = lister(etat).find((x) => x.id === id);
    if (!l || l.sens !== 'sortie') throw new Error('Seule une dépense peut devenir un frais récurrent.');
    if (l.recurrentId) {
      // « Pas récurrent » (11/11/2026) : la ligne quitte son frais (null : la reconnaissance par libellé ne la reprend pas) et
      // recompte dans le seuil ; le frais est supprimé s'il n'a plus aucune ligne (créé par erreur, par exemple).
      const frais = etat.recurrents.find((x) => x.id === l.recurrentId);
      let e = lierLigne(etat, id, null);
      const autres = e.operations.some((o) => !e.ajouts[o.id]?.supprime && recurrentDe(e, o) === l.recurrentId);
      if (frais && !autres) e = supprimerRecurrent(e, frais.id);
      const nom = frais ? frais.nom : nomAffiche(l);
      return { etat: e, message: nomAffiche(l) + ' : plus récurrent' + (frais && !autres ? ' (frais « ' + nom + ' » supprimé, il n\'avait plus de ligne)' : ' (le frais « ' + nom + ' » reste pour ses autres lignes)') + '. Elle compte de nouveau dans le seuil.' };
    }
    const r = creerDepuisLigne(etat, id, { nom: nomAffiche(l), categorie: l.categorie ?? null });
    // Lien posé à la main : il prime sur un ancien « pas récurrent » de cette ligne.
    return { etat: lierLigne(r.etat, id, r.id), message: 'Frais récurrent créé : ' + (nomAffiche(l)) + ' (page Frais récurrents pour le régler). Il ne compte plus dans le seuil.' };
  }
  // Bouton Catégorie du détail : l'écran ouvre la fenêtre « Changer la catégorie » ; la catégorie touchée arrive ici.
  if (action === 'changer-categorie') return {};
  if (action === 'categorie-choisie' && id) {
    const l = lister(etat).find((x) => x.id === id);
    if (!l || l.sens !== 'sortie' || l.retrait) throw new Error('Seule une dépense a une catégorie.');
    const c = ctx.valeurs.id;
    if (!etat.categories.some((x) => x.id === c)) throw new Error('Catégorie introuvable.');
    return { etat: modifier(etat, id, { categorie: c }), message: (nomAffiche(l)) + ' → ' + nomCat(etat, c) };
  }
  if (action === 'basculer-statut' && id) {
    const l = lister(etat).find((x) => x.id === id);
    if (!l || !estCbAMain(l)) throw new Error('Seule une dépense banque saisie à la main a un statut.');
    // CB en attente → CB prélevée → Prélèvement → CB en attente. La fiche reste ouverte (11/11/2026, demande du propriétaire).
    const suivant = { attente: 'preleve', preleve: 'prelevement', prelevement: 'attente' }[statutDe(l)];
    let e = modifier(etat, id, { preleve: suivant !== 'attente', prelevement: suivant === 'prelevement' });
    let frais = '';
    if (suivant === 'prelevement') {
      // Prélèvement : lié au frais récurrent du même montant s'il est connu (ex. un abonnement déjà déclaré).
      const r = recurrentPourPrelevement(e, { centimes: l.centimes, libelle: nomAffiche(l) });
      if (r) {
        e = lierLigne(e, id, r);
        frais = ' (frais récurrent « ' + e.recurrents.find((x) => x.id === r).nom + ' »)';
      }
    } else if (l.prelevement && etat.ajouts[id] && 'recurrentId' in etat.ajouts[id]) {
      // Plus un prélèvement : le lien posé avec lui est retiré (retour à la reconnaissance habituelle).
      const { recurrentId: _lien, ...reste } = e.ajouts[id];
      e = { ...e, ajouts: { ...e.ajouts, [id]: reste } };
    }
    return { etat: e, message: nomAffiche(l) + ' : ' + STATUTS[suivant] + frais + '.' };
  }
  if (action === 'modifier-operation') return {}; // l'écran ouvre la fenêtre « Modifier l'opération »
  if (action === 'enregistrer-modification' && id) return modifierDepuisFenetre(etat, id, ctx);
  return null;
}

const ACTIONS_LIGNE = ['changer-categorie', 'categorie-choisie', 'modifier-operation', 'enregistrer-modification', 'rendre-recurrent', 'supprimer-operation', 'basculer-statut'];
function aAccueil(etat, ui, action, ctx) {
  const u = ui.accueil;
  // Toucher une ligne ouvre la fenêtre de détail d'Opérations : mêmes boutons, mêmes effets (03/11/2026).
  if (action === 'operation-touchee') return { ui: avec(ui, 'accueil', { touchee: ctx.valeurs.id }) };
  if (ACTIONS_LIGNE.includes(action)) {
    const r = aOperations(etat, avec(ui, 'operations', { touchee: u.touchee }), action, ctx);
    return r && { ...r, ui: avec(ui, 'accueil', { touchee: r.ui ? r.ui.operations.touchee : u.touchee }) };
  }
  if (action === 'corriger-banque' || action === 'corriger-especes' || action === 'enregistrer-correction') {
    const r = aSoldes(etat, avec(ui, 'soldes', { compte: u.compte ?? 'banque' }), action, ctx);
    return r && { ...r, ui: r.ui ? avec(ui, 'accueil', { compte: r.ui.soldes.compte }) : ui };
  }
  if (action === 'basculer-banque') return { ui: avec(ui, 'accueil', { saisieMode: u.saisieMode === 'attente' ? 'especes' : 'attente' }) };
  const modes = { 'mode-especes': 'especes', 'mode-attente': 'attente', 'mode-preleve': 'preleve', 'mode-prelevement': 'prelevement' };
  // Prélèvement choisi dans la liste des frais récurrents (fenêtre du bouton « Prélèvement »).
  // « Prélèvement unique » (en haut de la liste ; pas un frais récurrent) : la fenêtre se ferme, le mode Prélèvement reste, on
  // tape montant et description puis Ajouter.
  if (action === 'prelevement-autre' || (action === 'prelevement-choisi' && ctx.valeurs.id === PRELEVEMENT_UNIQUE)) return { ui: avec(ui, 'accueil', { saisieMode: 'prelevement', saisieMessage: 'Prélèvement non récurrent : tape le montant et la description, puis Ajouter.' }) };
  if (action === 'prelevement-choisi') {
    const r = ajouterPrelevementRecurrent(etat, ctx.valeurs.id, { maintenant: ctx.maintenant, aujourdhui: ctx.aujourdhui });
    return { etat: r.etat, ui: avec(ui, 'accueil', { saisieMessage: r.message, saisieMode: 'especes' }) };
  }
  if (modes[action]) return { ui: avec(ui, 'accueil', { saisieMode: modes[action] }) };
  if (action === 'changer-periode') return { ui: avec(ui, 'accueil', { periode: periodeSuivante(u.periode) }) };
  if (action === 'ajouter-depense') {
    const r = ajouterDepense(etat, ctx.saisies, { mode: u.saisieMode ?? 'especes', maintenant: ctx.maintenant, aujourdhui: ctx.aujourdhui });
    return { etat: r.etat, ui: avec(ui, 'accueil', { saisieMessage: r.message, ...(r.vider && { saisieMode: 'especes' }) }), vider: r.vider ? ['saisie-montant', 'saisie-description'] : null, erreurCase: r.erreur };
  }
  return null;
}

function aSeuils(etat, ui, action, ctx) {
  if (action === 'enregistrer-seuil') {
    const c = montant(ctx.saisies['seuil-montant'], 'seuil');
    if (c === null || c <= 0) throw new Error('Tape le seuil du mois (exemple : 2500).');
    return { etat: definirSeuilMois(etat, c), message: 'Seuil du mois : ' + euros(c), vider: ['seuil-montant'] };
  }
  const n = { 'alerte-70': 70, 'alerte-80': 80, 'alerte-90': 90 }[action];
  if (n) return { etat: definirAlerte(etat, n), message: 'Avertissement à ' + n + ' % du seuil.' };
  if (action === 'categorie-touchee') return { ui: avec(ui, 'seuils', { categorie: ctx.valeurs.id }) };
  const id = ui.seuils.categorie;
  if (action === 'enregistrer-seuil-categorie' && id) {
    if (id === 'a-classer') throw new Error('Classe d\'abord ces dépenses dans une catégorie.');
    const { centimes } = eurosOuPourcent(ctx, 'seuil-categorie', 'seuil-categorie-pourcent', etat.seuils.moisCentimes ?? 0);
    return { etat: definirSeuilCategorie(etat, id, centimes), message: centimes === null ? 'Seuil retiré.' : 'Seuil de ' + nomCat(etat, id) + ' : ' + euros(centimes) };
  }
  if (action === 'retirer-seuil-categorie' && id && id !== 'a-classer') return { etat: definirSeuilCategorie(etat, id, null), message: 'Seuil de ' + nomCat(etat, id) + ' retiré.' };
  return null;
}

function aCategories(etat, ui, action, ctx) {
  const u = ui.categories;
  if (action === 'classer') {
    const l = lister(etat).find((x) => x.id === ctx.valeurs.id);
    if (!l) throw new Error('Opération introuvable.');
    const e = classerEmetteur(modifier(etat, l.id, { categorie: ctx.valeurs.categorie }), l.libelle, ctx.valeurs.categorie);
    return { etat: e, message: (nomAffiche(l)) + ' → ' + nomCat(e, ctx.valeurs.categorie) + ' (retenu pour la suite)' };
  }
  if (/^classer-/.test(action)) return {}; // le bouton envoie aussi « classer » avec la ligne : c'est lui qui compte
  if (action === 'categorie-touchee') return { ui: avec(ui, 'categories', { touchee: ctx.valeurs.id, icone: null }) };
  // Toucher une catégorie (demande du propriétaire, 03/11/2026 : « je clique Abonnement, je vois toutes les dépenses
  // Abonnement ») : Opérations s'ouvre sur cette catégorie, depuis le début. Le bouton « Modifier » de la ligne ouvre la fenêtre.
  if (action === 'voir-categorie') {
    const c = ctx.valeurs.id;
    if (c === ENTREES) return { ui: avec(ui, 'operations', { categorie: 'toutes', type: 'entrees', periode: { type: 'tout', repere: ctx.aujourdhui }, touchee: null, depuisCategorie: true }), aller: 'operations' };
    if (!etat.categories.some((x) => x.id === c)) throw new Error('Catégorie introuvable.');
    return { ui: avec(ui, 'operations', { categorie: c, type: 'tout', periode: { type: 'tout', repere: ctx.aujourdhui }, touchee: null, depuisCategorie: true }), aller: 'operations' };
  }
  const ic = PREFIXE_CATEGORIE(action, 'icone-categorie-');
  if (ic) return { ui: avec(ui, 'categories', { icone: u.icone === ic ? null : ic }) };
  const icn = PREFIXE_CATEGORIE(action, 'icone-nouvelle-');
  if (icn) return { ui: avec(ui, 'categories', { nouvelleIcone: u.nouvelleIcone === icn ? null : icn }) };
  if (action === 'enregistrer-categorie' && u.touchee) {
    const nom = String(ctx.saisies.nom ?? '').trim();
    if (!nom) throw new Error('Le nom de la catégorie est vide.');
    if (u.touchee === ENTREES) return { etat: modifierEntrees(etat, { nom, ...(u.icone && { logo: u.icone }) }), message: 'Catégorie enregistrée.' };
    return { etat: modifierCategorie(etat, u.touchee, { nom, ...(u.icone && { logo: u.icone }) }), message: 'Catégorie enregistrée.' };
  }
  if (action === 'supprimer-categorie' && u.touchee === ENTREES) throw new Error('« ' + nomEntrees(etat) + ' » ne se supprime pas (son nom et son logo se changent).');
  if (action === 'supprimer-categorie' && u.touchee) return { etat: supprimerCategorie(etat, u.touchee), ui: avec(ui, 'categories', { touchee: null }), message: 'Catégorie supprimée : ses dépenses repassent « à classer ».' };
  if (action === 'creer-categorie') {
    const nom = String(ctx.saisies['nouvelle-nom'] ?? '').trim();
    if (!nom) throw new Error('Donne un nom à la nouvelle catégorie.');
    const r = ajouterCategorie(etat, nom, u.nouvelleIcone ?? 'autre');
    return { etat: r.etat, ui: avec(ui, 'categories', { nouvelleIcone: null }), message: 'Catégorie créée : ' + nom, vider: ['nouvelle-nom'] };
  }
  if (action === 'emetteur-touche') return { ui: avec(ui, 'categories', { emetteur: ctx.valeurs.id }) };
  const vers = PREFIXE_CATEGORIE(action, 'emetteur-vers-');
  if (vers && u.emetteur) return { etat: classerEmetteur(etat, u.emetteur, vers), message: 'Émetteur rangé dans ' + nomCat(etat, vers) + '.' };
  if (action === 'oublier-emetteur' && u.emetteur) return { etat: oublierEmetteur(etat, u.emetteur), ui: avec(ui, 'categories', { emetteur: null }), message: 'Émetteur oublié : ses dépenses repassent « à classer ».' };
  return null;
}

function aRecurrents(etat, ui, action, ctx) {
  const u = ui.recurrents;
  if (action === 'ajouter-suggestion' && ctx.valeurs?.id) {
    const s = suggestionsFrais(etat).find((x) => x.id === ctx.valeurs.id);
    if (!s) throw new Error('Suggestion introuvable.');
    const l = lister(etat).find((x) => normaliserLibelle(x.libelle) === s.id);
    const r = ajouterRecurrent(etat, { nom: s.libelle, centimes: s.centimes, categorie: l?.categorie ?? null, libelles: [s.libelle], periodicite: { unite: s.unite, pas: s.pas } });
    return { etat: r.etat, message: 'Frais récurrent ajouté : ' + s.libelle };
  }
  if (action === 'ignorer-suggestion' && ctx.valeurs?.id) return { etat: ignorerSuggestion(etat, ctx.valeurs.id), message: 'Suggestion ignorée.' };
  if (action === 'ajouter-suggestion' || action === 'ignorer-suggestion') return {}; // le bouton : l'envoi avec la ligne suit
  if (action === 'frais-touche') return { ui: avec(ui, 'recurrents', { touche: ctx.valeurs.id, categorie: undefined, unite: undefined }) };
  const fc = PREFIXE_CATEGORIE(action, 'frais-categorie-');
  if (fc) return { ui: avec(ui, 'recurrents', { categorie: u.categorie === fc ? null : fc }) };
  const nc = PREFIXE_CATEGORIE(action, 'nouveau-categorie-');
  if (nc) return { ui: avec(ui, 'recurrents', { nouveauCategorie: u.nouveauCategorie === nc ? null : nc }) };
  if (action === 'frais-unite-mois' || action === 'frais-unite-semaines') return { ui: avec(ui, 'recurrents', { unite: action.endsWith('mois') ? 'mois' : 'semaines' }) };
  if (action === 'nouveau-unite-mois' || action === 'nouveau-unite-semaines') return { ui: avec(ui, 'recurrents', { nouveauUnite: action.endsWith('mois') ? 'mois' : 'semaines' }) };
  const lire = (prefixe, unite) => {
    const nom = String(ctx.saisies[prefixe + 'nom'] ?? '').trim();
    const centimes = montant(ctx.saisies[prefixe + 'montant']);
    const pas = Number(String(ctx.saisies[prefixe + 'pas'] ?? '1').replace(',', '.')) || 1;
    if (!nom) throw new Error('Donne un nom au frais.');
    if (!centimes || centimes <= 0) throw new Error('Tape le montant du frais (exemple : 12,99).');
    const libelle = String(ctx.saisies[prefixe + 'libelle'] ?? '').trim();
    return { nom, centimes, periodicite: { unite, pas: Math.max(1, Math.round(pas)) }, libelles: libelle ? [libelle] : [] };
  };
  if (action === 'enregistrer-frais' && u.touche) {
    const r = etat.recurrents.find((x) => x.id === u.touche);
    const champs = lire('frais-', u.unite ?? r.periodicite.unite);
    return { etat: modifierRecurrent(etat, u.touche, { ...champs, ...(u.categorie !== undefined && { categorie: u.categorie }) }), message: 'Frais enregistré.' };
  }
  if (action === 'supprimer-frais' && u.touche) return { etat: supprimerRecurrent(etat, u.touche), ui: avec(ui, 'recurrents', { touche: null }), message: 'Frais supprimé.' };
  if (action === 'creer-frais') {
    const r = ajouterRecurrent(etat, { ...lire('nouveau-', u.nouveauUnite ?? 'mois'), categorie: u.nouveauCategorie ?? null });
    return { etat: r.etat, ui: avec(ui, 'recurrents', { nouveauCategorie: null, nouveauUnite: 'mois' }), message: 'Frais récurrent ajouté.', vider: ['nouveau-nom', 'nouveau-montant', 'nouveau-pas', 'nouveau-libelle'] };
  }
  return null;
}

function aObjectifs(etat, ui, action, ctx) {
  const u = ui.objectifs;
  const base = Math.max(0, economieDuMois(etat, ctx.aujourdhui).economie);
  if (action === 'objectif-touche') return { ui: avec(ui, 'objectifs', { touche: ctx.valeurs.id, icone: null, fenetre: 'objectif' }) };
  if (action === 'nouvel-objectif') return { ui: avec(ui, 'objectifs', { fenetre: 'nouveau' }) };
  if (action === 'fermer-objectif' || action === 'fermer-nouvel-objectif') return { ui: avec(ui, 'objectifs', { fenetre: null }) };
  const io = PREFIXE_CATEGORIE(action, 'objectif-icone-');
  if (io) return { ui: avec(ui, 'objectifs', { icone: io }) };
  const ino = PREFIXE_CATEGORIE(action, 'nouveau-icone-');
  if (ino) return { ui: avec(ui, 'objectifs', { nouvelleIcone: ino }) };
  const lire = (prefixe) => {
    const nom = String(ctx.saisies[prefixe + 'nom'] ?? '').trim();
    const cible = montant(ctx.saisies[prefixe + 'cible'], 'montant visé');
    if (!cible || cible <= 0) throw new Error('Tape le montant visé (exemple : 500).');
    const { pourcent: p } = eurosOuPourcent(ctx, prefixe + 'part', prefixe + 'part-pourcent', base);
    return { nom, cibleCentimes: cible, date: String(ctx.saisies[prefixe + 'date'] ?? '').trim(), part: Math.min(100, Math.max(0, p ?? 0)) };
  };
  if (action === 'enregistrer-objectif' && u.touche) return { etat: modifierObjectif(etat, u.touche, { ...lire('objectif-'), ...(u.icone && { icone: u.icone }) }, ctx.aujourdhui), ui: avec(ui, 'objectifs', { fenetre: null }), message: 'Objectif enregistré (une nouvelle part compte à partir de ce mois-ci).' };
  if (action === 'supprimer-objectif' && u.touche) return { etat: supprimerObjectif(etat, u.touche), ui: avec(ui, 'objectifs', { touche: null, fenetre: null }), message: 'Objectif supprimé.' };
  if (action === 'creer-objectif') {
    const r = ajouterObjectif(etat, { ...lire('nouveau-'), icone: u.nouvelleIcone ?? 'diamant' }, ctx.aujourdhui);
    return { etat: r.etat, ui: avec(ui, 'objectifs', { nouvelleIcone: 'diamant', fenetre: null }), message: 'Objectif créé.', vider: ['nouveau-nom', 'nouveau-cible', 'nouveau-date', 'nouveau-part', 'nouveau-part-pourcent'] };
  }
  return null;
}

function aStatistiques(etat, ui, action, ctx) {
  const p = choisirPeriode(ui.statistiques.periode, action, ctx);
  return p ? { ui: avec(ui, 'statistiques', { periode: p }) } : null;
}

function aSoldes(etat, ui, action, ctx) {
  if (action === 'corriger-banque' || action === 'corriger-especes') return { ui: avec(ui, 'soldes', { compte: action.endsWith('banque') ? 'banque' : 'especes' }), oublier: ['nouveau-solde'] };
  if (action === 'enregistrer-correction') {
    const c = montant(ctx.saisies['nouveau-solde'], 'solde');
    if (c === null) throw new Error('Tape le solde exact (exemple : 1 250,40).');
    const compte = ui.soldes.compte;
    return { etat: corrigerSolde(etat, compte, c, ctx.maintenant), message: (compte === 'banque' ? 'Banque' : 'Espèces') + ' : solde corrigé à ' + enEuros(c) + '.' };
  }
  return null;
}

function aSauvegarde(etat, ui, action, ctx) {
  const r = { 'rappel-3': 3, 'rappel-7': 7, 'rappel-14': 14, 'rappel-30': 30, 'rappel-jamais': null };
  if (action in r) return { etat: definirRappel(etat, r[action]), message: r[action] === null ? 'Plus de rappel de sauvegarde.' : 'Rappel tous les ' + r[action] + ' jours.' };
  const per = { 'export-periode-tout': 'tout', 'export-periode-annee': 'annee', 'export-periode-mois': 'mois' }[action];
  if (per) return { ui: avec(ui, 'sauvegarde', { exportPeriode: ui.sauvegarde.exportPeriode === per ? 'tout' : per }) };
  if (action === 'sauvegarder') return { effet: { type: 'sauvegarder' } };
  if (action === 'restaurer') return { effet: { type: 'restaurer' } };
  if (action === 'annuler-restauration') return { effet: { type: 'annuler-restauration' } };
  if (action === 'exporter-xlsx' || action === 'exporter-csv') return { effet: { type: 'exporter', format: action.slice(10), periode: ui.sauvegarde.exportPeriode } };
  return null;
}

function aReglages(etat, ui, action, ctx) {
  if (action === 'corbeille-remettre' && ctx.valeurs?.id) return { etat: remettre(etat, ctx.valeurs.id), message: 'Opération remise dans la liste.' };
  // Chaque suppression de Réglages demande d'abord (03/11/2026, demande du propriétaire : « pas supprimé en un clic »).
  if (action === 'corbeille-supprimer' && ctx.valeurs?.id) return { etat: supprimerDefinitivement(etat, ctx.valeurs.id), message: 'Supprimée pour de bon.', confirmer: 'Supprimer cette opération pour de bon ? Elle ne pourra plus être remise.', confirmerOui: 'Supprimer' };
  if (action === 'synchroniser') return { effet: { type: 'synchroniser' } };
  if (action === 'enregistrer-pont') return { effet: { type: 'pont', url: String(ctx.saisies['pont-adresse'] ?? '').trim(), cle: String(ctx.saisies['pont-cle'] ?? '').trim() }, vider: ['pont-cle'] };
  const champ = { 'regle-champ-libelle': 'libelle', 'regle-champ-objet': 'objet', 'regle-champ-tous': 'tous' }[action];
  if (champ) return { ui: avec(ui, 'reglages', { champRegle: champ }) };
  if (action === 'enregistrer-regle') {
    const r = ajouterRegle(etat, { contient: ctx.saisies['regle-mot'], champ: ui.reglages.champRegle ?? 'tous' });
    return { etat: r.etat, message: 'Règle ajoutée : ces dépenses deviennent des retraits.', vider: ['regle-mot'] };
  }
  if (action === 'supprimer-regle' && ctx.valeurs?.id) return { etat: supprimerRegle(etat, ctx.valeurs.id), message: 'Règle supprimée.', confirmer: 'Supprimer cette règle automatique ?', confirmerOui: 'Supprimer' };
  if (action === 'enregistrer-ignore') {
    const e = ajouterIgnore(etat, ctx.saisies['ignore-texte']);
    const n = Object.values(e.ajouts).filter((a) => a.ignorePar === e.libellesIgnores.at(-1).id).length;
    return { etat: e, message: 'Libellé ignoré aux prochaines synchros' + (n ? ' ; ' + n + ' opération(s) déjà là ne compte(nt) plus.' : '.'), vider: ['ignore-texte'] };
  }
  if (action === 'supprimer-ignore' && ctx.valeurs?.id) return { etat: supprimerIgnore(etat, ctx.valeurs.id), message: 'Libellé retiré de la liste.', confirmer: 'Retirer ce libellé de la liste ? Ses mails compteront de nouveau.', confirmerOui: 'Retirer' };
  if (action === 'supprimer-regle' || action === 'supprimer-ignore') return {}; // le bouton : l'envoi avec la ligne suit
  // Revenus attendus : fenêtre « Nouveau revenu » (nouveau-revenu-…) et fenêtre d'un revenu touché (revenu-…), comme les
  // frais récurrents. Par mois / par jour ; repéré au montant, au mot du virement, ou aux deux.
  const u = ui.reglages;
  if (action === 'revenu-touche') return { ui: avec(ui, 'reglages', { revenu: ctx.valeurs.id, revenuUnite: undefined, revenuReperage: undefined }) };
  for (const [prefixe, champ, valeurs] of [['revenu-unite-', 'revenuUnite', ['mois', 'jour']], ['revenu-reperage-', 'revenuReperage', ['montant', 'libelle', 'les-deux']], ['nouveau-revenu-unite-', 'nouveauUnite', ['mois', 'jour']], ['nouveau-revenu-reperage-', 'nouveauReperage', ['montant', 'libelle', 'les-deux']]]) {
    const v = PREFIXE_CATEGORIE(action, prefixe);
    if (v && valeurs.includes(v)) return { ui: avec(ui, 'reglages', { [champ]: v }) };
  }
  const lireRevenu = (prefixe) => ({
    nom: ctx.saisies[prefixe + 'nom'], libelle: ctx.saisies[prefixe + 'libelle'],
    centimes: montant(ctx.saisies[prefixe + 'montant']) ?? undefined,
  });
  if (action === 'creer-revenu') {
    const r = ajouterRevenu(etat, { ...lireRevenu('nouveau-revenu-'), unite: u.nouveauUnite ?? 'mois', reperage: u.nouveauReperage ?? 'montant' });
    return { etat: r.etat, ui: avec(ui, 'reglages', { nouveauUnite: 'mois', nouveauReperage: 'montant' }), message: 'Revenu ajouté.', vider: ['nouveau-revenu-nom', 'nouveau-revenu-montant', 'nouveau-revenu-libelle'] };
  }
  if (action === 'enregistrer-revenu' && u.revenu) {
    const champs = lireRevenu('revenu-');
    return { etat: modifierRevenu(etat, u.revenu, { ...champs, ...(u.revenuUnite && { unite: u.revenuUnite }), ...(u.revenuReperage && { reperage: u.revenuReperage }) }), message: 'Revenu enregistré.', vider: [] };
  }
  if (action === 'supprimer-revenu' && u.revenu) return { etat: supprimerRevenu(etat, u.revenu), ui: avec(ui, 'reglages', { revenu: null }), message: 'Revenu supprimé.', confirmer: 'Supprimer ce revenu attendu ?', confirmerOui: 'Supprimer', vider: [] };
  if (action === 'verrouiller') return { effet: { type: 'verrouiller' } };
  if (action === 'changer-mot-de-passe') return { effet: { type: 'changer-mot-de-passe' } };
  return null;
}

const ACTIONS = {
  accueil: aAccueil, operations: aOperations, categories: aCategories, recurrents: aRecurrents, seuils: aSeuils,
  objectifs: aObjectifs, statistiques: aStatistiques, soldes: aSoldes, sauvegarde: aSauvegarde, reglages: aReglages,
};

/**
 * Bouton touché (ou ligne touchée : ctx.valeurs). Rend { etat, ui, message?, effet?, vider?, oublier?, erreurCase?,
 * confirmer? (question à poser avant d'appliquer), aller? (page à ouvrir) } ; une action que l'app n'a pas à traiter (fermer une fenêtre, ouvrir une confirmation…) rend null.
 * Une erreur de saisie est rendue comme message (erreur: true), sans rien changer.
 */
export function agir(page, etat, ui, action, ctx) {
  try {
    // « Annuler » du message après une suppression : depuis n'importe quel écran.
    const r = action === 'annuler-suppression' && ctx?.valeurs?.id
      ? { etat: remettre(etat, ctx.valeurs.id), message: 'Suppression annulée.' }
      : ACTIONS[page]?.(etat, ui, action, { saisies: {}, ...ctx });
    if (!r) return null;
    return { etat: r.etat ?? etat, ui: r.ui ?? ui, message: r.message ?? null, annuler: r.annuler ?? null, effet: r.effet ?? null, vider: r.vider ?? null, oublier: r.oublier ?? null, erreurCase: r.erreurCase ?? null, confirmer: r.confirmer ?? null, confirmerOui: r.confirmerOui ?? null, aller: r.aller ?? null, erreur: false };
  } catch (e) {
    return { etat, ui, message: e.message, effet: null, vider: null, oublier: null, erreurCase: null, confirmer: null, confirmerOui: null, aller: null, erreur: true };
  }
}
