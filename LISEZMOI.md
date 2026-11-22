# Coaching reprise — application web (PWA)

Application de reprise sportive installée sur l'écran d'accueil de l'iPhone.
Toutes les données restent sur l'appareil (IndexedDB de Safari). Aucun serveur ne reçoit vos données.

## 1. Ouvrir l'application sur l'iPhone
L'application doit être ouverte depuis une adresse en `https://`. Si le dépôt est publié avec GitHub Pages,
l'adresse est `https://imadmechri-ux.github.io/SportCoach/`.
Ouvrez-la dans **Safari**, puis : **Partager → Sur l'écran d'accueil**.

## 2. Premier lancement
Répondez aux questions du profil. Le programme démarre à la date choisie : 12 semaines,
marche rapide puis renforcement à la maison, avec une progression lente.

## 3. Collecte des données Apple Santé (raccourci Apple)
Le raccourci écrit chaque jour un fichier CSV dans Fichiers. L'application le lit en un geste.

Format attendu (une ligne par jour, séparateur virgule, valeurs avec point décimal) :

```
date,fc_repos,vfc,sommeil_h,poids_kg,pas,spo2
2026-11-21,59,40,6.1,81.8,5200,98
```

Étapes dans l'app **Raccourcis** :
1. Créer un raccourci. Pour chaque mesure (fréquence au repos, VFC, sommeil, poids, pas, saturation),
   utiliser **Rechercher des échantillons de santé** sur les 14 derniers jours, puis **Calculer la statistique**
   (moyenne, ou dernière valeur pour le poids), puis **Obtenir les détails** des valeurs.
2. Assembler une ligne par jour dans le format ci-dessus avec **Texte**.
3. **Enregistrer le fichier** dans `Fichiers → iCloud Drive → Raccourcis → coaching.csv` (écrasement).
4. Créer une **Automatisation personnelle** : tous les jours à 7 h, lancer ce raccourci, sans confirmation.

Le fichier couvre 14 jours à chaque fois : un import répété ne crée pas de doublon.

Le raccourci n'a pas été testé sur un iPhone réel. Vérifiez le premier fichier produit avant de vous y fier.

## 4. Import dans l'application
Onglet **Données → Importer un CSV**, puis choisissez `coaching.csv` dans Fichiers.
L'application accepte aussi le CSV issu de l'export Apple Santé (format long), produit par le script PowerShell
`filtrer_sante`.

## 5. Sauvegardes
- Onglet **Données → Exporter une sauvegarde** : enregistrez le fichier JSON dans iCloud Drive.
- Une rappel apparaît si la dernière sauvegarde a plus de 7 jours.
- Pour restaurer : **Données → Restaurer une sauvegarde**.
- Safari peut effacer les données d'un site peu utilisé. L'application garde aussi une copie de secours,
  mais la sauvegarde JSON reste la protection principale.

## 6. Alertes de récupération
- FC de repos supérieure de 5 bpm ou plus à la médiane des 14 derniers jours.
- VFC inférieure de 20 % à la médiane des 14 derniers jours.
- Deux nuits de moins de 6 h.
- Douleur signalée à 4/10 ou plus.
- Trois séances de suite notées 8/10 ou plus.

Ces alertes donnent des conseils de prudence. Elles ne remplacent pas un avis médical.

## 7. Séances pas à pas (version 2)
- **Tests de départ** : après le profil, 4 mesures simples (levers-assis, pompes murales, pont, planche) calibrent les charges. Refaisables dans Programme → Tests de départ.
- **Aujourd'hui → Ouvrir la séance** : chaque exercice affiche un schéma de position, les étapes détaillées, la respiration, le tempo, les erreurs à éviter et des variantes.
- **Suivi exercice par exercice** : cochez chaque série, lancez le minuteur de repos ou de maintien, notez la douleur de l'exercice.
- **Programme → Bibliothèque** : les 17 exercices avec leurs fiches complètes.
- Les schémas sont des représentations indicatives. Un lien vidéo peut être ajouté à chaque exercice dans `exercices.js` (champ `video`).
