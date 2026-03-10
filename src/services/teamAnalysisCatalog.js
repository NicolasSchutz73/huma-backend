const actionCatalog = [
  {
    id: 'reduce-workload',
    title: 'Clarifier et réduire la charge de travail',
    priorityLabel: 'Critique',
    expectedImpactLabel: '+35%',
    checklist: [
      'Réduction du nombre de sujets en parallèle',
      'Priorisation explicite et assumée',
      'Suppression des tâches à faible valeur'
    ],
    bestFor: ['charge de travail', 'clarté des priorités', 'fatigue mentale'],
    avoidWhen: ['aucun signal de surcharge']
  },
  {
    id: 'protect-balance',
    title: "Protéger l'équilibre vie pro / vie perso",
    priorityLabel: 'Élevée',
    expectedImpactLabel: '+35%',
    checklist: [
      'Cadre clair sur les horaires',
      'Limitation des urgences artificielles',
      'Exemplarité côté management'
    ],
    bestFor: ['équilibre vie pro / vie perso', 'fatigue mentale', 'charge de travail'],
    avoidWhen: ['sujets de reconnaissance uniquement']
  },
  {
    id: 'recognition-routine',
    title: 'Mettre en place une reconnaissance régulière',
    priorityLabel: 'Élevée',
    expectedImpactLabel: '+25%',
    checklist: [
      'Feedbacks courts et fréquents',
      'Valorisation des efforts',
      'Reconnaissance visible'
    ],
    bestFor: ['reconnaissance', 'motivation', 'relations'],
    avoidWhen: ['urgence de charge critique non traitée']
  },
  {
    id: 'restore-clarity',
    title: 'Redonner du sens et de la visibilité',
    priorityLabel: 'Moyenne',
    expectedImpactLabel: '+20%',
    checklist: [
      'Explication des décisions',
      "Mise en lumière de l'impact du travail",
      'Implication dans certaines orientations'
    ],
    bestFor: ['clarté des priorités', 'motivation', 'organisation'],
    avoidWhen: ['équipe déjà très alignée']
  },
  {
    id: 'prevent-burnout',
    title: "Prévenir l'épuisement mental",
    priorityLabel: 'Complémentaire',
    expectedImpactLabel: '+25%',
    checklist: [
      'Pauses régulières',
      "Points d'écoute individuels",
      'Anticipation des pics de charge'
    ],
    bestFor: ['fatigue mentale', 'charge de travail', 'équilibre vie pro / vie perso'],
    avoidWhen: ['aucun signal de tension']
  }
];

const activityCatalog = [
  {
    id: 'solution-retro',
    title: "Rétrospective d'équipe orientée solutions",
    objective: 'Faire émerger irritants et solutions concrètes',
    format: 'Atelier collectif (1h-1h30)',
    bullets: [
      'Ce qui fonctionne',
      'Ce qui fatigue vraiment',
      "Ce qu'on arrête / améliore"
    ],
    benefitLabel: 'Utile, concret et directement actionnable',
    bestFor: ['charge de travail', 'organisation', 'clarté des priorités'],
    notFor: ['fatigue extrême sans traitement managérial préalable'],
    expectedImpactLabel: '+15%'
  },
  {
    id: 'recognition-icebreaker',
    title: 'Ice breaker Reconnaissance',
    objective: 'Renforcer la reconnaissance entre pairs',
    format: 'Court rituel (15-20min)',
    bullets: [
      'Chaque personne cite un point positif chez un collègue',
      'Basé sur des faits concrets, pas du flou'
    ],
    benefitLabel: 'Simple, peu coûteux, et très efficace émotionnellement',
    bestFor: ['reconnaissance', 'relations', 'motivation'],
    notFor: ['charge non maîtrisée utilisée comme cache-misère'],
    expectedImpactLabel: '+10%'
  },
  {
    id: 'low-pressure-offsite',
    title: 'Activité hors cadre à faible charge mentale',
    objective: 'Décompression sans pression',
    format: 'Moment informel',
    bullets: [
      'Sur le temps de travail',
      'Sans objectif de performance',
      'Sans discours corporate'
    ],
    benefitLabel: 'À utiliser en complément, jamais pour faire oublier les problèmes',
    bestFor: ['fatigue mentale', 'équilibre vie pro / vie perso', 'relations'],
    notFor: ['charge critique non traitée'],
    expectedImpactLabel: '+20%'
  }
];

module.exports = {
  actionCatalog,
  activityCatalog
};
