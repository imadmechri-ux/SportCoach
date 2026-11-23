(function () {
  "use strict";

  const DB_NAME = "coaching", DB_STORE = "kv", DB_KEY = "etat";
  const MIROIR_LS = "coaching-miroir";
  const FORMAT_SAUVEGARDE = "coaching-sauvegarde-v1";
  const JOURS_SEANCE = { 1: [0], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  const GRAPHIQUES = {
    fcRepos: { titre: "FC de repos", unite: "bpm", decimales: 0 },
    vfc: { titre: "VFC", unite: "ms", decimales: 0 },
    sommeil: { titre: "Sommeil", unite: "h", decimales: 1 },
    poids: { titre: "Poids", unite: "kg", decimales: 1 }
  };
  const COULEURS_PHASE = ["#2dd4bf", "#60a5fa", "#f59e0b", "#ff4d1f"];
  const EX = () => window.EXERCICES;
  const PH = () => window.PHASES_PROGRAMME;
  const ACTIONS_BILAN = { monte: "▲ Niveau suivant", reste: "■ Consolidation", recule: "▼ Allègement" };

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
  const dateCourte = (s) => new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const nombre = (v, dec = 0) => (typeof v === "number" && isFinite(v)) ? v.toFixed(dec).replace(".", ",") : "–";
  const duree = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const graine = () => new Date().getDate() + new Date().getMonth();
  function mediane(v) { if (!v.length) return null; const a = [...v].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 3200);
  }

  // ---------- État et stockage ----------
  function progressionInitiale() {
    return { semaineEvaluee: 0, niveau: 0, deltas: {}, marcheDelta: 0, bilans: [] };
  }
  function etatVide() {
    return { profil: null, debut: null, etapeTests: false, seances: {}, bilans: {}, sante: {},
      progression: progressionInitiale(), voix: false, dernierExport: null, dernierImport: null, majLe: null };
  }
  let S = etatVide();
  let onglet = "accueil";
  let choixSuivi = "fcRepos";
  let choixProgramme = "plan";
  let minuteur = null, tickId = null;

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
    S.progression = Object.assign(progressionInitiale(), S.progression || {});
    S.progression.deltas = S.progression.deltas || {};
    S.progression.bilans = S.progression.bilans || [];
  }
  async function sauver() {
    S.majLe = new Date().toISOString();
    try { await ecrireBase(S); }
    catch (e) { console.error(e); toast("Enregistrement impossible. Exportez votre sauvegarde."); }
    try { localStorage.setItem(MIROIR_LS, JSON.stringify(S)); } catch (e) { /* ignoré */ }
  }

  // ---------- Programme et niveau ----------
  function semaineDe(date) {
    if (!S.debut) return 1;
    return Math.min(12, S.progression.niveau + 1);
  }
  function indexPhase(semaine) {
    const s = Math.min(Math.max(semaine, 1), 12);
    const i = PH().findIndex((p) => p.semaines.includes(s));
    return i < 0 ? PH().length - 1 : i;
  }
  function seanceFaite(date) { return S.seances[date] && S.seances[date].fait ? S.seances[date] : null; }
  function seancesValidees() { return Object.keys(S.seances).filter((d) => S.seances[d].fait).sort(); }

  function besoinAllegement(date) {
    return alertes(date).some((a) => a.categorie === "recup" && a.niveau === "attention");
  }

  // Séance d'une date : blocs successifs, charges adaptées à l'historique
  function construireSeance(date) {
    const p = S.profil;
    if (!p || !S.debut || joursEntre(date, S.debut) < 0) return null;
    const n = Math.min(6, Math.max(1, Number(p.joursSemaine) || 3));
    const jours = JOURS_SEANCE[n];
    const idx = jourSemaineLundi0(date);
    const libre = !!(S.libres && S.libres[date]);
    if (!jours.includes(idx) && !libre) return null;

    const semaine = semaineDe(date);
    const pi = indexPhase(semaine);
    const phase = PH()[pi];
    const type = libre && !jours.includes(idx) ? "renfo" : (jours.indexOf(idx) % 2 === 0 ? "marche" : "renfo");
    const materiel = p.materiel || [];
    const allege = besoinAllegement(date);
    const deltas = S.progression.deltas || {};

    const blocs = [{ titre: "Échauffement", icone: "🔥", items: [{ id: "mobilite", minutes: 5 }] }];
    if (type === "marche") {
      let minutes = phase.marcheMin + (S.progression.marcheDelta || 0);
      minutes = Math.min(Number(p.minutes) || 20, Math.max(10, minutes));
      if (allege) minutes = Math.max(10, Math.round(minutes * 0.7));
      blocs.push({ titre: "Marche", icone: "👟", items: [{ id: "marche", minutes }] });
    } else {
      const liste = phase.renfo.slice();
      if (materiel.includes("halteres")) liste.push("rowing");
      if (materiel.includes("elastique")) liste.push("tirage");
      let series = phase.series;
      if (allege) series = Math.max(1, series - 1);
      blocs.push({
        titre: "Renforcement", icone: "💪",
        items: liste.map((id) => Object.assign(
          { id, series, repos: EX()[id].reposSec || 60 },
          window.prescrireAdaptatif(id, pi, p.tests, deltas[id] || 0, allege)))
      });
    }
    blocs.push({ titre: "Retour au calme", icone: "🧘", items: [{ id: "etirement", minutes: 3 }] });
    return { date, semaine, phase: phase.nom, phaseIndex: pi, type, allege,
      titre: type === "marche" ? "Marche rapide" : "Renforcement à la maison", blocs };
  }

  function prescriptionTexte(it) {
    if (it.minutes !== undefined) return `${it.minutes} min`;
    const ex = EX()[it.id];
    const quantite = ex.type === "temps" ? `${it.sec} s` : `${it.reps} rép.`;
    return `${it.series} × ${quantite} · repos ${it.repos} s`;
  }

  // Statistiques d'une fenêtre de 7 jours, utilisées pour décider de la semaine suivante
  function statsFenetre(debut) {
    let prevues = 0, faites = 0, rpeTotal = 0, rpeN = 0, douleurMax = 0, alertesRecup = 0;
    for (let i = 0; i < 7; i++) {
      const d = ajouterJours(debut, i);
      if (construireSeance(d)) prevues++;
      const s = S.seances[d];
      if (s && s.fait) {
        faites++;
        if (typeof s.rpe === "number") { rpeTotal += s.rpe; rpeN++; }
        if (typeof s.douleur === "number") douleurMax = Math.max(douleurMax, s.douleur);
        Object.values(s.suivi || {}).forEach((x) => { if (x.douleur > douleurMax) douleurMax = x.douleur; });
      }
      const b = S.bilans[d];
      if (b && typeof b.douleur === "number") douleurMax = Math.max(douleurMax, b.douleur);
      if (alertes(d).some((a) => a.categorie === "recup" && a.niveau === "attention")) alertesRecup++;
    }
    return { prevues, faites, rpeMoyen: rpeN ? rpeTotal / rpeN : null, douleurMax, alertesRecup };
  }

  // Évalue chaque semaine terminée depuis le dernier passage, puis ajuste le niveau.
  function avancerProgression() {
    if (!S.profil || !S.debut) return false;
    const pr = S.progression;
    const aujourd = aujourdhui();
    let change = false;
    while (joursEntre(aujourd, S.debut) >= 7 * (pr.semaineEvaluee + 1) && pr.semaineEvaluee < 52) {
      const debutFen = ajouterJours(S.debut, 7 * pr.semaineEvaluee);
      const stats = statsFenetre(debutFen);
      const d = window.decideSemaine(stats);
      if (d.action === "monte") pr.niveau = Math.min(12, pr.niveau + 1);
      if (d.action === "recule") pr.niveau = Math.max(0, pr.niveau - 1);
      pr.bilans.unshift({ debut: debutFen, action: d.action, raison: d.raison, niveauApres: pr.niveau,
        faites: stats.faites, prevues: stats.prevues, rpeMoyen: stats.rpeMoyen });
      pr.semaineEvaluee++;
      change = true;
    }
    pr.bilans = pr.bilans.slice(0, 26);
    return change;
  }

  // Met à jour charges et marche après une séance validée
  function appliquerSeanceAuProgramme(date, seance, rpe) {
    const pr = S.progression;
    const suivi = (S.seances[date] && S.seances[date].suivi) || {};
    seance.blocs.forEach((b) => b.items.forEach((it) => {
      if (it.id === "mobilite" || it.id === "etirement") return;
      if (it.id === "marche") { pr.marcheDelta = window.ajusterMarche(pr.marcheDelta || 0, rpe); return; }
      const f = suivi[it.id] || { faites: [], douleur: 0 };
      const reussi = (f.faites || []).filter(Boolean).length >= it.series;
      pr.deltas[it.id] = window.ajusterDelta(pr.deltas[it.id] || 0, reussi, rpe, f.douleur || 0);
    }));
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
      out.push({ categorie: "recup", niveau: "attention", texte: `FC de repos à ${s.fcRepos} bpm, soit ${Math.round(s.fcRepos - fc)} bpm au-dessus de votre habitude. Séance allégée conseillée.` });
    const vfc = mediane(valeursRecentes("vfc", date));
    if (typeof s.vfc === "number" && vfc !== null && s.vfc < 0.8 * vfc)
      out.push({ categorie: "recup", niveau: "attention", texte: `Variabilité cardiaque basse : ${Math.round(s.vfc)} ms contre ${Math.round(vfc)} ms habituellement. Récupération à privilégier.` });
    const n1 = (S.sante[date] || {}).sommeil, n2 = (S.sante[ajouterJours(date, -1)] || {}).sommeil;
    if (typeof n1 === "number" && typeof n2 === "number" && n1 < 6 && n2 < 6)
      out.push({ categorie: "recup", niveau: "attention", texte: "Deux nuits de moins de 6 h. Séance allégée conseillée." });
    const bilan = S.bilans[date];
    if (bilan && typeof bilan.douleur === "number" && bilan.douleur >= 4)
      out.push({ categorie: "douleur", niveau: "alerte", texte: "Douleur générale à 4/10 ou plus. Arrêtez l'exercice concerné. Si elle dure plus de 48 h, consultez un médecin." });
    const suivi = (S.seances[date] && S.seances[date].suivi) || {};
    Object.keys(suivi).forEach((id) => {
      if (suivi[id].douleur >= 4 && EX()[id])
        out.push({ categorie: "douleur", niveau: "alerte", texte: `Douleur à ${EX()[id].nom} : ${suivi[id].douleur}/10. Arrêtez cet exercice et consultez si la gêne persiste.` });
    });
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
  function serieEnCours() {
    let n = 0, d = aujourdhui();
    if (!seanceFaite(d)) d = ajouterJours(d, -1);
    for (let i = 0; i < 30; i++) {
      const date = ajouterJours(d, -i);
      if (seanceFaite(date)) n++;
      else if (construireSeance(date)) break;
    }
    return n;
  }
  function rappelSauvegarde() {
    if (!S.dernierExport) return "Aucune sauvegarde encore. Exportez-en une depuis l'onglet Données.";
    const j = joursEntre(aujourdhui(), iso(S.dernierExport));
    return j >= 7 ? `Dernière sauvegarde il y a ${j} jours. Pensez à exporter.` : "";
  }

  // ---------- Coach ----------
  function messageCoach() {
    const date = aujourdhui();
    const p = S.profil || {};
    const g = graine();
    const seance = construireSeance(date);
    const faite = seanceFaite(date);
    if (faite) {
      if (serieEnCours() >= 3) return COACH.texte("serie_longue", p.prenom, g, { n: serieEnCours() });
      if (faite.rpe >= 8) return COACH.texte("valide_dur", p.prenom, g);
      if (faite.douleur >= 4) return COACH.texte("valide_douleur", p.prenom, g);
      return COACH.texte("valide_facile", p.prenom, g);
    }
    const dernier = seancesValidees().slice(-1)[0];
    if (seance && dernier && joursEntre(date, dernier) >= 4) return COACH.texte("retour", p.prenom, g);
    if (seance && seance.allege) return COACH.texte("allege", p.prenom, g);
    if (seance) return COACH.texte(seance.type === "marche" ? "avant_marche" : "avant_renfo", p.prenom, g);
    return "Jour de repos. Récupérer fait partie du programme. Une marche tranquille si tu te sens bien.";
  }

  function dernierBilanRecent() {
    const b = S.progression.bilans[0];
    if (!b) return null;
    return joursEntre(aujourdhui(), ajouterJours(b.debut, 6)) <= 7 ? b : null;
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
        const jf = (c[iF] || "").slice(0, 10);
        if (d1 && d2 && d2 > d1) (sommeil[jf] = sommeil[jf] || []).push([d1.getTime(), d2.getTime()]);
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
    S.progression = Object.assign(progressionInitiale(), S.progression || {});
    await sauver();
  }

  // ---------- Schémas ----------
  // Dessine une figure dans un cadre de 200 px, décalé de dx.
  function figure(P, dx) {
    const t = (q) => `${q[0] + dx},${q[1]}`;
    const ligne = (pts, w) => `<polyline stroke-width="${w}" points="${pts.map(t).join(" ")}"/>`;
    let g = `<line class="sol" x1="${dx + 4}" y1="150" x2="${dx + 196}" y2="150"/>`;
    g += ligne([P.n, P.p], 14);
    P.bras.forEach((b) => (g += ligne(b, 8)));
    P.jambes.forEach((j) => (g += ligne(j, 10)));
    P.bras.flat().concat(P.jambes.flat()).concat([P.n, P.p]).forEach((q) => (g += `<circle class="joint" cx="${q[0] + dx}" cy="${q[1]}" r="4.5"/>`));
    g += `<circle class="tete" cx="${P.h[0] + dx}" cy="${P.h[1]}" r="12"/>`;
    return g;
  }
  // Une position : schéma seul. Deux positions : départ et arrivée côte à côte, avec une flèche.
  function illustration(pose, pose2) {
    const A = window.POSES[pose] || window.POSES.debout;
    if (!pose2) {
      return `<svg class="pose" viewBox="0 0 200 160" role="img" aria-label="Schéma de la position">${figure(A, 0)}</svg>`;
    }
    const B = window.POSES[pose2] || window.POSES.debout;
    return `<svg class="pose duo" viewBox="0 0 400 170" role="img" aria-label="Schéma du mouvement : départ et arrivée">
      <text class="legende" x="100" y="16">DÉPART</text>
      <text class="legende" x="300" y="16">ARRIVÉE</text>
      <path class="fleche" d="M170 12 H230"/><path class="fleche-tete" d="M234 12 l-9 -6 v12 z"/>
      <line class="separe" x1="200" y1="28" x2="200" y2="158"/>
      ${figure(A, 0)}${figure(B, 200)}
    </svg>`;
  }

  // Liens Spotify : ouvrent une recherche (aucune lecture automatique)
  const MUSIQUE = {
    echauffement: { titre: "Échauffement", requete: "échauffement sport motivation" },
    marche: { titre: "Marche rapide", requete: "marche rapide motivation" },
    renfo: { titre: "Renforcement", requete: "workout motivation renforcement" },
    retour: { titre: "Retour au calme", requete: "relaxation étirements" }
  };
  const lienSpotify = (q) => "https://open.spotify.com/search/" + encodeURIComponent(q);
  function carteMusique(seance) {
    const cles = ["echauffement", seance.type === "marche" ? "marche" : "renfo", "retour"];
    return `<div class="carte musique"><h3 class="titre-sport petit">🎧 Musique de la séance</h3>
      <div class="ligne">${cles.map((c) => `<a class="bouton-lien" href="${lienSpotify(MUSIQUE[c].requete)}" target="_blank" rel="noopener">▶ Spotify · ${esc(MUSIQUE[c].titre)}</a>`).join("")}</div>
      <p class="muted petit-texte">Ouvre Spotify sur une recherche. Rien n'est lu automatiquement.</p></div>`;
  }

  // ---------- Minuteur ----------
  function demarrerMinuteur(id, secondes, libelle, auFin) {
    arreterMinuteur();
    minuteur = { id, fin: Date.now() + secondes * 1000, libelle, auFin };
    tickId = setInterval(tick, 300);
    rendreBarre();
  }
  function arreterMinuteur() {
    if (tickId) clearInterval(tickId);
    tickId = null; minuteur = null;
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
  function trouverItem(seance, id) { return seance.blocs.flatMap((b) => b.items).find((i) => i.id === id); }
  function suiviItem(date, id, nbSeries) {
    S.seances[date] = S.seances[date] || {};
    const s = S.seances[date];
    s.suivi = s.suivi || {};
    if (!s.suivi[id]) s.suivi[id] = { faites: [], douleur: 0 };
    if (nbSeries) while (s.suivi[id].faites.length < nbSeries) s.suivi[id].faites.push(false);
    return s.suivi[id];
  }
  async function basculerSerie(date, seance, id, index, repos) {
    const item = trouverItem(seance, id);
    const it = suiviItem(date, id, item.series);
    it.faites[index] = !it.faites[index];
    await sauver();
    if (it.faites[index] && index < item.series - 1 && repos > 0) demarrerMinuteur("repos", repos, "Repos", null);
    rendu();
  }
  function maintien(date, seance, id, index, secondes) {
    const item = trouverItem(seance, id);
    const it = suiviItem(date, id, item.series);
    demarrerMinuteur(id, secondes, `Maintien · ${EX()[id].nom}`, async () => {
      it.faites[index] = true;
      await sauver();
      if (index < item.series - 1 && item.repos > 0) demarrerMinuteur("repos", item.repos, "Repos", null);
    });
  }
  async function basculerBloc(date, id, minutes) {
    const it = suiviItem(date, id, 0);
    if (it.faites[0]) { it.faites[0] = false; await sauver(); rendu(); return; }
    demarrerMinuteur(id, minutes * 60, EX()[id].nom, async () => {
      it.faites[0] = true;
      await sauver();
    });
  }
  async function douleurItem(date, id, valeur) {
    suiviItem(date, id, 0).douleur = valeur;
    await sauver();
    rendu();
  }

  // ---------- En-tête ----------
  function enteteHtml() {
    const h = $("#entete");
    if (!S.profil) { h.innerHTML = `<div class="marque">COACH<span>REPRISE</span></div>`; return; }
    const niveau = Math.min(12, S.progression.niveau + 1);
    h.innerHTML = `<div class="marque">COACH<span>REPRISE</span></div>
      <div class="ligne-en-tete"><span>${esc(S.profil.prenom)}</span><span class="pastille" style="background:${COULEURS_PHASE[indexPhase(niveau)]}">${esc(PH()[indexPhase(niveau)].nom)}</span></div>`;
  }

  // ---------- Vues ----------
  function anneau(pct, couleur) {
    const r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
    return `<svg class="anneau" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="${r}" class="anneau-fond"/>
      <circle cx="44" cy="44" r="${r}" class="anneau-val" style="stroke:${couleur};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg>`;
  }

  function formulaireProfil(v = {}) {
    const p = Object.assign({ joursSemaine: 3, minutes: 20, materiel: [], objectif: "sante", inactiviteAnnees: 2, debut: aujourdhui() }, v);
    const mat = (k) => (p.materiel || []).includes(k) ? "checked" : "";
    const sel = (n, x) => (String(x) === String(n) ? "selected" : "");
    return `<div class="carte hero-carte">
      <h2 class="titre-sport">${S.profil ? "Modifier mon profil" : "Prêt à te lancer ?"}</h2>
      <p class="muted">Ces réponses personnalisent ton programme. Tout reste sur cet iPhone.</p>
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
        <p class="muted">Ce programme ne remplace pas un avis médical. Consulte ton médecin avant de reprendre après une longue pause.</p>
        <div class="ligne" style="margin-top:12px">
          <button type="submit">${S.profil ? "Enregistrer" : "Continuer vers les tests"}</button>
          ${S.profil ? '<button type="button" class="secondaire" data-action="annuler-profil">Annuler</button>' : ""}
        </div>
      </form></div>`;
  }

  function formulaireTests() {
    const t = (S.profil && S.profil.tests) || {};
    return `<div class="carte hero-carte"><h2 class="titre-sport">Tests de départ</h2>
      <p class="muted">Quatre mesures pour calibrer ton programme sur tes capacités réelles. Fais-les reposé, sans sport intense la veille. Arrête à la première douleur ou à la première faute de forme.</p>
      <form id="formulaire-tests">
        ${window.TESTS_DEPART.map((x) => `<div class="carte carte-test">
          ${illustration(x.pose)}
          <h3>${esc(x.nom)}</h3>
          <p class="muted">${esc(x.protocole)}</p>
          <label for="t-${x.id}">Résultat (${esc(x.unite)})</label>
          <input type="number" min="0" max="999" id="t-${x.id}" value="${t[x.id] ?? ""}">
        </div>`).join("")}
        <div class="ligne"><button type="submit">Enregistrer mes résultats</button>
        <button type="button" class="secondaire" data-action="passer-tests">Plus tard</button></div>
      </form></div>`;
  }

  function vueAccueil() {
    const date = aujourdhui();
    const seance = construireSeance(date);
    const faite = seanceFaite(date);
    const bilan = S.bilans[date] || {};
    const s = S.sante[date] || {};
    const niveau = Math.min(12, S.progression.niveau + 1);
    const prog = S.progression.niveau / 12;
    const sem = seancesDeLaSemaine(date);
    const couleur = COULEURS_PHASE[indexPhase(niveau)];
    let html = "";

    html += `<section class="hero">
      <div class="hero-texte">
        <p class="hero-petit">Semaine ${niveau} / 12</p>
        <h2 class="titre-sport">${esc(PH()[indexPhase(niveau)].nom)}</h2>
        <p class="hero-petit">${esc(serieTexte())}</p>
      </div>
      <div class="hero-anneau">${anneau(prog, couleur)}<b>${Math.round(prog * 100)}%</b></div>
    </section>`;

    const rappel = rappelSauvegarde();
    if (rappel) html += `<div class="bandeau">${esc(rappel)} <button class="choix" data-onglet="donnees">Données</button></div>`;

    const bilanRecent = dernierBilanRecent();
    if (bilanRecent) {
      html += `<div class="bilan-semaine ${bilanRecent.action}">
        <b>${esc(ACTIONS_BILAN[bilanRecent.action])}</b> <span>${esc(bilanRecent.raison)}</span></div>`;
    }

    html += `<section class="coach">
      <div class="coach-avatar" aria-hidden="true">📣</div>
      <div class="coach-bulle">
        <p class="coach-nom">Ton coach</p>
        <p class="coach-texte">${esc(messageCoach())}</p>
        <button class="choix" data-action="ecouter-coach">🔊 Écouter</button>
      </div>
    </section>`;

    alertes(date).forEach((a) => (html += `<div class="alerte ${a.niveau}">${esc(a.texte)}</div>`));

    if (!seance) {
      html += `<div class="carte repos-carte"><h3 class="titre-sport">Jour de repos</h3>
        <p>Récupérer fait partie du programme. Une marche tranquille reste bienvenue.</p>
        <button class="grand" data-action="seance-libre">Démarrer une séance aujourd'hui</button></div>`;
    } else {
      const av = avancementSeance(date, seance);
      const pct = av.total ? av.fait / av.total : 0;
      html += `<section class="carte seance-carte">
        <div class="ligne" style="justify-content:space-between">
          <h3 class="titre-sport">${esc(seance.titre)}</h3>
          ${seance.allege ? '<span class="badge badge-alerte">Allégée</span>' : `<span class="badge" style="background:${couleur}">${esc(seance.phase)}</span>`}
        </div>
        <div class="barre"><span style="width:${Math.round(pct * 100)}%"></span></div>
        <p class="muted">${av.fait}/${av.total} série(s) ou bloc(s) faits</p>
        <ul class="liste-blocs">${seance.blocs.map((b) => `<li>${b.icone} <b>${esc(b.titre)}</b> · ${b.items.map((i) => esc(EX()[i.id].nom)).join(", ")}</li>`).join("")}</ul>
        ${faite
          ? `<p class="succes">✓ Séance terminée · effort ${faite.rpe}/10</p>`
          : `<button class="grand" data-onglet="seance">${av.fait ? "Reprendre la séance" : "Lancer la séance"}</button>`}
      </section>
      ${carteMusique(seance)}`;
    }
    html += `<p class="muted centre">Cette semaine : ${sem.faites} séance(s) sur ${sem.prevues} prévue(s)</p>`;

    html += `<div class="carte"><h3 class="titre-sport petit">Comment tu te sens ?</h3>
      ${bilanBouton("sommeil", "Sommeil ressenti (1 mauvais · 5 excellent)", bilan.sommeil, 5)}
      ${bilanBouton("energie", "Énergie (1 faible · 5 forte)", bilan.energie, 5)}
      ${bilanBouton("douleur", "Douleur générale (0 aucune)", bilan.douleur, 10, true)}
    </div>`;

    if (Object.keys(s).length) {
      html += `<div class="carte"><h3 class="titre-sport petit">Mesures importées</h3><div class="grille">
        ${stat("FC repos", nombre(s.fcRepos), "bpm", "rouge")}${stat("VFC", nombre(s.vfc), "ms", "vert")}
        ${stat("Sommeil", nombre(s.sommeil, 1), "h", "bleu")}${stat("Poids", nombre(s.poids, 1), "kg", "orange")}
        ${stat("Pas", nombre(s.pas), "", "lime")}${stat("SpO₂", nombre(s.spo2), "%", "teal")}</div></div>`;
    } else {
      html += `<p class="muted centre">Aucune mesure importée aujourd'hui. Importez votre fichier depuis Données.</p>`;
    }
    return html;
  }
  function serieTexte() {
    const n = serieEnCours();
    return n >= 2 ? `🔥 ${n} séances d'affilée` : (n === 1 ? "1 séance validée d'affilée" : "Prêt pour la première séance");
  }

  function vueSeance() {
    const date = aujourdhui();
    const seance = construireSeance(date);
    if (!seance) {
      return `<div class="carte repos-carte"><h3 class="titre-sport">Pas de séance aujourd'hui</h3>
        <p>Le programme t'attend au prochain jour d'entraînement.</p>
        <button class="grand" data-action="seance-libre">Démarrer une séance aujourd'hui</button>
        <button class="secondaire" data-onglet="programme" style="margin-top:8px">Voir le programme</button></div>`;
    }
    const faite = seanceFaite(date);
    const av = avancementSeance(date, seance);
    let html = `<div class="ligne"><button class="secondaire" data-onglet="accueil">← Retour</button></div>
      <h2 class="titre-sport">${esc(seance.titre)}</h2>
      <p class="muted">Semaine ${seance.semaine} · ${esc(seance.phase)} · ${av.fait}/${av.total} fait(s)</p>
      <div class="barre"><span style="width:${av.total ? Math.round((av.fait / av.total) * 100) : 0}%"></span></div>`;
    if (seance.allege) html += `<div class="bandeau">Séance allégée aujourd'hui : ta récupération le demande. C'est un bon choix.</div>`;
    html += carteMateriel(seance);
    html += carteMusique(seance);
    seance.blocs.forEach((b) => {
      html += `<h3 class="titre-bloc">${b.icone} ${esc(b.titre)}</h3>`;
      b.items.forEach((it) => (html += carteExercice(date, it)));
    });
    html += faite
      ? `<div class="carte"><p class="succes">✓ Séance validée · effort ${faite.rpe}/10</p>
          <button class="secondaire" data-action="annuler-validation">Rouvrir la séance</button></div>`
      : `<div class="carte"><h3 class="titre-sport petit">Fin de séance</h3>
          <div class="grille">
            <div><label for="rpe">Effort ressenti (1 à 10)</label>
              <select id="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${n === 5 ? "selected" : ""}>${n}</option>`).join("")}</select></div>
            <div><label for="douleur-seance">Douleur générale (0 à 10)</label>
              <select id="douleur-seance">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></div>
          </div>
          <label for="note">Note (facultatif)</label>
          <textarea id="note" placeholder="Comment ça s'est passé ?"></textarea>
          <div class="ligne" style="margin-top:10px"><button class="grand" data-action="valider-seance">Valider la séance</button></div></div>`;
    return html;
  }

  // Matériel à préparer, avec des alternatives que l'utilisateur peut choisir à la place
  const ALTERNATIVES = {
    chaise: [
      { nom: "Canapé ferme ou lit à hauteur d'assise", detail: "Assise ferme et stable, dos calé contre un mur. Un canapé mou est déconseillé." },
      { nom: "Tabouret solide à environ 45 cm", detail: "Pieds antidérapants, posé contre un mur ou sur un sol plat." }
    ],
    mur: [
      { nom: "Plan de travail de cuisine", detail: "Pompes inclinées : mains sur le plan, corps en diagonale. Vérifiez qu'il ne bouge pas." },
      { nom: "Table solide", detail: "Même principe que le plan de travail. Table lourde ou fixée au sol uniquement." }
    ],
    tapis: [
      { nom: "Couverture pliée en deux ou trois", detail: "Épaisseur suffisante pour les genoux et le dos pendant les exercices au sol." },
      { nom: "Moquette ou tapis épais", detail: "Vérifiez qu'il ne glisse pas." },
      { nom: "Serviette de bain roulée", detail: "Sous les genoux ou les coudes pour les planches." }
    ],
    halteres: [
      { nom: "Bouteilles d'eau 1,5 ou 2 L", detail: "Pleines, tenues fermement. Un bon remplacement pour le rowing." },
      { nom: "Sac à dos chargé de livres", detail: "Bretelles bien serrées, poids réparti. Gardez le dos droit." },
      { nom: "Bidon de lessive plein", detail: "Plus lourd : tenez-le à deux mains et commencez léger." }
    ],
    elastique: [
      { nom: "Serviette épaisse tenue aux deux mains", detail: "Tirez les deux extrémités vers l'arrière, en gardant les coudes près du corps." },
      { nom: "Sac à dos avec bretelles", detail: "Accrochez-le à une poignée de porte fermée pour un tirage contrôlé." }
    ],
    montre: [
      { nom: "Téléphone dans la poche ou posé", detail: "L'application suit les pas et le temps de marche sans montre." }
    ],
    espace: [
      { nom: "Couloir ou balcon dégagé", detail: "Vérifiez qu'il n'y a ni meuble ni objet fragile à moins d'un bras." }
    ]
  };

  function materielRequis(seance) {
    const mat = (S.profil && S.profil.materiel) || [];
    const liste = [
      { cle: "tenue", nom: "Tenue et chaussures", detail: "Chaussures fermées, vêtements qui ne gênent pas les mouvements.", alternatives: [] },
      { cle: "eau", nom: "Eau", detail: "Une bouteille à portée de main, posée au sol près de vous.", alternatives: [{ nom: "Gourde ou verre d'eau", detail: "Tout récipient facile à attraper entre les séries." }] },
      { cle: "telephone", nom: "Téléphone", detail: "Son activé, sur une table ou un appui stable : il sert de minuteur et de musique.", alternatives: [] }
    ];
    if (seance.type === "marche") {
      liste.push({ cle: "espace", nom: "Trajet plat et sûr", detail: "Un trottoir ou un parc. Si le temps ne le permet pas, marchez dans votre logement.", alternatives: ALTERNATIVES.espace });
      liste.push({ cle: "montre", nom: "Montre Apple Watch (facultatif)", detail: "Pour suivre votre fréquence cardiaque pendant la marche.", alternatives: ALTERNATIVES.montre });
    } else {
      liste.push({ cle: "chaise", nom: "Chaise stable", detail: "Sans roulettes, posée sur un sol plat (levers-assis).", alternatives: ALTERNATIVES.chaise });
      liste.push({ cle: "mur", nom: "Mur libre", detail: "Pour les pompes murales : posez-vous à environ un bras de distance.", alternatives: ALTERNATIVES.mur });
      liste.push({ cle: "tapis", nom: "Tapis ou serviette", detail: "Pour les exercices au sol (pont, planche, superman).", alternatives: ALTERNATIVES.tapis });
      liste.push({ cle: "espace", nom: "Espace d'environ 2 × 2 m", detail: "Pour les fentes et le squat, sans rien à proximité.", alternatives: ALTERNATIVES.espace });
      if (mat.includes("halteres")) liste.push({ cle: "halteres", nom: "Haltères", detail: "Pour le rowing penché.", alternatives: ALTERNATIVES.halteres });
      if (mat.includes("elastique")) liste.push({ cle: "elastique", nom: "Élastique", detail: "Fixé à une porte ou à un point stable.", alternatives: ALTERNATIVES.elastique });
    }
    return liste;
  }
  function carteMateriel(seance) {
    const choix = S.materielAlt || {};
    const items = materielRequis(seance).map((m) => {
      const idx = choix[m.cle];
      const alt = m.alternatives.length && idx !== undefined && idx !== "" ? m.alternatives[Number(idx)] : null;
      const nom = alt ? alt.nom : m.nom;
      const detail = alt ? alt.detail : m.detail;
      const menu = m.alternatives.length
        ? `<select data-mat-alt="${m.cle}" class="alt-select" aria-label="Remplacer ${esc(m.nom)}">
            <option value="">Mon matériel : ${esc(m.nom)}</option>
            ${m.alternatives.map((a, i) => `<option value="${i}" ${String(idx) === String(i) ? "selected" : ""}>Remplacer par : ${esc(a.nom)}</option>`).join("")}
          </select>`
        : "";
      return `<li><b>${esc(nom)}</b><span>${esc(detail)}</span>${menu}</li>`;
    }).join("");
    return `<div class="carte materiel"><h3 class="titre-sport petit">🎒 À préparer avant de commencer</h3>
      <p class="muted petit-texte">Pas de matériel sous la main ? Choisissez une alternative dans le menu de chaque élément.</p>
      <ul class="liste-materiel">${items}</ul></div>`;
  }

  function carteExercice(date, it) {
    const ex = EX()[it.id];
    const suivi = (S.seances[date] && S.seances[date].suivi && S.seances[date].suivi[it.id]) || { faites: [], douleur: 0 };
    let pied;
    if (ex.type === "bloc") {
      const fait = suivi.faites[0];
      pied = `<div class="ligne"><button class="${fait ? "secondaire" : ""}" data-bloc="${it.id}" data-min="${it.minutes}">${fait ? "✓ Fait · annuler" : `Minuteur · ${it.minutes} min`}</button></div>`;
    } else {
      const lignes = [];
      for (let i = 0; i < it.series; i++) {
        const ok = suivi.faites[i];
        if (ex.type === "temps") {
          lignes.push(`<div class="serie-ligne ${ok ? "ok" : ""}"><span>Série ${i + 1} · ${it.sec} s</span>
            ${ok ? `<button class="choix" data-serie="${it.id}" data-i="${i}" data-repos="${it.repos}">Annuler</button>`
              : `<button class="choix actif" data-maintien="${it.id}" data-i="${i}" data-sec="${it.sec}">▶ Lancer ${it.sec} s</button>`}</div>`);
        } else {
          lignes.push(`<button class="serie ${ok ? "ok" : ""}" data-serie="${it.id}" data-i="${i}" data-repos="${it.repos}">Série ${i + 1}<small>${it.reps} rép.</small>${ok ? "✓" : ""}</button>`);
        }
      }
      pied = ex.type === "temps" ? lignes.join("") : `<div class="series">${lignes.join("")}</div>`;
      pied += `<p class="muted petit-texte">Repos entre séries : ${it.repos} s</p>`;
    }
    const video = ex.video ? `<p><a href="${esc(ex.video)}" target="_blank" rel="noopener">▶ Voir la vidéo de démonstration</a></p>` : "";
    return `<article class="carte exo">
      <div class="ligne" style="justify-content:space-between"><h3>${esc(ex.nom)}</h3><span class="badge">${esc(prescriptionTexte(it))}</span></div>
      ${illustration(ex.pose, ex.pose2)}
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
      <p class="muted petit-texte">${esc(ex.securite)}</p>
      ${pied}
      <div class="ligne" style="margin-top:10px"><label style="margin:0">Douleur sur cet exercice</label>
        <select data-douleur="${it.id}" style="width:auto">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${n === suivi.douleur ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </article>`;
  }

  function avancementSeance(date, seance) {
    let total = 0, fait = 0;
    const suivi = (S.seances[date] && S.seances[date].suivi) || {};
    seance.blocs.forEach((b) => b.items.forEach((it) => {
      const f = suivi[it.id] || { faites: [] };
      if (it.series) { total += it.series; fait += f.faites.filter(Boolean).length; }
      else { total += 1; if (f.faites[0]) fait += 1; }
    }));
    return { total, fait };
  }

  function bilanBouton(champ, titre, actuel, max, zeroPossible = false) {
    const boutons = [];
    for (let i = zeroPossible ? 0 : 1; i <= max; i++)
      boutons.push(`<button class="choix ${actuel === i ? "actif" : ""}" data-bilan="${champ}" data-val="${i}">${i}</button>`);
    return `<p class="muted" style="margin:10px 0 4px">${esc(titre)}</p><div class="ligne">${boutons.join("")}</div>`;
  }
  function stat(titre, valeur, unite, teinte = "lime") {
    return `<div class="stat stat-${teinte}"><b>${esc(valeur)} <small>${esc(unite)}</small></b><span>${esc(titre)}</span></div>`;
  }

  function vueProgramme() {
    const actuelle = Math.min(12, S.progression.niveau + 1);
    let html = `<div class="onglets-sous">
      <button class="choix ${choixProgramme === "plan" ? "actif" : ""}" data-prog="plan">Plan 12 semaines</button>
      <button class="choix ${choixProgramme === "biblio" ? "actif" : ""}" data-prog="biblio">Exercices</button>
      <button class="choix ${choixProgramme === "tests" ? "actif" : ""}" data-prog="tests">Tests</button></div>`;
    if (choixProgramme === "plan") {
      html += `<div class="carte"><p class="muted">Ton programme s'adapte chaque semaine à tes séances, tes efforts et tes douleurs. Tu n'avances que si ton corps suit.</p>`;
      PH().forEach((p, i) => {
        const debut = p.semaines[0], fin = p.semaines[p.semaines.length - 1];
        const actif = actuelle >= debut && actuelle <= fin;
        html += `<div class="phase ${actif ? "phase-actuelle" : ""}" style="border-color:${COULEURS_PHASE[i]}">
          <div class="ligne" style="justify-content:space-between"><b>${esc(p.nom)}</b><span class="badge" style="background:${COULEURS_PHASE[i]}">Sem. ${debut}–${fin}</span></div>
          <p class="muted petit-texte">${p.renfo.map((id) => esc(EX()[id].nom)).join(" · ")}</p></div>`;
      });
      html += `</div>`;
    } else if (choixProgramme === "biblio") {
      html += Object.keys(EX()).map((id) => {
        const ex = EX()[id];
        return `<details class="carte"><summary><b>${esc(ex.nom)}</b> <span class="muted">· ${esc(ex.objectif)}</span></summary>
          ${illustration(ex.pose, ex.pose2)}
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
      html += `<div class="carte"><h3 class="titre-sport petit">Tes résultats de départ</h3>
        <table>${window.TESTS_DEPART.map((x) => `<tr><td>${esc(x.nom)}</td><td><b>${t[x.id] ?? "non fait"}</b> ${esc(x.unite)}</td></tr>`).join("")}</table>
        <div class="ligne" style="margin-top:12px"><button data-action="refaire-tests">Refaire les tests</button></div></div>`;
    }
    return html;
  }

  function vueSuivi() {
    const validees = seancesValidees();
    const recents = validees.slice(-14).map((d) => S.seances[d].rpe).filter((n) => typeof n === "number");
    const rpe = recents.length ? recents.reduce((a, b) => a + b, 0) / recents.length : null;
    const pr = S.progression;
    let html = `<div class="grille">${stat("Séances validées", String(validees.length), "", "orange")}${stat("Effort moyen (14 dernières)", nombre(rpe, 1), "/10", "rouge")}</div>
      <div class="onglets-sous">${Object.keys(GRAPHIQUES).map((k) => `<button class="choix ${choixSuivi === k ? "actif" : ""}" data-suivi="${k}">${esc(GRAPHIQUES[k].titre)}</button>`).join("")}</div>
      <div class="carte"><h3 class="titre-sport petit">${esc(GRAPHIQUES[choixSuivi].titre)} · 60 jours</h3>${graphique(choixSuivi)}</div>`;

    html += `<div class="carte"><h3 class="titre-sport petit">Ma progression</h3>`;
    if (!pr.bilans.length) {
      html += `<p class="muted">Le premier bilan apparaîtra à la fin de ta première semaine.</p>`;
    } else {
      html += pr.bilans.map((b) => `<div class="bilan-ligne ${b.action}">
        <div class="ligne" style="justify-content:space-between"><b>${esc(ACTIONS_BILAN[b.action])}</b><span class="muted petit-texte">semaine du ${esc(dateCourte(b.debut))}</span></div>
        <p class="petit-texte">${esc(b.raison)}</p>
        <p class="muted petit-texte">${b.faites}/${b.prevues} séances · niveau ${b.niveauApres + 1}</p></div>`).join("");
    }
    const ajustements = Object.keys(pr.deltas).filter((id) => pr.deltas[id] !== 0 && EX()[id]);
    if (ajustements.length) {
      html += `<h3 class="titre-sport petit" style="margin-top:14px">Charges personnalisées</h3><ul class="liste">${ajustements.map((id) => {
        const d = pr.deltas[id], unite = EX()[id].type === "temps" ? "s" : "rép.";
        return `<li>${esc(EX()[id].nom)} : ${d > 0 ? "+" : ""}${d * (EX()[id].type === "temps" ? 5 : 1)} ${unite}</li>`;
      }).join("")}</ul>`;
    }
    if (pr.marcheDelta) html += `<p class="muted petit-texte">Marche : ${pr.marcheDelta > 0 ? "+" : ""}${pr.marcheDelta} min par rapport au plan.</p>`;
    html += `</div>`;
    return html;
  }
  function graphique(champ) {
    const { unite, decimales, titre } = GRAPHIQUES[champ];
    const jours = 60, fin = aujourdhui(), pts = [];
    for (let i = jours - 1; i >= 0; i--) {
      const v = (S.sante[ajouterJours(fin, -i)] || {})[champ];
      if (typeof v === "number") pts.push({ x: jours - 1 - i, v });
    }
    if (pts.length < 2) return `<p class="muted">Pas assez de données sur ${jours} jours. Importez vos mesures depuis Données.</p>`;
    const W = 320, H = 150, P = 12;
    const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
    const etendue = (max - min) || 1;
    const coords = pts.map((p) => `${(P + (p.x / (jours - 1)) * (W - 2 * P)).toFixed(1)},${(H - P - ((p.v - min) / etendue) * (H - 2 * P)).toFixed(1)}`).join(" ");
    const recents = pts.filter((p) => p.x >= jours - 7).map((p) => p.v);
    const moy7 = recents.length ? recents.reduce((a, b) => a + b, 0) / recents.length : null;
    return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique ${esc(titre)}">
        <line class="axe" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/><polyline points="${coords}"/></svg>
      <div class="grille" style="margin-top:8px">${stat("Dernière valeur", nombre(pts[pts.length - 1].v, decimales), unite, "lime")}${stat("Moyenne 7 jours", nombre(moy7, decimales), unite, "bleu")}</div>
      <p class="muted petit-texte">Min ${nombre(min, decimales)} · Max ${nombre(max, decimales)} ${esc(unite)} sur 60 jours.</p>`;
  }

  function vueDonnees() {
    const f = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "jamais");
    return `
      <div class="carte"><h3 class="titre-sport petit">Coach vocal</h3>
        <p class="muted">Le coach peut lire ses messages à voix haute avec la voix française de ton iPhone.</p>
        <div class="ligne"><button class="${S.voix ? "secondaire" : ""}" data-action="voix">${S.voix ? "Désactiver la voix" : "Activer la voix du coach"}</button></div></div>
      <div class="carte"><h3 class="titre-sport petit">Importer mes mesures</h3>
        <p class="muted">CSV du raccourci Santé (une ligne par jour) ou CSV de l'export Apple Santé. Rien n'est dupliqué.</p>
        <div class="ligne"><button data-action="choisir-csv">Importer un CSV</button></div>
        <p class="muted">Dernier import : ${esc(f(S.dernierImport))} · ${Object.keys(S.sante).length} jour(s)</p></div>
      <div class="carte"><h3 class="titre-sport petit">Sauvegarde</h3>
        <p class="muted">Exporte une sauvegarde et enregistre-la dans Fichiers (iCloud Drive) : elle permet de tout restaurer.</p>
        <div class="ligne"><button data-action="exporter">Exporter</button><button class="secondaire" data-action="restaurer">Restaurer</button></div>
        <p class="muted">Dernier export : ${esc(f(S.dernierExport))}</p></div>
      <div class="carte"><h3 class="titre-sport petit">Profil</h3>
        <div class="ligne"><button class="secondaire" data-action="modifier-profil">Modifier mon profil</button></div></div>
      <div class="carte"><h3 class="titre-sport petit">Zone de danger</h3>
        <p class="muted">Efface toutes les données de cet appareil. Exporte une sauvegarde avant.</p>
        <button class="danger" data-action="effacer">Tout effacer</button></div>`;
  }

  const VUES = { accueil: vueAccueil, seance: vueSeance, programme: vueProgramme, suivi: vueSuivi, donnees: vueDonnees };

  function rendu() {
    if (S.profil && avancerProgression()) sauver();
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
      if (b.dataset.maintien && seance) { maintien(date, seance, b.dataset.maintien, Number(b.dataset.i), Number(b.dataset.sec)); return rendu(); }
      if (b.dataset.bloc) return basculerBloc(date, b.dataset.bloc, Number(b.dataset.min));
      switch (b.dataset.action) {
        case "valider-seance": return validerSeance(date, seance);
        case "annuler-validation":
          S.seances[date] = Object.assign({}, S.seances[date], { fait: false });
          await sauver(); rendu(); return;
        case "passer-minuteur": arreterMinuteur(); rendu(); return;
        case "seance-libre":
          S.libres = Object.assign({}, S.libres, { [date]: true });
          await sauver(); onglet = "seance"; rendu(); window.scrollTo(0, 0); return;
        case "ecouter-coach": COACH.parler(messageCoach(), true); return;
        case "voix":
          S.voix = !S.voix; await sauver();
          COACH.parler(`Salut ${S.profil ? S.profil.prenom : ""}, je suis ton coach. On y va ?`, S.voix);
          toast(S.voix ? "Voix activée" : "Voix désactivée");
          rendu(); return;
        case "exporter": return exporterSauvegarde();
        case "restaurer": return $("#fichier-json").click();
        case "choisir-csv": return $("#fichier-csv").click();
        case "modifier-profil":
          $("#contenu").innerHTML = formulaireProfil(Object.assign({}, S.profil, { debut: S.debut })); return;
        case "annuler-profil": return rendu();
        case "refaire-tests": S.etapeTests = true; await sauver(); rendu(); return;
        case "passer-tests":
          S.profil.tests = S.profil.tests || {};
          S.etapeTests = false; await sauver(); toast("Valeurs par défaut utilisées."); rendu(); return;
        case "effacer": return effacerTout();
      }
    });

    document.body.addEventListener("change", async (e) => {
      if (e.target.dataset.douleur) await douleurItem(aujourdhui(), e.target.dataset.douleur, Number(e.target.value));
      if (e.target.dataset.matAlt) {
        S.materielAlt = Object.assign({}, S.materielAlt, { [e.target.dataset.matAlt]: e.target.value });
        await sauver(); rendu();
      }
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

  async function validerSeance(date, seance) {
    if (!seance) return;
    const rpe = Number($("#rpe").value);
    S.seances[date] = Object.assign({}, S.seances[date], {
      fait: true, rpe, douleur: Number($("#douleur-seance").value),
      note: ($("#note").value || "").trim(), quand: new Date().toISOString()
    });
    if (!S.seances[date].adapte) {
      appliquerSeanceAuProgramme(date, seance, rpe);
      S.seances[date].adapte = true;
    }
    await sauver();
    const texte = messageCoach();
    toast(texte);
    COACH.parler(texte, S.voix);
    rendu();
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
    const debutAvant = S.debut;
    S.debut = $("#p-debut").value || aujourdhui();
    if (premiere || debutAvant !== S.debut) S.progression = progressionInitiale();
    if (premiere || !S.profil.tests) S.etapeTests = true;
    await sauver();
    onglet = "accueil";
    toast(S.etapeTests ? "Profil enregistré. Lance maintenant les tests de départ." : "Profil enregistré.");
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
    toast("Tests enregistrés. Ton programme est calibré.");
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
