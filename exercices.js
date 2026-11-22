// Bibliothèque d'exercices et schémas de position (vue de profil, 200 x 160).
// Les schémas sont indicatifs : ils montrent la position, pas une photo réelle.
// Champ "video" : laisser vide, ou coller l'adresse d'une vidéo que vous avez choisie.
window.POSES = {
  debout:        { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [110, 72], [104, 94]]], jambes: [[[100, 90], [100, 120], [102, 148]]] },
  marche:        { h: [102, 22], n: [102, 40], p: [100, 90], bras: [[[102, 46], [118, 68], [128, 82]]], jambes: [[[100, 90], [114, 120], [126, 146]], [[100, 90], [86, 120], [76, 146]]] },
  chaise:        { h: [84, 24], n: [90, 42], p: [104, 102], bras: [[[92, 50], [120, 70], [132, 78]]], jambes: [[[104, 102], [142, 102], [142, 148]]] },
  squat:         { h: [106, 36], n: [106, 56], p: [100, 98], bras: [[[106, 62], [126, 80], [116, 96]]], jambes: [[[100, 98], [124, 112], [110, 148]]] },
  fente:         { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [106, 70], [104, 92]]], jambes: [[[100, 90], [126, 114], [126, 148]], [[100, 90], [80, 120], [66, 146]]] },
  pompe_mur:     { h: [64, 44], n: [74, 60], p: [128, 84], bras: [[[76, 66], [52, 72], [38, 82]]], jambes: [[[128, 84], [166, 104], [186, 148]]] },
  pompe:         { h: [40, 54], n: [52, 64], p: [128, 84], bras: [[[56, 70], [58, 108], [58, 146]]], jambes: [[[128, 84], [170, 110], [190, 146]]] },
  pompe_genoux:  { h: [40, 54], n: [52, 64], p: [124, 84], bras: [[[56, 70], [58, 108], [58, 146]]], jambes: [[[124, 84], [150, 146], [178, 122]]] },
  pont:          { h: [30, 128], n: [46, 132], p: [110, 100], bras: [[[52, 136], [92, 140], [100, 146]]], jambes: [[[110, 100], [148, 96], [160, 146]]] },
  planche:       { h: [40, 96], n: [54, 104], p: [120, 108], bras: [[[60, 110], [64, 146], [30, 146]]], jambes: [[[120, 108], [160, 122], [186, 146]]] },
  planche_genoux:{ h: [40, 96], n: [54, 104], p: [118, 106], bras: [[[60, 110], [64, 146], [30, 146]]], jambes: [[[118, 106], [150, 146], [176, 126]]] },
  lateral:       { h: [40, 64], n: [54, 80], p: [120, 116], bras: [[[60, 88], [64, 146], [36, 146]]], jambes: [[[120, 116], [160, 130], [186, 146]]] },
  superman:      { h: [34, 112], n: [50, 120], p: [110, 124], bras: [[[56, 120], [30, 108], [12, 104]]], jambes: [[[110, 124], [150, 112], [186, 106]]] },
  mollets:       { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [110, 72], [104, 94]]], jambes: [[[100, 90], [100, 120], [106, 140]]] },
  penche:        { h: [60, 44], n: [76, 60], p: [120, 96], bras: [[[76, 66], [90, 92], [98, 122]]], jambes: [[[120, 96], [126, 124], [122, 148]]] },
  // Positions d'arrivée et variantes de mouvement
  chaise_debout: { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [112, 60], [96, 66]]], jambes: [[[100, 90], [100, 120], [102, 148]]] },
  debout_bras_avant: { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [124, 50], [146, 50]]], jambes: [[[100, 90], [100, 120], [102, 148]]] },
  pompe_mur_bas: { h: [58, 60], n: [68, 74], p: [128, 84], bras: [[[72, 80], [52, 92], [38, 84]]], jambes: [[[128, 84], [166, 104], [186, 148]]] },
  pompe_bas:     { h: [40, 66], n: [52, 76], p: [128, 84], bras: [[[56, 80], [76, 112], [58, 146]]], jambes: [[[128, 84], [170, 110], [190, 146]]] },
  pompe_genoux_bas: { h: [40, 66], n: [52, 76], p: [124, 84], bras: [[[56, 80], [76, 112], [58, 146]]], jambes: [[[124, 84], [150, 146], [178, 122]]] },
  pont_bas:      { h: [30, 132], n: [46, 136], p: [108, 136], bras: [[[52, 138], [92, 142], [100, 146]]], jambes: [[[108, 136], [146, 120], [160, 146]]] },
  superman_bas:  { h: [34, 130], n: [50, 136], p: [110, 140], bras: [[[56, 136], [30, 130], [12, 128]]], jambes: [[[110, 140], [150, 142], [186, 144]]] },
  mollets_haut:  { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [110, 72], [104, 94]]], jambes: [[[100, 90], [100, 120], [108, 138]]] },
  penche_tire:   { h: [60, 44], n: [76, 60], p: [120, 96], bras: [[[76, 66], [60, 80], [84, 90]]], jambes: [[[120, 96], [126, 124], [122, 148]]] },
  tirage_avant:  { h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [118, 64], [136, 64]]], jambes: [[[100, 90], [100, 120], [102, 148]]] },
  tirage_arriere:{ h: [100, 22], n: [100, 40], p: [100, 90], bras: [[[100, 46], [82, 54], [72, 66]]], jambes: [[[100, 90], [100, 120], [102, 148]]] }
};

