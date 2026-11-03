// Tableaux de l'export « tout dedans » (une feuille Excel = un tableau, un CSV = un tableau).
// Les cellules sont des valeurs simples ou des cellules typées, que csv.js et xlsx.js savent écrire :
//   texte | nombre | null | { t: 'montant', v: centimes } | { t: 'date', v: 'AAAA-MM-JJ' } | { t: 'dateheure', v: ms }

import { lister } from './donnees.js?v=448471bd735c';
import { soldes } from './soldes.js?v=448471bd735c';
import { apercuFrais, resteAPrevoir, soldeApresFraisAVenir } from './recurrents.js?v=448471bd735c';
import { jauge } from './seuils.js?v=448471bd735c';
import { normaliserLibelle } from './categories.js?v=448471bd735c';
import { dateLocale, moisDe, ajouterMois } from './dates.js?v=448471bd735c';

const M = (v) => (v === null || v === undefined ? null : { t: 'montant', v });
const D = (v) => (v ? { t: 'date', v } : null);
const H = (v) => ({ t: 'dateheure', v });
const oui = (b) => (b ? 'oui' : 'non');

const estDepense = (l) => !l.supprime && l.sens === 'sortie' && !l.retrait;
const SANS_CATEGORIE = 'À classer';

function periodiciteEnTexte(p) {
  if (p.unite === 'semaines') return p.pas === 1 ? 'Toutes les semaines' : 'Toutes les ' + p.pas + ' semaines';
  const base = p.pas === 1 ? 'Tous les mois' : 'Tous les ' + p.pas + ' mois';
  return p.jour ? base + ', le ' + p.jour : base;
}

