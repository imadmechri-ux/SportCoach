(function () {
  "use strict";

  const DB_NAME = "coaching";
  const DB_STORE = "kv";
  const DB_KEY = "etat";
  const MIROIR_LS = "coaching-miroir";
  const FORMAT_SAUVEGARDE = "coaching-sauvegarde-v1";
  const JOURS_SEANCE = { 1: [0], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  const GRAPHIQUES = {
    fcRepos: { titre: "FC de repos", unite: "bpm", decimales: 0 },
    vfc: { titre: "Variabilité cardiaque (VFC)", unite: "ms", decimales: 0 },
    sommeil: { titre: "Sommeil", unite: "h", decimales: 1 },
    poids: { titre: "Poids", unite: "kg", decimales: 1 }
  };
  const EX = () => window.EXERCICES;
  const PH = () => window.PHASES_PROGRAMME;

  // ---------- Utilitaires ----------
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
  const aujourdhui = () => iso(new Date());
  const ajouterJours = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const joursEntre = (a, b) => Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
  const jourSemaineLundi0 = (s) => (new Date(s + "T12:00:00").getDay() + 6) % 7;
  const dateFr = (s) => new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const nombre = (v, dec = 0) => (typeof v === "number" && isFinite(v)) ? v.toFixed(dec).replace(".", ",") : "–";
  const duree = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function mediane(v) { if (!v.length) return null; const a = [...v].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 3000);
  }

  // ---------- État et stockage ----------
  function etatVide() {
    return { profil: null, debut: null, etapeTests: false, seances: {}, bilans: {}, sante: {},
      dernierExport: null, dernierImport: null, majLe: null };
  }
  let S = etatVide();
  let onglet = "accueil";
  let choixSuivi = "fcRepos";
  let choixProgramme = "semaine";

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
  async function ecrireBase(v) {
    const db = await ouvrirBase();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(v, DB_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function charger() {
    let base = null;
    try { base = await lireBase(); } catch (e) { console.warn(e); }
    let miroir = null;
    try { miroir = JSON.parse(localStorage.getItem(MIROIR_LS) || "null"); } catch (e) { /* ignoré */ }
    const candidats = [base, miroir].filter(Boolean).sort((a, b) => (b.majLe || "").localeCompare(a.majLe || ""));
    if (candidats.length) S = Object.assign(etatVide(), candidats[0]);
  }
  async function sauver() {
    S.majLe = new Date().toISOString();
    try { await ecrireBase(S); }
    catch (e) { console.error(e); toast("Enregistrement impossible. Exportez votre sauvegarde."); }
    try { localStorage.setItem(MIROIR_LS, JSON.stringify(S)); } catch (e) { /* ignoré */ }
  }

  // ---------- Programme ----------
  function indexPhase(semaine) {
    const s = Math.min(Math.max(semaine, 1), 12);
    const i = PH().findIndex((p) => p.semaines.includes(s));
    return i < 0 ? PH().length - 1 : i;
  }
  function semaineDe(date) {
    if (!S.debut) return 1;
    return Math.max(1, Math.floor(joursEntre(date, S.debut) / 7) + 1);
  }

  // Construit la séance d'une date : blocs successifs, chacun avec ses exercices
  function construireSeance(date) {
    const p = S.profil;
    if (!p || !S.debut || joursEntre(date, S.debut) < 0) return null;
    const n = Math.min(6, Math.max(1, Number(p.joursSemaine) || 3));
    const jours = JOURS_SEANCE[n];
    const idx = jourSemaineLundi0(date);
    if (!jours.includes(idx)) return null;

    const semaine = semaineDe(date);
    const pi = indexPhase(semaine);
    const phase = PH()[pi];
    const type = jours.indexOf(idx) % 2 === 0 ? "marche" : "renfo";
    const materiel = p.materiel || [];

    const blocs = [{ titre: "Échauffement", items: [{ id: "mobilite", minutes: 5 }] }];
    if (type === "marche") {
      blocs.push({ titre: "Marche", items: [{ id: "marche", minutes: Math.min(phase.marcheMin, Number(p.minutes) || 20) }] });
    } else {
      const liste = phase.renfo.slice();
      if (materiel.includes("halteres")) liste.push("rowing");
      if (materiel.includes("elastique")) liste.push("tirage");
      blocs.push({
        titre: "Renforcement",
        items: liste.map((id) => Object.assign({ id, series: phase.series, repos: EX()[id].reposSec || 60 },
          window.prescrire(id, pi, p.tests)))
      });
    }
    blocs.push({ titre: "Retour au calme", items: [{ id: "etirement", minutes: 3 }] });
    return { date, semaine, phase: phase.nom, type, titre: type === "marche" ? "Marche rapide" : "Renforcement à la maison", blocs };
  }

  function prescriptionTexte(it) {
    if (it.id === "mobilite" || it.id === "etirement") return `${it.minutes} min`;
    if (it.id === "marche") return `${it.minutes} min`;
    const ex = EX()[it.id];
    const quantite = ex.type === "temps" ? `${it.sec} s` : `${it.reps} rép.`;
    return `${it.series} × ${quantite} · repos ${it.repos} s`;
  }

  // ---------- Suivi des séances ----------
  function seanceFaite(date) { return S.seances[date] && S.seances[date].fait ? S.seances[date] : null; }
  function suiviItem(date, id, nbSeries) {
    S.seances[date] = S.seances[date] || {};
    const s = S.seances[date];
    s.suivi = s.suivi || {};
    if (!s.suivi[id]) s.suivi[id] = { faites: [], douleur: 0 };
    if (nbSeries) while (s.suivi[id].faites.length < nbSeries) s.suivi[id].faites.push(false);
    return s.suivi[id];
  }
  function avancementSeance(date, seance) {
    let total = 0, fait = 0;
    seance.blocs.forEach((b) => b.items.forEach((it) => {
      if (it.series) {
        total += it.series;
        const f = (S.seances[date] && S.seances[date].suivi && S.seances[date].suivi[it.id]) || { faites: [] };
        fait += f.faites.filter(Boolean).length;
      } else {
        total += 1;
        const f = (S.seances[date] && S.seances[date].suivi && S.seances[date].suivi[it.id]) || { faites: [] };
        if (f.faites[0]) fait += 1;
      }
    }));
    return { total, fait };
  }

  // ---------- Santé et alertes ----------
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
    const s = S.sante[date] || {};
    const fc = mediane(valeursRecentes("fcRepos", date));
    if (typeof s.fcRepos === "number" && fc !== null && s.fcRepos >= fc + 5)
      out.push({ niveau: "attention", texte: `FC de repos à ${s.fcRepos} bpm, soit ${Math.round(s.fcRepos - fc)} bpm au-dessus de votre habitude. Préférez une séance facile ou un repos.` });
    const vfc = mediane(valeursRecentes("vfc", date));
    if (typeof s.vfc === "number" && vfc !== null && s.vfc < 0.8 * vfc)
      out.push({ niveau: "attention", texte: `Variabilité cardiaque basse : ${Math.round(s.vfc)} ms contre ${Math.round(vfc)} ms habituellement. Récupération à privilégier.` });
    const n1 = (S.sante[date] || {}).sommeil, n2 = (S.sante[ajouterJours(date, -1)] || {}).sommeil;
    if (typeof n1 === "number" && typeof n2 === "number" && n1 < 6 && n2 < 6)
      out.push({ niveau: "attention", texte: "Deux nuits de moins de 6 h. Réduisez l'intensité aujourd'hui." });
    const bilan = S.bilans[date];
    if (bilan && typeof bilan.douleur === "number" && bilan.douleur >= 4)
      out.push({ niveau: "alerte", texte: "Douleur générale signalée à 4/10 ou plus. Arrêtez l'exercice concerné. Si elle dure plus de 48 h, consultez un médecin." });
    const suivi = (S.seances[date] && S.seances[date].suivi) || {};
    Object.keys(suivi).forEach((id) => {
      if (suivi[id].douleur >= 4 && EX()[id])
        out.push({ niveau: "alerte", texte: `Douleur à ${EX()[id].nom} : ${suivi[id].douleur}/10. Arrêtez cet exercice et consultez si la gêne persiste.` });
    });
    const recentes = Object.keys(S.seances).filter((d) => d <= date && S.seances[d].fait).sort().reverse().slice(0, 3);
    if (recentes.length === 3 && recentes.every((d) => S.seances[d].rpe >= 8))
      out.push({ niveau: "attention", texte: "Trois séances de suite très difficiles (8/10 ou plus). Gardez la même charge une semaine avant de progresser." });
    return out;
  }
  function seancesDeLaSemaine(date) {
    let prevues = 0, faites = 0;
    for (let i = 0; i < 7; i++) {
      const d = ajouterJours(date, -i);
      if (construireSeance(d)) { prevues++; if (seanceFaite(d)) faites++; }
    }
    return { prevues, faites };
  }
  function rappelSauvegarde() {
    if (!S.dernierExport) return "Aucune sauvegarde encore. Exportez-en une depuis l'onglet Données.";
    const j = joursEntre(aujourdhui(), iso(S.dernierExport));
    return j >= 7 ? `Dernière sauvegarde il y a ${j} jours. Pensez à exporter.` : "";
  }

  // ---------- Import ----------
  function separateurCsv(l) { return l.includes(";") && !l.includes(",") ? ";" : ","; }
  function decouper(ligne, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (q) { if (c === '"') { if (ligne[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function nombreFr(t) { const v = parseFloat(String(t ?? "").replace(",", ".")); return isFinite(v) ? v : null; }
  function dateApple(t) {
    const m = String(t || "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?: ([+-]\d{2})(\d{2}))?/);
    if (!m) return null;
    return new Date(`${m[1]}T${m[2]}${m[3] ? `${m[3]}:${m[4]}` : ""}`);
  }
  function importerLarge(lignes, entete, sep) {
    const cle = { date: entete.indexOf("date"), fcRepos: entete.indexOf("fc_repos"), vfc: entete.indexOf("vfc"),
      sommeil: entete.indexOf("sommeil_h"), poids: entete.indexOf("poids_kg"), pas: entete.indexOf("pas"), spo2: entete.indexOf("spo2") };
    let nb = 0;
    for (let l = 1; l < lignes.length; l++) {
      const c = decouper(lignes[l], sep);
      const date = (c[cle.date] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const jour = Object.assign({}, S.sante[date]);
      ["fcRepos", "vfc", "sommeil", "poids", "pas", "spo2"].forEach((k) => {
        if (cle[k] < 0) return;
        const v = nombreFr(c[cle[k]]);
        if (v !== null) jour[k] = v;
      });
      S.sante[date] = jour; nb++;
    }
    return nb;
  }
  function importerLong(lignes, entete, sep) {
    const iT = entete.indexOf("type"), iD = entete.indexOf("debut"), iF = entete.indexOf("fin"), iV = entete.indexOf("valeur"), iU = entete.indexOf("unite");
    const moy = {}, dernierPoids = {}, sommeil = {};
    const ajout = (d, k, v) => { moy[d] = moy[d] || {}; const m = moy[d][k] = moy[d][k] || { s: 0, n: 0 }; m.s += v; m.n++; };
    for (let l = 1; l < lignes.length; l++) {
      const c = decouper(lignes[l], sep);
      const type = c[iT] || "", debut = c[iD] || "", date = debut.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = nombreFr(c[iV]);
      if (type === "HKQuantityTypeIdentifierRestingHeartRate" && v !== null) ajout(date, "fcRepos", v);
      else if (type === "HKQuantityTypeIdentifierHeartRateVariabilitySDNN" && v !== null) ajout(date, "vfc", v);
      else if (type === "HKQuantityTypeIdentifierOxygenSaturation" && v !== null) ajout(date, "spo2", v <= 1 ? v * 100 : v);
      else if (type === "HKQuantityTypeIdentifierBodyMass" && v !== null) {
        const kg = (c[iU] || "").trim() === "lb" ? v * 0.45359237 : v;
        if (!dernierPoids[date] || debut > dernierPoids[date].t) dernierPoids[date] = { t: debut, v: kg };
      } else if (type === "HKCategoryTypeIdentifierSleepAnalysis" && (c[iV] || "").includes("Asleep")) {
        const d1 = dateApple(debut), d2 = dateApple(c[iF]);
        if (d1 && d2 && d2 > d1) (sommeil[(c[iF] || "").slice(0, 10)] = sommeil[(c[iF] || "").slice(0, 10)] || []).push([d1.getTime(), d2.getTime()]);
      }
    }
    const dates = new Set([...Object.keys(moy), ...Object.keys(dernierPoids), ...Object.keys(sommeil)]);
    dates.forEach((date) => {
      const jour = Object.assign({}, S.sante[date]);
      const m = moy[date] || {};
      Object.keys(m).forEach((k) => { jour[k] = Math.round((m[k].s / m[k].n) * 10) / 10; });
      if (dernierPoids[date]) jour.poids = Math.round(dernierPoids[date].v * 10) / 10;
      if (sommeil[date]) {
        const iv = sommeil[date].sort((a, b) => a[0] - b[0]);
        let total = 0, [ds, fs] = iv[0];
        for (let i = 1; i < iv.length; i++) {
          const [d, f] = iv[i];
          if (d <= fs) fs = Math.max(fs, f);
          else { total += fs - ds; [ds, fs] = [d, f]; }
        }
        total += fs - ds;
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
    const entete = decouper(lignes[0], sep).map((h) => h.trim().toLowerCase());
    if (entete.includes("date")) return { nb: importerLarge(lignes, entete, sep), type: "quotidien" };
    if (entete.includes("type") && entete.includes("valeur")) return { nb: importerLong(lignes, entete, sep), type: "santé" };
    throw new Error("Format non reconnu. Utilisez le CSV du raccourci Santé ou le CSV de l'export Apple Santé.");
  }

  // ---------- Sauvegarde ----------
  function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  async function exporterSauvegarde() {
    S.dernierExport = new Date().toISOString();
    await sauver();
    telecharger(new Blob([JSON.stringify(Object.assign({ format: FORMAT_SAUVEGARDE }, S), null, 2)], { type: "application/json" }),
      `coaching-sauvegarde-${aujourdhui()}.json`);
    toast("Sauvegarde créée. Enregistrez-la dans Fichiers.");
  }
  async function restaurerSauvegarde(texte) {
    const d = JSON.parse(texte);
    if (d.format !== FORMAT_SAUVEGARDE) throw new Error("Ce fichier n'est pas une sauvegarde de l'application.");
    const { format, ...reste } = d;
    S = Object.assign(etatVide(), reste);
    await sauver();
  }

  // ---------- Schémas de position ----------
  function illustration(pose) {
    const P = window.POSES[pose] || window.POSES.debout;
    const ligne = (pts) => `<polyline points="${pts.map((q) => q.join(",")).join(" ")}"/>`;
    let g = `<line class="sol" x1="0" y1="150" x2="200" y2="150"/>`;
    g += `<circle class="tete" cx="${P.h[0]}" cy="${P.h[1]}" r="11"/>`;
    g += ligne([P.n, P.p]);
    P.bras.forEach((b) => (g += ligne(b)));
    P.jambes.forEach((j) => (g += ligne(j)));
    return `<svg class="pose" viewBox="0 0 200 160" role="img" aria-label="Schéma de la position">${g}</svg>`;
  }

  // ---------- Minuteur ----------
  let minuteur = null, tickId = null;
  function demarrerMinuteur(id, secondes, libelle, auFin) {
    arreterMinuteur();
    minuteur = { id, fin: Date.now() + secondes * 1000, libelle, auFin };
    tickId = setInterval(tick, 300);
    rendreBarre();
  }
  function arreterMinuteur() {
    if (tickId) clearInterval(tickId);
    tickId = null; minuteur = null;
    rendreBarre();
  }
  function tick() {
    if (!minuteur) return;
    const reste = Math.ceil((minuteur.fin - Date.now()) / 1000);
    if (reste <= 0) {
      const cb = minuteur.auFin;
      arreterMinuteur();
      try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* ignoré */ }
      if (cb) cb();
      rendu();
      return;
    }
    const el = document.getElementById("minuteur-texte");
    if (el) el.textContent = `${minuteur.libelle} · ${duree(reste)}`;
  }
  function rendreBarre() {
    const b = $("#barre-minuteur");
    if (!minuteur) { b.classList.add("hidden"); b.innerHTML = ""; return; }
    b.classList.remove("hidden");
    b.innerHTML = `<span id="minuteur-texte"></span><button class="secondaire" data-action="passer-minuteur">Passer</button>`;
    tick();
  }

  // ---------- Actions sur la séance ----------
  async function basculerSerie(date, seance, id, index, repos) {
    const item = seance.blocs.flatMap((b) => b.items).find((i) => i.id === id);
    const it = suiviItem(date, id, item.series);
    it.faites[index] = !it.faites[index];
    await sauver();
    if (it.faites[index] && index < item.series - 1 && repos > 0) {
      demarrerMinuteur("repos", repos, "Repos", null);
    } else rendu();
  }
  async function maintien(date, seance, id, index, secondes) {
    const item = seance.blocs.flatMap((b) => b.items).find((i) => i.id === id);
    const it = suiviItem(date, id, item.series);
    demarrerMinuteur(id, secondes, `Maintien ${EX()[id].nom}`, async () => {
      it.faites[index] = true;
      await sauver();
      if (index < item.series - 1 && item.repos > 0) demarrerMinuteur("repos", item.repos, "Repos", null);
    });
  }
  async function bloc(date, seance, id, minutes) {
    const it = suiviItem(date, id, 0);
    if (!it.faites[0]) {
      demarrerMinuteur(id, minutes * 60, EX()[id].nom, async () => {
        it.faites[0] = true;
        await sauver();
      });
    } else {
      it.faites[0] = false;
      await sauver();
      rendu();
    }
  }
  async function douleurItem(date, id, valeur) {
    const it = suiviItem(date, id, 0);
    it.douleur = valeur;
    await sauver();
    rendu();
  }

  // ---------- Vues ----------
  function enteteHtml() {
    const h = $("#entete");
    if (!S.profil) { h.innerHTML = "<h1>Coaching reprise</h1><p>Votre programme sur mesure</p>"; return; }
    const sem = semaineDe(aujourdhui());
    h.innerHTML = `<h1>Bonjour ${esc(S.profil.prenom)}</h1><p>Semaine ${Math.min(sem, 12)} sur 12 · ${esc(PH()[indexPhase(sem)].nom)}</p>`;
  }

  function formulaireProfil(v = {}) {
    const p = Object.assign({ joursSemaine: 3, minutes: 20, materiel: [], objectif: "sante", inactiviteAnnees: 2, debut: aujourdhui() }, v);
    const mat = (k) => (p.materiel || []).includes(k) ? "checked" : "";
    const sel = (n, x) => (String(x) === String(n) ? "selected" : "");
    return `<div class="carte">
      <h2 style="margin-top:0">${S.profil ? "Modifier mon profil" : "Bienvenue"}</h2>
      <p class="muted">Ces réponses servent à construire votre programme. Tout reste sur cet iPhone.</p>
      <form id="formulaire-profil">
        <label for="p-prenom">Prénom</label>
        <input type="text" id="p-prenom" required value="${esc(p.prenom || "")}">
        <div class="grille">
          <div><label for="p-age">Âge</label><input type="number" id="p-age" required min="14" max="99" value="${esc(p.age || "")}"></div>
          <div><label for="p-taille">Taille (cm)</label><input type="number" id="p-taille" required min="120" max="230" value="${esc(p.taille || "")}"></div>
          <div><label for="p-poids">Poids (kg)</label><input type="number" id="p-poids" required min="30" max="250" step="0.1" value="${esc(p.poids || "")}"></div>
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
          <div><label for="p-minutes">Marche maximum (min)</label>
            <select id="p-minutes">${[15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${sel(n, p.minutes)}>${n}</option>`).join("")}</select></div>
        </div>
        <label>Matériel à la maison</label>
        <div class="coches">
          <label><input type="checkbox" name="materiel" value="halteres" ${mat("halteres")}> Haltères ou bouteilles lourdes</label>
          <label><input type="checkbox" name="materiel" value="elastique" ${mat("elastique")}> Élastique</label>
        </div>
        <label for="p-limitations">Blessures, douleurs ou problèmes de santé</label>
        <textarea id="p-limitations" placeholder="Ex. : genou gauche sensible, hypertension…">${esc(p.limitations || "")}</textarea>
        <label for="p-debut">Date de début du programme</label>
        <input type="date" id="p-debut" required value="${esc(p.debut)}">
        <p class="muted">Ce programme ne remplace pas un avis médical. Consultez votre médecin avant de reprendre une activité après une longue pause.</p>
        <div class="ligne" style="margin-top:12px">
          <button type="submit">${S.profil ? "Enregistrer" : "Continuer vers les tests"}</button>
          ${S.profil ? '<button type="button" class="secondaire" data-action="annuler-profil">Annuler</button>' : ""}
        </div>
      </form></div>`;
  }

  function formulaireTests() {
    const t = (S.profil && S.profil.tests) || {};
    return `<div class="carte"><h2 style="margin-top:0">Tests de départ</h2>
      <p class="muted">Quatre mesures simples pour calibrer votre programme sur vos capacités réelles. Faites-les reposé, sans sport intense la veille. Arrêtez à la première douleur ou à la première faute de forme.</p>
      <form id="formulaire-tests">
        ${window.TESTS_DEPART.map((x) => `<div class="carte" style="margin:10px 0">
          ${illustration(x.pose)}
          <h3>${esc(x.nom)}</h3>
          <p class="muted">${esc(x.protocole)}</p>
          <label for="t-${x.id}">Résultat (${esc(x.unite)})</label>
          <input type="number" min="0" max="999" id="t-${x.id}" value="${t[x.id] ?? ""}">
        </div>`).join("")}
        <div class="ligne"><button type="submit">Enregistrer mes résultats</button>
        <button type="button" class="secondaire" data-action="passer-tests">Passer pour l'instant</button></div>
      </form></div>`;
  }

  function vueAccueil() {
    const date = aujourdhui();
    const seance = construireSeance(date);
    const faite = seanceFaite(date);
    const bilan = S.bilans[date] || {};
    const s = S.sante[date] || {};
    let html = "";
    const rappel = rappelSauvegarde();
    if (rappel) html += `<div class="bandeau">${esc(rappel)} <button class="choix" data-onglet="donnees">Données</button></div>`;
    alertes(date).forEach((a) => (html += `<div class="alerte ${a.niveau}">${esc(a.texte)}</div>`));

    html += `<div class="carte"><h3>Aujourd'hui · ${esc(dateFr(date))}</h3>`;
    if (!seance) {
      html += `<p>Jour de repos. Une marche tranquille reste bienvenue si vous vous sentez bien.</p>`;
    } else {
      const av = avancementSeance(date, seance);
      html += `<p class="muted">${esc(seance.phase)} · Semaine ${seance.semaine} · ${esc(seance.titre)}</p>
        <ul class="liste">${seance.blocs.map((b) => `<li><b>${esc(b.titre)}</b> : ${b.items.map((i) => esc(EX()[i.id].nom)).join(", ")}</li>`).join("")}</ul>
        <p class="muted">Avancement : ${av.fait}/${av.total} série(s) ou bloc(s)</p>`;
      html += faite
        ? `<p style="color:var(--ok)">Séance terminée · effort ${faite.rpe}/10</p>`
        : `<div class="ligne" style="margin-top:8px"><button data-onglet="seance">Ouvrir la séance pas à pas</button></div>`;
    }
    html += `<p class="muted">Cette semaine : ${seancesDeLaSemaine(date).faites} séance(s) faite(s) sur ${seancesDeLaSemaine(date).prevues} prévue(s).</p></div>`;

    html += `<div class="carte"><h3>Comment vous sentez-vous ?</h3>
      ${bilanBouton("sommeil", "Sommeil ressenti (1 = mauvais, 5 = excellent)", bilan.sommeil, 5)}
      ${bilanBouton("energie", "Énergie (1 = faible, 5 = forte)", bilan.energie, 5)}
      ${bilanBouton("douleur", "Douleur générale (0 = aucune)", bilan.douleur, 10, true)}
    </div>`;
    if (Object.keys(s).length) {
      html += `<div class="carte"><h3>Mesures importées</h3><div class="grille">
        ${stat("FC repos", nombre(s.fcRepos), "bpm")}${stat("VFC", nombre(s.vfc), "ms")}
        ${stat("Sommeil", nombre(s.sommeil, 1), "h")}${stat("Poids", nombre(s.poids, 1), "kg")}
        ${stat("Pas", nombre(s.pas), "")}${stat("SpO₂", nombre(s.spo2), "%")}</div></div>`;
    } else {
      html += `<p class="muted">Aucune mesure importée pour aujourd'hui. Importez votre fichier depuis l'onglet Données.</p>`;
    }
    return html;
  }

  function vueSeance() {
    const date = aujourdhui();
    const seance = construireSeance(date);
    if (!seance) {
      return `<div class="carte"><h3>Pas de séance aujourd'hui</h3>
        <p>Consultez le programme pour voir les prochaines séances.</p>
        <button data-onglet="programme">Voir le programme</button></div>`;
    }
    const faite = seanceFaite(date);
    const av = avancementSeance(date, seance);
    let html = `<div class="ligne"><button class="secondaire" data-onglet="accueil">← Retour</button></div>
      <h2>${esc(seance.titre)}</h2>
      <p class="muted">Semaine ${seance.semaine} · ${esc(seance.phase)} · ${av.fait}/${av.total} fait(s)</p>`;
    seance.blocs.forEach((b) => {
      html += `<h3 style="margin-top:18px">${esc(b.titre)}</h3>`;
      b.items.forEach((it) => (html += carteExercice(date, it)));
    });
    html += faite
      ? `<div class="carte"><p style="color:var(--ok)">Séance validée · effort ${faite.rpe}/10</p>
          <button class="secondaire" data-action="annuler-validation">Rouvrir la séance</button></div>`
      : `<div class="carte"><h3>Fin de séance</h3>
          <div class="grille">
            <div><label for="rpe">Effort ressenti (1 à 10)</label>
              <select id="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${n === 5 ? "selected" : ""}>${n}</option>`).join("")}</select></div>
            <div><label for="douleur-seance">Douleur générale (0 à 10)</label>
              <select id="douleur-seance">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></div>
          </div>
          <label for="note">Note (facultatif)</label>
          <textarea id="note" placeholder="Comment ça s'est passé ?"></textarea>
          <div class="ligne" style="margin-top:10px"><button data-action="valider-seance">Valider la séance</button></div></div>`;
    return html;
  }

  function carteExercice(date, it) {
    const ex = EX()[it.id];
    const suivi = (S.seances[date] && S.seances[date].suivi && S.seances[date].suivi[it.id]) || { faites: [], douleur: 0 };
    let pied = "";
    if (ex.type === "bloc") {
      const fait = suivi.faites[0];
      pied = `<div class="ligne"><button data-bloc="${it.id}" data-min="${it.minutes}">${fait ? "Annuler" : `Démarrer le minuteur · ${it.minutes} min`}</button>${fait ? '<span style="color:var(--ok)">✓ Fait</span>' : ""}</div>`;
    } else {
      const lignes = [];
      for (let i = 0; i < it.series; i++) {
        const ok = suivi.faites[i];
        if (ex.type === "temps") {
          lignes.push(`<div class="ligne" style="margin:6px 0"><span>Série ${i + 1} · ${it.sec} s</span>
            ${ok ? '<span style="color:var(--ok)">✓</span>' : `<button class="choix" data-maintien="${it.id}" data-i="${i}" data-sec="${it.sec}">Démarrer ${it.sec} s</button>`}
            ${ok ? `<button class="choix" data-serie="${it.id}" data-i="${i}" data-repos="${it.repos}">Annuler</button>` : ""}</div>`);
        } else {
          lignes.push(`<button class="choix ${ok ? "actif" : ""}" data-serie="${it.id}" data-i="${i}" data-repos="${it.repos}">Série ${i + 1} · ${it.reps} rép. ${ok ? "✓" : ""}</button>`);
        }
      }
      pied = `<div class="${ex.type === "temps" ? "" : "ligne"}">${lignes.join("")}</div>
        <p class="muted" style="margin-top:6px">Repos entre les séries : ${it.repos} s</p>`;
    }
    const video = ex.video ? `<p><a href="${esc(ex.video)}" target="_blank" rel="noopener">▶ Voir la vidéo de démonstration</a></p>` : "";
    return `<article class="carte exo">
      <div class="ligne" style="justify-content:space-between"><h3>${esc(ex.nom)}</h3><span class="badge">${esc(it.minutes ? it.minutes + " min" : prescriptionTexte(it))}</span></div>
      ${illustration(ex.pose)}
      <p>${esc(ex.description)}</p>
      <details><summary>Comment faire, pas à pas</summary>
        <ol class="liste">${ex.etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ol>
        <p><b>Respiration :</b> ${esc(ex.respiration)}</p>
        <p><b>Tempo :</b> ${esc(ex.tempo)}</p>
        <p><b>Erreurs fréquentes :</b></p><ul class="liste">${ex.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        <p><b>Plus facile :</b> ${esc(ex.variantes.facile)}</p>
        <p><b>Plus difficile :</b> ${esc(ex.variantes.difficile)}</p>
      </details>
      ${video}
      <p class="muted">${esc(ex.securite)}</p>
      ${pied}
      <div class="ligne" style="margin-top:10px"><label style="margin:0">Douleur pendant cet exercice</label>
        <select data-douleur="${it.id}" style="width:auto">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${n === suivi.douleur ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </article>`;
  }

  function bilanBouton(champ, titre, actuel, max, zeroPossible = false) {
    const boutons = [];
    for (let i = zeroPossible ? 0 : 1; i <= max; i++)
      boutons.push(`<button class="choix ${actuel === i ? "actif" : ""}" data-bilan="${champ}" data-val="${i}">${i}</button>`);
    return `<p class="muted" style="margin:10px 0 4px">${esc(titre)}</p><div class="ligne">${boutons.join("")}</div>`;
  }
  function stat(titre, valeur, unite) {
    return `<div class="stat"><b>${esc(valeur)} ${esc(unite)}</b><span>${esc(titre)}</span></div>`;
  }

  function vueProgramme() {
    const actuelle = semaineDe(aujourdhui());
    let html = `<div class="ligne" style="margin-bottom:6px">
      <button class="choix ${choixProgramme === "semaine" ? "actif" : ""}" data-prog="semaine">Plan 12 semaines</button>
      <button class="choix ${choixProgramme === "bibliotheque" ? "actif" : ""}" data-prog="bibliotheque">Bibliothèque d'exercices</button>
      <button class="choix ${choixProgramme === "tests" ? "actif" : ""}" data-prog="tests">Tests de départ</button></div>`;
    if (choixProgramme === "semaine") {
      html += `<div class="carte"><table><tr><th>Sem.</th><th>Phase</th><th>Séances</th></tr>`;
      PH().forEach((p, i) => p.semaines.forEach((n) => {
        html += `<tr class="${n === actuelle ? "actuelle" : ""}"><td>${n}</td><td>${esc(p.nom)}</td><td>${p.renfo.map((id) => esc(EX()[id].nom)).join(", ")}</td></tr>`;
      }));
      html += `</table><p class="muted">Charges calibrées sur vos tests de départ. Elles augmentent à chaque phase. Les blocs marche et étirements sont communs à toutes les séances.</p></div>`;
      const seance = construireSeance(aujourdhui()) || construireSeance(prochaineSeance());
      if (seance) {
        html += `<div class="carte"><h3>Prochaine séance type : ${esc(seance.titre)}</h3>`;
        seance.blocs.forEach((b) => {
          html += `<h3 style="font-size:15px;margin-top:10px">${esc(b.titre)}</h3><ul class="liste">${b.items.map((i) => `<li>${esc(EX()[i.id].nom)} · ${esc(prescriptionTexte(i))}</li>`).join("")}</ul>`;
        });
        html += `</div>`;
      }
    } else if (choixProgramme === "bibliotheque") {
      html += Object.keys(EX()).map((id) => {
        const ex = EX()[id];
        return `<details class="carte"><summary><b>${esc(ex.nom)}</b> <span class="muted">· ${esc(ex.objectif)}</span></summary>
          ${illustration(ex.pose)}
          <p>${esc(ex.description)}</p>
          <ol class="liste">${ex.etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ol>
          <p><b>Respiration :</b> ${esc(ex.respiration)}</p>
          <p><b>Tempo :</b> ${esc(ex.tempo)}</p>
          <p><b>Muscles :</b> ${esc(ex.muscles)}</p>
          <p><b>Erreurs fréquentes :</b></p><ul class="liste">${ex.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
          <p><b>Plus facile :</b> ${esc(ex.variantes.facile)}</p>
          <p><b>Plus difficile :</b> ${esc(ex.variantes.difficile)}</p>
          <p class="muted">${esc(ex.securite)}</p>
          ${ex.video ? `<p><a href="${esc(ex.video)}" target="_blank" rel="noopener">▶ Voir la vidéo</a></p>` : ""}
        </details>`;
      }).join("");
    } else {
      const t = (S.profil && S.profil.tests) || {};
      html += `<div class="carte"><h3>Vos résultats de départ</h3>
        <table>${window.TESTS_DEPART.map((x) => `<tr><td>${esc(x.nom)}</td><td>${t[x.id] ?? "non fait"} ${esc(x.unite)}</td></tr>`).join("")}</table>
        <div class="ligne" style="margin-top:12px"><button data-action="refaire-tests">Refaire les tests</button></div>
        <p class="muted">Refaire les tests recalcule les charges à partir de la prochaine séance.</p></div>`;
    }
    return html;
  }
  function prochaineSeance() {
    for (let i = 1; i <= 14; i++) { const d = ajouterJours(aujourdhui(), i); if (construireSeance(d)) return d; }
    return aujourdhui();
  }

  function graphique(champ) {
    const { unite, decimales, titre } = GRAPHIQUES[champ];
    const jours = 60, fin = aujourdhui(), pts = [];
    for (let i = jours - 1; i >= 0; i--) {
      const d = ajouterJours(fin, -i);
      const v = (S.sante[d] || {})[champ];
      if (typeof v === "number") pts.push({ x: jours - 1 - i, v });
    }
    if (pts.length < 2) return `<p class="muted">Pas assez de données sur ${jours} jours. Importez vos mesures depuis l'onglet Données.</p>`;
    const W = 320, H = 150, P = 12;
    const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
    const etendue = (max - min) || 1;
    const coords = pts.map((p) => `${(P + (p.x / (jours - 1)) * (W - 2 * P)).toFixed(1)},${(H - P - ((p.v - min) / etendue) * (H - 2 * P)).toFixed(1)}`).join(" ");
    const recents = pts.filter((p) => p.x >= jours - 7).map((p) => p.v);
    const moy7 = recents.length ? recents.reduce((a, b) => a + b, 0) / recents.length : null;
    return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique ${esc(titre)}">
        <line class="axe" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/><polyline points="${coords}"/></svg>
      <div class="grille" style="margin-top:8px">${stat("Dernière valeur", nombre(pts[pts.length - 1].v, decimales), unite)}${stat("Moyenne 7 jours", nombre(moy7, decimales), unite)}</div>
      <p class="muted">Min ${nombre(min, decimales)} · Max ${nombre(max, decimales)} ${esc(unite)} sur 60 jours.</p>`;
  }
  function vueSuivi() {
    const faites = Object.keys(S.seances).filter((d) => S.seances[d].fait).sort();
    const recents = faites.slice(-14).map((d) => S.seances[d].rpe).filter((n) => typeof n === "number");
    const rpe = recents.length ? recents.reduce((a, b) => a + b, 0) / recents.length : null;
    return `<div class="carte"><div class="grille">${stat("Séances validées", String(faites.length), "")}${stat("Effort moyen (14 dernières)", nombre(rpe, 1), "/10")}</div></div>
      <div class="ligne">${Object.keys(GRAPHIQUES).map((k) => `<button class="choix ${choixSuivi === k ? "actif" : ""}" data-suivi="${k}">${esc(GRAPHIQUES[k].titre)}</button>`).join("")}</div>
      <div class="carte"><h3>${esc(GRAPHIQUES[choixSuivi].titre)} · 60 jours</h3>${graphique(choixSuivi)}</div>`;
  }

  function vueDonnees() {
    const f = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "jamais");
    return `
      <div class="carte"><h3>Importer mes mesures</h3>
        <p class="muted">CSV du raccourci Santé (une ligne par jour) ou CSV de l'export Apple Santé. Les jours déjà présents sont mis à jour, rien n'est dupliqué.</p>
        <div class="ligne"><button data-action="choisir-csv">Importer un CSV</button></div>
        <p class="muted">Dernier import : ${esc(f(S.dernierImport))} · ${Object.keys(S.sante).length} jour(s) de mesures</p></div>
      <div class="carte"><h3>Sauvegarde</h3>
        <p class="muted">Exportez une sauvegarde et enregistrez-la dans Fichiers (iCloud Drive) : elle permet de tout restaurer.</p>
        <div class="ligne"><button data-action="exporter">Exporter une sauvegarde</button><button class="secondaire" data-action="restaurer">Restaurer</button></div>
        <p class="muted">Dernier export : ${esc(f(S.dernierExport))}</p></div>
      <div class="carte"><h3>Profil</h3>
        <div class="ligne"><button class="secondaire" data-action="modifier-profil">Modifier mon profil</button></div></div>
      <div class="carte"><h3>Zone de danger</h3>
        <p class="muted">Efface toutes les données de cet appareil. Exportez une sauvegarde avant.</p>
        <button class="danger" data-action="effacer">Tout effacer</button></div>`;
  }

  const VUES = { accueil: vueAccueil, seance: vueSeance, programme: vueProgramme, suivi: vueSuivi, donnees: vueDonnees };

  function rendu() {
    enteteHtml();
    const nav = $("#navigation");
    nav.classList.toggle("hidden", !S.profil || S.etapeTests);
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === onglet || (onglet === "seance" && b.dataset.onglet === "accueil")));
    rendreBarre();
    if (!S.profil) { $("#contenu").innerHTML = formulaireProfil(); return; }
    if (S.etapeTests) { $("#contenu").innerHTML = formulaireTests(); return; }
    $("#contenu").innerHTML = VUES[onglet]();
  }

  // ---------- Événements ----------
  function brancher() {
    document.body.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const date = aujourdhui();
      const seance = construireSeance(date);
      if (b.dataset.onglet) { onglet = b.dataset.onglet; rendu(); window.scrollTo(0, 0); return; }
      if (b.dataset.prog) { choixProgramme = b.dataset.prog; rendu(); return; }
      if (b.dataset.bilan) {
        S.bilans[date] = Object.assign({}, S.bilans[date], { [b.dataset.bilan]: Number(b.dataset.val) });
        await sauver(); rendu(); return;
      }
      if (b.dataset.suivi) { choixSuivi = b.dataset.suivi; rendu(); return; }
      if (b.dataset.serie && seance) return basculerSerie(date, seance, b.dataset.serie, Number(b.dataset.i), Number(b.dataset.repos));
      if (b.dataset.maintien && seance) return maintien(date, seance, b.dataset.maintien, Number(b.dataset.i), Number(b.dataset.sec));
      if (b.dataset.bloc && seance) return bloc(date, seance, b.dataset.bloc, Number(b.dataset.min));
      switch (b.dataset.action) {
        case "valider-seance": {
          S.seances[date] = Object.assign({}, S.seances[date], {
            fait: true, rpe: Number($("#rpe").value), douleur: Number($("#douleur-seance").value),
            note: ($("#note").value || "").trim(), quand: new Date().toISOString()
          });
          await sauver(); toast("Séance validée. Bravo !"); rendu(); return;
        }
        case "annuler-validation":
          S.seances[date] = Object.assign({}, S.seances[date], { fait: false });
          await sauver(); rendu(); return;
        case "passer-minuteur": arreterMinuteur(); rendu(); return;
        case "exporter": return exporterSauvegarde();
        case "restaurer": return $("#fichier-json").click();
        case "choisir-csv": return $("#fichier-csv").click();
        case "modifier-profil":
          $("#contenu").innerHTML = formulaireProfil(Object.assign({}, S.profil, { debut: S.debut }));
          return;
        case "annuler-profil": return rendu();
        case "refaire-tests":
          S.etapeTests = true; await sauver(); rendu(); return;
        case "passer-tests":
          S.profil.tests = S.profil.tests || {};
          S.etapeTests = false; await sauver(); toast("Valeurs par défaut utilisées."); rendu(); return;
        case "effacer": return effacerTout();
      }
    });

    document.body.addEventListener("change", async (e) => {
      if (e.target.dataset.douleur) await douleurItem(aujourdhui(), e.target.dataset.douleur, Number(e.target.value));
    });

    document.body.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (e.target.id === "formulaire-profil") return enregistrerProfil(e.target);
      if (e.target.id === "formulaire-tests") return enregistrerTests();
    });

    $("#fichier-csv").addEventListener("change", (e) => lireFichier(e.target, async (texte) => {
      const r = importerTexte(texte);
      S.dernierImport = new Date().toISOString();
      await sauver();
      toast(`Import ${r.type} : ${r.nb} jour(s) mis à jour.`);
      rendu();
    }));
    $("#fichier-json").addEventListener("change", (e) => lireFichier(e.target, async (texte) => {
      if (!confirm("Remplacer les données actuelles par cette sauvegarde ?")) return;
      await restaurerSauvegarde(texte);
      toast("Sauvegarde restaurée.");
      rendu();
    }));
  }

  async function lireFichier(input, traitement) {
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    try { await traitement(await f.text()); }
    catch (e) { toast(e.message || "Import impossible."); }
  }

  async function enregistrerProfil(form) {
    const prenom = $("#p-prenom").value.trim();
    if (!prenom) { toast("Indiquez un prénom."); return; }
    const materiel = [...form.querySelectorAll('input[name="materiel"]:checked')].map((c) => c.value);
    const premiere = !S.profil;
    S.profil = Object.assign({}, S.profil, {
      prenom, age: Number($("#p-age").value), taille: Number($("#p-taille").value), poids: Number($("#p-poids").value),
      inactiviteAnnees: Number($("#p-inactif").value || 0), objectif: $("#p-objectif").value,
      joursSemaine: Number($("#p-jours").value), minutes: Number($("#p-minutes").value),
      materiel, limitations: $("#p-limitations").value.trim()
    });
    S.debut = $("#p-debut").value || aujourdhui();
    if (premiere || !S.profil.tests) S.etapeTests = true;
    await sauver();
    onglet = "accueil";
    toast(S.etapeTests ? "Profil enregistré. Faites maintenant les tests de départ." : "Profil enregistré.");
    rendu();
  }

  async function enregistrerTests() {
    const tests = {};
    window.TESTS_DEPART.forEach((x) => {
      const v = nombreFr($("#t-" + x.id).value);
      if (v !== null && v > 0) tests[x.id] = v;
    });
    S.profil.tests = tests;
    S.etapeTests = false;
    await sauver();
    toast("Tests enregistrés. Votre programme est calibré.");
    rendu();
  }

  async function effacerTout() {
    if (!confirm("Effacer toutes les données de cet appareil ? Cette action est définitive.")) return;
    if (!confirm("Dernière confirmation : avez-vous une sauvegarde ?")) return;
    S = etatVide();
    try { localStorage.removeItem(MIROIR_LS); } catch (e) { /* ignoré */ }
    arreterMinuteur();
    await sauver();
    onglet = "accueil";
    toast("Données effacées.");
    rendu();
  }

  async function demarrer() {
    brancher();
    await charger();
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignoré */ }
    rendu();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn(e));
  }
  demarrer();
})();
