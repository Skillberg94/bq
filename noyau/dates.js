// Petites fonctions de dates au format 'AAAA-MM-JJ' (calcul en UTC : pas de décalage d'heure d'été).

const pad = (n) => String(n).padStart(2, '0');

export const enDate = (s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))));
export const enTexte = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
export const joursDuMois = (annee, mois) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();
export const ajouterJours = (s, n) => enTexte(new Date(enDate(s).getTime() + n * 86400000));

/** Ajoute n mois ; le jour est ramené au dernier jour des mois courts (31 → 28 en février). */
export function ajouterMois(s, n, jour) {
  const total = Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = (total % 12 + 12) % 12 + 1;
  return annee + '-' + pad(mois) + '-' + pad(Math.min(jour ?? Number(s.slice(8, 10)), joursDuMois(annee, mois)));
}

/** 'AAAA-MM' d'une date. */
export const moisDe = (s) => s.slice(0, 7);

/** Date du jour d'un horodatage en millisecondes, dans le fuseau du téléphone. */
export function dateLocale(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** 'AAAA-MM-JJ HH:MM' d'un horodatage, dans le fuseau du téléphone. */
export function dateHeureLocale(ts) {
  const d = new Date(ts);
  return dateLocale(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
