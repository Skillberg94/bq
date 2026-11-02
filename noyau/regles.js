// Règles automatiques : le propriétaire indique un mot (dans le libellé de la banque, dans l'objet du mail, ou les deux) ;
// toute dépense de la banque qui le contient est reconnue comme retrait au distributeur (pour l'instant, la seule action).
// Les règles agissent aussi sur les lignes déjà là, et supprimer une règle annule son effet. Le choix du propriétaire sur
// une ligne (case « retrait » cochée ou décochée) prime toujours sur les règles.
// État : regles: [{ id, champ: 'libelle' | 'objet' | 'tous', contient, action: 'retrait' }]

const CHAMPS = ['libelle', 'objet', 'tous'];

export function ajouterRegle(etat, { contient, champ = 'tous', action = 'retrait' }) {
  if (!contient || !contient.trim()) throw new Error('le mot de la règle est vide');
  if (!CHAMPS.includes(champ)) throw new Error('champ inconnu : ' + champ);
  if (action !== 'retrait') throw new Error('action inconnue : ' + action);
  const regles = etat.regles ?? [];
  const id = 'g' + (regles.length + 1) + '-' + Date.now().toString(36);
  return { etat: { ...etat, regles: regles.concat([{ id, champ, contient: contient.trim(), action }]) }, id };
}

export function supprimerRegle(etat, id) {
  if (!(etat.regles ?? []).some((r) => r.id === id)) throw new Error('règle introuvable : ' + id);
  return { ...etat, regles: etat.regles.filter((r) => r.id !== id) };
}
