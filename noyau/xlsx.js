// Classeur Excel (.xlsx) à partir des tableaux. Ce module ne dépend pas de la bibliothèque : il prépare les feuilles,
// et l'appelant les écrit avec « write-excel-file » (version navigateur dans l'app, version Node dans les tests) :
//   import writeExcelFile from 'write-excel-file/browser';  await writeExcelFile(feuillesXlsx(tableaux(...))).toFile('banque.xlsx');

const FORMAT_MONTANT = '#,##0.00 "€"';
const FORMAT_DATE = 'dd/mm/yyyy';
const FORMAT_DATE_HEURE = 'dd/mm/yyyy hh:mm';
const ENTETE = { fontWeight: 'bold', backgroundColor: '#E8E8E8' };

function cellule(c) {
  if (c === null || c === undefined) return null;
  if (typeof c === 'number') return { value: c, type: Number };
  if (typeof c === 'string') return c === '' ? null : { value: c, type: String };
  if (c.t === 'montant') return { value: c.v / 100, type: Number, format: FORMAT_MONTANT };
  // La bibliothèque écrit les dates en UTC : minuit UTC = le bon jour, quel que soit le fuseau du téléphone.
  if (c.t === 'date') return { value: new Date(c.v + 'T00:00:00Z'), type: Date, format: FORMAT_DATE };
  // Excel ne connaît pas les fuseaux : on décale pour afficher l'heure locale de l'appareil.
  if (c.t === 'dateheure') return { value: new Date(c.v - new Date(c.v).getTimezoneOffset() * 60000), type: Date, format: FORMAT_DATE_HEURE };
  throw new Error('cellule inconnue : ' + JSON.stringify(c));
}

function largeur(tableau, i) {
  let max = tableau.colonnes[i].length;
  for (const l of tableau.lignes.slice(0, 200)) {
    const c = l[i];
    const taille = typeof c === 'string' ? c.length : c && c.t === 'dateheure' ? 16 : c ? 12 : 0;
    if (taille > max) max = taille;
  }
  return Math.max(8, Math.min(max + 2, 60));
}

/** Les feuilles au format attendu par write-excel-file : première ligne figée et en gras, largeurs ajustées. */
export function feuillesXlsx(tables) {
  return tables.map((t) => ({
    sheet: t.nom.slice(0, 31),
    data: [t.colonnes.map((titre) => ({ value: titre, type: String, ...ENTETE })), ...t.lignes.map((l) => l.map(cellule))],
    columns: t.colonnes.map((_, i) => ({ width: largeur(t, i) })),
    stickyRowsCount: 1,
  }));
}
