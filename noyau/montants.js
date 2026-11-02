// Saisie d'un montant en euros par le propriétaire -> centimes (entier). Accepte « 107,19 », « 1 396,12 », « 107.19 », « -5 », « 12 € ».

export function enCentimes(texte) {
  const propre = String(texte ?? '').replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(propre)) throw new Error('montant illisible : « ' + texte + ' » (exemple : 107,19)');
  return Math.round(Number(propre) * 100);
}

/** Centimes -> « 1 396,12 € » (avec le signe si demandé). */
export function enEuros(centimes, { signe = false } = {}) {
  const texte = (Math.abs(centimes) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (centimes < 0 ? '−' : signe ? '+' : '') + texte + ' €';
}
