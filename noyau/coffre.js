// Coffre : chiffrement des données de l'app avec un mot de passe (protection niveau 2, option B, décidée le 02/11/2026).
//
// - Le mot de passe donne une clé (PBKDF2-SHA-256, 600 000 tours, sel aléatoire) qui « enveloppe » une clé de données
//   tirée au hasard (AES-KW). Les données sont chiffrées avec la clé de données (AES-256-GCM).
// - Option B : une fois le coffre ouvert, l'app garde la clé de données dans le téléphone (non exportable) ;
//   le mot de passe n'est redemandé que si cette clé disparaît, ou après « Verrouiller maintenant ».
// - Uniquement le chiffrement intégré au navigateur (WebCrypto) : aucune bibliothèque.
// - Mot de passe oublié + clé perdue = données chiffrées perdues (risque accepté par le propriétaire).
//
// Rangement : CLE_ENTETE -> { version, iterations, sel, enveloppe } (rien de secret) ;
//             CLE_DONNEES -> { iv, donnees } (chiffré).

export const LONGUEUR_MIN = 10;
export const ITERATIONS = 600000;
export const CLE_ENTETE = 'banque-coffre-v1';
export const CLE_DONNEES = 'banque-donnees-chiffrees-v1';
const CONTEXTE = new TextEncoder().encode('banque-donnees-v1'); // lié au chiffrement : un autre usage ne peut pas s'y substituer

const subtle = () => globalThis.crypto.subtle;
const versB64 = (octets) => {
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
};
const depuisB64 = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

async function cleDuMotDePasse(motDePasse, sel, iterations) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(motDePasse.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' }, base, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

export function verifierMotDePasse(motDePasse, confirmation) {
  if (typeof motDePasse !== 'string' || motDePasse.length < LONGUEUR_MIN) throw new Error('Le mot de passe doit faire au moins ' + LONGUEUR_MIN + ' caractères.');
  if (confirmation !== undefined && confirmation !== motDePasse) throw new Error('Les deux mots de passe ne sont pas identiques.');
}

/** Crée un coffre : rend { entete (à ranger, rien de secret), cle (clé de données non exportable) }. */
export async function creerCoffre(motDePasse, { iterations = ITERATIONS } = {}) {
  verifierMotDePasse(motDePasse);
  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const enveloppante = await cleDuMotDePasse(motDePasse, sel, iterations);
  const temporaire = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const enveloppe = new Uint8Array(await subtle().wrapKey('raw', temporaire, enveloppante, 'AES-KW'));
  // La clé gardée dans l'app n'est pas exportable : on la ré-ouvre depuis l'enveloppe.
  const cle = await subtle().unwrapKey('raw', enveloppe, enveloppante, 'AES-KW', { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { entete: { version: 1, iterations, sel: versB64(sel), enveloppe: versB64(enveloppe) }, cle };
}

/** Ouvre le coffre avec le mot de passe : rend la clé de données, ou refuse un mauvais mot de passe. */
export async function ouvrirCoffre(motDePasse, entete) {
  const enveloppante = await cleDuMotDePasse(motDePasse, depuisB64(entete.sel), entete.iterations);
  try {
    return await subtle().unwrapKey('raw', depuisB64(entete.enveloppe), enveloppante, 'AES-KW', { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    throw new Error('Mot de passe incorrect.');
  }
}

export async function chiffrer(cle, valeur) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const clair = new TextEncoder().encode(JSON.stringify(valeur));
  const donnees = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: CONTEXTE }, cle, clair));
  return { iv: versB64(iv), donnees: versB64(donnees) };
}

export async function dechiffrer(cle, paquet) {
  try {
    const clair = await subtle().decrypt({ name: 'AES-GCM', iv: depuisB64(paquet.iv), additionalData: CONTEXTE }, cle, depuisB64(paquet.donnees));
    return JSON.parse(new TextDecoder().decode(clair));
  } catch {
    throw new Error('Données chiffrées illisibles (abîmées, ou mauvaise clé).');
  }
}

// ---- Rangement dans le téléphone (`stockage` = localStorage ou équivalent, passé en paramètre : testable)

export const coffreExiste = (stockage) => stockage.getItem(CLE_ENTETE) !== null;
export const lireEntete = (stockage) => JSON.parse(stockage.getItem(CLE_ENTETE));

export async function ecrireCoffre(stockage, cle, contenu) {
  stockage.setItem(CLE_DONNEES, JSON.stringify(await chiffrer(cle, contenu)));
}

/** Contenu déchiffré, ou null si rien n'est encore rangé. */
export async function lireCoffre(stockage, cle) {
  const texte = stockage.getItem(CLE_DONNEES);
  return texte === null ? null : dechiffrer(cle, JSON.parse(texte));
}

/**
 * Première mise en place : chiffre le contenu actuel (données jusque-là en clair), vérifie qu'on sait le relire,
 * et SEULEMENT ENSUITE efface les anciennes clés en clair. Rien n'est effacé si la vérification échoue.
 */
export async function installerCoffre(stockage, motDePasse, contenu, anciennesCles = []) {
  const { entete, cle } = await creerCoffre(motDePasse);
  await ecrireCoffre(stockage, cle, contenu);
  stockage.setItem(CLE_ENTETE, JSON.stringify(entete));
  const relu = await lireCoffre(stockage, await ouvrirCoffre(motDePasse, entete));
  if (JSON.stringify(relu) !== JSON.stringify(contenu)) throw new Error('Vérification du coffre échouée : les données en clair sont conservées.');
  for (const c of anciennesCles) stockage.removeItem(c);
  return cle;
}
