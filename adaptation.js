// Logique d'adaptation du programme. Fonctions pures : aucune lecture ni écriture de l'état ici.
// Tout l'historique passe par ces règles : séances validées, efforts (RPE), douleurs, alertes de récupération.
(function () {
  "use strict";

  // Une semaine est évaluée une fois terminée, à partir des données de cette semaine.
  // Renvoie l'action : "monte" (niveau suivant), "reste" (on consolide), "recule" (on allège).
  window.decideSemaine = function (st) {
    if (st.prevues === 0) return { action: "reste", raison: "Aucune séance prévue cette semaine." };
    const taux = st.faites / st.prevues;
    if (taux < 0.4)
      return { action: "recule", raison: `${st.faites} séance(s) sur ${st.prevues}. On reprend un cran plus doux pour retrouver le rythme.` };
    if (st.douleurMax >= 7)
      return { action: "recule", raison: "Une douleur élevée a été signalée. On allège avant de reprendre." };
    if (st.douleurMax >= 4)
      return { action: "reste", raison: "Une douleur a été signalée. On consolide cette semaine avant de progresser." };
    if (st.rpeMoyen !== null && st.rpeMoyen >= 8)
      return { action: "reste", raison: "Effort ressenti très élevé. On consolide avant de progresser." };
    if (st.alertesRecup >= 3)
      return { action: "reste", raison: "Récupération difficile plusieurs jours. On garde le même niveau." };
    if (taux >= 0.75)
      return { action: "monte", raison: `${st.faites}/${st.prevues} séances faites avec un effort maîtrisé. Vous passez au niveau suivant.` };
    return { action: "reste", raison: "Encore un peu de régularité avant de progresser." };
  };

  // Ajuste la charge d'un exercice (en répétitions, ou en pas de 5 s pour les maintiens) après une séance.
  // delta : écart cumulé par rapport à la charge de base, borné entre -3 et +4.
  window.ajusterDelta = function (delta, reussi, rpe, douleur) {
    if (douleur >= 4 || rpe >= 9 || !reussi) return Math.max(-3, delta - 1);
    if (rpe <= 6 && douleur <= 2) return Math.min(4, delta + 1);
    return delta;
  };

  // Ajuste la durée de marche (en minutes), bornée entre -10 et +20.
  window.ajusterMarche = function (delta, rpe) {
    if (rpe >= 8) return Math.max(-10, delta - 5);
    if (rpe <= 6) return Math.min(20, delta + 5);
    return delta;
  };

  // Charge prescrite pour un exercice : base calibrée (tests + phase) + écart personnel.
  // allege : séance allégée le jour même (récupération insuffisante), environ 20 % de moins.
  window.prescrireAdaptatif = function (exoId, indexPhase, tests, delta, allege) {
    const base = window.prescrire(exoId, indexPhase, tests);
    const ex = window.EXERCICES[exoId];
    const c = window.CHARGES[exoId];
    const pas = ex.type === "temps" ? 5 : 1;
    let v = (base.sec !== undefined ? base.sec : base.reps) + (delta || 0) * pas;
    v = Math.min(c.max, Math.max(c.min, v));
    if (allege) v = Math.max(c.min, Math.round(v * 0.8));
    return ex.type === "temps" ? { sec: v } : { reps: v };
  };
})();
