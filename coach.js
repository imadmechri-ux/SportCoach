// Voix du coach : messages encourageants (texte) et lecture vocale (voix système du téléphone, en français).
(function () {
  "use strict";

  const MESSAGES = {
    bienvenue: [
      "{prenom}, on commence ensemble. Pas besoin d'être parfait, juste régulier.",
      "Ta reprise commence aujourd'hui. Chaque séance compte, même les petites.",
      "Bienvenue {prenom}. Le plus dur, c'est de franchir la porte. Tu l'as fait."
    ],
    avant_marche: [
      "Marche du jour : une allure où tu peux parler. C'est ton moteur pour le cœur.",
      "Aujourd'hui on marche. Dos droit, respiration calme, et profite du rythme.",
      "Une bonne marche, c'est déjà une victoire. On y va tranquillement."
    ],
    avant_renfo: [
      "Séance de renforcement. Concentre-toi sur la technique avant la vitesse.",
      "Aujourd'hui on travaille la force. Une répétition propre vaut mieux que dix bâclées.",
      "C'est parti pour le renfo. Respire, contrôle, et écoute ton corps."
    ],
    serie_faite: ["Belle série !", "Propre. Continue comme ça.", "Tu gères, {prenom} !", "Solide. Une de plus dans la poche."],
    repos_fin: ["C'est reparti !", "Respire, et on repart.", "Allez, prêt ? Une bonne série arrive."],
    valide_facile: [
      "Séance validée, effort bien maîtrisé. Tu progresses, {prenom}.",
      "Bravo {prenom}. Séance faite et bien gérée. Continue comme ça."
    ],
    valide_dur: [
      "Séance dure, et tu l'as finie. C'est exactement ce qui construit la forme.",
      "Tu as poussé fort aujourd'hui. Récupère bien, tu l'as mérité."
    ],
    valide_douleur: [
      "Séance validée. Écoute ton corps, on adapte la suite pour toi.",
      "Tu as bien fait de signaler la douleur. On ajuste, et on reprend en douceur."
    ],
    monte: [
      "Tu passes au niveau supérieur ! Tu l'as vraiment mérité, {prenom}.",
      "Niveau suivant débloqué. Ta régularité paie."
    ],
    reste: [
      "On consolide cette semaine. C'est comme ça qu'on tient sur la durée.",
      "Pas de précipitation : on solidifie avant de monter le niveau."
    ],
    recule: [
      "On reprend un cran plus doux. Ce n'est pas un échec, c'est du bon sens.",
      "On allège un peu pour repartir d'une base solide."
    ],
    retour: [
      "Content de te revoir, {prenom}. On reprend doucement, sans rattraper ce qui a été manqué.",
      "Te revoilà ! Le plus important, c'est de reprendre, pas de compenser."
    ],
    allege: [
      "Ton corps demande de la récupération aujourd'hui. Séance allégée : c'est une vraie bonne décision.",
      "Séance plus légère aujourd'hui, parce que la récupération compte autant que l'effort."
    ],
    douleur: [
      "Stop sur cet exercice. La douleur n'est pas un défi. Si elle persiste, parles-en à ton médecin."
    ],
    serie_longue: [
      "{n} séances de suite ! Tu es en train de créer une vraie habitude.",
      "{n} séances d'affilée, {prenom}. Ça, c'est de la constance."
    ]
  };

  const PREFERENCES_VOIX = ["Amélie", "Thomas", "Audrey", "Aurélie", "Google français", "Hortense"];
  let voixChoisie = null;

  function choisirVoix() {
    if (!("speechSynthesis" in window)) return;
    const voix = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
    voixChoisie = voix.slice().sort((a, b) => rang(a) - rang(b))[0] || null;
  }
  function rang(v) {
    const i = PREFERENCES_VOIX.findIndex((n) => v.name.includes(n));
    return i < 0 ? 99 : i;
  }

  window.COACH = {
    // graine : nombre stable (ex. jour du mois) pour varier les formules sans les tirer au hasard
    phrase(cle, prenom, graine) {
      const pool = MESSAGES[cle] || [];
      if (!pool.length) return "";
      const t = pool[Math.abs(graine || 0) % pool.length];
      return t.replace(/\{prenom\}/g, prenom || "champion");
    },
    texte(cle, prenom, graine, extra) {
      let t = this.phrase(cle, prenom, graine);
      if (extra) Object.keys(extra).forEach((k) => (t = t.replace(new RegExp("\\{" + k + "\\}", "g"), extra[k])));
      return t;
    },
    // Lit le message à voix haute si la voix est activée. Doit être déclenché par un geste de l'utilisateur sur iPhone.
    parler(texte, actif) {
      if (!actif || !texte || !("speechSynthesis" in window)) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texte);
        u.lang = "fr-FR";
        u.rate = 0.98;
        u.pitch = 1.05;
        if (voixChoisie) u.voice = voixChoisie;
        speechSynthesis.speak(u);
      } catch (e) { /* ignoré */ }
    },
    voixDisponible() {
      return "speechSynthesis" in window && !!voixChoisie;
    }
  };

  if ("speechSynthesis" in window) {
    choisirVoix();
    speechSynthesis.onvoiceschanged = choisirVoix;
  }
})();
