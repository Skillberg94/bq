// CSV à la française, pour s'ouvrir directement dans l'Excel français :
// séparateur « ; », virgule décimale, UTF-8 avec BOM, fins de ligne CRLF, dates AAAA-MM-JJ.
// Protection : un texte qui commence par = + - @ serait pris pour une formule par Excel ; on le fait précéder d'une apostrophe.

import { dateHeureLocale } from './dates.js?v=deb522bce8bf';

const SEPARATEUR = ';';

function texteCellule(c) {
  if (c === null || c === undefined) return '';
  if (typeof c === 'number') return String(c).replace('.', ',');
  if (typeof c === 'string') return /^[=+\-@\t\r]/.test(c) ? "'" + c : c;
  if (c.t === 'montant') return (c.v / 100).toFixed(2).replace('.', ',');
  if (c.t === 'date') return c.v;
  if (c.t === 'dateheure') return dateHeureLocale(c.v);
  throw new Error('cellule inconnue : ' + JSON.stringify(c));
}

function proteger(texte) {
  return /[;"\r\n]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
}

/** Un tableau (voir tableaux.js) -> texte CSV complet, BOM compris. */
export function enCsv(tableau) {
  const lignes = [tableau.colonnes.map(proteger).join(SEPARATEUR)];
  for (const l of tableau.lignes) lignes.push(l.map((c) => proteger(texteCellule(c))).join(SEPARATEUR));
  return '﻿' + lignes.join('\r\n') + '\r\n';
}
