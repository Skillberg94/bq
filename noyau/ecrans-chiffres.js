// Écrans publiés chiffrés (décision du propriétaire, 03/11/2026 : « chiffrer puis publier », avec le même mot de passe que
// l'app). Les dessins Tool Design, leurs images et leurs polices (dont F25 Bank Printer) partent sur GitHub Pages
// chiffrés : sans le mot de passe, personne ne peut les lire.
// - Clé : PBKDF2-SHA-256 (600 000 tours) du mot de passe avec un sel FIXE (fichier chiffrement-ecrans.json du projet,
//   rien de secret) : le même mot de passe donne la même clé à chaque publication, le téléphone garde la clé.
// - Chaque fichier : AES-256-GCM, 12 octets d'IV puis le chiffré, lié au contexte « bq-ecrans-v1 ».
// - designs/coffre.json (en clair) : sel, tours et un contrôle (texte connu chiffré) pour reconnaître le bon mot de passe.
// Fonctionne dans le navigateur et dans Node (WebCrypto des deux côtés).

export const ITERATIONS_ECRANS = 600000;
export const FORMAT_ECRANS = 'bq-ecrans';
const CONTEXTE = new TextEncoder().encode('bq-ecrans-v1');
const TEXTE_CONTROLE = 'bq-ecrans-ok';
const subtle = () => globalThis.crypto.subtle;

export const versB64 = (octets) => {
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
};
export const depuisB64 = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

/** Clé des écrans (non exportable). */
export async function cleEcrans(motDePasse, selB64, iterations = ITERATIONS_ECRANS) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(motDePasse.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: depuisB64(selB64), iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * iv : facultatif. Absent : tiré au hasard. Publication (07/11/2026) : calculé à partir du fichier et d'un secret tiré du
 * mot de passe (ivStable) : un fichier qui n'a pas changé donne le même fichier chiffré, donc le téléphone ne le
 * retélécharge pas et GitHub ne le garde pas une fois de plus.
 */
export async function chiffrerOctets(cle, octets, iv = globalThis.crypto.getRandomValues(new Uint8Array(12))) {
  const chiffre = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: CONTEXTE }, cle, octets));
  const sortie = new Uint8Array(12 + chiffre.length);
  sortie.set(iv, 0);
  sortie.set(chiffre, 12);
  return sortie;
}

export async function dechiffrerOctets(cle, octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: o.subarray(0, 12), additionalData: CONTEXTE }, cle, o.subarray(12)));
}

/** Secret pour ivStable, tiré du mot de passe et du sel (jamais publié). */
export async function cleIv(motDePasse, selB64) {
  const graine = await subtle().digest('SHA-256', new TextEncoder().encode('bq-iv|' + selB64 + '|' + motDePasse.normalize('NFC')));
  return subtle().importKey('raw', graine, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/** IV d'un fichier : les 12 premiers octets du HMAC du fichier (même fichier, même IV ; fichiers différents, IV différents). */
export async function ivStable(cleSecrete, octets) {
  return new Uint8Array(await subtle().sign('HMAC', cleSecrete, octets)).slice(0, 12);
}

/** Contrôle à ranger dans coffre.json (texte connu, chiffré). */
export async function controleEcrans(cle) {
  return versB64(await chiffrerOctets(cle, new TextEncoder().encode(TEXTE_CONTROLE)));
}

/** Vrai si la clé ouvre les écrans (bon mot de passe). */
export async function cleValide(cle, controle) {
  try {
    return new TextDecoder().decode(await dechiffrerOctets(cle, depuisB64(controle))) === TEXTE_CONTROLE;
  } catch {
    return false;
  }
}

/** Sel neuf (une seule fois, à la première publication). */
export const nouveauSel = () => versB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
