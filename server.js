const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const dns = require("node:dns");

// Force IPv4 en priorité pour éviter les timeouts undici sur l'API FFBB
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

const FILE_MAPPING = {
  usbl_articles: "data/articles.json",
  usbl_volunteers: "data/benevoles.json",
  usbl_partners: "data/partenaires.json",
  usbl_rosters: "data/rosters.json",
  usbl_games: "data/games.json",
  usbl_coachs: "data/coachs.json",
  usbl_club_usbl: "data/club_usbl.json",
  usbl_club_bcl: "data/club_bcl.json",
  usbl_informations: "data/informations.json",
};

// IDs des clubs sur l'API FFBB (USBL Masculin + BCL Féminin)
const CLUBS_FFBB = [
  { id: "12429", name: "USBL", filterTerms: ["jourdain", "usbl"] },
  { id: "12400", name: "BCL", filterTerms: ["l'islois", "lislois", "bcl", "jourdain"] }
];

// Verrou pour éviter les lancements simultanés
let isRunning = false;

// Synchronisation Git automatique (débouncée) pour pousser les données modifiées vers GitHub Pages
let gitSyncTimer = null;
function triggerGitSync() {
  clearTimeout(gitSyncTimer);
  gitSyncTimer = setTimeout(() => {
    const { exec } = require("child_process");
    exec('git add data/*.json && git commit -m "chore(data): auto-sync data from admin panel" && git push origin main', (err, stdout, stderr) => {
      if (err) {
        if (!err.message.includes("nothing to commit")) {
          console.log("[Git Sync Info]", err.message.split("\n")[0]);
        }
      } else {
        console.log("[Git Sync] ✅ Données synchronisées et poussées sur GitHub Pages avec succès !");
      }
    });
  }, 2500);
}

