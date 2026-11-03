// Synchro des alertes de la banque (venues du pont Apps Script ou de la connexion Google) vers le noyau.
// Décisions du 02/11/2026 : synchro automatique à l'ouverture et au retour dans l'app ; au plus 50 nouvelles alertes
// par synchro (au-delà, on prévient) ; les données restent dans le téléphone.
//
// État : synchro: { dernierTs (ms : arrivée de l'alerte la plus récente déjà traitée), ignores: [ids de mails écartés],
//                   derniere (ms : heure de la dernière synchro réussie) | null }
// Le noyau ne lit pas les mails lui-même : on lui passe `lire` (message -> { id, ts, objet, texte })
// et `extraire` (l'extraction testée de test-gmail/extraction.js).

import { fusionnerMails } from './donnees.js?v=acd44948f510';
import { estIgnore } from './reglages.js?v=acd44948f510';
import { validerAttentes } from './attentes.js?v=acd44948f510';

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
export function synchroniser(etat, messages, { lire, extraire, maintenant }) {
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

  const fusion = fusionnerMails(etat, nouvelles);
  rapport.ajoutees = fusion.ajoutees.map((o) => o.id);
  // Paiements CB en attente : un prélèvement du même montant les valide (noyau/attentes.js).
  const { etat: suivant, validees } = validerAttentes(fusion.etat, rapport.ajoutees);
  rapport.validees = validees;
  // Ne jamais avancer au-delà d'un message illisible : il doit être redemandé.
  const dernierTs = Math.min(plusRecent, plusAncienEnErreur - 1);
  return {
    etat: { ...suivant, synchro: { dernierTs: Math.max(synchro.dernierTs, dernierTs), ignores: ignores.slice(-MAX_IGNORES), derniere: maintenant } },
    rapport,
  };
}
