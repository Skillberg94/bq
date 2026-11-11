// Extraction d'une opération depuis un mail d'alerte de la banque.
// Fonctions simples, sans accès réseau ni stockage : testables à part.
(function (racine) {
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DATE = '(\\d{1,2})\\s+(' + MOIS.join('|') + ')\\s+(\\d{4})';
  const MONTANT = '([+\\-\\u2212\\u2013]?)\\s?(\\d[\\d\\s\\u00a0\\u202f]*,\\d{2})\\s?€';
  // Une ligne d'opération : libellé, puis date, puis montant (juste après le nom du titulaire du compte).
  const LIGNE = new RegExp('ouvert au nom de .*?\\.\\s+(.+?)\\s+' + DATE + '\\s+' + MONTANT, 'is');

  // Virements entre mes propres comptes : à ne pas compter (consigne du propriétaire, 02/11/2026).
  const IGNORES = [/^VIR\.?\s+VERS\s+CPT\s+DEPOT\s+PART\.?$/i, /^VIR\.?\s+VERS\s+LIVRET\s+A$/i];

  const nettoyer = (t) => t.replace(/[\s  ]+/g, ' ').trim();

  function sensDeObjet(objet) {
    const o = objet.toLowerCase();
    if (o.includes('sortie d')) return 'sortie';
    if (o.includes('entrée d') || o.includes('entree d')) return 'entree';
    return null;
  }

  // Tout mail d'alerte de la banque, quel que soit le type d'opération (sortie, entrée, retrait au distributeur…).
  const EST_ALERTE = /op[ée]ration\s+li[ée]e\s+[àa]\s+l.alerte/i;

  // m = { id, objet, texte } -> { id, objet, ignore: raison | null, sens, libelle, date (AAAA-MM-JJ), centimes (toujours positif) }
  // Le sens vient de l'objet (« Sortie d'argent » / « Entrée d'argent ») ; pour un autre type d'alerte, du signe du montant.
  function extraireOperation(m) {
    const objet = m.objet || '';
    const sensObjet = sensDeObjet(objet);
    if (!sensObjet && !EST_ALERTE.test(objet)) return { id: m.id, objet, ignore: 'objet non reconnu : ' + objet };
    const trouve = LIGNE.exec(nettoyer(m.texte || ''));
    if (!trouve) return { id: m.id, objet, ignore: 'ligne d\'opération introuvable', ...(sensObjet && { sens: sensObjet }) };
    const libelle = nettoyer(trouve[1]);
    const jour = trouve[2].padStart(2, '0');
    const mois = String(MOIS.indexOf(trouve[3].toLowerCase()) + 1).padStart(2, '0');
    const date = trouve[4] + '-' + mois + '-' + jour;
    const centimes = Math.round(parseFloat(trouve[6].replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    const signeMontant = trouve[5] === '' ? null : trouve[5] === '+' ? 'entree' : 'sortie';
    const sens = sensObjet ?? signeMontant;
    if (!sens) return { id: m.id, objet, ignore: 'sens indéterminé (ni l\'objet ni le signe du montant ne le disent)', libelle, date, centimes };
    const op = { id: m.id, objet, ignore: null, sens, libelle, date, centimes };
    if (sensObjet && signeMontant && signeMontant !== sensObjet) op.alerte = 'le signe du montant et l\'objet du mail ne concordent pas';
    if (IGNORES.some((re) => re.test(libelle))) op.ignore = 'virement entre mes comptes';
    return op;
  }

  // Notification Banxo de l'iPhone (11/11/2026), déposée au pont par Raccourcis : « L'opération LIBELLÉ de -12,34€ vient d'être
  // débitée du compte de … ». n = { id, titre, texte, date (AAAA-MM-JJ : jour de réception) } -> même forme qu'un mail.
  const NOTIF = new RegExp("L['\u2019]op[ée]ration\\s+(.+?)\\s+de\\s+" + MONTANT + "\\s+vient\\s+d['\u2019][êe]tre\\s+(d[ée]bit[ée]e|cr[ée]dit[ée]e)", 'is');
  function extraireNotification(n) {
    const objet = n.titre || '';
    const trouve = NOTIF.exec(nettoyer(n.texte || ''));
    if (!trouve) return { id: n.id, objet, ignore: 'notification non reconnue' };
    const libelle = nettoyer(trouve[1]);
    const centimes = Math.round(parseFloat(trouve[3].replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    const sensMot = /^d/i.test(trouve[4]) ? 'sortie' : 'entree';
    const sensObjet = sensDeObjet(objet);
    const signe = trouve[2] === '' ? null : trouve[2] === '+' ? 'entree' : 'sortie';
    const sens = sensObjet ?? sensMot;
    const op = { id: n.id, objet, ignore: null, sens, libelle, date: n.date, centimes };
    if ((signe && signe !== sens) || sensMot !== sens) op.alerte = 'le signe du montant et le titre de la notification ne concordent pas';
    if (IGNORES.some((re) => re.test(libelle))) op.ignore = 'virement entre mes comptes';
    return op;
  }

  // Anti-doublon : on ne garde que les opérations dont l'identifiant de mail n'est pas déjà connu.
  function fusionner(existantes, nouvelles) {
    const connus = new Set(existantes.map((o) => o.id));
    const ajoutees = nouvelles.filter((o) => !o.ignore && !connus.has(o.id));
    return { liste: existantes.concat(ajoutees), ajoutees };
  }

  // Corps d'un mail en texte. Deux formes possibles :
  //  - l'API Gmail normale donne du base64url (texte) ;
  //  - le service Gmail intégré à Apps Script (pont) donne les octets déjà décodés, sous forme de liste de nombres signés.
  function decoderCorps(donnees) {
    let octets;
    if (typeof donnees === 'string') {
      const bin = atob(donnees.replace(/-/g, '+').replace(/_/g, '/'));
      octets = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    } else if (Array.isArray(donnees)) {
      octets = Uint8Array.from(donnees, (v) => v & 255); // -61 devient 195, etc.
    } else {
      throw new Error('corps de mail illisible (ni texte ni liste d\'octets)');
    }
    return new TextDecoder('utf-8').decode(octets);
  }

  const api = { extraireOperation, extraireNotification, fusionner, decoderCorps };
  if (typeof module !== 'undefined') module.exports = api;
  else racine.Extraction = api;
})(typeof window !== 'undefined' ? window : globalThis);