// =========================================================================
// 🔄 MACHINE DE RÉCUPÉRATION DES MATCHS (USBL + BCL / FILTRÉ + PHASES)
// =========================================================================
async function runCompleteScraper() {
  if (isRunning) {
    console.log(
      "[API FFBB] Une synchronisation est déjà en cours, tâche ignorée.",
    );
    return false;
  }

  isRunning = true;
  console.log("[API FFBB] Démarrage de la synchronisation des matchs (USBL & BCL)...");

  let FFBBClient;
  try {
    const module = await import("ffbb-api-client");
    FFBBClient = module.FFBBClient;
  } catch (e) {
    try {
      FFBBClient = require("ffbb-api-client").FFBBClient;
    } catch (err) {
      console.error(
        "[API FFBB Error] Impossible de charger 'ffbb-api-client'. L'as-tu installé ? (npm install ffbb-api-client)",
      );
      isRunning = false;
      return false;
    }
  }

  try {
    const client = new FFBBClient();
    await client.authenticate();

    const finalGamesDatabase = {};

    for (const clubCfg of CLUBS_FFBB) {
      console.log(`[API FFBB] Récupération des engagements pour ${clubCfg.name} (${clubCfg.id})...`);
      
      let club;
      try {
        club = await client.getOrganisme(clubCfg.id, {
          fields: [
            "id",
            "nom",
            "engagements.id",
            "engagements.idCompetition.id",
            "engagements.idCompetition.nom",
            "engagements.idCompetition.idCompetitionPere.id",
            "engagements.idPoule.id",
            "engagements.idPoule.nom",
          ],
          deep: {
            engagements: { _limit: 100 },
          },
        });
      } catch (clubErr) {
        console.error(`[API FFBB Error] Impossible de charger le club ${clubCfg.name} (${clubCfg.id}):`, clubErr.message);
        continue;
      }

      if (!club.engagements || club.engagements.length === 0) {
        console.log(`[API FFBB] Aucun engagement trouvé pour ${clubCfg.name}.`);
        continue;
      }

      // --- GESTION DES PHASES (Priorité Phase 2 sur Phase 1) ---
      const engagements = club.engagements;
      const phase1 = engagements.filter(
        (e) => !e.idCompetition?.idCompetitionPere,
      );
      const phase2 = engagements.filter(
        (e) => !!e.idCompetition?.idCompetitionPere,
      );

      const phase1Map = new Map(phase1.map((e) => [e.idCompetition?.id, e]));
      const activeEngagementsMap = new Map();

      for (const e1 of phase1) {
        if (e1.idCompetition?.id) {
          activeEngagementsMap.set(e1.idCompetition.id, e1);
        }
      }

      for (const p2 of phase2) {
        const parentCompetitionId = p2.idCompetition?.idCompetitionPere?.id;
        if (parentCompetitionId && phase1Map.has(parentCompetitionId)) {
          activeEngagementsMap.delete(parentCompetitionId);
        }
        if (p2.idCompetition?.id) {
          activeEngagementsMap.set(p2.idCompetition.id, p2);
        }
      }

      // Parcours des engagements actifs
      for (const engagement of activeEngagementsMap.values()) {
        const pouleId = engagement.idPoule?.id;
        const categorieNom =
          engagement.idCompetition?.nom || "Catégorie Inconnue";
        const pouleNom = engagement.idPoule?.nom || "Sans poule";

        if (!pouleId) {
          console.log(`[API FFBB] ⚠️ ${clubCfg.name} - ${categorieNom} n'a pas de poule active.`);
          continue;
        }

        console.log(
          `[API FFBB] Récupération matchs [${clubCfg.name}] : ${categorieNom} (${pouleNom})...`,
        );

        finalGamesDatabase[categorieNom] = {
          club: clubCfg.name,
          pouleNom: pouleNom,
          classement: [],
          matchs: [],
        };

        try {
          const poule = await client.getPoule(pouleId, {
            fields: [
              "id",
              "nom",
              "rencontres.id",
              "rencontres.numeroJournee",
              "rencontres.nomEquipe1",
              "rencontres.nomEquipe2",
              "rencontres.resultatEquipe1",
              "rencontres.resultatEquipe2",
              "rencontres.joue",
              "rencontres.date_rencontre",
              "rencontres.salle.libelle",
              "classements.id",
              "classements.idEngagement.nom",
              "classements.matchJoues",
              "classements.points",
              "classements.position",
              "classements.gagnes",
              "classements.perdus",
            ],
            deep: {
              rencontres: {
                _limit: 100,
                _sort: ["date_rencontre"],
              },
            },
          });

          if (poule.classements && poule.classements.length > 0) {
            finalGamesDatabase[categorieNom].classement = poule.classements.map(
              (c) => ({
                team: c.idEngagement?.nom || "Inconnu",
                pts: c.points || 0,
                j: c.matchJoues || 0,
                g: c.gagnes || 0,
                p: c.perdus || 0,
                pos: c.position || 0,
              }),
            );
          }

          if (poule.rencontres && poule.rencontres.length > 0) {
            poule.rencontres.forEach((match) => {
              const eq1 = match.nomEquipe1 || "Inconnue";
              const eq2 = match.nomEquipe2 || "Inconnue";

              const isEq1NotreClub = clubCfg.filterTerms.some((term) =>
                eq1.toLowerCase().includes(term),
              );
              const isEq2NotreClub = clubCfg.filterTerms.some((term) =>
                eq2.toLowerCase().includes(term),
              );

              if (!isEq1NotreClub && !isEq2NotreClub) {
                return;
              }

              const dateMatch = match.date_rencontre
                ? match.date_rencontre.replace("T", " à ").substring(0, 16)
                : "Date inconnue";

              let notreEquipe = "";
              let equipeAdverse = "";
              let notreScore = null;
              let scoreAdverse = null;

              const res1 =
                match.joue && match.resultatEquipe1 !== null
                  ? parseInt(match.resultatEquipe1)
                  : null;
              const res2 =
                match.joue && match.resultatEquipe2 !== null
                  ? parseInt(match.resultatEquipe2)
                  : null;

              if (isEq1NotreClub) {
                notreEquipe = eq1;
                equipeAdverse = eq2;
                notreScore = res1;
                scoreAdverse = res2;
              } else {
                notreEquipe = eq2;
                equipeAdverse = eq1;
                notreScore = res2;
                scoreAdverse = res1;
              }

              finalGamesDatabase[categorieNom].matchs.push({
                idMatch: match.id,
                journee: match.numeroJournee || "?",
                date: dateMatch,
                joue: match.joue || false,
                equipeAdverse: equipeAdverse,
                scoreAdverse: scoreAdverse,
                notreEquipe: notreEquipe,
                notreScore: notreScore,
                salle: match.salle?.libelle || "Non spécifiée",
              });
            });
          }
        } catch (pouleError) {
          console.error(
            `[API FFBB Warning] Impossible d'avoir les matchs de la poule ${pouleId}:`,
            pouleError.message,
          );
        }
      }
    }

    // Écriture sécurisée sur le disque
    const filePath = path.join(PUBLIC_DIR, FILE_MAPPING["usbl_games"]);
    fs.writeFileSync(
      filePath,
      JSON.stringify(finalGamesDatabase, null, 2),
      "utf8",
    );
    console.log(
      `\n🏆 [API FFBB Success] Fichier 'games.json' mis à jour pour USBL & BCL !`,
    );

    isRunning = false;
    return true;
  } catch (error) {
    console.error("[API FFBB Error] Une erreur globale est survenue :", error);
    isRunning = false;
    return false;
  }
}

