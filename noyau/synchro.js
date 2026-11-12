// Synchro des alertes de la banque (venues du pont Apps Script ou de la connexion Google) vers le noyau.
// Décisions du 02/11/2026 : synchro automatique à l'ouverture et au retour dans l'app ; au plus 50 nouvelles alertes
// par synchro (au-delà, on prévient) ; les données restent dans le téléphone.
//
// État : synchro: { dernierTs (ms : arrivée de l'alerte la plus récente déjà traitée), ignores: [ids de mails écartés],
//                   derniere (ms : heure de la dernière synchro réussie) | null }
// Le noyau ne lit pas les mails lui-même : on lui passe `lire` (message -> { id, ts, objet, texte })
// et `extraire` (l'extraction testée de test-gmail/extraction.js).

import { fusionnerMails } from './donnees.js?v=9ab47a314fd1';
import { estIgnore } from './reglages.js?v=9ab47a314fd1';
import { validerAttentes } from './attentes.js?v=9ab47a314fd1';
import { normaliserLibelle } from './libelles.js?v=9ab47a314fd1';

// Une même opération venue par mail ET par notification (11/11/2026) : même sens, même montant, même libellé, à un jour près.
const ECART_JOURS_JUMEAUX = 1;
const jours = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
const jumeaux = (a, b) => a.sens === b.sens && a.centimes === b.centimes && Math.abs(jours(a.date) - jours(b.date)) <= ECART_JOURS_JUMEAUX
  && normaliserLibelle(a.libelle) === normaliserLibelle(b.libelle);
const BANQUE_AUTO = ['mail', 'notification'];
const NON_RECONNUE = 'notification non reconnue'; // raison donnée par extraireNotification (test-gmail/extraction.js)
const MAX_NON_RECONNUES = 50;

export const LIMITE = 50;
export const MARGE_MS = 60 * 60 * 1000; // on redemande 1 h en arrière : l'anti-doublon écarte ce qui est déjà connu
const MAX_IGNORES = 500;

export const synchroVide = () => ({ dernierTs: 0, ignores: [], derniere: null });

/** À partir de quand demander les alertes (0 = tout). */
export function apresTsPour(etat) {
  const t = etat.synchro?.dernierTs ?? 0;
  return t ? Math.max(0, t - MARGE_MS) : 0;
}

/**
 * Range les messages reçus dans l'état. Rend { etat, rapport }.
 * rapport : { ajoutees: [ids], validees: [{ attente, mail, centimes }], dejaVues, ignorees: [{ id, raison, libelle? }], alertes: [{ id, alerte }], erreurs: [{ id, message }], limiteAtteinte }
 * Un message illisible n'est ni ajouté ni marqué ignoré : il sera relu à la prochaine synchro.
 */
