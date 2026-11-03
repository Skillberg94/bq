// Catégories de dépense et mémoire des émetteurs.
// État (voir donnees.js) : categories: [{ id, nom, logo }], emetteurs: { [libellé normalisé]: { categorie } }.
// Règle : la catégorie d'une ligne = celle choisie sur la ligne, sinon celle retenue pour son libellé.
// Classer un émetteur reclasse donc aussi ses anciennes lignes (sauf celles où une catégorie a été choisie à la main).

import { effective, estRetrait } from './soldes.js?v=608bfef3efde';
import { normaliserLibelle } from './libelles.js?v=608bfef3efde';
import { recurrentDe } from './recurrents.js?v=608bfef3efde';

export { normaliserLibelle };

/** Catégories proposées au départ (modifiables par le propriétaire ; logos choisis plus tard avec Tool Design). */
export const CATEGORIES_DEFAUT = [
  'Courses', 'Restauration', 'Logement', 'Transport', 'Abonnements', 'Santé', 'Loisirs', 'Shopping', 'Frais et administratif', 'Autre',
];

// Icône de chaque catégorie (« logo » : nom d'une icône du dossier suivi-depense/icones, sans « icone- » ni « .png »),
// celles choisies avec le propriétaire pour les catégories de départ (caddie pour les courses, 02/11/2026).
export const ICONES = ['shopping', 'restaurant', 'logement', 'transport', 'forfait', 'sante', 'sport', 'frais-administratif', 'autre', 'virement', 'retrait', 'piece'];
const ICONES_DEPART = {
  courses: 'shopping', restauration: 'restaurant', logement: 'logement', transport: 'transport', abonnements: 'forfait',
  sante: 'sante', loisirs: 'sport', shopping: 'shopping', 'frais-et-administratif': 'frais-administratif', autre: 'autre',
};
export function iconeCategorie(etat, id) {
  if (id === null || id === undefined || id === 'a-classer') return 'a-classe';
  return etat.categories.find((c) => c.id === id)?.logo ?? ICONES_DEPART[id] ?? 'autre';
}

const sansAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

function idLibre(nom, existants) {
  const base = sansAccents(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categorie';
  let id = base;
  for (let i = 2; existants.includes(id); i++) id = base + '-' + i;
  return id;
}

export function categoriesParDefaut() {
  const liste = [];
  for (const nom of CATEGORIES_DEFAUT) liste.push({ id: idLibre(nom, liste.map((c) => c.id)), nom, logo: null });
  return liste;
}

export function ajouterCategorie(etat, nom, logo = null) {
  if (!nom || !nom.trim()) throw new Error('nom de catégorie vide');
  const id = idLibre(nom, etat.categories.map((c) => c.id));
  return { etat: { ...etat, categories: etat.categories.concat([{ id, nom: nom.trim(), logo }]) }, id };
}

export function modifierCategorie(etat, id, { nom, logo }) {
  if (!etat.categories.some((c) => c.id === id)) throw new Error('catégorie introuvable : ' + id);
  return {
    ...etat,
    categories: etat.categories.map((c) => (c.id === id ? { ...c, ...(nom !== undefined && { nom: nom.trim() }), ...(logo !== undefined && { logo }) } : c)),
  };
}

/** Supprime une catégorie : les lignes, émetteurs et frais récurrents qui l'utilisaient redeviennent « à classer ». */
export function supprimerCategorie(etat, id) {
  if (!etat.categories.some((c) => c.id === id)) throw new Error('catégorie introuvable : ' + id);
  const emetteurs = Object.fromEntries(Object.entries(etat.emetteurs).filter(([, v]) => v.categorie !== id));
  const ajouts = Object.fromEntries(
    Object.entries(etat.ajouts).map(([k, a]) => [k, a.categorie === id ? Object.fromEntries(Object.entries(a).filter(([c]) => c !== 'categorie')) : a]),
  );
  return {
    ...etat,
    categories: etat.categories.filter((c) => c.id !== id),
    emetteurs,
    ajouts,
    recurrents: etat.recurrents.map((r) => (r.categorie === id ? { ...r, categorie: null } : r)),
  };
}

/** Retient la catégorie d'un libellé de la banque, pour ses lignes passées et futures. */
export function classerEmetteur(etat, libelle, categorie) {
  if (!etat.categories.some((c) => c.id === categorie)) throw new Error('catégorie introuvable : ' + categorie);
  return { ...etat, emetteurs: { ...etat.emetteurs, [normaliserLibelle(libelle)]: { categorie } } };
}

export function oublierEmetteur(etat, libelle) {
  const { [normaliserLibelle(libelle)]: _, ...reste } = etat.emetteurs;
  return { ...etat, emetteurs: reste };
}

/**
 * Catégorie d'une ligne (id) ou null si elle est « à classer ». Ordre : choisie sur la ligne, puis retenue pour
 * le libellé de la banque, puis celle du frais récurrent auquel la ligne appartient.
 */
export function categorieDe(etat, brute) {
  const op = effective(etat, brute);
  const choisie = etat.ajouts[op.id]?.categorie;
  if (choisie && etat.categories.some((c) => c.id === choisie)) return choisie;
  const retenue = etat.emetteurs[normaliserLibelle(op.libelle)]?.categorie;
  if (retenue) return retenue;
  const frais = etat.recurrents.find((r) => r.id === recurrentDe(etat, brute));
  return frais?.categorie ?? null;
}

/** Libellés de dépenses sans catégorie, avec leur nombre de lignes et leur total (pour proposer de les classer). */
export function aClasser(etat) {
  const groupes = new Map();
  for (const brute of etat.operations) {
    const op = effective(etat, brute);
    if (op.sens !== 'sortie' || etat.ajouts[op.id]?.supprime || categorieDe(etat, brute) || estRetrait(etat, brute)) continue;
    const cle = normaliserLibelle(op.libelle);
    const g = groupes.get(cle) ?? { libelle: op.libelle, lignes: 0, centimes: 0 };
    g.lignes += 1;
    g.centimes += op.centimes;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => b.centimes - a.centimes);
}