// =========================================================================
// ⏱️ AUTOMATISATION DU CALENDRIER (CHAQUE LUNDI À 08h00 PILE)
// =========================================================================
setInterval(() => {
  const maintenant = new Date();
  if (
    maintenant.getDay() === 1 &&
    maintenant.getHours() === 8 &&
    maintenant.getMinutes() === 0
  ) {
    runCompleteScraper();
  }
}, 60000);

// =========================================================================
// ⚙️ ROUTAGE HTTP DE L'API SPARTIATES USBL
// =========================================================================
const server = http.createServer((req, res) => {
  // En-têtes CORS pour autoriser les requêtes même depuis file:/// ou autre port
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const method = req.method;

  if (parsedUrl.pathname === "/api/trigger-scraping" && method === "GET") {
    runCompleteScraper().then((success) => {
      if (success) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: "Synchronisation effectuée avec succès !",
          }),
        );
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "La synchronisation a échoué.",
          }),
        );
      }
    });
    return;
  }

  if (parsedUrl.pathname === "/api/save-collection" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { key, data } = payload;

        if (!key || !data) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Champs key ou data manquants." }));
          return;
        }

        const fileName = FILE_MAPPING[key];
        if (!fileName) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Clé invalide : ${key}` }));
          return;
        }

        const filePath = path.join(PUBLIC_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        console.log(
          `[Database Sync] Écriture effectuée pour ${key} (${fileName})`,
        );

        if (typeof triggerGitSync === "function") {
          triggerGitSync();
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: `Sauvegarde de ${fileName} validée.`,
          }),
        );
      } catch (err) {
        console.error("[Database Sync Error] Erreur POST :", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            details: err.message,
          }),
        );
      }
    });
    return;
  }

  // =========================================================================
  // 📄 GESTION DES DOCUMENTS PDF D'INFORMATIONS (COMMISSIONS, PLANNING, ETC.)
  // =========================================================================
  if (parsedUrl.pathname === "/api/upload-pdf" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Sécurité limite 25 Mo
      if (body.length > 25 * 1024 * 1024) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Fichier trop volumineux (max 25 Mo)." }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { category, filename, title, data } = payload;
        const validCategories = ["inscriptions", "planning", "boutiques", "charte", "commissions"];

        if (!category || !validCategories.includes(category)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Catégorie invalide. Doit être parmi : ${validCategories.join(", ")}` }));
          return;
        }

        if (!data) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Données du PDF manquantes." }));
          return;
        }

        // Nettoyage base64 (retirer éventuel en-tête data:application/pdf;base64,)
        const base64Data = data.includes(",") ? data.split(",")[1] : data;
        const buffer = Buffer.from(base64Data, "base64");

        const docsDir = path.join(PUBLIC_DIR, "documents");
        if (!fs.existsSync(docsDir)) {
          fs.mkdirSync(docsDir, { recursive: true });
        }

        // Nom de fichier physique normalisé
        const savedFilename = `${category}.pdf`;
        const physicalPath = path.join(docsDir, savedFilename);
        fs.writeFileSync(physicalPath, buffer);

        // Calcul taille lisible
        const bytes = buffer.length;
        const sizeFormatted = bytes >= 1024 * 1024
          ? (bytes / (1024 * 1024)).toFixed(1) + " Mo"
          : Math.max(1, Math.round(bytes / 1024)) + " Ko";

        // Mise à jour de data/informations.json
        const infoFilePath = path.join(PUBLIC_DIR, FILE_MAPPING["usbl_informations"]);
        let infoDb = {};
        if (fs.existsSync(infoFilePath)) {
          try {
            infoDb = JSON.parse(fs.readFileSync(infoFilePath, "utf8"));
          } catch (e) {
            infoDb = {};
          }
        }

        infoDb[category] = {
          title: title || (infoDb[category]?.title) || `${category.toUpperCase()}`,
          filename: filename || `${category}.pdf`,
          url: `documents/${savedFilename}`,
          filesize: sizeFormatted,
          updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(infoFilePath, JSON.stringify(infoDb, null, 2), "utf8");
        console.log(`[Document PDF] Téléversement réussi pour la catégorie '${category}' : ${savedFilename} (${sizeFormatted})`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          message: `Document PDF pour '${category}' enregistré avec succès dans la base de données interne.`,
          document: infoDb[category]
        }));
      } catch (err) {
        console.error("[Document PDF Error] Erreur téléversement :", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erreur lors du traitement du fichier PDF.", details: err.message }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === "/api/delete-pdf" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { category } = payload;
        const validCategories = ["inscriptions", "planning", "boutiques", "charte", "commissions"];

        if (!category || !validCategories.includes(category)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Catégorie invalide." }));
          return;
        }

        // Supprimer fichier physique si présent
        const physicalPath = path.join(PUBLIC_DIR, "documents", `${category}.pdf`);
        if (fs.existsSync(physicalPath)) {
          try {
            fs.unlinkSync(physicalPath);
          } catch (e) {
            console.warn(`[Document PDF Warning] Impossible de supprimer le fichier physique ${physicalPath}:`, e.message);
          }
        }

        // Mise à jour de data/informations.json
        const infoFilePath = path.join(PUBLIC_DIR, FILE_MAPPING["usbl_informations"]);
        let infoDb = {};
        if (fs.existsSync(infoFilePath)) {
          try {
            infoDb = JSON.parse(fs.readFileSync(infoFilePath, "utf8"));
          } catch (e) {
            infoDb = {};
          }
        }

        if (infoDb[category]) {
          infoDb[category] = {
            title: infoDb[category].title || `${category.toUpperCase()}`,
            filename: null,
            url: null,
            filesize: null,
            updatedAt: null
          };
          fs.writeFileSync(infoFilePath, JSON.stringify(infoDb, null, 2), "utf8");
        }

        console.log(`[Document PDF] Suppression effectuée pour la catégorie '${category}'`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: `Document PDF pour '${category}' supprimé de la base de données.` }));
      } catch (err) {
        console.error("[Document PDF Error] Erreur suppression :", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erreur lors de la suppression.", details: err.message }));
      }
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, parsedUrl.pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<h1>404 Introuvable</h1><p>Le fichier <code>${parsedUrl.pathname}</code> n'existe pas.</p>`,
    );
  }
});

function startServer(portToUse) {
  server.listen(portToUse, () => {
    console.log(
      `\n\x1b[32m============================================================\x1b[0m`,
    );
    console.log(`\x1b[1m  SERVEUR SPARTIATES USBL (API SYNCHRO OK) 🏀🔥\x1b[0m`);
    console.log(
      `\x1b[32m============================================================\x1b[0m`,
    );
    console.log(`  URL locale         : \x1b[36mhttp://localhost:${portToUse}\x1b[0m`);
    console.log(
      `  Fichier de sortie  : \x1b[35m${FILE_MAPPING["usbl_games"]}\x1b[0m`,
    );
    console.log(
      `  Planification      : \x1b[33mTous les lundis matin à 08h00 pile\x1b[0m`,
    );
    console.log(
      `\x1b[32m============================================================\x1b[0m\n`,
    );
  });
}

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.warn(`[Serveur USBL] Le port ${PORT} est déjà utilisé, tentative sur le port ${PORT + 1}...`);
    PORT = PORT + 1;
    startServer(PORT);
  } else {
    console.error("[Serveur USBL Error]", e);
  }
});

startServer(PORT);

module.exports = server; //  (On exporte la vraie variable de ton serveur)
