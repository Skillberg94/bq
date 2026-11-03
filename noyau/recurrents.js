// Frais récurrents : déclarés par le propriétaire (nom, montant, périodicité, libellé de la banque).
// Ils sont distincts du seuil : un débit reconnu comme récurrent n'est PAS compté dans « ce que je peux dépenser ».
// Rien n'est retiré du solde à l'avance : le solde ne baisse qu'au vrai débit (mail), comme toute dépense.
//
// Les dates de prélèvement sont souvent inconnues et certains frais reviennent toutes les 4 semaines (pas au mois) :
// il n'y a donc pas de « payé ou non ». L'app retient le DERNIER DÉBIT VU et estime le PROCHAIN.
//
// État : recurrents: [{ id, nom, centimes, categorie, libelles: [libellés de banque normalisés],
//          periodicite: { unite: 'mois'|'semaines', pas: entier ≥ 1, jour?: 1-31 (mois), reference?: 'AAAA-MM-JJ' (date connue d'un prélèvement) } }]

import { effective, soldes } from './soldes.js?v=37dffcf5cbd6';
import { normaliserLibelle } from './libelles.js?v=37dffcf5cbd6';

const pad = (n) => String(n).padStart(2, '0');
const enDate = (s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))));
const enTexte = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const joursDuMois = (annee, mois) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();
const ajouterJours = (s, n) => enTexte(new Date(enDate(s).getTime() + n * 86400000));
function ajouterMois(s, n, jour) {
  const total = Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = (total % 12) + 1;
  return annee + '-' + pad(mois) + '-' + pad(Math.min(jour ?? Number(s.slice(8, 10)), joursDuMois(annee, mois)));
}

/** Occurrence qui suit une date donnée, selon la périodicité. */
function suivant(per, date) {
  return per.unite === 'semaines' ? ajouterJours(date, 7 * per.pas) : ajouterMois(date, per.pas, per.jour);
}

function normaliserPeriodicite(p) {
  if (!p) throw new Error('périodicité manquante');
  return { unite: p.unite, pas: p.pas, ...(p.jour !== undefined && { jour: p.jour }), ...(p.reference !== undefined && { reference: p.reference }) };
}

function verifier(r) {
  if (!r.nom || !r.nom.trim()) throw new Error('nom du frais vide');
  if (!Number.isInteger(r.centimes) || r.centimes <= 0) throw new Error('montant invalide (centimes entiers, positifs)');
  const p = r.periodicite;
  if (!['mois', 'semaines'].includes(p.unite)) throw new Error('périodicité inconnue : ' + p.unite);
  if (!Number.isInteger(p.pas) || p.pas < 1) throw new Error('périodicité invalide (pas entier ≥ 1)');
  if (p.jour !== undefined && (p.unite !== 'mois' || !Number.isInteger(p.jour) || p.jour < 1 || p.jour > 31)) throw new Error('jour du mois invalide (1 à 31, mensuel seulement)');
  if (p.reference !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.reference)) throw new Error('date de référence invalide (AAAA-MM-JJ)');
}

/** periodicite : { unite, pas, jour?, reference? }. Raccourci : `jour` seul = chaque mois à ce jour. */
export function ajouterRecurrent(etat, { nom, centimes, categorie = null, libelles = [], periodicite, jour }) {
  const per = periodicite ?? (jour !== undefined ? { unite: 'mois', pas: 1, jour } : undefined);
  const r = { id: 'r' + (etat.recurrents.length + 1) + '-' + Date.now().toString(36), nom: nom?.trim(), centimes, categorie, libelles: libelles.map(normaliserLibelle), periodicite: normaliserPeriodicite(per) };
  verifier(r);
  return { etat: { ...etat, recurrents: etat.recurrents.concat([r]) }, id: r.id };
}

export function modifierRecurrent(etat, id, champs) {
  const r = etat.recurrents.find((x) => x.id === id);
  if (!r) throw new Error('frais récurrent introuvable : ' + id);
  const suivantR = { ...r, ...champs };
  if (champs.libelles) suivantR.libelles = champs.libelles.map(normaliserLibelle);
  if (champs.periodicite) suivantR.periodicite = normaliserPeriodicite(champs.periodicite);
  verifier(suivantR);
  return { ...etat, recurrents: etat.recurrents.map((x) => (x.id === id ? suivantR : x)) };
}

export function supprimerRecurrent(etat, id) {
  if (!etat.recurrents.some((x) => x.id === id)) throw new Error('frais récurrent introuvable : ' + id);
  const ajouts = Object.fromEntries(
    Object.entries(etat.ajouts).map(([k, a]) => [k, a.recurrentId === id ? Object.fromEntries(Object.entries(a).filter(([c]) => c !== 'recurrentId')) : a]),
  );
  return { ...etat, recurrents: etat.recurrents.filter((x) => x.id !== id), ajouts };
}

