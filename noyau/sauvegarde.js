// Sauvegarde chiffrée des données de l'app (fichier à ranger dans Fichiers / iCloud) et restauration.
// Décisions du 02/11/2026 : restaurer = REMPLACER les données actuelles, après en avoir gardé une copie de sécurité
// dans le téléphone (annulable) ; rappel au bout de 7 jours sans sauvegarde.
//
// Le fichier contient l'entête du coffre (clé de données enveloppée par le mot de passe) et le contenu chiffré :
// il s'ouvre avec le mot de passe seul, sur n'importe quel appareil. En clair : seulement le format et la date.

import { CLE_ENTETE, CLE_DONNEES, lireEntete, ouvrirCoffre, chiffrer, dechiffrer, lireCoffre } from './coffre.js?v=afc1385028cb';
import { importer, soldes } from './donnees.js?v=afc1385028cb';

export const FORMAT = 'bq-sauvegarde';
export const RAPPEL_JOURS = 7;
export const CLE_ENTETE_PRECEDENTE = 'banque-coffre-precedent-v1';
export const CLE_DONNEES_PRECEDENTES = 'banque-donnees-precedentes-v1';

/** Fabrique le fichier de sauvegarde (objet à écrire en JSON). Note aussi la date de sauvegarde dans le contenu. */
export async function creerSauvegarde(stockage, cle, contenu, maintenant) {
  const date = new Date(maintenant).toISOString();
  const aJour = { ...contenu, sauvegarde: { derniere: maintenant } };
  return { fichier: { format: FORMAT, version: 1, cree: date, entete: lireEntete(stockage), paquet: await chiffrer(cle, aJour) }, contenu: aJour };
}

export function nomDeFichier(maintenant) {
  return 'bq-sauvegarde-' + new Date(maintenant).toISOString().slice(0, 10) + '.json';
}

/** Lit le texte d'un fichier choisi par le propriétaire ; refuse ce qui n'est pas une sauvegarde de cette app. */
export function lireSauvegarde(texte) {
  let f;
  try { f = JSON.parse(texte); } catch { throw new Error('Ce fichier n\'est pas une sauvegarde de BQ (illisible).'); }
  if (!f || f.format !== FORMAT || f.version !== 1 || !f.entete || !f.paquet) throw new Error('Ce fichier n\'est pas une sauvegarde de BQ.');
  return f;
}

/** Ouvre la sauvegarde avec le mot de passe : rend la clé, le contenu vérifié et un résumé pour confirmation. */
export async function ouvrirSauvegarde(fichier, motDePasse) {
  const cle = await ouvrirCoffre(motDePasse, fichier.entete);
  const contenu = await dechiffrer(cle, fichier.paquet);
  if (!contenu || !contenu.etat) throw new Error('Sauvegarde incomplète : aucune donnée dedans.');
  importer(JSON.stringify(contenu.etat)); // vérifie la forme des données (lève une erreur sinon)
  const s = soldes(contenu.etat);
  return { cle, contenu, resume: { cree: fichier.cree, operations: contenu.etat.operations.length, banque: s.banque, especes: s.especes } };
}

/**
 * Remplace les données du téléphone par la sauvegarde. Avant : copie de sécurité des données actuelles (annulable).
 * Après : vérification qu'on relit bien les données restaurées ; sinon, retour automatique à la copie de sécurité.
 */
export async function restaurer(stockage, fichier, cle) {
  const enteteActuelle = stockage.getItem(CLE_ENTETE);
  const donneesActuelles = stockage.getItem(CLE_DONNEES);
  if (enteteActuelle !== null) stockage.setItem(CLE_ENTETE_PRECEDENTE, enteteActuelle);
  if (donneesActuelles !== null) stockage.setItem(CLE_DONNEES_PRECEDENTES, donneesActuelles);
  stockage.setItem(CLE_ENTETE, JSON.stringify(fichier.entete));
  stockage.setItem(CLE_DONNEES, JSON.stringify(fichier.paquet));
  try {
    const relu = await lireCoffre(stockage, cle);
    if (!relu || !relu.etat) throw new Error('données restaurées illisibles');
    return relu;
  } catch (e) {
    annulerRestauration(stockage);
    throw new Error('Restauration annulée, tes données d\'avant sont remises : ' + e.message);
  }
}

export const restaurationAnnulable = (stockage) => stockage.getItem(CLE_DONNEES_PRECEDENTES) !== null;

/** Remet les données d'avant la dernière restauration. */
export function annulerRestauration(stockage) {
  const entete = stockage.getItem(CLE_ENTETE_PRECEDENTE);
  const donnees = stockage.getItem(CLE_DONNEES_PRECEDENTES);
  if (entete === null || donnees === null) throw new Error('Aucune restauration à annuler.');
  stockage.setItem(CLE_ENTETE, entete);
  stockage.setItem(CLE_DONNEES, donnees);
  stockage.removeItem(CLE_ENTETE_PRECEDENTE);
  stockage.removeItem(CLE_DONNEES_PRECEDENTES);
}

/** Texte de rappel, ou null s'il n'y a pas lieu de rappeler. */
export function rappelSauvegarde(contenu, maintenant, jours = RAPPEL_JOURS) {
  const derniere = contenu?.sauvegarde?.derniere;
  if (!derniere) return 'Aucune sauvegarde de tes données pour l\'instant.';
  const ecart = Math.floor((maintenant - derniere) / 86400000);
  return ecart >= jours ? 'Dernière sauvegarde il y a ' + ecart + ' jours.' : null;
}
