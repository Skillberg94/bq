// Données INVENTÉES pour tester l'export sur le téléphone. Rien ici ne vient de vraies opérations.
import { vide, definirReference, fusionnerMails, ajouterManuel, modifier } from './noyau/donnees.js?v=afc1385028cb';
import { classerEmetteur } from './noyau/categories.js?v=afc1385028cb';
import { definirSeuilMois } from './noyau/seuils.js?v=afc1385028cb';

const midi = (date) => Date.parse(date + 'T12:00:00Z');
const mail = (id, centimes, libelle, date, sens = 'sortie') => ({ id, sens, centimes, libelle, date, ts: midi(date) });

export function etatDeTest() {
  let e = definirReference(vide(), 'banque', 100000, midi('2026-10-01'));
  e = definirSeuilMois(e, 60000);
  e = fusionnerMails(e, [
    mail('t1', 250000, 'SALAIRE EXEMPLE', '2026-10-02', 'entree'),
    mail('t2', 4590, 'SUPERMARCHE EXEMPLE', '2026-10-05'),
    mail('t3', 1290, 'BOULANGERIE EXEMPLE', '2026-10-06'),
    mail('t4', 2000, "RETRAIT D'ESPECES CB EXEMPLE", '2026-10-07'),
  ]).etat;
  e = classerEmetteur(e, 'SUPERMARCHE EXEMPLE', 'courses');
  e = ajouterManuel(e, { compte: 'especes', libelle: 'Marché', date: '2026-10-08', centimes: 350, ts: midi('2026-10-08') }).etat;
  return modifier(e, 't3', { description: 'Pain', emetteurReel: 'Boulangerie du coin' });
}