window.EXERCICES = {
  mobilite: {
    nom: "Mobilité articulaire", pose: "debout", type: "bloc",
    objectif: "Préparer les articulations à l'effort", muscles: "Épaules, hanches, chevilles",
    description: "Quelques minutes de mouvements lents pour préparer le corps et réduire le risque de blessure.",
    etapes: [
      "Rotations d'épaules : 10 vers l'avant, 10 vers l'arrière, lentement.",
      "Cercles de hanches : 10 dans chaque sens, mains sur les hanches.",
      "Demi-flexions de genoux : mains sur les genoux, 10 répétitions contrôlées.",
      "Chevilles : 10 cercles par pied, en appui sur une jambe."
    ],
    respiration: "Calme et régulière.", tempo: "Lent, amplitude confortable.", reposSec: 0,
    erreurs: ["Forcer une amplitude qui fait mal.", "Bloquer la respiration."],
    variantes: { facile: "5 mouvements par exercice.", difficile: "Ajouter 10 montées sur la pointe des pieds." },
    securite: "Aucune douleur vive pendant la mobilité.", video: ""
  },
  marche: {
    nom: "Marche rapide", pose: "marche", type: "bloc",
    objectif: "Endurance cardio, santé du cœur", muscles: "Jambes, fessiers, système cardio-vasculaire",
    description: "Le socle de la reprise : elle renforce le cœur sans impact pour les articulations.",
    etapes: [
      "Dos droit, regard à l'horizon, épaules détendues.",
      "Bras pliés à 90°, qui balancent d'avant en arrière.",
      "Pas réguliers : talon, puis pointe du pied.",
      "Cherchez une allure où vous parlez en phrases complètes, sans chanter."
    ],
    respiration: "Naturelle, par le nez si possible.", tempo: "Continu, allure modérée.", reposSec: 0,
    erreurs: ["Aller si vite qu'on ne peut plus parler.", "Se pencher en avant.", "Bloquer les genoux à chaque pas."],
    variantes: { facile: "Deux marches de 10 min dans la journée.", difficile: "Alterner 2 min rapides et 1 min tranquilles." },
    securite: "Arrêtez et consultez en cas de douleur thoracique, d'essoufflement anormal ou de vertiges.", video: ""
  },
  etirement: {
    nom: "Étirements de retour au calme", pose: "debout", type: "bloc",
    objectif: "Relâcher les muscles après l'effort", muscles: "Mollets, cuisses, ischio-jambiers, poitrine",
    description: "Maintenez chaque position 30 secondes, sans rebond, pour aider la récupération.",
    etapes: [
      "Mollets contre un mur : 30 s par jambe, talon au sol.",
      "Ischio-jambiers assis : 30 s, dos long, penché vers les pieds.",
      "Cuisses debout : 30 s par jambe, talon vers les fesses, genoux serrés.",
      "Poitrine contre un cadre de porte : 30 s, coudes à hauteur des épaules."
    ],
    respiration: "Expirez doucement pour approfondir.", tempo: "Maintien statique de 30 s.", reposSec: 0,
    erreurs: ["Rebondir sur l'étirement.", "Retenir sa respiration."],
    variantes: { facile: "15 s par position.", difficile: "Maintenir 45 s." },
    securite: "L'étirement doit tirer, jamais faire mal.", video: ""
  },
  chaise: {
    nom: "Levers-assis sur chaise", pose: "chaise", pose2: "chaise_debout", type: "reps", reposSec: 60,
    objectif: "Force des jambes et des fessiers", muscles: "Quadriceps, fessiers",
    description: "Le mouvement de se lever d'une chaise : le meilleur point de départ pour renforcer les jambes.",
    etapes: [
      "Chaise stable, sans roulettes, pieds à la largeur des hanches.",
      "Asseyez-vous au bord, bras croisés sur la poitrine.",
      "Poussez dans les talons pour vous lever complètement.",
      "Descendez lentement jusqu'à effleurer la chaise, sans vous asseoir."
    ],
    respiration: "Expirez en vous levant, inspirez en descendant.", tempo: "3 s descente · 1 s pause · 2 s montée",
    erreurs: ["Se laisser tomber sur la chaise.", "Genoux qui rentrent vers l'intérieur.", "Buste penché sans contrôle."],
    variantes: { facile: "Posez les mains sur les cuisses pour aider.", difficile: "Chaise plus basse, ou bras tendus devant." },
    securite: "Arrêtez si une douleur apparaît au genou ou au dos.", video: ""
  },
  pompe_mur: {
    nom: "Pompes contre un mur", pose: "pompe_mur", pose2: "pompe_mur_bas", type: "reps", reposSec: 60,
    objectif: "Pectoraux, épaules, triceps", muscles: "Poitrine, épaules, bras",
    description: "Version la plus douce de la pompe : le mur réduit la charge sur les épaules et les poignets.",
    etapes: [
      "Face à un mur, à environ un bras de distance.",
      "Mains à la largeur des épaules, à hauteur de poitrine.",
      "Corps aligné de la tête aux talons : serrez les abdominaux.",
      "Pliez les coudes, approchez la poitrine du mur, puis poussez."
    ],
    respiration: "Inspirez en descendant, expirez en poussant.", tempo: "2 s descente · 0 s pause · 2 s montée",
    erreurs: ["Hanches qui s'affaissent.", "Coudes écartés à 90° du corps.", "Tête qui tombe en avant."],
    variantes: { facile: "Pieds plus proches du mur.", difficile: "Pieds plus éloignés du mur." },
    securite: "Arrêtez si une douleur apparaît à l'épaule ou au poignet.", video: ""
  },
  pompe_genoux: {
    nom: "Pompes sur les genoux", pose: "pompe_genoux", pose2: "pompe_genoux_bas", type: "reps", reposSec: 60,
    objectif: "Pectoraux, triceps, gainage", muscles: "Poitrine, bras, abdominaux",
    description: "Étape intermédiaire entre la pompe murale et la pompe au sol.",
    etapes: [
      "Mains au sol, à la largeur des épaules.",
      "Genoux au sol, derrière les hanches : corps droit des épaules aux genoux.",
      "Descendez le buste en gardant le dos plat.",
      "Poussez pour remonter, sans cambrer le bas du dos."
    ],
    respiration: "Inspirez en descendant, expirez en poussant.", tempo: "2 s descente · 0 s pause · 2 s montée",
    erreurs: ["Cambrer le bas du dos.", "Pousser avec la tête."],
    variantes: { facile: "Revenez à la pompe murale.", difficile: "Passez aux pompes au sol." },
    securite: "Stoppez si la douleur est vive aux poignets.", video: ""
  },
  pompe: {
    nom: "Pompes au sol", pose: "pompe", pose2: "pompe_bas", type: "reps", reposSec: 90,
    objectif: "Pectoraux, triceps, gainage", muscles: "Poitrine, bras, abdominaux, dos",
    description: "L'exercice de poussée complet, à faire sur les pieds quand la version genoux devient facile.",
    etapes: [
      "Mains au sol, légèrement plus larges que les épaules.",
      "Corps en ligne droite des talons à la tête, fessiers contractés.",
      "Descendez en gardant les coudes à environ 45° du corps.",
      "Poussez jusqu'à bras presque tendus, sans verrouiller les coudes."
    ],
    respiration: "Inspirez en descendant, expirez en poussant.", tempo: "2 s descente · 0 s pause · 2 s montée",
    erreurs: ["Hanches trop hautes ou trop basses.", "Coudes ouverts à 90°.", "Mouvement trop rapide."],
    variantes: { facile: "Pompes sur les genoux.", difficile: "Pieds surélevés sur une chaise." },
    securite: "Arrêtez en cas de douleur à l'épaule ou au poignet.", video: ""
  },
  pont: {
    nom: "Pont fessier", pose: "pont_bas", pose2: "pont", type: "reps", reposSec: 45,
    objectif: "Fessiers, arrière de cuisses, bas du dos", muscles: "Fessiers, ischio-jambiers",
    description: "Renforce les fessiers, qui protègent le bas du dos. Très accessible.",
    etapes: [
      "Allongé sur le dos, genoux pliés, pieds à plat à la largeur des hanches.",
      "Bras le long du corps, paumes au sol.",
      "Poussez dans les talons et montez les hanches.",
      "En haut, serrez les fessiers 1 s, puis redescendez lentement."
    ],
    respiration: "Expirez en montant, inspirez en descendant.", tempo: "2 s montée · 1 s pause · 2 s descente",
    erreurs: ["Pousser avec le bas du dos plutôt qu'avec les fessiers.", "Pieds trop loin du corps."],
    variantes: { facile: "Montée moins haute.", difficile: "Pont à une jambe." },
    securite: "Arrêtez en cas de douleur lombaire.", video: ""
  },
  squat: {
    nom: "Squat au poids du corps", pose: "debout_bras_avant", pose2: "squat", type: "reps", reposSec: 60,
    objectif: "Jambes et fessiers", muscles: "Quadriceps, fessiers, ischio-jambiers",
    description: "Le mouvement de base du bas du corps, à faire sans charge pour apprendre la bonne technique.",
    etapes: [
      "Pieds un peu plus larges que les hanches, pointes légèrement ouvertes.",
      "Bras tendus devant pour l'équilibre.",
      "Descendez les fesses vers l'arrière, comme pour vous asseoir.",
      "Poids sur les talons, genoux dans l'axe des pieds. Remontez."
    ],
    respiration: "Inspirez en descendant, expirez en remontant.", tempo: "3 s descente · 1 s pause · 2 s montée",
    erreurs: ["Talons qui décollent.", "Genoux qui rentrent vers l'intérieur.", "Dos arrondi."],
    variantes: { facile: "Squat sur chaise (à effleurer).", difficile: "Squat avec pause de 2 s en bas." },
    securite: "Arrêtez en cas de douleur au genou.", video: ""
  },
  fente: {
    nom: "Fentes sur place", pose: "debout", pose2: "fente", type: "reps", reposSec: 60,
    objectif: "Équilibre, jambes, fessiers", muscles: "Quadriceps, fessiers, stabilisateurs",
    description: "Travail d'une jambe après l'autre : améliore l'équilibre et corrige les déséquilibres.",
    etapes: [
      "Pieds joints, mains sur les hanches ou tenues pour l'équilibre.",
      "Faites un grand pas en avant.",
      "Descendez le genou arrière vers le sol ; le genou avant reste au-dessus de la cheville.",
      "Poussez dans le talon avant pour revenir. Alternez les jambes."
    ],
    respiration: "Expirez en remontant.", tempo: "2 s descente · 0 s pause · 1 s montée (par jambe)",
    erreurs: ["Genou avant qui dépasse fortement les orteils.", "Buste penché en avant."],
    variantes: { facile: "Mains sur un appui stable.", difficile: "Fentes sans pause, plus lentes." },
    securite: "Arrêtez en cas de douleur au genou ou à la hanche.", video: ""
  },
  planche_genoux: {
    nom: "Planche sur les genoux", pose: "planche_genoux", type: "temps", reposSec: 45,
    objectif: "Gainage du tronc", muscles: "Abdominaux, lombaires, épaules",
    description: "Le gainage protège le dos au quotidien. Version genoux au sol, plus accessible.",
    etapes: [
      "Avant-bras au sol, coudes sous les épaules.",
      "Genoux au sol, corps aligné de la nuque aux genoux.",
      "Serrez les abdominaux et les fessiers.",
      "Respirez calmement pendant toute la durée."
    ],
    respiration: "Régulière, ne jamais bloquer.", tempo: "Maintien statique.",
    erreurs: ["Hanches qui tombent.", "Tête relevée, nuque tendue."],
    variantes: { facile: "Durée plus courte.", difficile: "Passez à la planche sur les pieds." },
    securite: "Arrêtez en cas de douleur lombaire.", video: ""
  },
  planche: {
    nom: "Planche sur les avant-bras", pose: "planche", type: "temps", reposSec: 60,
    objectif: "Gainage complet", muscles: "Abdominaux, lombaires, épaules, fessiers",
    description: "Maintenir le corps droit : un des meilleurs exercices pour le dos et la posture.",
    etapes: [
      "Avant-bras parallèles, coudes sous les épaules.",
      "Jambes tendues, pointes des pieds au sol.",
      "Corps droit du crâne aux talons.",
      "Regard au sol, entre les mains."
    ],
    respiration: "Régulière, sans bloquer.", tempo: "Maintien statique.",
    erreurs: ["Fesses trop hautes.", "Hanches qui s'affaissent.", "Épaules qui remontent vers les oreilles."],
    variantes: { facile: "Planche sur les genoux.", difficile: "Lever une jambe à la fois." },
    securite: "Arrêtez en cas de douleur à l'épaule ou au bas du dos.", video: ""
  },
  lateral: {
    nom: "Gainage latéral", pose: "lateral", type: "temps", reposSec: 45,
    objectif: "Muscles latéraux du tronc", muscles: "Obliques, carré des lombes",
    description: "Stabilise la colonne et le bassin, indispensable pour marcher et porter.",
    etapes: [
      "Allongé sur le côté, avant-bras au sol, coude sous l'épaule.",
      "Soulevez les hanches jusqu'à aligner la tête et les pieds.",
      "Maintenez, bras libre le long du corps.",
      "Changez de côté à la fin de la durée prévue."
    ],
    respiration: "Régulière.", tempo: "Maintien statique, par côté.",
    erreurs: ["Hanches qui tombent vers le sol."],
    variantes: { facile: "Genou au sol pour alléger.", difficile: "Lever la jambe du dessus." },
    securite: "Arrêtez en cas de douleur à l'épaule.", video: ""
  },
  superman: {
    nom: "Superman", pose: "superman_bas", pose2: "superman", type: "reps", reposSec: 45,
    objectif: "Bas du dos et fessiers", muscles: "Lombaires, fessiers, épaules",
    description: "Renforce la chaîne postérieure, souvent négligée et utile pour la posture.",
    etapes: [
      "Allongé à plat ventre, bras tendus devant.",
      "Soulevez bras, poitrine et jambes de quelques centimètres.",
      "Tenez 1 s en contractant le bas du dos et les fessiers.",
      "Redescendez lentement."
    ],
    respiration: "Expirez en montant.", tempo: "2 s montée · 1 s pause · 2 s descente",
    erreurs: ["Lever la tête ou le cou exagérément.", "Mouvements brusques."],
    variantes: { facile: "Lever un seul bras ou une seule jambe.", difficile: "Pause de 3 s en haut." },
    securite: "Arrêtez en cas de douleur lombaire vive.", video: ""
  },
  mollets: {
    nom: "Élévations de mollets", pose: "debout", pose2: "mollets_haut", type: "reps", reposSec: 45,
    objectif: "Mollets et chevilles", muscles: "Gastrocnémiens, soléaire",
    description: "Renforce les mollets, utiles pour la marche et la stabilité.",
    etapes: [
      "Debout, pieds à la largeur des hanches, main au mur pour l'équilibre.",
      "Montez sur la pointe des pieds le plus haut possible.",
      "Tenez 1 s.",
      "Redescendez lentement, talons sous le niveau des orteils."
    ],
    respiration: "Expirez en montant.", tempo: "2 s montée · 1 s pause · 2 s descente",
    erreurs: ["Mouvement trop rapide.", "Déséquilibre vers l'avant."],
    variantes: { facile: "Les deux pieds, avec appui.", difficile: "Sur une jambe, sur une marche." },
    securite: "Arrêtez en cas de douleur au tendon d'Achille.", video: ""
  },
  rowing: {
    nom: "Rowing haltères penché", pose: "penche", pose2: "penche_tire", type: "reps", reposSec: 60,
    objectif: "Dos et posture", muscles: "Dorsaux, rhomboïdes, biceps",
    description: "Nécessite deux haltères ou deux bouteilles d'eau lourdes.",
    etapes: [
      "Pieds à la largeur des hanches, genoux légèrement fléchis.",
      "Penchez le buste à environ 45°, dos plat.",
      "Tirez les haltères vers le bas des côtes, coudes près du corps.",
      "Redescendez bras tendus, sans arrondir le dos."
    ],
    respiration: "Expirez en tirant.", tempo: "2 s tirage · 1 s pause · 2 s descente",
    erreurs: ["Dos arrondi.", "Tirer avec les épaules plutôt qu'avec le dos."],
    variantes: { facile: "Bouteilles d'eau légères.", difficile: "Haltères plus lourds." },
    securite: "Arrêtez en cas de douleur lombaire.", video: ""
  },
  tirage: {
    nom: "Tirage élastique", pose: "tirage_avant", pose2: "tirage_arriere", type: "reps", reposSec: 60,
    objectif: "Dos et épaules", muscles: "Dorsaux, rhomboïdes, deltoïdes postérieurs",
    description: "Alternative au rowing avec un élastique. Facile à ranger.",
    etapes: [
      "Fixez l'élastique à une porte ou à un point stable.",
      "Tenez les poignées à hauteur de poitrine, coudes en arrière.",
      "Tirez les coudes vers l'arrière en serrant les omoplates.",
      "Revenez lentement sans relâcher la tension."
    ],
    respiration: "Expirez en tirant.", tempo: "2 s tirage · 1 s pause · 2 s retour",
    erreurs: ["Épaules qui remontent.", "Mouvement brusque."],
    variantes: { facile: "Élastique moins résistant.", difficile: "Élastique plus résistant." },
    securite: "Vérifiez l'élastique avant chaque séance.", video: ""
  }
};

window.TESTS_DEPART = [
  { id: "chaise", nom: "Levers-assis sur chaise", pose: "chaise", unite: "répétitions en 30 s",
    protocole: "Chaise stable, bras croisés sur la poitrine. Comptez les levers complets pendant 30 secondes." },
  { id: "pompe_mur", nom: "Pompes contre un mur", pose: "pompe_mur", unite: "répétitions",
    protocole: "Mains contre le mur, corps aligné. Faites le maximum sans pause, et arrêtez à la première faute de forme." },
  { id: "pont", nom: "Pont fessier", pose: "pont", unite: "répétitions",
    protocole: "Allongé, genoux pliés. Montez les hanches jusqu'à l'alignement, redescendez. Maximum sans pause." },
  { id: "planche", nom: "Planche sur les genoux", pose: "planche_genoux", unite: "secondes",
    protocole: "Avant-bras et genoux au sol, corps aligné. Chronométrez jusqu'à la fin de l'alignement." }
];
