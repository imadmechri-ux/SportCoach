(function () {
  "use strict";

  // ============================================================
  // Constantes
  // ============================================================
  const DB_NAME = "coaching";
  const DB_STORE = "kv";
  const DB_KEY = "etat";
  const MIROIR_LS = "coaching-miroir";
  const FORMAT_SAUVEGARDE = "coaching-sauvegarde-v1";

  // Phases de reprise : marche rapide puis renforcement à la maison
  const PHASES = [
    { nom: "Reprise douce", semaines: [1, 2], marche: 20, renfo: [
      ["Assis-debout sur une chaise", "2 x 8"],
      ["Pompes contre un mur", "2 x 6"],
      ["Pont fessier", "2 x 10"]
    ]},
    { nom: "Renforcement léger", semaines: [3, 4], marche: 25, renfo: [
      ["Assis-debout sur une chaise", "3 x 10"],
      ["Pompes contre un mur", "3 x 8"],
      ["Pont fessier", "3 x 12"],
      ["Planche sur les genoux", "2 x 20 s"]
    ]},
    { nom: "Construction", semaines: [5, 6, 7, 8], marche: 35, renfo: [
      ["Squat au poids du corps", "3 x 12"],
      ["Pompes sur les genoux", "3 x 8"],
      ["Fentes sur place", "2 x 8 par jambe"],
      ["Planche", "3 x 30 s"],
      ["Gainage latéral", "2 x 20 s par côté"]
    ]},
    { nom: "Autonomie", semaines: [9, 10, 11, 12], marche: 45, renfo: [
      ["Squat", "3 x 15"],
      ["Pompes (genoux ou pieds)", "3 x 10"],
      ["Fentes", "3 x 10 par jambe"],
      ["Planche", "3 x 45 s"],
      ["Superman", "2 x 12"]
    ]}
  ];
  const EXTRA_MATERIEL = {
    halteres: ["Rowing avec haltères", "3 x 10"],
    elastique: ["Tirage avec élastique", "3 x 12"]
  };
  // Jours de séance (0 = lundi) selon le nombre de séances par semaine
  const JOURS_SEANCE = { 1: [0], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

  const GRAPHIQUES = {
    fcRepos: { titre: "FC de repos", unite: "bpm", decimales: 0 },
    vfc: { titre: "Variabilité cardiaque (VFC)", unite: "ms", decimales: 0 },
    sommeil: { titre: "Sommeil", unite: "h", decimales: 1 },
    poids: { titre: "Poids", unite: "kg", decimales: 1 }
  };

  // ============================================================
  // Utilitaires
  // ============================================================
  const $ = (s, racine = document) => racine.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const iso = (d) => {
    const z = new Date(d);
    z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
    return z.toISOString().slice(0, 10);
  };
  const aujourdhui = () => iso(new Date());
  const ajouterJours = (s, n) => {
    const d = new Date(s + "T12:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  };
  const joursEntre = (a, b) => Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
  const jourSemaineLundi0 = (s) => (new Date(s + "T12:00:00").getDay() + 6) % 7;
  const dateFr = (s) => new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const nombre = (v, dec = 0) => (typeof v === "number" && isFinite(v)) ? v.toFixed(dec).replace(".", ",") : "–";

  function mediane(valeurs) {
    if (!valeurs.length) return null;
    const a = [...valeurs].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 3500);
  }

  // ============================================================
  // État et stockage (IndexedDB + miroir localStorage)
  // ============================================================
  function etatVide() {
    return { profil: null, debut: null, seances: {}, bilans: {}, sante: {},
      dernierExport: null, dernierImport: null, majLe: null };
  }
  let S = etatVide();
  let onglet = "accueil";
  let choixSuivi = "fcRepos";

  function ouvrirBase() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function lireBase() {
    const db = await ouvrirBase();
    return new Promise((res, rej) => {
      const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  }
  async function ecrireBase(valeur) {
    const db = await ouvrirBase();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(valeur, DB_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function charger() {
    let base = null;
    try { base = await lireBase(); } catch (e) { console.warn("IndexedDB indisponible", e); }
    let miroir = null;
    try { miroir = JSON.parse(localStorage.getItem(MIROIR_LS) || "null"); } catch (e) { /* ignoré */ }
    const candidats = [base, miroir].filter(Boolean);
    candidats.sort((a, b) => (b.majLe || "").localeCompare(a.majLe || ""));
    if (candidats.length) S = Object.assign(etatVide(), candidats[0]);
  }

  async function sauver() {
    S.majLe = new Date().toISOString();
    try { await ecrireBase(S); }
    catch (e) { console.error(e); toast("Enregistrement impossible. Exportez votre sauvegarde."); }
    try { localStorage.setItem(MIROIR_LS, JSON.stringify(S)); } catch (e) { /* ignoré */ }
  }

  // ============================================================
  // Programme
  // ============================================================
  function phasePour(semaine) {
    const s = Math.min(Math.max(semaine, 1), 12);
    return PHASES.find((p) => p.semaines.includes(s)) || PHASES[PHASES.length - 1];
  }
  function semaineDe(date) {
    if (!S.debut) return 1;
    return Math.max(1, Math.floor(joursEntre(date, S.debut) / 7) + 1);
  }

  // Renvoie la séance prévue pour une date, ou null si repos
  function seancePrevue(date) {
    const p = S.profil;
    if (!p || !S.debut) return null;
    if (joursEntre(date, S.debut) < 0) return null;
    const nSeances = Math.min(6, Math.max(1, Number(p.joursSemaine) || 3));
    const jours = JOURS_SEANCE[nSeances];
    const idxJour = jourSemaineLundi0(date);
    if (!jours.includes(idxJour)) return null;

    const semaine = semaineDe(date);
    const phase = phasePour(semaine);
    const rang = jours.indexOf(idxJour);
    const type = rang % 2 === 0 ? "marche" : "renfo";
    const minutesMarche = Math.min(phase.marche, Number(p.minutes) || 20);

    const consignes = [];
    consignes.push("Mobilité douce 5 min : rotations des épaules, des hanches et des chevilles.");
    const exercices = [];
    let titre;
    if (type === "marche") {
      titre = "Marche rapide";
      consignes.push(`Marchez ${minutesMarche} min à une allure où vous pouvez parler sans chanter.`);
      consignes.push("Si vous êtes essoufflé au point de ne plus pouvoir parler, ralentissez.");
    } else {
      titre = "Renforcement à la maison";
      consignes.push("Faites chaque exercice avec une technique propre. Reposez-vous 60 à 90 s entre les séries.");
      phase.renfo.forEach(([nom, charge]) => exercices.push({ nom, charge }));
      const mat = p.materiel || [];
      if (mat.includes("halteres")) exercices.push({ nom: EXTRA_MATERIEL.halteres[0], charge: EXTRA_MATERIEL.halteres[1] });
      if (mat.includes("elastique")) exercices.push({ nom: EXTRA_MATERIEL.elastique[0], charge: EXTRA_MATERIEL.elastique[1] });
    }
    consignes.push("Arrêtez tout exercice qui provoque une douleur vive. Dans le doute, consultez votre médecin.");

    return { date, semaine, phase: phase.nom, type, titre, minutesMarche, consignes, exercices };
  }

  // ============================================================
  // Séances réalisées, bilans, alertes
  // ============================================================
  function seanceFaite(date) { return S.seances[date] && S.seances[date].fait ? S.seances[date] : null; }

  function santeDuJour(date) { return S.sante[date] || {}; }

  function valeursRecentes(champ, avant, jours = 14) {
    const out = [];
    for (let i = 1; i <= jours; i++) {
      const v = (S.sante[ajouterJours(avant, -i)] || {})[champ];
      if (typeof v === "number") out.push(v);
    }
    return out;
  }

  function alertes(date = aujourdhui()) {
    const out = [];
    const s = santeDuJour(date);

    const fcHabituelle = mediane(valeursRecentes("fcRepos", date));
    if (typeof s.fcRepos === "number" && fcHabituelle !== null && s.fcRepos >= fcHabituelle + 5) {
      out.push({ niveau: "attention", texte: `FC de repos à ${s.fcRepos} bpm, soit ${Math.round(s.fcRepos - fcHabituelle)} bpm au-dessus de votre habitude. Préférez une séance facile ou un repos.` });
    }

    const vfcHabituelle = mediane(valeursRecentes("vfc", date));
    if (typeof s.vfc === "number" && vfcHabituelle !== null && s.vfc < 0.8 * vfcHabituelle) {
      out.push({ niveau: "attention", texte: `Variabilité cardiaque basse : ${Math.round(s.vfc)} ms contre ${Math.round(vfcHabituelle)} ms habituellement. Récupération à privilégier.` });
    }

    const nuit1 = santeDuJour(date).sommeil;
    const nuit2 = santeDuJour(ajouterJours(date, -1)).sommeil;
    if (typeof nuit1 === "number" && typeof nuit2 === "number" && nuit1 < 6 && nuit2 < 6) {
      out.push({ niveau: "attention", texte: "Deux nuits de moins de 6 h. Réduisez l'intensité aujourd'hui." });
    }

    const bilan = S.bilans[date];
    if (bilan && typeof bilan.douleur === "number" && bilan.douleur >= 4) {
      out.push({ niveau: "alerte", texte: "Douleur signalée à 4/10 ou plus. Arrêtez l'exercice concerné. Si la douleur dure plus de 48 h, consultez un médecin." });
    }

    const recentes = Object.keys(S.seances).filter((d) => d <= date && S.seances[d].fait).sort().reverse().slice(0, 3);
    if (recentes.length === 3 && recentes.every((d) => S.seances[d].rpe >= 8)) {
      out.push({ niveau: "attention", texte: "Trois séances de suite jugées très difficiles (8/10 ou plus). Gardez la même charge une semaine avant de progresser." });
    }
    return out;
  }

  function seancesDeLaSemaine(date) {
    let prevues = 0, faites = 0;
    for (let i = 0; i < 7; i++) {
      const d = ajouterJours(date, -i);
      if (seancePrevue(d)) {
        prevues++;
        if (seanceFaite(d)) faites++;
      }
    }
    return { prevues, faites };
  }

  function rappelSauvegarde() {
    if (!S.dernierExport) return "Vous n'avez encore jamais exporté de sauvegarde. Faites-le dès maintenant depuis l'onglet Données.";
    const jours = joursEntre(aujourdhui(), iso(S.dernierExport));
    if (jours >= 7) return `Dernière sauvegarde il y a ${jours} jours. Pensez à exporter.`;
    return "";
  }

  // ============================================================
  // Import : CSV du raccourci (une ligne par jour) ou CSV Santé (format long)
  // ============================================================
  function separateurCsv(ligne) {
    return ligne.includes(";") && !ligne.includes(",") ? ";" : ",";
  }
  function decouperLigne(ligne, sep) {
    const out = [];
    let cur = "", guillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (guillemets) {
        if (c === '"') {
          if (ligne[i + 1] === '"') { cur += '"'; i++; } else guillemets = false;
        } else cur += c;
      } else if (c === '"') guillemets = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function nombreFr(texte) {
    const v = parseFloat(String(texte ?? "").replace(",", "."));
    return isFinite(v) ? v : null;
  }
  // Dates Apple : "2026-11-21 07:30:00 +0100" (Safari refuse ce format tel quel)
  function dateApple(texte) {
    const m = String(texte || "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?: ([+-]\d{2})(\d{2}))?/);
    if (!m) return null;
    const fuseau = m[3] ? `${m[3]}:${m[4]}` : "";
    return new Date(`${m[1]}T${m[2]}${fuseau}`);
  }

  function importerDailyCsv(lignes, entete, sep) {
    const cle = {
      date: entete.indexOf("date"),
      fcRepos: entete.indexOf("fc_repos"),
      vfc: entete.indexOf("vfc"),
      sommeil: entete.indexOf("sommeil_h"),
      poids: entete.indexOf("poids_kg"),
      pas: entete.indexOf("pas"),
      spo2: entete.indexOf("spo2")
    };
    let nb = 0;
    for (let l = 1; l < lignes.length; l++) {
      const c = decouperLigne(lignes[l], sep);
      const date = (c[cle.date] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const jour = Object.assign({}, S.sante[date]);
      ["fcRepos", "vfc", "sommeil", "poids", "pas", "spo2"].forEach((champ) => {
        if (cle[champ] < 0) return;
        const v = nombreFr(c[cle[champ]]);
        if (v !== null) jour[champ] = v;
      });
      S.sante[date] = jour;
      nb++;
    }
    return nb;
  }

  function importerFormatLong(lignes, entete, sep) {
    const iType = entete.indexOf("type"), iDebut = entete.indexOf("debut"), iFin = entete.indexOf("fin");
    const iValeur = entete.indexOf("valeur"), iUnite = entete.indexOf("unite");
    const moyennes = {};   // date -> champ -> {somme, n}
    const dernierPoids = {}; // date -> {t, v}
    const sommeil = {};    // date -> [[debut, fin]]

    const ajouterMoyenne = (date, champ, v) => {
      moyennes[date] = moyennes[date] || {};
      const m = moyennes[date][champ] = moyennes[date][champ] || { somme: 0, n: 0 };
      m.somme += v; m.n++;
    };

    for (let l = 1; l < lignes.length; l++) {
      const c = decouperLigne(lignes[l], sep);
      const type = c[iType] || "";
      const debut = c[iDebut] || "";
      const date = debut.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = nombreFr(c[iValeur]);
      if (type === "HKQuantityTypeIdentifierRestingHeartRate" && v !== null) ajouterMoyenne(date, "fcRepos", v);
      else if (type === "HKQuantityTypeIdentifierHeartRateVariabilitySDNN" && v !== null) ajouterMoyenne(date, "vfc", v);
      else if (type === "HKQuantityTypeIdentifierOxygenSaturation" && v !== null) ajouterMoyenne(date, "spo2", v <= 1 ? v * 100 : v);
      else if (type === "HKQuantityTypeIdentifierBodyMass" && v !== null) {
        const kg = (c[iUnite] || "").trim() === "lb" ? v * 0.45359237 : v;
        if (!dernierPoids[date] || debut > dernierPoids[date].t) dernierPoids[date] = { t: debut, v: kg };
      }
      else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        const valeur = c[iValeur] || "";
        if (valeur.includes("Asleep")) {
          const d1 = dateApple(debut), d2 = dateApple(c[iFin]);
          if (d1 && d2 && d2 > d1) {
            const jourFin = (c[iFin] || "").slice(0, 10);
            (sommeil[jourFin] = sommeil[jourFin] || []).push([d1.getTime(), d2.getTime()]);
          }
        }
      }
    }

    const dates = new Set([...Object.keys(moyennes), ...Object.keys(dernierPoids), ...Object.keys(sommeil)]);
    dates.forEach((date) => {
      const jour = Object.assign({}, S.sante[date]);
      const m = moyennes[date] || {};
      Object.keys(m).forEach((champ) => { jour[champ] = Math.round((m[champ].somme / m[champ].n) * 10) / 10; });
      if (dernierPoids[date]) jour.poids = Math.round(dernierPoids[date].v * 10) / 10;
      if (sommeil[date]) {
        // Fusion des intervalles qui se chevauchent (plusieurs sources) pour éviter le double comptage
        const intervalles = sommeil[date].sort((a, b) => a[0] - b[0]);
        let total = 0, [debutC, finC] = intervalles[0];
        for (let i = 1; i < intervalles.length; i++) {
          const [d, f] = intervalles[i];
          if (d <= finC) finC = Math.max(finC, f);
          else { total += finC - debutC; [debutC, finC] = [d, f]; }
        }
        total += finC - debutC;
        jour.sommeil = Math.round((total / 3600000) * 10) / 10;
      }
      S.sante[date] = jour;
    });
    return dates.size;
  }

  function importerTexte(texte) {
    const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lignes.length < 2) throw new Error("Fichier vide ou non reconnu.");
    const sep = separateurCsv(lignes[0]);
    const entete = decouperLigne(lignes[0], sep).map((h) => h.trim().toLowerCase());
    if (entete.includes("date")) return { nb: importerDailyCsv(lignes, entete, sep), type: "quotidien" };
    if (entete.includes("type") && entete.includes("valeur")) return { nb: importerFormatLong(lignes, entete, sep), type: "santé" };
    throw new Error("Format non reconnu. Utilisez le CSV produit par le raccourci Santé, ou le CSV issu de l'export Apple Santé.");
  }

  // ============================================================
  // Sauvegarde et restauration
  // ============================================================
  function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  async function exporterSauvegarde() {
    S.dernierExport = new Date().toISOString();
    await sauver();
    const contenu = Object.assign({ format: FORMAT_SAUVEGARDE }, S);
    telecharger(new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" }),
      `coaching-sauvegarde-${aujourdhui()}.json`);
    toast("Sauvegarde créée. Enregistrez-la dans Fichiers (iCloud Drive).");
  }

  async function restaurerSauvegarde(texte) {
    const d = JSON.parse(texte);
    if (d.format !== FORMAT_SAUVEGARDE) throw new Error("Ce fichier n'est pas une sauvegarde de l'application.");
    const { format, ...reste } = d;
    S = Object.assign(etatVide(), reste);
    await sauver();
  }

  // ============================================================
  // Vues
  // ============================================================
  function enteteHtml() {
    const h = $("#entete");
    if (!S.profil) { h.innerHTML = "<h1>Coaching reprise</h1><p>Votre programme sur mesure</p>"; return; }
    const date = aujourdhui();
    const semaine = semaineDe(date);
    const phase = phasePour(semaine);
    h.innerHTML = `<h1>Bonjour ${esc(S.profil.prenom)}</h1>
      <p>Semaine ${Math.min(semaine, 12)} sur 12 · ${esc(phase.nom)}</p>`;
  }

  function formulaireProfil(valeurs = {}) {
    const p = Object.assign({ joursSemaine: 3, minutes: 20, materiel: [], objectif: "sante", inactiviteAnnees: 2, debut: aujourdhui() }, valeurs);
    const mat = (k) => (p.materiel || []).includes(k) ? "checked" : "";
    const sel = (n, v) => (String(v) === String(n) ? "selected" : "");
    return `
      <div class="carte">
        <h2 style="margin-top:0">${S.profil ? "Modifier mon profil" : "Bienvenue"}</h2>
        <p class="muted">Ces réponses servent à construire votre programme. Tout reste sur cet iPhone.</p>
        <form id="formulaire-profil">
          <label for="p-prenom">Prénom</label>
          <input type="text" id="p-prenom" required value="${esc(p.prenom || "")}">
          <div class="grille">
            <div><label for="p-age">Âge</label><input type="number" id="p-age" required min="14" max="99" value="${esc(p.age || "")}"></div>
            <div><label for="p-taille">Taille (cm)</label><input type="number" id="p-taille" required min="120" max="230" value="${esc(p.taille || "")}"></div>
            <div><label for="p-poids">Poids actuel (kg)</label><input type="number" id="p-poids" required min="30" max="250" step="0.1" value="${esc(p.poids || "")}"></div>
            <div><label for="p-inactif">Années sans sport</label><input type="number" id="p-inactif" min="0" max="60" value="${esc(p.inactiviteAnnees ?? 2)}"></div>
          </div>
          <label for="p-objectif">Objectif principal</label>
          <select id="p-objectif">
            <option value="sante" ${sel("sante", p.objectif)}>Santé et bien-être</option>
            <option value="perte" ${sel("perte", p.objectif)}>Perte de poids</option>
            <option value="forme" ${sel("forme", p.objectif)}>Remise en forme générale</option>
          </select>
          <div class="grille">
            <div><label for="p-jours">Séances par semaine</label>
              <select id="p-jours">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${sel(n, p.joursSemaine)}>${n}</option>`).join("")}</select></div>
            <div><label for="p-minutes">Minutes de marche max.</label>
              <select id="p-minutes">${[15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${sel(n, p.minutes)}>${n}</option>`).join("")}</select></div>
          </div>
          <label>Matériel disponible à la maison</label>
          <div class="coches">
            <label><input type="checkbox" name="materiel" value="halteres" ${mat("halteres")}> Haltères</label>
            <label><input type="checkbox" name="materiel" value="elastique" ${mat("elastique")}> Élastiques</label>
          </div>
          <label for="p-limitations">Blessures, douleurs ou problèmes de santé à connaître</label>
          <textarea id="p-limitations" placeholder="Ex. : genou gauche sensible, hypertension…">${esc(p.limitations || "")}</textarea>
          <label for="p-debut">Date de début du programme</label>
          <input type="date" id="p-debut" required value="${esc(p.debut)}">
          <p class="muted">Ce programme ne remplace pas un avis médical. Consultez votre médecin avant de reprendre une activité après une longue pause.</p>
          <div class="ligne" style="margin-top:12px">
            <button type="submit">${S.profil ? "Enregistrer" : "Commencer mon programme"}</button>
            ${S.profil ? '<button type="button" class="secondaire" data-action="annuler-profil">Annuler</button>' : ""}
          </div>
        </form>
      </div>`;
  }

  function vueAccueil() {
    if (!S.profil) return formulaireProfil();
    const date = aujourdhui();
    const seance = seancePrevue(date);
    const faite = seanceFaite(date);
    const bilan = S.bilans[date] || {};
    const alertesJour = alertes(date);
    const rappel = rappelSauvegarde();
    const sem = seancesDeLaSemaine(date);
    const s = santeDuJour(date);

    let html = "";
    if (rappel) html += `<div class="bandeau">${esc(rappel)} <button class="choix" data-onglet="donnees">Données</button></div>`;

    alertesJour.forEach((a) => { html += `<div class="alerte ${a.niveau}">${esc(a.texte)}</div>`; });

    html += `<div class="carte">
      <h3>Aujourd'hui · ${esc(dateFr(date))}</h3>`;
    if (!seance) {
      html += `<p>Jour de repos. Une marche tranquille reste bienvenue si vous vous sentez bien.</p>`;
    } else {
      html += `<p class="muted">${esc(seance.phase)} · Semaine ${seance.semaine}</p>
        <h3>${esc(seance.titre)}${seance.type === "marche" ? ` · ${seance.minutesMarche} min` : ""}</h3>
        <ul class="liste">${seance.consignes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`;
      if (seance.exercices.length) {
        html += `<ul class="liste">${seance.exercices.map((e) => `<li><b>${esc(e.nom)}</b> : ${esc(e.charge)}</li>`).join("")}</ul>`;
      }
      if (faite) {
        html += `<p style="color:var(--ok)">Séance faite · effort ${faite.rpe}/10</p>
          <button class="secondaire" data-action="annuler-seance">Annuler la validation</button>`;
      } else {
        html += `<div class="grille">
            <div><label for="rpe">Effort ressenti (1 à 10)</label>
              <select id="rpe">${[1,2,3,4,5,6,7,8,9,10].map((n) => `<option value="${n}" ${n === 5 ? "selected" : ""}>${n}</option>`).join("")}</select></div>
            <div><label for="douleur-seance">Douleur (0 à 10)</label>
              <select id="douleur-seance">${[0,1,2,3,4,5,6,7,8,9,10].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></div>
          </div>
          <label for="note">Note (facultatif)</label>
          <textarea id="note" placeholder="Comment ça s'est passé ?"></textarea>
          <div class="ligne" style="margin-top:10px"><button data-action="valider-seance">Marquer la séance comme faite</button></div>`;
      }
    }
    html += `<p class="muted" style="margin-bottom:0">Cette semaine : ${sem.faites} séance(s) faite(s) sur ${sem.prevues} prévue(s).</p></div>`;

    html += `<div class="carte"><h3>Comment vous sentez-vous ?</h3>
      ${bilanBouton("sommeil", "Sommeil ressenti", bilan.sommeil, 5)}
      ${bilanBouton("energie", "Énergie", bilan.energie, 5)}
      ${bilanBouton("douleur", "Douleur (0 = aucune)", bilan.douleur, 10, true)}
      </div>`;

    if (Object.keys(s).length) {
      html += `<div class="carte"><h3>Mesures importées</h3><div class="grille">
        ${stat("FC repos", nombre(s.fcRepos), "bpm")}
        ${stat("VFC", nombre(s.vfc), "ms")}
        ${stat("Sommeil", nombre(s.sommeil, 1), "h")}
        ${stat("Poids", nombre(s.poids, 1), "kg")}
        ${stat("Pas", nombre(s.pas), "")}
        ${stat("SpO₂", nombre(s.spo2), "%")}
      </div></div>`;
    } else {
      html += `<p class="muted">Aucune mesure importée pour aujourd'hui. Importez votre fichier depuis l'onglet Données.</p>`;
    }
    return html;
  }

  function stat(titre, valeur, unite) {
    return `<div class="stat"><b>${esc(valeur)} ${esc(unite)}</b><span>${esc(titre)}</span></div>`;
  }

  function bilanBouton(champ, titre, actuel, max, zeroPossible = false) {
    const debut = zeroPossible ? 0 : 1;
    const boutons = [];
    for (let i = debut; i <= max; i++) {
      boutons.push(`<button class="choix ${actuel === i ? "actif" : ""}" data-bilan="${champ}" data-val="${i}">${i}</button>`);
    }
    return `<p class="muted" style="margin:10px 0 4px">${esc(titre)}</p><div class="ligne">${boutons.join("")}</div>`;
  }

  function vueProgramme() {
    if (!S.profil) return formulaireProfil();
    const actuelle = semaineDe(aujourdhui());
    const lignes = PHASES.flatMap((p) => p.semaines.map((n) => ({ n, p })));
    let html = `<div class="carte"><h3>Votre programme sur 12 semaines</h3>
      <p class="muted">Séances : ${esc(S.profil.joursSemaine)} par semaine · marche jusqu'à ${esc(S.profil.minutes)} min. La progression est lente exprès : on augmente une semaine sur deux seulement si les alertes restent calmes.</p>
      <table><tr><th>Sem.</th><th>Phase</th><th>Marche</th><th>Renforcement</th></tr>`;
    lignes.forEach(({ n, p }) => {
      const marche = Math.min(p.marche, Number(S.profil.minutes) || 20);
      const renfo = p.renfo.map(([nom, charge]) => `${esc(nom)} ${esc(charge)}`).join("<br>");
      html += `<tr class="${n === actuelle ? "actuelle" : ""}"><td>${n}</td><td>${esc(p.nom)}</td><td>${marche} min</td><td>${renfo}</td></tr>`;
    });
    html += `</table></div>`;
    html += `<p class="muted">Après la semaine 12, le programme se termine. Revenez sur votre profil pour en définir un nouveau.</p>`;
    return html;
  }

  function graphique(champ) {
    const { unite, decimales } = GRAPHIQUES[champ];
    const jours = 60, fin = aujourdhui();
    const points = [];
    for (let i = jours - 1; i >= 0; i--) {
      const d = ajouterJours(fin, -i);
      const v = (S.sante[d] || {})[champ];
      if (typeof v === "number") points.push({ x: jours - 1 - i, v, d });
    }
    if (points.length < 2) {
      return `<p class="muted">Pas assez de données sur ${jours} jours. Importez vos mesures depuis l'onglet Données.</p>`;
    }
    const W = 320, H = 150, P = 12;
    const min = Math.min(...points.map((p) => p.v)), max = Math.max(...points.map((p) => p.v));
    const etendue = (max - min) || 1;
    const coords = points.map((p) => {
      const x = P + (p.x / (jours - 1)) * (W - 2 * P);
      const y = H - P - ((p.v - min) / etendue) * (H - 2 * P);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const derniere = points[points.length - 1].v;
    const recents = points.filter((p) => p.x >= jours - 7).map((p) => p.v);
    const moyenne7 = recents.length ? recents.reduce((a, b) => a + b, 0) / recents.length : null;
    return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique ${esc(GRAPHIQUES[champ].titre)}">
        <line class="axe" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"></line>
        <polyline points="${coords}"></polyline>
      </svg>
      <div class="grille" style="margin-top:8px">
        ${stat("Dernière valeur", nombre(derniere, decimales), unite)}
        ${stat("Moyenne 7 jours", nombre(moyenne7, decimales), unite)}
      </div>
      <p class="muted">Min ${nombre(min, decimales)} · Max ${nombre(max, decimales)} ${esc(unite)} sur 60 jours.</p>`;
  }

  function vueSuivi() {
    if (!S.profil) return formulaireProfil();
    const seancesFaites = Object.keys(S.seances).filter((d) => S.seances[d].fait).sort();
    const recentes = seancesFaites.slice(-14).map((d) => S.seances[d].rpe).filter((n) => typeof n === "number");
    const rpeMoyen = recentes.length ? recentes.reduce((a, b) => a + b, 0) / recentes.length : null;
    let html = `<div class="carte"><div class="grille">
        ${stat("Séances faites", String(seancesFaites.length), "")}
        ${stat("Effort moyen (14 dernières)", nombre(rpeMoyen, 1), "/10")}
      </div></div>`;
    html += `<div class="ligne">${Object.keys(GRAPHIQUES).map((k) =>
      `<button class="choix ${choixSuivi === k ? "actif" : ""}" data-suivi="${k}">${esc(GRAPHIQUES[k].titre)}</button>`).join("")}</div>`;
    html += `<div class="carte"><h3>${esc(GRAPHIQUES[choixSuivi].titre)} · 60 jours</h3>${graphique(choixSuivi)}</div>`;
    return html;
  }

  function vueDonnees() {
    const dernierImport = S.dernierImport ? new Date(S.dernierImport).toLocaleString("fr-FR") : "jamais";
    const dernierExport = S.dernierExport ? new Date(S.dernierExport).toLocaleString("fr-FR") : "jamais";
    const nbJours = Object.keys(S.sante).length;
    const nbSeances = Object.keys(S.seances).filter((d) => S.seances[d].fait).length;
    return `
      <div class="carte">
        <h3>Importer mes mesures</h3>
        <p class="muted">Choisissez le fichier CSV produit par le raccourci Santé (une ligne par jour), ou le CSV issu de l'export Apple Santé. Les mesures déjà présentes sont mises à jour, rien n'est dupliqué.</p>
        <div class="ligne"><button data-action="choisir-csv">Importer un CSV</button></div>
        <p class="muted">Dernier import : ${esc(dernierImport)} · ${nbJours} jour(s) de mesures</p>
      </div>
      <div class="carte">
        <h3>Sauvegarde</h3>
        <p class="muted">Vos données ne quittent pas cet iPhone. Exportez une sauvegarde et enregistrez-la dans Fichiers (iCloud Drive) : elle vous permettra de tout restaurer.</p>
        <div class="ligne">
          <button data-action="exporter">Exporter une sauvegarde</button>
          <button class="secondaire" data-action="restaurer">Restaurer une sauvegarde</button>
        </div>
        <p class="muted">Dernier export : ${esc(dernierExport)} · ${nbSeances} séance(s) enregistrée(s)</p>
      </div>
      <div class="carte">
        <h3>Profil et programme</h3>
        <div class="ligne"><button class="secondaire" data-action="modifier-profil">Modifier mon profil</button></div>
      </div>
      <div class="carte">
        <h3>Zone de danger</h3>
        <p class="muted">Efface toutes les données de cet appareil. Exportez une sauvegarde avant.</p>
        <button class="danger" data-action="effacer">Tout effacer</button>
      </div>`;
  }

  const VUES = { accueil: vueAccueil, programme: vueProgramme, suivi: vueSuivi, donnees: vueDonnees };

  function rendu() {
    enteteHtml();
    const nav = $("#navigation");
    nav.classList.toggle("hidden", !S.profil);
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === onglet));
    if (!S.profil) { $("#contenu").innerHTML = formulaireProfil(); return; }
    $("#contenu").innerHTML = VUES[onglet]();
  }

  // ============================================================
  // Actions
  // ============================================================
  async function validerSeance() {
    const date = aujourdhui();
    S.seances[date] = {
      fait: true,
      rpe: Number($("#rpe").value),
      douleur: Number($("#douleur-seance").value),
      note: ($("#note").value || "").trim(),
      quand: new Date().toISOString()
    };
    await sauver();
    toast("Séance enregistrée. Bon travail !");
    rendu();
  }

  async function annulerSeance() {
    delete S.seances[aujourdhui()];
    await sauver();
    rendu();
  }

  async function enregistrerBilan(champ, valeur) {
    const date = aujourdhui();
    S.bilans[date] = Object.assign({}, S.bilans[date], { [champ]: valeur });
    await sauver();
    rendu();
  }

  async function enregistrerProfil(form) {
    const debut = $("#p-debut").value || aujourdhui();
    const materiel = [...form.querySelectorAll('input[name="materiel"]:checked')].map((c) => c.value);
    const profil = {
      prenom: $("#p-prenom").value.trim(),
      age: Number($("#p-age").value),
      taille: Number($("#p-taille").value),
      poids: Number($("#p-poids").value),
      inactiviteAnnees: Number($("#p-inactif").value || 0),
      objectif: $("#p-objectif").value,
      joursSemaine: Number($("#p-jours").value),
      minutes: Number($("#p-minutes").value),
      materiel,
      limitations: $("#p-limitations").value.trim()
    };
    if (!profil.prenom) { toast("Indiquez un prénom."); return; }
    S.profil = profil;
    S.debut = debut;
    await sauver();
    onglet = "accueil";
    toast("Programme enregistré.");
    rendu();
  }

  function choisirFichier(id) { $(id).click(); }

  async function lireFichier(input, traitement) {
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    try {
      const texte = await f.text();
      await traitement(texte);
    } catch (e) {
      toast(e.message || "Import impossible.");
    }
  }

  async function effacerTout() {
    if (!confirm("Effacer toutes les données de cet appareil ? Cette action est définitive.")) return;
    if (!confirm("Dernière confirmation : avez-vous une sauvegarde ?")) return;
    S = etatVide();
    try { localStorage.removeItem(MIROIR_LS); } catch (e) { /* ignoré */ }
    await sauver();
    onglet = "accueil";
    toast("Données effacées.");
    rendu();
  }

  // ============================================================
  // Événements
  // ============================================================
  function brancher() {
    document.body.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.onglet) { onglet = btn.dataset.onglet; rendu(); window.scrollTo(0, 0); return; }
      if (btn.dataset.bilan) { await enregistrerBilan(btn.dataset.bilan, Number(btn.dataset.val)); return; }
      if (btn.dataset.suivi) { choixSuivi = btn.dataset.suivi; rendu(); return; }
      switch (btn.dataset.action) {
        case "valider-seance": return validerSeance();
        case "annuler-seance": return annulerSeance();
        case "exporter": return exporterSauvegarde();
        case "restaurer": return choisirFichier("#fichier-json");
        case "choisir-csv": return choisirFichier("#fichier-csv");
        case "modifier-profil": return modifierProfil();
        case "annuler-profil": return rendu();
        case "effacer": return effacerTout();
      }
    });

    document.body.addEventListener("submit", (e) => {
      if (e.target.id === "formulaire-profil") {
        e.preventDefault();
        enregistrerProfil(e.target);
      }
    });

    $("#fichier-csv").addEventListener("change", (e) => lireFichier(e.target, async (texte) => {
      const res = importerTexte(texte);
      S.dernierImport = new Date().toISOString();
      await sauver();
      toast(`Import ${res.type} : ${res.nb} jour(s) mis à jour.`);
      rendu();
    }));

    $("#fichier-json").addEventListener("change", (e) => lireFichier(e.target, async (texte) => {
      if (!confirm("Remplacer les données actuelles par cette sauvegarde ?")) return;
      await restaurerSauvegarde(texte);
      toast("Sauvegarde restaurée.");
      rendu();
    }));
  }

  function modifierProfil() {
    $("#contenu").innerHTML = formulaireProfil(Object.assign({}, S.profil, { debut: S.debut }));
  }

  // ============================================================
  // Démarrage
  // ============================================================
  async function demarrer() {
    brancher();
    await charger();
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) { /* ignoré */ }
    rendu();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Hors ligne indisponible", e));
    }
  }

  demarrer();
})();
