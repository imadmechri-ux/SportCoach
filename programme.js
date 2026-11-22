// Programme de reprise sur 12 semaines, en 4 phases.
// facteur : multiplie la charge de base (répétitions ou secondes) selon la phase.
window.PHASES_PROGRAMME = [
  { nom: "Reprise douce", semaines: [1, 2], facteur: 1.0, series: 2, marcheMin: 20,
    renfo: ["chaise", "pompe_mur", "pont"] },
  { nom: "Renforcement léger", semaines: [3, 4], facteur: 1.15, series: 3, marcheMin: 25,
    renfo: ["chaise", "pompe_mur", "pont", "planche_genoux"] },
  { nom: "Construction", semaines: [5, 6, 7, 8], facteur: 1.3, series: 3, marcheMin: 35,
    renfo: ["squat", "pompe_genoux", "fente", "planche", "lateral"] },
  { nom: "Autonomie", semaines: [9, 10, 11, 12], facteur: 1.45, series: 3, marcheMin: 45,
    renfo: ["squat", "pompe", "fente", "planche", "superman", "mollets"] }
];

// Charge de base par exercice.
// test : clé du test de départ utilisé ; ratio : part du résultat de test visée ;
// defaut : valeur si pas de test ; min / max : bornes de sécurité.
window.CHARGES = {
  chaise:         { test: "chaise",   ratio: 0.5, defaut: 8,  min: 4,  max: 20 },
  squat:          { test: "chaise",   ratio: 0.6, defaut: 8,  min: 4,  max: 20 },
  fente:          { test: "chaise",   ratio: 0.4, defaut: 6,  min: 4,  max: 12 },
  pompe_mur:      { test: "pompe_mur", ratio: 0.6, defaut: 6,  min: 3,  max: 20 },
  pompe_genoux:   { test: "pompe_mur", ratio: 0.4, defaut: 5,  min: 3,  max: 15 },
  pompe:          { test: "pompe_mur", ratio: 0.25, defaut: 4, min: 3,  max: 12 },
  pont:           { test: "pont",     ratio: 0.7, defaut: 10, min: 5,  max: 25 },
  planche_genoux: { test: "planche",  ratio: 0.6, defaut: 20, min: 10, max: 60 },
  planche:        { test: "planche",  ratio: 0.4, defaut: 15, min: 10, max: 60 },
  lateral:        { test: "planche",  ratio: 0.3, defaut: 15, min: 10, max: 45 },
  superman:       { defaut: 10, min: 6, max: 15 },
  mollets:        { defaut: 12, min: 8, max: 20 },
  rowing:         { defaut: 10, min: 6, max: 15 },
  tirage:         { defaut: 10, min: 6, max: 15 }
};

// Renvoie { reps } ou { sec } selon le type de l'exercice, calibré sur les tests de départ.
window.prescrire = function (exoId, indexPhase, tests) {
  const c = window.CHARGES[exoId];
  const ex = window.EXERCICES[exoId];
  const phase = window.PHASES_PROGRAMME[indexPhase];
  const resultat = tests && typeof tests[c.test] === "number" && tests[c.test] > 0 ? tests[c.test] : null;
  const base = resultat !== null && c.ratio ? resultat * c.ratio : c.defaut;
  let valeur = Math.round(base * phase.facteur);
  valeur = Math.min(c.max, Math.max(c.min, valeur));
  return ex.type === "temps" ? { sec: valeur } : { reps: valeur };
};
