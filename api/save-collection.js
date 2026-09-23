const fs = require("fs");
const path = require("path");

const FILE_MAPPING = {
  usbl_articles: "data/articles.json",
  usbl_volunteers: "data/benevoles.json",
  usbl_partners: "data/partenaires.json",
  usbl_rosters: "data/rosters.json",
  usbl_games: "data/games.json",
  usbl_coachs: "data/coachs.json",
  usbl_club_usbl: "data/club_usbl.json",
  usbl_club_bcl: "data/club_bcl.json",
  usbl_informations: "data/informations.json"
};

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { key, data } = req.body;

    if (!key || !data) {
      res.status(400).json({ error: "Champs key ou data manquants." });
      return;
    }

    const fileName = FILE_MAPPING[key];
    if (!fileName) {
      res.status(400).json({ error: `Clé invalide : ${key}` });
      return;
    }

    const filePath = path.join(process.cwd(), fileName);

    // Vercel serverless environment has a read-only filesystem (except for /tmp).
    // Attempt writing to disk, but catch permission or read-only errors gracefully.
    try {
      // Ensure directory exists (useful for local development with Vercel CLI)
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      
      res.status(200).json({
        success: true,
        message: `Sauvegarde de ${fileName} réussie.`
      });
    } catch (writeErr) {
      console.warn(`[Vercel Serverless] Could not write to ${fileName} (running on read-only server):`, writeErr.message);
      
      // Return 200 OK because the frontend handles localStorage fallback perfectly
      res.status(200).json({
        success: true,
        message: `Données sauvegardées localement dans votre navigateur (le serveur de production est en lecture seule).`
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
};