export function tableaux(etat, aujourdhui) {
  const nomCat = (id) => (id ? etat.categories.find((c) => c.id === id)?.nom ?? SANS_CATEGORIE : SANS_CATEGORIE);
  const tout = lister(etat, { avecSupprimees: true });

  // 1. Opérations
  const operations = {
    nom: 'Opérations',
    colonnes: ['Date', 'Compte', 'Sens', 'Libellé banque', 'Vrai émetteur', 'Description', 'Catégorie', 'Montant', 'Montant signé', 'Source',
      'Frais récurrent', 'Retrait', 'Corrigée', 'Supprimée', 'Compte dans le solde', 'Arrivée'],
    lignes: tout.map((l) => [
      D(l.date), l.compte === 'banque' ? 'Banque' : 'Espèces', l.sens === 'sortie' ? 'Dépense' : 'Entrée', l.libelle, l.emetteurReel ?? '', l.description ?? '',
      l.sens === 'sortie' ? nomCat(l.categorie) : '', M(l.centimes), M(l.sens === 'sortie' ? -l.centimes : l.centimes),
      l.source === 'mail' ? 'Mail' : 'Saisie', etat.recurrents.find((r) => r.id === l.recurrentId)?.nom ?? '',
      oui(l.retrait), oui(l.corrigee), oui(l.supprime), oui(l.comptee), H(l.ts),
    ]),
  };

  // 2. Catégories
  const noms = etat.categories.map((c) => ({ id: c.id, nom: c.nom })).concat([{ id: null, nom: SANS_CATEGORIE }]);
  const categories = {
    nom: 'Catégories',
    colonnes: ['Catégorie', 'Lignes', 'Total dépensé', 'Dont frais récurrents'],
    lignes: noms.map(({ id, nom }) => {
      const l = tout.filter((x) => estDepense(x) && x.categorie === id);
      return [nom, l.length, M(l.reduce((s, x) => s + x.centimes, 0)), M(l.filter((x) => x.recurrentId).reduce((s, x) => s + x.centimes, 0))];
    }),
  };

  // 3. Émetteurs (libellés de la banque)
  const groupes = new Map();
  for (const l of tout) {
    if (l.supprime) continue;
    const cle = normaliserLibelle(l.libelle);
    const g = groupes.get(cle) ?? { libelle: l.libelle, lignes: 0, depense: 0, entrees: 0 };
    g.lignes += 1;
    if (estDepense(l)) g.depense += l.centimes;
    if (l.sens === 'entree') g.entrees += l.centimes;
    groupes.set(cle, g);
  }
  for (const cle of Object.keys(etat.emetteurs)) if (!groupes.has(cle)) groupes.set(cle, { libelle: cle, lignes: 0, depense: 0, entrees: 0 });
  const emetteurs = {
    nom: 'Émetteurs',
    colonnes: ['Libellé banque', 'Catégorie retenue', 'Lignes', 'Total dépensé', 'Total entrées'],
    lignes: [...groupes.entries()].sort((a, b) => b[1].depense - a[1].depense).map(([cle, g]) => [
      g.libelle, etat.emetteurs[cle] ? nomCat(etat.emetteurs[cle].categorie) : '', g.lignes, M(g.depense), M(g.entrees),
    ]),
  };

  // 4. Frais récurrents
  const frais = apercuFrais(etat, aujourdhui);
  const recurrents = {
    nom: 'Frais récurrents',
    colonnes: ['Nom', 'Montant', 'Périodicité', 'Catégorie', 'Libellés reconnus', 'Dernier débit vu', 'Prochain estimé', 'En retard'],
    lignes: etat.recurrents.map((r) => {
      const f = frais.find((x) => x.id === r.id);
      return [r.nom, M(r.centimes), periodiciteEnTexte(r.periodicite), r.categorie ? nomCat(r.categorie) : '', r.libelles.join(' | '),
        D(f.dernierDebit), f.estimable ? D(f.prochain) : 'pas encore estimable', oui(f.enRetard)];
    }),
  };

  // 5. Soldes et seuils
  const s = soldes(etat);
  const jm = jauge(etat, 'mois', aujourdhui);
  const js = jauge(etat, 'semaine', aujourdhui);
  const jj = jauge(etat, 'jour', aujourdhui);
  const info = (nom, valeur) => [nom, valeur];
  const reference = (compte) => etat.reference[compte];
  const soldesSeuils = {
    nom: 'Soldes et seuils',
    colonnes: ['Information', 'Valeur'],
    lignes: [
      info('Date de l\'export', D(aujourdhui)),
      info('Solde de référence banque', M(reference('banque')?.centimes ?? null)),
      info('Date de la référence banque', D(reference('banque') ? dateLocale(reference('banque').ts) : null)),
      info('Solde de référence espèces', M(reference('especes')?.centimes ?? null)),
      info('Date de la référence espèces', D(reference('especes') ? dateLocale(reference('especes').ts) : null)),
      info('Solde actuel banque', M(s.banque)),
      info('Solde actuel espèces', M(s.especes)),
      info('Seuil du mois', M(jm.seuil)),
      info('Dépensé ce mois (comparable au seuil, hors frais récurrents)', M(jm.depense)),
      info('Reste à dépenser ce mois', M(jm.reste)),
      info('Seuil de la semaine', M(js.seuil)),
      info('Dépensé cette semaine', M(js.depense)),
      info('Reste à dépenser cette semaine', M(js.reste)),
      info('Seuil du jour', M(jj.seuil)),
      info('Dépensé aujourd\'hui', M(jj.depense)),
      info('Reste à dépenser aujourd\'hui', M(jj.reste)),
      info('Frais récurrents à prévoir d\'ici la fin du mois (estimation)', M(resteAPrevoir(etat, aujourdhui))),
      info('Solde banque après frais à venir (estimation)', M(soldeApresFraisAVenir(etat, aujourdhui))),
    ],
  };

  // 6. Par mois (entrées, dépenses, détail par catégorie)
  const actives = tout.filter((l) => !l.supprime);
  const parMois = { nom: 'Par mois', colonnes: ['Mois', 'Entrées', 'Dépenses', 'Solde du mois', ...noms.map((n) => n.nom)], lignes: [] };
  if (actives.length) {
    const premier = moisDe(actives.map((l) => l.date).sort()[0]);
    const dernier = moisDe(actives.map((l) => l.date).sort().at(-1));
    for (let m = premier, i = 0; m <= dernier && i < 240; m = moisDe(ajouterMois(m + '-01', 1, 1)), i++) {
      const duMois = actives.filter((l) => moisDe(l.date) === m);
      const entrees = duMois.filter((l) => l.sens === 'entree').reduce((t, l) => t + l.centimes, 0);
      const depenses = duMois.filter(estDepense).reduce((t, l) => t + l.centimes, 0);
      parMois.lignes.push([m, M(entrees), M(depenses), M(entrees - depenses),
        ...noms.map((n) => M(duMois.filter((l) => estDepense(l) && l.categorie === n.id).reduce((t, l) => t + l.centimes, 0)))]);
    }
  }

  return [operations, categories, emetteurs, recurrents, soldesSeuils, parMois];
}
