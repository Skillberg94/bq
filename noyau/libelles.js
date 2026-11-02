// Libellés de la banque : forme normalisée pour les comparer (émetteurs connus, frais récurrents).

const sansAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Majuscules, sans accents, espaces unifiés, et toutes les apostrophes (’ ‘ ` ´) ramenées à « ' » :
// la banque écrit « RETRAIT D'ESPECES » avec l'une ou l'autre selon l'endroit.
export function normaliserLibelle(libelle) {
  return sansAccents(String(libelle)).replace(/[’‘`´]/g, "'").toUpperCase().replace(/\s+/g, ' ').trim();
}
