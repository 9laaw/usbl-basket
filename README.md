# 🏀 Union Sportive Basket Lislois (USBL) & Basket Club Lislois (BCL)
> Site officiel et plateforme administrative du club de basketball de L'Isle-Jourdain (32600).

---

## 📁 Arborescence du Projet

L'arborescence des fichiers a été repensée pour être claire, organisée et intuitive :

```text
USBL/
├── 📄 index.html                  # Page d'accueil officielle du club
├── 📄 admin.html                  # Espace d'administration complet (Back-office)
├── 📄 404.html                    # Redirection automatique et gestion des liens
├── 🎨 styles.css                  # Feuilles de styles CSS unifiées (responsive & dark hero)
├── ⚡ scripts.js                  # Logique applicative, gestion SPA/MPA, CRUD & API
├── 🖥️ server.js                   # Serveur Node.js local (API FFBB, upload PDF, sync Git)
├── 📦 package.json                # Dépendances Node.js
├── ▲ vercel.json                 # Configuration de déploiement Vercel
├── 📖 README.md                   # Guide du projet et de l'architecture
│
├── 📁 pages/                      # Toutes les pages secondaires du site
│   ├── qui-sommes-nous.html      # Présentation des deux clubs (Hub)
│   ├── qui-sommes-nous-usbl.html # Page officielle section masculine USBL
│   ├── qui-sommes-nous-bcl.html  # Page officielle section féminine BCL
│   ├── infrastructures.html      # Présentation des 3 gymnases
│   ├── benevoles.html            # Équipe des bénévoles et dirigeants
│   ├── contact.html              # Coordonnées, plan d'accès et secrétariat
│   ├── competitions.html         # Équipes, calendriers et classements
│   ├── competition-detail.html   # Fiche détaillée d'une équipe & effectif
│   ├── coachs.html               # Annuaire des entraîneurs du club
│   ├── coach-detail.html         # Fiche individuelle d'un entraîneur
│   ├── evenements.html           # Tournois, stages et événements
│   ├── event-detail.html         # Détail d'un événement & inscriptions
│   ├── article-detail.html       # Lecture complète d'un communiqué / article
│   ├── partenaires.html          # Entreprises partenaires et sponsors
│   ├── informations.html         # Hub officiel des documents PDF
│   ├── inscriptions.html         # Document Inscriptions & licences
│   ├── planning.html             # Document Planning des entraînements
│   ├── boutiques.html            # Document Boutique officielle textile
│   ├── charte-interne.html       # Document Charte sportive & fair-play
│   └── commissions.html          # Document Pôles et commissions du club
│
├── 📁 assets/                     # Photos, logos officiels et illustrations
│   ├── logo_usbl.png             # Logo officiel USBL Spartiates (Masculin)
│   ├── logo_bcl_transparent.png  # Logo officiel BCL (Féminin)
│   ├── gascosport.jpg            # Photo haute définition de la salle Gasco'Sport
│   └── ...
│
├── 📁 data/                       # Bases de données JSON du club
│   ├── articles.json             # Actualités et communiqués
│   ├── games.json                # Résultats et matchs FFBB
│   ├── rosters.json              # Effectifs et fiches équipes
│   ├── coachs.json               # Entraîneurs et fiches coachs
│   ├── benevoles.json            # Membres et bénévoles
│   ├── partenaires.json          # Sponsors et mécènes
│   ├── informations.json         # Métadonnées des documents PDF officiels
│   ├── club_usbl.json            # Contenu libre page USBL
│   └── club_bcl.json             # Contenu libre page BCL
│
├── 📁 docs/                       # Cahier des charges et spécifications
│   └── Projet_site_web.docx      # Document Word original du club
│
├── 📁 server/                     # Scripts utilitaires pour le serveur
│   └── Lancer_Serveur_USBL.command # Script double-clic macOS
│
└── 📁 api/                        # Fonctions serverless
    └── save-collection.js        # Sauvegarde Vercel Serverless
```

---

## 🚀 Démarrage Rapide

### Option 1 : Double-clic sur macOS
Double-cliquez simplement sur le fichier **`Lancer_Serveur_USBL.command`** (situé à la racine ou dans le dossier `server/`).  
Le terminal s'ouvrira et lancera automatiquement le site dans votre navigateur à l'adresse [http://localhost:3001](http://localhost:3001).

### Option 2 : Ligne de commande
```bash
npm install
npm start
```

---

## 🔐 Espace Administrateur
- URL locale : [http://localhost:3001/admin.html](http://localhost:3001/admin.html)
- URL en ligne : [https://9laaw.github.io/usbl-basket/admin.html](https://9laaw.github.io/usbl-basket/admin.html)

Fonctionnalités disponibles :
1. **Actualités** : Publication, modification, ajout de photos et suppression en direct.
2. **Équipes & Joueurs** : Gestion complète des effectifs, numéros, postes, photos d'équipe.
3. **Entraîneurs** : Fiches coachs, bios et attributions d'équipes.
4. **Documents PDF** : Téléversement haute fidélité (Inscriptions, Planning, Boutique, Charte, Commissions).
5. **Synchronisation FFBB** : Récupération automatique des calendriers et résultats du Gers et d'Occitanie.
