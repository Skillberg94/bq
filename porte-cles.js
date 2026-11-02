// Range la clé de données dans le téléphone (IndexedDB), pour ne demander le mot de passe qu'une fois (option B).
// La clé est un objet CryptoKey NON exportable : le navigateur sait s'en servir, mais personne ne peut en lire la valeur.
const BASE = 'bq';
const MAGASIN = 'cles';
const NOM = 'donnees';

function ouvrir() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function agir(mode, action) {
  const base = await ouvrir();
  return new Promise((ok, ko) => {
    const t = base.transaction(MAGASIN, mode);
    const demande = action(t.objectStore(MAGASIN));
    t.oncomplete = () => { base.close(); ok(demande.result); };
    t.onerror = () => { base.close(); ko(t.error); };
  });
}

/** La clé rangée, ou null (rien de rangé, ou IndexedDB indisponible). */
export const lireCle = () => agir('readonly', (m) => m.get(NOM)).then((c) => c ?? null).catch(() => null);
export const rangerCle = (cle) => agir('readwrite', (m) => m.put(cle, NOM));
export const effacerCle = () => agir('readwrite', (m) => m.delete(NOM));