/** Crée un frais récurrent à partir d'une ligne existante : reprend son libellé et son montant (mensuel par défaut). */
export function creerDepuisLigne(etat, idLigne, { nom, categorie = null, periodicite }) {
  const brute = etat.operations.find((o) => o.id === idLigne);
  if (!brute) throw new Error('opération introuvable : ' + idLigne);
  const op = effective(etat, brute);
  return ajouterRecurrent(etat, { nom, centimes: op.centimes, categorie, libelles: [op.libelle], periodicite: periodicite ?? { unite: 'mois', pas: 1 } });
}

/** Lie (ou délie avec null) une ligne à un frais récurrent, à la main. Prime sur la reconnaissance automatique. */
export function lierLigne(etat, idLigne, idRecurrent) {
  if (!etat.operations.some((o) => o.id === idLigne)) throw new Error('opération introuvable : ' + idLigne);
  if (idRecurrent !== null && !etat.recurrents.some((r) => r.id === idRecurrent)) throw new Error('frais récurrent introuvable : ' + idRecurrent);
  return { ...etat, ajouts: { ...etat.ajouts, [idLigne]: { ...(etat.ajouts[idLigne] ?? {}), recurrentId: idRecurrent } } };
}

/** Frais récurrent auquel appartient une ligne (id) ou null. Choix manuel d'abord, sinon libellé de la banque connu. */
export function recurrentDe(etat, brute) {
  const op = effective(etat, brute);
  const a = etat.ajouts[op.id];
  if (a && 'recurrentId' in a) return a.recurrentId;
  if (op.compte !== 'banque' || op.sens !== 'sortie') return null;
  const cle = normaliserLibelle(op.libelle);
  return etat.recurrents.find((r) => r.libelles.includes(cle))?.id ?? null;
}

/** Date du dernier débit vu pour ce frais (lignes non supprimées liées), ou null. */
export function dernierDebit(etat, r) {
  let dernier = null;
  for (const brute of etat.operations) {
    const op = effective(etat, brute);
    if (etat.ajouts[op.id]?.supprime || recurrentDe(etat, brute) !== r.id) continue;
    if (dernier === null || op.date > dernier) dernier = op.date;
  }
  return dernier;
}

/**
 * Prochain prélèvement estimé : { date, enRetard } ou null si on ne peut pas encore l'estimer.
 *  - dernier débit vu + périodicité (enRetard si cette date est déjà passée sans nouveau débit) ;
 *  - sinon, une date de référence connue, avancée jusqu'à aujourd'hui ;
 *  - sinon, pour un frais mensuel avec un jour : le prochain de ce jour ;
 *  - sinon null (« pas encore estimable » : le premier débit vu apprendra la date).
 */
export function prochainEstime(etat, r, aujourdhui) {
  const per = r.periodicite;
  const dernier = dernierDebit(etat, r);
  if (dernier) {
    const date = suivant(per, dernier);
    return { date, enRetard: date < aujourdhui };
  }
  if (per.reference) {
    let d = per.reference;
    for (let i = 0; d < aujourdhui && i < 2000; i++) d = suivant(per, d);
    return { date: d, enRetard: false };
  }
  if (per.unite === 'mois' && per.jour) {
    const debutMois = aujourdhui.slice(0, 8) + '01';
    let d = ajouterMois(debutMois, 0, per.jour);
    if (d < aujourdhui) d = ajouterMois(debutMois, per.pas, per.jour);
    return { date: d, enRetard: false };
  }
  return null;
}

/** Aperçu de tous les frais : dernier débit vu et prochain estimé. Pas de « payé ou non ». */
export function apercuFrais(etat, aujourdhui) {
  return etat.recurrents.map((r) => {
    const prochain = prochainEstime(etat, r, aujourdhui);
    return {
      id: r.id, nom: r.nom, centimes: r.centimes, categorie: r.categorie,
      dernierDebit: dernierDebit(etat, r), prochain: prochain?.date ?? null, enRetard: prochain?.enRetard ?? false,
      estimable: prochain !== null,
    };
  });
}

function finDuMois(date) {
  return date.slice(0, 8) + pad(joursDuMois(Number(date.slice(0, 4)), Number(date.slice(5, 7))));
}

/**
 * Solde de la banque moins l'ESTIMATION des frais à venir d'ici la fin du mois : information seulement,
 * le vrai solde ne change qu'au vrai débit. Null tant que le solde de départ n'est pas saisi.
 */
export function soldeApresFraisAVenir(etat, aujourdhui) {
  const banque = soldes(etat).banque;
  return banque === null ? null : banque - resteAPrevoir(etat, aujourdhui);
}

/** ESTIMATION des frais à prévoir d'ici la fin du mois (un frais toutes les semaines compte plusieurs fois). Aucun solde n'est touché. */
export function resteAPrevoir(etat, aujourdhui) {
  const fin = finDuMois(aujourdhui);
  let total = 0;
  for (const r of etat.recurrents) {
    const p = prochainEstime(etat, r, aujourdhui);
    if (!p) continue;
    let d = p.date;
    for (let i = 0; d <= fin && i < 100; i++) {
      total += r.centimes;
      d = suivant(r.periodicite, d);
    }
  }
  return total;
}