// notifications (11/11/2026) : [{ id, ts, titre, texte }] déposées au pont par l'iPhone ; extraireNotification et dateDe
// (ts -> 'AAAA-MM-JJ', jour de réception) les lisent. rapport.jumeaux : opérations déjà connues par l'autre voie (non ajoutées).
export function synchroniser(etat, messages, { lire, extraire, maintenant, notifications = [], extraireNotification = null, dateDe = null }) {
  const synchro = { ...synchroVide(), ...(etat.synchro ?? {}) };
  const connus = new Set([...etat.operations.map((o) => o.id), ...synchro.ignores]);
  const rapport = { ajoutees: [], dejaVues: 0, ignorees: [], alertes: [], erreurs: [], limiteAtteinte: messages.length >= LIMITE };
  const nouvelles = [];
  const ignores = [...synchro.ignores];
  let plusRecent = synchro.dernierTs;
  let plusAncienEnErreur = Infinity;

  for (const message of messages) {
    let m;
    try {
      m = lire(message);
    } catch (e) {
      const ts = Number(message?.internalDate) || 0;
      rapport.erreurs.push({ id: message?.id ?? '?', message: e.message });
      if (ts) plusAncienEnErreur = Math.min(plusAncienEnErreur, ts);
      continue;
    }
    if (connus.has(m.id)) { rapport.dejaVues += 1; plusRecent = Math.max(plusRecent, m.ts); continue; }
    connus.add(m.id);
    const op = extraire({ id: m.id, objet: m.objet, texte: m.texte });
    // Libellés ignorés ajoutés par le propriétaire (page Réglages).
    if (!op.ignore && estIgnore(etat, op.libelle)) op.ignore = 'libellé ignoré (réglages)';
    if (op.ignore) {
      ignores.push(m.id);
      rapport.ignorees.push({ id: m.id, raison: op.ignore, ...(op.libelle && { libelle: op.libelle }) });
    } else {
      nouvelles.push({ id: m.id, sens: op.sens, libelle: op.libelle, date: op.date, centimes: op.centimes, ts: m.ts, objet: m.objet });
      if (op.alerte) rapport.alertes.push({ id: m.id, alerte: op.alerte });
    }
    plusRecent = Math.max(plusRecent, m.ts);
  }

  // Notifications non reconnues (11/11/2026) : gardées de côté (au plus MAX_NON_RECONNUES) et relues à chaque synchro, pour
  // être rattrapées dès que leur phrase est ajoutée à la lecture (ex. paiements CB, texte encore inconnu).
  const nonReconnues = [];
  const aLire = extraireNotification ? [...(synchro.nonReconnues ?? []), ...notifications] : [];
  for (const n of aLire) {
    if (!n || !n.id) continue;
    if (connus.has(n.id)) { rapport.dejaVues += 1; plusRecent = Math.max(plusRecent, n.ts || 0); continue; }
    connus.add(n.id);
    const op = extraireNotification({ id: n.id, titre: n.titre, texte: n.texte, date: dateDe(n.ts) });
    if (!op.ignore && estIgnore(etat, op.libelle)) op.ignore = 'libellé ignoré (réglages)';
    if (op.ignore === NON_RECONNUE) {
      nonReconnues.push({ id: n.id, ts: n.ts, titre: n.titre ?? '', texte: n.texte ?? '' });
    } else if (op.ignore) {
      ignores.push(n.id);
      rapport.ignorees.push({ id: n.id, raison: op.ignore, ...(op.libelle && { libelle: op.libelle }) });
    } else {
      nouvelles.push({ id: n.id, source: 'notification', sens: op.sens, libelle: op.libelle, date: op.date, centimes: op.centimes, ts: n.ts, objet: op.objet });
      if (op.alerte) rapport.alertes.push({ id: n.id, alerte: op.alerte });
    }
    plusRecent = Math.max(plusRecent, n.ts || 0);
  }

  // Jumeaux : une opération déjà connue par l'autre voie (mail ↔ notification) n'est pas ajoutée une deuxième fois. Chaque
  // ligne n'a qu'un jumeau (deux paiements identiques le même jour restent deux lignes s'ils arrivent deux fois par chaque voie).
  rapport.jumeaux = [];
  let ajoutsJumeaux = etat.ajouts;
  const pris = new Set(Object.entries(etat.ajouts).filter(([, a]) => a.jumeau).map(([id]) => id));
  const gardees = [];
  for (const m of nouvelles) {
    const source = m.source ?? 'mail';
    const deja = [...etat.operations.filter((o) => BANQUE_AUTO.includes(o.source)), ...gardees.map((g) => ({ ...g, source: g.source ?? 'mail' }))]
      .find((o) => o.source !== source && !pris.has(o.id) && jumeaux(o, m));
    if (deja) {
      pris.add(deja.id);
      ignores.push(m.id);
      ajoutsJumeaux = { ...ajoutsJumeaux, [deja.id]: { ...(ajoutsJumeaux[deja.id] ?? {}), jumeau: m.id } };
      rapport.jumeaux.push({ id: m.id, de: deja.id });
    } else gardees.push(m);
  }

  const fusion = fusionnerMails({ ...etat, ajouts: ajoutsJumeaux }, gardees);
  rapport.ajoutees = fusion.ajoutees.map((o) => o.id);
  rapport.nonReconnues = nonReconnues.length;
  // Paiements CB en attente : un prélèvement du même montant les valide (noyau/attentes.js).
  const { etat: suivant, validees } = validerAttentes(fusion.etat, rapport.ajoutees);
  rapport.validees = validees;
  // Ne jamais avancer au-delà d'un message illisible : il doit être redemandé.
  const dernierTs = Math.min(plusRecent, plusAncienEnErreur - 1);
  return {
    etat: { ...suivant, synchro: { dernierTs: Math.max(synchro.dernierTs, dernierTs), ignores: ignores.slice(-MAX_IGNORES), derniere: maintenant, ...(nonReconnues.length && { nonReconnues: nonReconnues.slice(-MAX_NON_RECONNUES) }) } },
    rapport,
  };
}
