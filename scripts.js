/**
 * SCRIPTS - USBL SPARTIATES
 * Interactivité premium de la maquette de la page d'accueil,
 * gestion de l'état SPA (Le club, Compétitions, Événements, Boutique, Nos partenaires, Panier, Détail Article, Détail Événement),
 * effectifs, scores FFBB, inscriptions événements et panier d'achats réactif.
 */

// =========================================================================
// GESTION & ÉDITION DYNAMIQUE DES PAGES DE PRÉSENTATION DES CLUBS (QUI SOMMES-NOUS)
// Fonctions déclarées au plus haut niveau pour éviter toute contrainte de TDZ
// =========================================================================

function createEmptyClubData() {
  return {
    header: {
      title: "",
      subtitle: "",
      text: "",
      photo: "",
      photoCaption: ""
    },
    sections: []
  };
}
window.createEmptyClubData = createEmptyClubData;

function isClubDataEmpty(data) {
  if (!data) return true;
  const h = data.header || {};
  const hasHeaderTitle = !!(h.title && h.title.trim());
  const hasHeaderSub = !!(h.subtitle && h.subtitle.trim());
  const hasHeaderText = !!(h.text && h.text.trim());
  const hasHeaderPhoto = !!(h.photo && h.photo.trim());
  const hasHeaderCaption = !!(h.photoCaption && h.photoCaption.trim());
  const hasSections = Array.isArray(data.sections) && data.sections.some(s => 
    (s.title && s.title.trim()) || 
    (s.text && s.text.trim()) || 
    (s.photo && s.photo.trim()) ||
    (s.photoCaption && s.photoCaption.trim())
  );
  return !hasHeaderTitle && !hasHeaderSub && !hasHeaderText && !hasHeaderPhoto && !hasHeaderCaption && !hasSections;
}
window.isClubDataEmpty = isClubDataEmpty;

function escapeClubHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeClubHtml = escapeClubHtml;

function formatClubParagraphs(text) {
  if (!text) return "";
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  return paragraphs.map(p => `<p>${escapeClubHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}
window.formatClubParagraphs = formatClubParagraphs;

function getClubPresentationData(clubKey) {
  // 1. Synchronisation via hash d'URL (#sync=... ou #preview=...)
  try {
    const hash = window.location.hash || "";
    if (hash.includes("sync=") || hash.includes("preview=")) {
      const match = hash.match(/(?:sync|preview)=([^&]+)/);
      if (match && match[1]) {
        const decoded = JSON.parse(decodeURIComponent(match[1]));
        if (decoded && typeof decoded === "object" && !isClubDataEmpty(decoded)) {
          try {
            localStorage.setItem("usbl_club_" + clubKey, JSON.stringify(decoded));
          } catch(err) {}
          return decoded;
        }
      }
    }
  } catch(e) {
    console.warn("Erreur lecture hash club data", e);
  }

  // 2. Lecture localStorage
  try {
    const raw = localStorage.getItem("usbl_club_" + clubKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !isClubDataEmpty(parsed)) {
        return {
          header: {
            title: parsed.header?.title || "",
            subtitle: parsed.header?.subtitle || "",
            text: parsed.header?.text || "",
            photo: parsed.header?.photo || "",
            photoCaption: parsed.header?.photoCaption || ""
          },
          sections: Array.isArray(parsed.sections) ? parsed.sections : []
        };
      }
    }
  } catch (e) {
    console.error("Erreur lecture club data", e);
  }

  // 3. Fallback direct via window.opener si la page a été ouverte depuis l'admin sur file:///
  try {
    if (window.opener) {
      if (window.opener.currentAdminClubData && !isClubDataEmpty(window.opener.currentAdminClubData)) {
        const d = window.opener.currentAdminClubData;
        try {
          localStorage.setItem("usbl_club_" + clubKey, JSON.stringify(d));
        } catch(err) {}
        return d;
      }
      if (typeof window.opener.getClubPresentationData === "function") {
        const openerData = window.opener.getClubPresentationData(clubKey);
        if (openerData && !isClubDataEmpty(openerData)) {
          try {
            localStorage.setItem("usbl_club_" + clubKey, JSON.stringify(openerData));
          } catch(err) {}
          return openerData;
        }
      }
    }
  } catch(e) {
    // Restriction cross-origin de opener
  }

  return createEmptyClubData();
}
window.getClubPresentationData = getClubPresentationData;

function renderQuiSommesNousHub() {
  const usblSec = document.getElementById("usbl");
  const bclSec = document.getElementById("bcl");
  if (!usblSec && !bclSec) return;

  const usblData = window.getClubPresentationData("usbl");
  const bclData = window.getClubPresentationData("bcl");

  if (usblSec && !isClubDataEmpty(usblData)) {
    const h2 = usblSec.querySelector("h2");
    if (h2 && usblData.header?.title) h2.textContent = usblData.header.title;
    const pIntro = usblSec.querySelector("p");
    if (pIntro && (usblData.header?.text || usblData.header?.subtitle)) {
      pIntro.textContent = usblData.header.text || usblData.header.subtitle;
    }
  }

  if (bclSec && !isClubDataEmpty(bclData)) {
    const h2 = bclSec.querySelector("h2");
    if (h2 && bclData.header?.title) h2.textContent = bclData.header.title;
    const pIntro = bclSec.querySelector("p");
    if (pIntro && (bclData.header?.text || bclData.header?.subtitle)) {
      pIntro.textContent = bclData.header.text || bclData.header.subtitle;
    }
  }
}
window.renderQuiSommesNousHub = renderQuiSommesNousHub;

function loadClubPresentation(clubKey) {
  const container = document.getElementById("club-presentation-wrapper");
  if (!container) return;

  // Écouteur de synchronisation inter-fenêtres (postMessage) pour file:/// et cross-origin
  if (!window._clubPostMessageBound) {
    window._clubPostMessageBound = true;
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "USBL_RECEIVE_CLUB_DATA") {
        const incomingKey = e.data.clubKey;
        const incomingData = e.data.data;
        if (incomingData && !isClubDataEmpty(incomingData)) {
          try {
            localStorage.setItem("usbl_club_" + incomingKey, JSON.stringify(incomingData));
          } catch(err) {}
          window.loadClubPresentation(incomingKey);
        }
      }
    });

    // Demander poliment les données au parent (admin) s'il existe
    if (window.opener) {
      try {
        window.opener.postMessage({ type: "USBL_REQUEST_CLUB_DATA", clubKey }, "*");
      } catch(e) {}
    }
  }

  const data = window.getClubPresentationData(clubKey);
  const isBcl = clubKey === "bcl";
  const defaultName = isBcl ? "Basket Club Lislois" : "Union Sportive Basket Lislois";
  const logoSrc = isBcl ? "assets/logo_bcl_transparent.png" : "assets/logo_usbl.png";
  const competitionsLink = isBcl ? "competitions.html#section-feminine" : "competitions.html#section-masculine";

  // 1. ÉTAT VIDE ("Page en cours de création par le club")
  if (isClubDataEmpty(data)) {
    container.innerHTML = `
      <div class="club-empty-state-wrap">
        <div class="club-empty-state-card">
          <img src="${logoSrc}" alt="${defaultName}" class="club-empty-state-logo">
          <h1 class="club-empty-state-title">${defaultName}</h1>
          <div class="club-empty-state-tag">Page en cours de création</div>
          <p class="club-empty-state-desc">
            Le club est actuellement en train de préparer la présentation détaillée de l'association.<br>
            Revenez très prochainement pour découvrir son histoire, ses équipes et ses projets.
          </p>
          <div class="club-empty-state-actions">
            <a href="index.html" class="btn btn-outline">Retour à l'accueil</a>
            <a href="${competitionsLink}" class="btn btn-outline">Voir les compétitions</a>
          </div>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); font-size: 0.82rem; color: var(--muted-text);">
            Responsable du club ? <a href="admin.html" style="color: var(--primary-color); text-decoration: underline; font-weight: 500;">Personnaliser cette page depuis l'Espace Admin →</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 2. ÉTAT PERSONNALISÉ AVEC EN-TÊTE ET SOUS-PARTIES LIBRES
  const pageTitle = data.header.title ? escapeClubHtml(data.header.title) : defaultName;
  const pageSub = data.header.subtitle ? `<p class="editorial-header-sub">${escapeClubHtml(data.header.subtitle)}</p>` : "";

  // Sommaire d'ancres dynamique si sous-parties avec titre
  const navLinks = (data.sections || [])
    .filter(s => s.title && s.title.trim())
    .map((s, idx) => `<a href="#section-${idx}">${escapeClubHtml(s.title)}</a>`)
    .join("");
  const navBar = navLinks ? `<nav class="editorial-header-nav">${navLinks}</nav>` : "";

  let html = `
    <!-- EN-TÊTE ÉDITORIAL DYNAMIQUE -->
    <header class="editorial-header-banner">
      <div class="editorial-header-container">
        <img src="${logoSrc}" alt="${pageTitle}" class="editorial-header-logo">
        <div class="editorial-header-text">
          <h1>${pageTitle}</h1>
          ${pageSub}
          ${navBar}
        </div>
      </div>
    </header>

    <!-- CONTENU PRINCIPAL -->
    <main class="editorial-page-wrap">
  `;

  // Bloc introductif (Texte d'en-tête + Photo d'en-tête si présents)
  const hasIntroText = data.header.text && data.header.text.trim();
  const hasIntroPhoto = data.header.photo && data.header.photo.trim();

  if (hasIntroText || hasIntroPhoto) {
    html += `<section class="editorial-block">`;
    if (hasIntroText) {
      html += formatClubParagraphs(data.header.text);
    }
    if (hasIntroPhoto) {
      const caption = data.header.photoCaption ? `<figcaption>${escapeClubHtml(data.header.photoCaption)}</figcaption>` : "";
      html += `
        <figure class="editorial-photo">
          <img src="${data.header.photo}" alt="${escapeClubHtml(data.header.photoCaption || pageTitle)}">
          ${caption}
        </figure>
      `;
    }
    html += `</section>`;
  }

  // Sous-parties créées dynamiquement
  if (Array.isArray(data.sections)) {
    data.sections.forEach((sec, idx) => {
      const secTitle = sec.title ? escapeClubHtml(sec.title) : "";
      const secText = sec.text ? formatClubParagraphs(sec.text) : "";
      const hasPhoto = sec.photo && sec.photo.trim();

      if (secTitle || secText || hasPhoto) {
        html += `<section id="section-${idx}" class="editorial-block">`;
        if (secTitle) {
          html += `<h2>${secTitle}</h2>`;
        }
        if (secText) {
          html += secText;
        }
        if (hasPhoto) {
          const caption = sec.photoCaption ? `<figcaption>${escapeClubHtml(sec.photoCaption)}</figcaption>` : "";
          html += `
            <figure class="editorial-photo">
              <img src="${sec.photo}" alt="${escapeClubHtml(sec.photoCaption || sec.title || pageTitle)}">
              ${caption}
            </figure>
          `;
        }
        html += `</section>`;
      }
    });
  }

  html += `</main>`;
  container.innerHTML = html;
}
window.loadClubPresentation = loadClubPresentation;

document.addEventListener("DOMContentLoaded", async () => {

  // ----------------------------------------------------------------------
  // 1. TRANSITION DU HEADER SUR DÉFILEMENT (TOUJOURS EN BLANC SUR TOUT LE SITE)
  // ----------------------------------------------------------------------
  const header = document.querySelector(".main-header");

  if (header) {
    const handleScrollHeader = () => {
      if (window.scrollY > 20) {
        header.classList.add("scrolled-header");
      } else {
        header.classList.remove("scrolled-header");
      }
    };

    window.addEventListener("scroll", handleScrollHeader, { passive: true });
    handleScrollHeader(); // Déclencher au chargement initial
  }

  // Détection des pages avec bandeau d'en-tête sombre pour la navbar initiale
  if (document.querySelector(".editorial-header-banner")) {
    document.body.classList.add("has-dark-banner");
  }

  // Détection automatique du lien actif de la navbar selon l'URL et application de la navbar rouge sur toutes les sous-pages
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a.nav-link").forEach(link => {
    link.classList.remove("active");
  });

  const isHomePage = currentPath === "index.html" || currentPath === "" || currentPath === "/";

  if (isHomePage) {
    document.body.classList.add("is-home-page");
    document.body.classList.remove("has-red-navbar");
    const el = document.getElementById("nav-leclub");
    if (el) el.classList.add("active");
  } else {
    document.body.classList.remove("is-home-page");
    document.body.classList.add("has-red-navbar");
    if (currentPath.includes("qui-sommes-nous") || currentPath.includes("infrastructures") || currentPath.includes("benevoles") || currentPath.includes("contact") || currentPath.includes("partenaire")) {
      const el = document.getElementById("nav-leclub");
      if (el) el.classList.add("active");
      document.body.classList.add("is-club-page");
    } else if (currentPath.includes("competition") || currentPath.includes("coach")) {
      const el = document.getElementById("nav-competitions");
      if (el) el.classList.add("active");
    } else if (currentPath.includes("evenement") || currentPath.includes("event") || currentPath.includes("article")) {
      const el = document.getElementById("nav-evenements");
      if (el) el.classList.add("active");
    } else if (currentPath.includes("information") || currentPath.includes("inscription") || currentPath.includes("planning") || currentPath.includes("boutique") || currentPath.includes("charte") || currentPath.includes("commission")) {
      const el = document.getElementById("nav-informations");
      if (el) el.classList.add("active");
    }
  }

  // Suppression absolue et dynamique de tout soulignement sur la navbar
  document.querySelectorAll(".main-nav a, .main-nav span, .nav-link").forEach(el => {
    el.style.setProperty("text-decoration", "none", "important");
    el.style.setProperty("border-bottom", "none", "important");
  });

  // Rendu immédiat des pages de club depuis localStorage (zéro latence)
  if (document.getElementById("club-presentation-wrapper") || document.getElementById("club-display-title")) {
    const isBcl = window.location.pathname.includes("bcl") || document.body.getAttribute("data-club") === "bcl";
    if (typeof window.loadClubPresentation === "function") {
      window.loadClubPresentation(isBcl ? "bcl" : "usbl");
    }
  }
  if (typeof window.renderQuiSommesNousHub === "function") {
    window.renderQuiSommesNousHub();
  }

  // ----------------------------------------------------------------------
  // 2. MENU MOBILE RESPONSIVE (HAMBURGER TO X)
  // ----------------------------------------------------------------------
  const menuToggle = document.querySelector(".mobile-menu-toggle");
  const mainNav = document.querySelector(".main-nav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      mainNav.classList.toggle("active");

      const spans = menuToggle.querySelectorAll("span");
      if (menuToggle.classList.contains("active")) {
        spans[0].style.transform = "rotate(45deg) translate(5px, 5px)";
        spans[1].style.opacity = "0";
        spans[2].style.transform = "rotate(-45deg) translate(6px, -6px)";
      } else {
        spans[0].style.transform = "none";
        spans[1].style.opacity = "1";
        spans[2].style.transform = "none";
      }
    });
  }

  // Fermer le menu mobile lors du clic sur un lien de navigation
  const navLinks = document.querySelectorAll(".main-nav a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768 && mainNav.classList.contains("active")) {
        mainNav.classList.remove("active");
        menuToggle.classList.remove("active");

        const spans = menuToggle.querySelectorAll("span");
        spans[0].style.transform = "none";
        spans[1].style.opacity = "1";
        spans[2].style.transform = "none";
      }
    });
  });

  // ----------------------------------------------------------------------
  // 3. SCROLL REVEAL (EFFETS D'APPARITION ÉLÉGANTS SUR LE SITE BLANC PUR)
  // ----------------------------------------------------------------------
  const revealElements = document.querySelectorAll(
    ".chronicle-match-row, .actu-card, .pillar-row, .salle-frame-row, .annexe-item, .table-frame, .contact-text-col, .contact-form-col, .team-explorer-card, .credo-pillar-card, .product-card, .partner-card, .timeline-item",
  );

  const revealOnScroll = () => {
    const triggerBottom = window.innerHeight * 0.92;

    revealElements.forEach((el) => {
      const elTop = el.getBoundingClientRect().top;

      if (elTop < triggerBottom) {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }
    });
  };

  // Style de départ pour le Scroll Reveal (Fade-in + Slide-up léger)
  revealElements.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(25px)";
    el.style.transition =
      "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
  });

  window.addEventListener("scroll", revealOnScroll);
  revealOnScroll(); // Lancer une première fois

  // ----------------------------------------------------------------------
  // AUTOMATIC PURGE OF LEGACY MOCK / FAKE NEWS FROM CACHE
  // ----------------------------------------------------------------------
  // AUTOMATIC PURGE OF LEGACY MOCK / FAKE NEWS FROM CACHE
  // ----------------------------------------------------------------------
  const isLegacyMockArticle = (a) => {
    if (!a) return true;
    const t = a.title || "";
    return (
      a.id === "art-1" ||
      a.id === "art-2" ||
      a.id !== undefined && String(a.id).startsWith("art-test-") ||
      a.id === "art-3" ||
      t.includes("Union et Ferveur") ||
      t.includes("RM3 : Les Spartiates") ||
      t.includes("Section Féminine BCL : Reprise") ||
      t.includes("Stages Basket") ||
      t.includes("Assemblée Générale") ||
      t.includes("Mini-Basket") ||
      t.includes("Label Occitanie") ||
      t.includes("Tournoi 3x3") ||
      t.includes("Stages d'Été") ||
      t.includes("Portes Ouvertes")
    );
  };

  const storedArticlesCheck = localStorage.getItem("usbl_articles");
  if (storedArticlesCheck) {
    try {
      const parsedArticles = JSON.parse(storedArticlesCheck);
      if (Array.isArray(parsedArticles)) {
        const cleanedArticles = parsedArticles.filter((a) => !isLegacyMockArticle(a));
        if (cleanedArticles.length !== parsedArticles.length) {
          localStorage.setItem("usbl_articles", JSON.stringify(cleanedArticles));
        }
      }
    } catch (e) {
      localStorage.removeItem("usbl_articles");
    }
  }

  // ----------------------------------------------------------------------
  // UNIFIED CLIENT-SIDE DATABASE INITIALIZATION (localStorage)
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // UNIFIED DATABASE SYNCHRONIZATION WITH PHYSICAL JSON FILES & localStorage
  // ----------------------------------------------------------------------

  const loadCollection = async (fileName, localStorageKey, fallbackDefault) => {
    let localData = null;
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored !== null) {
        localData = JSON.parse(stored);
        if (localStorageKey === "usbl_articles" && Array.isArray(localData)) {
          localData = localData.filter((a) => !isLegacyMockArticle(a));
        }
      }
    } catch (e) {}

    try {
      let res = null;
      if (window.location.protocol !== "file:") {
        try { res = await fetch(fileName); } catch(e) {}
      }
      if (!res || !res.ok) {
        const ports = [3001, 3000, 8080];
        for (const p of ports) {
          try {
            const r = await fetch(`http://localhost:${p}/${fileName}`);
            if (r.ok) { res = r; break; }
          } catch(e) {}
        }
      }
      if (!res || !res.ok) {
        try { res = await fetch(fileName); } catch(e) {}
      }
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && (Array.isArray(serverData) || typeof serverData === "object")) {
          // If local storage has items but server has none (e.g. empty file on Vercel), keep local storage
          if (localData && Array.isArray(localData) && localData.length > 0 && Array.isArray(serverData) && serverData.length === 0) {
            console.log(`[Database Sync] Server file ${fileName} is empty, keeping local storage for ${localStorageKey}`);
            return localData;
          }
          if (localData && typeof localData === "object" && !Array.isArray(localData) && Object.keys(localData).length > 0 && typeof serverData === "object" && Object.keys(serverData).length === 0) {
            console.log(`[Database Sync] Server file ${fileName} is empty, keeping local storage for ${localStorageKey}`);
            return localData;
          }

          // If both are arrays, merge them to preserve local browser changes alongside any server updates
          if (Array.isArray(serverData) && Array.isArray(localData)) {
            const cleanServer = localStorageKey === "usbl_articles"
              ? serverData.filter((a) => !isLegacyMockArticle(a))
              : [...serverData];
            const cleanLocal = localStorageKey === "usbl_articles"
              ? localData.filter((a) => !isLegacyMockArticle(a))
              : [...localData];

            const merged = [...cleanServer];
            cleanLocal.forEach(localItem => {
              const exists = cleanServer.some(serverItem => {
                if (localItem.id && serverItem.id) return localItem.id === serverItem.id;
                if (localItem.title && serverItem.title) return localItem.title === serverItem.title;
                return JSON.stringify(localItem) === JSON.stringify(serverItem);
              });
              if (!exists) {
                merged.push(localItem);
              }
            });
            localStorage.setItem(localStorageKey, JSON.stringify(merged));
            return merged;
          }

          // For club presentation pages, if local storage has customized content and server file is empty, preserve local storage!
          if (localStorageKey.startsWith("usbl_club_")) {
            const isLocalEmpty = !localData || isClubDataEmpty(localData);
            const isServerEmpty = !serverData || isClubDataEmpty(serverData);
            if (!isLocalEmpty && isServerEmpty) {
              return localData;
            }
            if (!isServerEmpty) {
              localStorage.setItem(localStorageKey, JSON.stringify(serverData));
              return serverData;
            }
            return localData || fallbackDefault;
          }

          // If both are objects (like rosters), merge them
          if (typeof serverData === "object" && typeof localData === "object" && !Array.isArray(serverData) && !Array.isArray(localData)) {
            const merged = { ...localData, ...serverData };
            localStorage.setItem(localStorageKey, JSON.stringify(merged));
            return merged;
          }

          localStorage.setItem(localStorageKey, JSON.stringify(serverData));
          return serverData;
        }
      }
    } catch (err) {
      console.warn(`[Database Sync] Could not fetch ${fileName} from disk/server, using local storage.`);
    }

    if (localData !== null) {
      return localData;
    }

    localStorage.setItem(localStorageKey, JSON.stringify(fallbackDefault));
    return fallbackDefault;
  };

  const saveCollectionToDisk = async (localStorageKey, data) => {
    // 1. Essai sur endpoint relatif si on est sur http/https
    if (window.location.protocol !== "file:") {
      try {
        const res = await fetch("/api/save-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: localStorageKey, data: data })
        });
        if (res.ok) {
          console.log(`[Database Sync] Successfully synced ${localStorageKey} to server!`);
          return true;
        }
      } catch (e) {}
    }

    // 2. Essai sur les ports locaux (pour protocole file:/// ou ports alternatifs)
    const ports = [3001, 3000, 8080];
    for (const p of ports) {
      try {
        const res = await fetch(`http://localhost:${p}/api/save-collection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: localStorageKey, data: data })
        });
        if (res.ok) {
          console.log(`[Database Sync] Successfully synced ${localStorageKey} to physical JSON file on disk (port ${p})!`);
          return true;
        }
      } catch (err) {}
    }

    console.warn(`[Database Sync] Could not sync changes for ${localStorageKey} to physical disk file.`);
    return false;
  };
  window.saveCollectionToDisk = saveCollectionToDisk;

  // 1. Articles (Actualités)
  const loadedArticles = await loadCollection("data/articles.json", "usbl_articles", []);
  articles.length = 0;
  articles.push(...loadedArticles);

  // 2. Volunteers (Bénévoles)
  const loadedVolunteers = await loadCollection("data/benevoles.json", "usbl_volunteers", defaultVolunteers);
  volunteers.length = 0;
  volunteers.push(...loadedVolunteers);

  // 3. Partners (Partenaires)
  const loadedPartners = await loadCollection("data/partenaires.json", "usbl_partners", defaultPartners);
  partners.length = 0;
  partners.push(...loadedPartners);

  // 4. Rosters (Effectifs)
  rosters = await loadCollection("data/rosters.json", "usbl_rosters", rosters);
  window.rosters = rosters;
  window.articles = articles;
  window.volunteers = volunteers;
  window.coachs = coachs;
  window.partners = partners;

  // 4b. Coachs & Encadrement
  const loadedCoachs = await loadCollection("data/coachs.json", "usbl_coachs", defaultCoachs);
  coachs.length = 0;
  coachs.push(...loadedCoachs);

  // 5. Club presentation data (USBL & BCL)
  const defaultEmptyClub = {
    header: {
      title: "",
      subtitle: "",
      text: "",
      photo: "",
      photoCaption: ""
    },
    sections: []
  };
  await loadCollection("data/club_usbl.json", "usbl_club_usbl", defaultEmptyClub);
  await loadCollection("data/club_bcl.json", "usbl_club_bcl", defaultEmptyClub);

  // Rafraîchir les pages de présentation des clubs après chargement des données serveur
  if (document.getElementById("club-presentation-wrapper") || document.getElementById("club-display-title")) {
    const isBcl = window.location.pathname.includes("bcl") || document.body.getAttribute("data-club") === "bcl";
    window.loadClubPresentation(isBcl ? "bcl" : "usbl");
  }
  if (typeof window.renderQuiSommesNousHub === "function") {
    window.renderQuiSommesNousHub();
  }

  // Initialiser les rendus
  renderArticles();
  renderTicker();
  renderScores();
  renderCompetitionPages();
  renderVolunteers();
  renderPartners();
  renderSponsorsBand();
  renderCompetitionsHub();
  if (typeof window.initCategoryPdfPage === "function") {
    window.initCategoryPdfPage();
  }
  if (typeof window.initInformationsHubPage === "function") {
    window.initInformationsHubPage();
  }
  // fetchInstagramFeed(); // Désactivé au profit de la bannière statique premium avec capture floutée

  if (document.getElementById("page-competition-detail")) {
    loadCompetitionDetailPage();
  }

  // Decode query params for details pages
  const urlParams = new URLSearchParams(window.location.search);

  // Article Detail page
  if (document.getElementById("page-article-detail")) {
    const articleParam = urlParams.get("article");
    if (articleParam !== null && articleParam !== "") {
      renderArticleDetail(articleParam);
    } else {
      window.location.href = "evenements.html";
    }
  }

  // Event Detail page
  if (document.getElementById("page-event-detail")) {
    const eventId = urlParams.get("event");
    if (eventId !== null) {
      renderEventDetail(eventId);
    } else {
      window.location.href = "evenements.html";
    }
  }

  // Admin Page Guard (admin.html)
  if (document.getElementById("page-admin-login")) {
    const isAuth = sessionStorage.getItem("admin_authenticated") === "true";
    if (isAuth) {
      document.getElementById("page-admin-login").style.display = "none";
      document.getElementById("page-admin-dashboard").style.display = "block";
      renderAdminTables();
    } else {
      document.getElementById("page-admin-login").style.display = "block";
      document.getElementById("page-admin-dashboard").style.display = "none";
    }
  }

  // Chargement automatique des données dynamiques sur les pages de présentation des clubs
  if (document.getElementById("club-presentation-wrapper") || document.getElementById("club-display-title")) {
    const isBcl = window.location.pathname.includes("bcl") || document.body.getAttribute("data-club") === "bcl";
    window.loadClubPresentation(isBcl ? "bcl" : "usbl");
  }
  if (typeof window.renderQuiSommesNousHub === "function") {
    window.renderQuiSommesNousHub();
  }

  // Synchronisation en direct inter-onglets pour les pages clubs
  window.addEventListener("storage", (e) => {
    if (e.key === "usbl_club_usbl" && (!window.location.pathname.includes("bcl") && document.body.getAttribute("data-club") !== "bcl")) {
      window.loadClubPresentation("usbl");
    }
    if (e.key === "usbl_club_bcl" && (window.location.pathname.includes("bcl") || document.body.getAttribute("data-club") === "bcl")) {
      window.loadClubPresentation("bcl");
    }
    if (e.key === "usbl_club_usbl" || e.key === "usbl_club_bcl") {
      if (typeof window.renderQuiSommesNousHub === "function") {
        window.renderQuiSommesNousHub();
      }
    }
  });
});

// ----------------------------------------------------------------------
// 4. BASE DE DONNÉES / ÉTAT DE L'APPLICATION (STATE MANAGEMENT)
// ----------------------------------------------------------------------

// Active dynamic collections loaded from localStorage on startup
let volunteers = [];
let partners = [];

// Articles par défaut (démarrage propre à vide)
const articles = [];

// Matchs par défaut (Réels FFBB)
const matchs = [
  {
    date: "01 Juin 2026",
    competition: "RMU21",
    competitionLabel: "RÉGIONALE MASCULINE U21 • PHASE FINALE ELIMINATOIRE",
    teamHome: "US Basket L'Isle Jourdain",
    teamAway: "TOAC Basket (CTC Avenir Toulouse)",
    scoreHome: 78,
    scoreAway: 68,
    scoreUSBL: 78,
    scoreOpp: 68,
    venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
    resultText: "Victoire à Domicile",
    isPlayed: true,
  },
  {
    date: "28 Mai 2026",
    competition: "DMU13-3",
    competitionLabel: "DÉPARTEMENTALE MASCULINE U13 - DIVISION 3 • POULE B",
    teamHome: "AS Tournefeuille 2",
    teamAway: "US Basket L'Isle Jourdain 2",
    scoreHome: 30,
    scoreAway: 66,
    scoreUSBL: 66,
    scoreOpp: 30,
    venue: "📍 Gymnase Municipal (Tournefeuille)",
    resultText: "Victoire à l'Extérieur",
    isPlayed: true,
  },
  {
    date: "06 Juin 2026",
    competition: "RM3",
    competitionLabel: "PROCHAIN DERBY DU GERS • RM3 POULE MAINTIEN",
    teamHome: "US Basket L'Isle Jourdain 1",
    teamAway: "Auch Basket Club 2",
    scoreHome: null,
    scoreAway: null,
    scoreUSBL: null,
    scoreOpp: null,
    venue: "📍 Gymnase Gasco'Sport • Samedi Prochain, 20h30",
    resultText: "À venir",
    isPlayed: false,
  },
];

// Base de données des effectifs (Rosters avec effectifs à vide par défaut)
let rosters = {
  rm3: {
    category: "Régionale RM3",
    name: "Seniors Garçons 1",
    coach: "Jean-Pierre Gasc",
    players: [],
  },
  rmu21: {
    category: "Régionale RMU21",
    name: "Espoirs U21",
    coach: "Marc Antoine",
    players: [],
  },
  dmu18: {
    category: "Départementale DMU18",
    name: "Jeunes U18",
    coach: "David Salles",
    players: [],
  },
  dmu13: {
    category: "Départementale DMU13",
    name: "Minimes U13",
    coach: "Julien Lopez",
    players: [],
  },
};

// Base de données Boutique
const products = {
  maillot: {
    tag: "Vêtement Officiel",
    title: "Maillot Officiel Spartiates",
    price: "45 €",
    icon: "👕",
    category: "vetements",
  },
  sweat: {
    tag: "Sportswear",
    title: "Sweat à Capuche USBL",
    price: "55 €",
    icon: "🧥",
    category: "vetements",
  },
  ballon: {
    tag: "Accessoires",
    title: "Ballon Spalding USBL Leather",
    price: "35 €",
    icon: "🏀",
    category: "accessoires",
  },
  sac: {
    tag: "Accessoires",
    title: "Sac à Dos de Match",
    price: "28 €",
    icon: "🎒",
    category: "accessoires",
  },
};

// Base de données Événements (Vide par défaut, alimentée uniquement par les données réelles)
const events = {};

// État Global du Panier d'achat
const cart = [];

let currentFilter = "toutes";

// Helper de formatage de date
const formatDate = (date) => {
  const options = { day: "2-digit", month: "long", year: "numeric" };
  let formatted = date.toLocaleDateString("fr-FR", options);
  return formatted.replace(/^[a-z]/, (m) => m.toUpperCase());
};

// Helper de compression d'image pour éviter la saturation du localStorage
const compressImage = (file, callback, maxWidth = 800, maxHeight = 600, quality = 0.7) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target.result);
    reader.readAsDataURL(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      callback(compressedDataUrl);
    };
    img.onerror = () => {
      callback(e.target.result);
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    console.error("FileReader error");
  };
  reader.readAsDataURL(file);
};

// Helper de sauvegarde sécurisée dans localStorage
const safeSetLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`[LocalStorage Error] Failed to write key "${key}":`, err);
    if (document.getElementById("page-admin-dashboard")) {
      alert("⚠️ Erreur de stockage : La mémoire de votre navigateur est saturée pour ce site. Les images que vous tentez d'importer sont probablement trop lourdes, veuillez les compresser ou les réduire avant de réessayer.");
    }
    return false;
  }
};


// ----------------------------------------------------------------------
// 6. SYSTÈME DE ROUTING SPA (ET HEADER COLOR TRANSITIONS)
// ----------------------------------------------------------------------
window.navigateTo = (pageId) => {
  if (pageId === "leclub") {
    window.location.href = "index.html";
  } else {
    window.location.href = `${pageId}.html`;
  }
};

// ----------------------------------------------------------------------
// 7. SYSTEM DE LECTURE D'ARTICLES EN HAUTE FIDÉLITÉ (MPA DIRECT REDIRECT)
// ----------------------------------------------------------------------
window.readArticle = (indexOrId) => {
  window.location.href = `article-detail.html?article=${encodeURIComponent(indexOrId)}`;
};

function renderArticleDetail(identifier) {
  let art = null;
  if (identifier !== undefined && identifier !== null) {
    art = articles.find((a) => a.id === String(identifier));
    if (!art && (typeof identifier === "number" || (!isNaN(identifier) && !isNaN(parseFloat(identifier))))) {
      art = articles[parseInt(identifier, 10)];
    }
  }

  if (!art) {
    window.location.href = "evenements.html";
    return;
  }

  const categoryEl = document.getElementById("detail-article-category");
  const titleEl = document.getElementById("detail-article-title");
  const dateEl = document.getElementById("detail-article-date");
  const contentDiv = document.getElementById("detail-article-content");
  const photoFrame = document.querySelector(".article-rich-photo-frame");
  const imageEl = document.querySelector(".article-rich-img");
  const galleryDiv = document.getElementById("detail-article-gallery");

  if (categoryEl) categoryEl.textContent = art.category;
  if (titleEl) titleEl.textContent = art.title;
  if (dateEl) dateEl.textContent = art.date;

  if (photoFrame && imageEl) {
    if (art.image && art.image.trim() !== "") {
      imageEl.src = art.image;
      photoFrame.style.display = "block";
    } else {
      photoFrame.style.display = "none";
    }
  }

  if (contentDiv) {
    const paragraphs = art.content.split("\n\n");
    contentDiv.innerHTML = paragraphs
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  if (galleryDiv) {
    galleryDiv.innerHTML = "";
    if (art.images && art.images.length > 0) {
      galleryDiv.innerHTML = art.images
        .map(
          (imgUrl) => `
                <div class="article-gallery-img-container" onclick="window.open('${imgUrl}', '_blank')">
                    <img src="${imgUrl}" class="article-gallery-img" alt="Illustration intégrée">
                </div>
            `,
        )
        .join("");
      galleryDiv.style.display = "grid";
    } else {
      galleryDiv.style.display = "none";
    }
  }
}

// ----------------------------------------------------------------------
// 8. LOGIQUE DÉTAIL D'ÉVÉNEMENTS & INSCRIPTIONS ASSOCIÉES
// ----------------------------------------------------------------------
window.viewEvent = (eventId) => {
  window.location.href = `event-detail.html?event=${eventId}`;
};

function renderEventDetail(eventId) {
  const ev = events[eventId];
  if (!ev) {
    window.location.href = "evenements.html";
    return;
  }

  const tagEl = document.getElementById("detail-event-tag");
  const titleEl = document.getElementById("detail-event-title");
  const dateEl = document.getElementById("detail-event-date");
  const venueEl = document.getElementById("detail-event-venue");
  const accessEl = document.getElementById("detail-event-access");
  const descEl = document.getElementById("detail-event-description");

  if (tagEl) tagEl.textContent = ev.tag;
  if (titleEl) titleEl.textContent = ev.title;
  if (dateEl) dateEl.textContent = ev.date;
  if (venueEl) venueEl.textContent = ev.venue;
  if (accessEl) accessEl.textContent = ev.access;
  if (descEl) descEl.innerHTML = ev.description;

  // Reset confirmation box
  const successBox = document.getElementById("event-success-box");
  if (successBox) successBox.style.display = "none";

  const formWrapper = document.getElementById("event-form-wrapper");
  if (!formWrapper) return;

  formWrapper.style.display = "block";

  // Générer le formulaire sémantique adapté au type d'événement
  let formHtml = "";
  if (ev.formType === "rsvp") {
    formHtml = `
            <form id="event-rsvp-form" onsubmit="event.preventDefault(); submitEventRegistration('${eventId}', 'rsvp');">
                <div class="form-line-group">
                    <input type="text" id="rsvp-name" required placeholder=" ">
                    <label for="rsvp-name">Votre Nom & Prénom</label>
                </div>
                <div class="form-line-group">
                    <input type="email" id="rsvp-email" required placeholder=" ">
                    <label for="rsvp-email">Votre Adresse E-mail</label>
                </div>
                <div class="form-line-group">
                    <input type="number" id="rsvp-count" value="1" min="1" max="10" required placeholder=" ">
                    <label for="rsvp-count">Nombre de participants</label>
                </div>
                <button type="submit" class="btn-submit full-width-btn margin-top-20">Confirmer ma présence <span class="arrow">→</span></button>
            </form>
        `;
  } else if (ev.formType === "tournament3x3") {
    formHtml = `
            <form id="event-3x3-form" onsubmit="event.preventDefault(); submitEventRegistration('${eventId}', 'tournament3x3');">
                <div class="form-line-group">
                    <input type="text" id="t-team-name" required placeholder=" ">
                    <label for="t-team-name">Nom de votre Équipe 3x3</label>
                </div>
                <div class="form-line-group">
                    <input type="email" id="t-contact-email" required placeholder=" ">
                    <label for="t-contact-email">E-mail du capitaine de l'équipe</label>
                </div>
                
                <span class="form-sub-header-label">Membres de l'équipe (4 joueurs max)</span>
                <div class="form-grid-players">
                    <div class="form-line-group">
                        <input type="text" id="t-p1" required placeholder=" ">
                        <label for="t-p1">Joueur 1 (Capitaine)</label>
                    </div>
                    <div class="form-line-group">
                        <input type="text" id="t-p2" required placeholder=" ">
                        <label for="t-p2">Joueur 2</label>
                    </div>
                    <div class="form-line-group">
                        <input type="text" id="t-p3" required placeholder=" ">
                        <label for="t-p3">Joueur 3</label>
                    </div>
                    <div class="form-line-group">
                        <input type="text" id="t-p4" placeholder=" ">
                        <label for="t-p4">Joueur 4 (Remplaçant optionnel)</label>
                    </div>
                </div>
                <button type="submit" class="btn-submit full-width-btn margin-top-20">Inscrire l'équipe (10€) <span class="arrow">→</span></button>
            </form>
        `;
  } else if (ev.formType === "summercamp") {
    formHtml = `
            <form id="event-camp-form" onsubmit="event.preventDefault(); submitEventRegistration('${eventId}', 'summercamp');">
                <div class="form-line-group">
                    <input type="text" id="c-child-name" required placeholder=" ">
                    <label for="c-child-name">Nom & Prénom de l'enfant</label>
                </div>
                <div class="form-line-group">
                    <select id="c-child-cat" required>
                        <option value="" disabled selected hidden></option>
                        <option value="U9">U9 Poussins (7-8 ans)</option>
                        <option value="U11">U11 Benjamins (9-10 ans)</option>
                        <option value="U13">U13 Minimes (11-12 ans)</option>
                        <option value="U15">U15 Cadets (13-14 ans)</option>
                        <option value="U18">U18 Juniors (15-17 ans)</option>
                    </select>
                    <label for="c-child-cat">Catégorie d'âge</label>
                </div>
                <div class="form-line-group">
                    <input type="text" id="c-parent-name" required placeholder=" ">
                    <label for="c-parent-name">Nom du parent / Tuteur légal</label>
                </div>
                <div class="form-line-group">
                    <input type="email" id="c-parent-email" required placeholder=" ">
                    <label for="c-parent-email">E-mail de contact parent</label>
                </div>
                <button type="submit" class="btn-submit full-width-btn margin-top-20">Inscrire au stage d'été <span class="arrow">→</span></button>
            </form>
        `;
  }

  formWrapper.innerHTML = formHtml;
}

// Soumission de l'inscription événementielle
window.submitEventRegistration = (eventId, type) => {
  const ev = events[eventId];
  let msg = "";

  if (type === "rsvp") {
    const name = document.getElementById("rsvp-name").value;
    const count = document.getElementById("rsvp-count").value;
    msg = `Merci ${name} ! Votre participation pour ${count} personne(s) à l'événement "${ev.title}" a été enregistrée avec succès.`;
  } else if (type === "tournament3x3") {
    const team = document.getElementById("t-team-name").value;
    msg = `Félicitations ! L'équipe "${team}" a été enregistrée avec succès pour le Tournoi 3x3 Nocturne. Le capitaine recevra le bon de match par e-mail.`;
  } else if (type === "summercamp") {
    const name = document.getElementById("c-child-name").value;
    msg = `Parfait ! L'inscription de ${name} a été pré-validée pour le Stage d'Été des Spartiates. Une confirmation complète a été envoyée.`;
  }

  document.getElementById("event-success-message").textContent = msg;
  document.getElementById("event-success-box").style.display = "block";
  document.getElementById("event-form-wrapper").style.display = "none";
};

// ----------------------------------------------------------------------
// 9. FORMULAIRES LE CLUB (BÉNÉVOLES & CONTACTS) & INSTAGRAM STORIES
// ----------------------------------------------------------------------

window.submitBenevoleForm = () => {
  const successBox = document.getElementById("benevole-success-box");
  const form = document.getElementById("benevole-form");
  if (successBox && form) {
    successBox.style.display = "block";
    form.style.display = "none";
  }
};

window.submitContactForm = () => {
  const successBox = document.getElementById("contact-success-box");
  const form = document.getElementById("contact-details-form");
  if (successBox && form) {
    successBox.style.display = "block";
    form.style.display = "none";
  }
};

// (Instagram stories épurées au profit des 3 publications réelles)

// ----------------------------------------------------------------------
// 10. COMPÉTITIONS DYNAMIQUES PAR NIVEAUX (FFBB STATE & RENDER)
// ----------------------------------------------------------------------

const competitionTeamsData = {
  rm3: {
    playedMatches: [
      {
        date: "17 Mai 2026",
        opp: "Montaut",
        scoreUSBL: 82,
        scoreOpp: 75,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
      {
        date: "10 Mai 2026",
        opp: "Saint Puy",
        scoreUSBL: 68,
        scoreOpp: 72,
        venue: "📍 Complexe Sportif (Saint-Puy)",
        isHome: false,
        result: "P",
      },
      {
        date: "03 Mai 2026",
        opp: "Valence Condom 3",
        scoreUSBL: 94,
        scoreOpp: 60,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
    ],
    upcomingMatches: [
      {
        date: "06 Juin 2026 • 20h30",
        opp: "Auch Basket Club 2",
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
      },
      {
        date: "13 Juin 2026 • 20h00",
        opp: "CTC Gers Basket",
        venue: "📍 Arène Condomoise (Valence-sur-Baïse)",
        isHome: false,
      },
    ],
    standings: [
      {
        pos: 1,
        team: "CTC Gers Basket",
        pts: 18,
        j: 10,
        g: 8,
        p: 2,
        diff: "+64",
      },
      {
        pos: 2,
        team: "US Basket L'Isle Jourdain",
        pts: 17,
        j: 10,
        g: 7,
        p: 3,
        diff: "+32",
      },
      {
        pos: 3,
        team: "Auch Basket Club 2",
        pts: 16,
        j: 10,
        g: 6,
        p: 4,
        diff: "+18",
      },
      { pos: 4, team: "Saint Puy", pts: 14, j: 10, g: 4, p: 6, diff: "-12" },
      { pos: 5, team: "Montaut", pts: 12, j: 10, g: 2, p: 8, diff: "-48" },
      {
        pos: 6,
        team: "Valence Condom 3",
        pts: 10,
        j: 10,
        g: 0,
        p: 10,
        diff: "-54",
      },
    ],
    roster: rosters.rm3.players,
    coach: rosters.rm3.coach,
  },
  rmu21: {
    playedMatches: [
      {
        date: "01 Juin 2026",
        opp: "TOAC Basket",
        scoreUSBL: 78,
        scoreOpp: 68,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
      {
        date: "24 Mai 2026",
        opp: "Colomiers Basket",
        scoreUSBL: 85,
        scoreOpp: 80,
        venue: "📍 Gymnase Municipal (Colomiers)",
        isHome: false,
        result: "G",
      },
      {
        date: "17 Mai 2026",
        opp: "CTC Gers Basket",
        scoreUSBL: 72,
        scoreOpp: 64,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
    ],
    upcomingMatches: [
      {
        date: "07 Juin 2026 • 15h30",
        opp: "Castéra Verduzan",
        venue: "📍 Complexe Sportif (Castéra-Verduzan)",
        isHome: false,
      },
      {
        date: "14 Juin 2026 • 16h00",
        opp: "TOAC Basket",
        venue: "📍 Gymnase Léo Lagrange (Toulouse)",
        isHome: false,
      },
    ],
    standings: [
      {
        pos: 1,
        team: "TOAC Basket",
        pts: 22,
        j: 12,
        g: 10,
        p: 2,
        diff: "+112",
      },
      {
        pos: 2,
        team: "US Basket L'Isle Jourdain",
        pts: 21,
        j: 12,
        g: 9,
        p: 3,
        diff: "+78",
      },
      {
        pos: 3,
        team: "Colomiers Basket",
        pts: 19,
        j: 12,
        g: 7,
        p: 5,
        diff: "+24",
      },
      {
        pos: 4,
        team: "Castéra Verduzan",
        pts: 17,
        j: 12,
        g: 5,
        p: 7,
        diff: "-42",
      },
      {
        pos: 5,
        team: "CTC Gers Basket",
        pts: 15,
        j: 12,
        g: 3,
        p: 9,
        diff: "-68",
      },
    ],
    roster: rosters.rmu21.players,
    coach: rosters.rmu21.coach,
  },
  dmu18: {
    playedMatches: [
      {
        date: "26 Mai 2026",
        opp: "Gimont",
        scoreUSBL: 65,
        scoreOpp: 58,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
      {
        date: "19 Mai 2026",
        opp: "Jegun",
        scoreUSBL: 70,
        scoreOpp: 61,
        venue: "📍 Gymnase Municipal (Jegun)",
        isHome: false,
        result: "G",
      },
      {
        date: "12 Mai 2026",
        opp: "Mauvezin",
        scoreUSBL: 58,
        scoreOpp: 63,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "P",
      },
    ],
    upcomingMatches: [
      {
        date: "06 Juin 2026 • 14h00",
        opp: "Fleurance",
        venue: "📍 Gymnase Municipal (Fleurance)",
        isHome: false,
      },
      {
        date: "13 Juin 2026 • 14h30",
        opp: "Gimont",
        venue: "📍 Gymnase Municipal (Gimont)",
        isHome: false,
      },
    ],
    standings: [
      {
        pos: 1,
        team: "US Basket L'Isle Jourdain",
        pts: 14,
        j: 8,
        g: 6,
        p: 2,
        diff: "+48",
      },
      { pos: 2, team: "Gimont", pts: 12, j: 8, g: 4, p: 4, diff: "+12" },
      { pos: 3, team: "Mauvezin", pts: 11, j: 8, g: 3, p: 5, diff: "-18" },
      { pos: 4, team: "Jegun", pts: 9, j: 8, g: 2, p: 6, diff: "-24" },
      { pos: 5, team: "Fleurance", pts: 8, j: 8, g: 1, p: 7, diff: "-18" },
    ],
    roster: rosters.dmu18.players,
    coach: rosters.dmu18.coach,
  },
  dmu13: {
    playedMatches: [
      {
        date: "28 Mai 2026",
        opp: "AS Tournefeuille 2",
        scoreUSBL: 66,
        scoreOpp: 30,
        venue: "📍 Gymnase Municipal (Tournefeuille)",
        isHome: false,
        result: "G",
      },
      {
        date: "21 Mai 2026",
        opp: "Cugnaux",
        scoreUSBL: 54,
        scoreOpp: 42,
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
        result: "G",
      },
      {
        date: "14 Mai 2026",
        opp: "Auch 3",
        scoreUSBL: 48,
        scoreOpp: 38,
        venue: "📍 Gymnase Mathalin (Auch)",
        isHome: false,
        result: "G",
      },
    ],
    upcomingMatches: [
      {
        date: "06 Juin 2026 • 10h00",
        opp: "L'Isle-Jourdain 1",
        venue: "📍 Gymnase Municipal (L'Isle-Jourdain)",
        isHome: false,
      },
      {
        date: "13 Juin 2026 • 10h30",
        opp: "AS Tournefeuille 2",
        venue: "📍 Gymnase Gasco'Sport (L'Isle-Jourdain)",
        isHome: true,
      },
    ],
    standings: [
      {
        pos: 1,
        team: "US Basket L'Isle Jourdain 2",
        pts: 16,
        j: 9,
        g: 7,
        p: 2,
        diff: "+92",
      },
      {
        pos: 2,
        team: "AS Tournefeuille 2",
        pts: 14,
        j: 9,
        g: 5,
        p: 4,
        diff: "+14",
      },
      {
        pos: 3,
        team: "L'Isle-Jourdain 1",
        pts: 12,
        j: 9,
        g: 3,
        p: 6,
        diff: "-32",
      },
      { pos: 4, team: "Cugnaux", pts: 10, j: 9, g: 2, p: 7, diff: "-44" },
      { pos: 5, team: "Auch 3", pts: 8, j: 9, g: 1, p: 8, diff: "-30" },
    ],
    roster: rosters.dmu13.players,
    coach: rosters.dmu13.coach,
  },
};

window.renderCompetitionPages = () => {
  Object.keys(competitionTeamsData).forEach((teamKey) => {
    const team = competitionTeamsData[teamKey];

    // 1. Derniers Matchs
    const playedContainer = document.getElementById(
      `played-matches-${teamKey}`,
    );
    if (playedContainer) {
      playedContainer.innerHTML = team.playedMatches
        .map(
          (m) => `
                <div class="comp-match-item">
                    <div class="comp-match-meta">${m.date} • ${m.venue}</div>
                    <div class="comp-match-main">
                        <span class="comp-match-opp">${m.isHome ? "USBL" : m.opp} vs ${m.isHome ? m.opp : "USBL"}</span>
                        <div class="comp-match-score">
                            <span class="${m.result === "G" ? "winner-score" : ""}">${m.scoreUSBL}</span>
                            <span class="sep">-</span>
                            <span class="${m.result === "P" ? "winner-score" : ""}">${m.scoreOpp}</span>
                            <span class="result-badge ${m.result === "G" ? "win" : "loss"}">${m.result}</span>
                        </div>
                    </div>
                </div>
            `,
        )
        .join("");
    }

    // 2. Prochaines Rencontres
    const upcomingContainer = document.getElementById(
      `upcoming-matches-${teamKey}`,
    );
    if (upcomingContainer) {
      upcomingContainer.innerHTML = team.upcomingMatches
        .map(
          (m) => `
                <div class="comp-match-item upcoming">
                    <div class="comp-match-meta">${m.date}</div>
                    <div class="comp-match-main">
                        <span class="comp-match-opp">${m.isHome ? "USBL" : m.opp} vs ${m.isHome ? m.opp : "USBL"}</span>
                        <span class="comp-match-venue">${m.venue}</span>
                    </div>
                </div>
            `,
        )
        .join("");
    }

    // 3. Tableaux de classements
    const standingsBody = document.querySelector(
      `#standings-table-${teamKey} tbody`,
    );
    if (standingsBody) {
      standingsBody.innerHTML = team.standings
        .map(
          (s) => `
                <tr class="${s.team.includes("L'Isle Jourdain") ? "usbl-row" : ""}">
                    <td><strong>${s.pos}</strong></td>
                    <td class="team-name-cell">${s.team}</td>
                    <td><strong>${s.pts}</strong></td>
                    <td>${s.j}</td>
                    <td>${s.g}</td>
                    <td>${s.p}</td>
                    <td>${s.diff}</td>
                </tr>
            `,
        )
        .join("");
    }

    // Update coach label dynamically if it exists on page
    const coachLabel = document.querySelector(`#page-competition-${teamKey} .coach-name-label`);
    if (coachLabel) {
      if (rosters[teamKey]) {
        coachLabel.innerHTML = `<strong>Coach principal :</strong> ${rosters[teamKey].coach}`;
        coachLabel.style.display = "block";
      } else {
        coachLabel.style.display = "none";
      }
    }

    // 4. Rosters (Dynamic from rosters database)
    const rosterBody = document.querySelector(`#roster-table-${teamKey} tbody`);
    if (rosterBody) {
      if (!rosters[teamKey]) {
        rosterBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px 0;">Équipe non active ou supprimée.</td></tr>`;
      } else {
        const playersList = rosters[teamKey].players || [];
        if (playersList.length === 0) {
          rosterBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px 0;">Aucun joueur enregistré dans cette équipe.</td></tr>`;
        } else {
          rosterBody.innerHTML = playersList
            .map(
              (p) => `
                    <tr>
                        <td><strong>${p.num}</strong></td>
                        <td class="player-name-cell">${p.name}</td>
                        <td>${p.height}</td>
                        <td>${p.position}</td>
                    </tr>
                `,
            )
            .join("");
        }
      }
    }
  });
};

// ----------------------------------------------------------------------
// 10. SYSTÈME DE MODALE EFFECTIFS (ROSTER EXPLORER)
// ----------------------------------------------------------------------
window.openRosterModal = (teamId) => {
  const teamData = rosters[teamId];
  if (!teamData) return;

  document.getElementById("modal-team-category").textContent =
    teamData.category;
  document.getElementById("modal-team-name").textContent = teamData.name;
  document.getElementById("modal-team-coach").innerHTML =
    `<strong>Coach principal :</strong> ${teamData.coach}`;

  const tbody = document.getElementById("roster-table-body");
  tbody.innerHTML = "";

  teamData.players.forEach((player) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${player.num}</td>
            <td><strong>${player.name}</strong></td>
            <td>${player.height}</td>
            <td>${player.position}</td>
        `;
    tbody.appendChild(tr);
  });

  const modal = document.getElementById("roster-modal");
  modal.style.display = "flex";
};

window.closeRosterModal = () => {
  const modal = document.getElementById("roster-modal");
  modal.style.display = "none";
};

// Fermer les modales si clic à l'extérieur ou touche Échap
window.addEventListener("click", (e) => {
  const rosterModal = document.getElementById("roster-modal");
  if (e.target === rosterModal) {
    window.closeRosterModal();
  }
  const shopModal = document.getElementById("shop-modal");
  if (e.target === shopModal) {
    window.closeShopModal();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeRosterModal();
    window.closeShopModal();
  }
});

// ----------------------------------------------------------------------
// 11. FONCTIONS DE RENDU DYNAMIQUE
// ----------------------------------------------------------------------

// Détermination dynamique des teintes de la palette pour les actualités
function getArticlePaletteStyle(category, index = 0) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("bcl") || cat.includes("féminin") || cat.includes("feminin")) {
    return {
      textColor: "var(--palette-400)", // #FF6A2F
      bgColor: "var(--palette-50)",     // #FFF3EC
      borderColor: "var(--palette-100)", // #FFE4D2
      accentBorder: "var(--palette-400)",
      label: "BCL"
    };
  } else if (cat.includes("usbl") || cat.includes("masculin") || cat.includes("spartiate")) {
    return {
      textColor: "var(--palette-700)", // #D21A00
      bgColor: "var(--palette-50)",     // #FFF3EC
      borderColor: "var(--palette-200)", // #FFC6A4
      accentBorder: "var(--palette-700)",
      label: "USBL"
    };
  } else if (cat.includes("match") || cat.includes("résultat") || cat.includes("championnat")) {
    return {
      textColor: "var(--palette-600)", // #F92C00
      bgColor: "var(--palette-50)",
      borderColor: "var(--palette-200)",
      accentBorder: "var(--palette-600)",
      label: "MATCH"
    };
  } else if (cat.includes("événement") || cat.includes("evenement") || cat.includes("tournoi") || cat.includes("fête")) {
    return {
      textColor: "var(--palette-500)", // #FF4307
      bgColor: "var(--palette-50)",
      borderColor: "var(--palette-200)",
      accentBorder: "var(--palette-500)",
      label: "ÉVÉNEMENT"
    };
  } else if (cat.includes("jeune") || cat.includes("stage") || cat.includes("formation") || cat.includes("école")) {
    return {
      textColor: "var(--palette-300)", // #FF9E6B
      bgColor: "var(--palette-50)",
      borderColor: "var(--palette-100)",
      accentBorder: "var(--palette-300)",
      label: "FORMATION"
    };
  } else {
    const ramp = [
      { textColor: "var(--palette-700)", bgColor: "var(--palette-50)", borderColor: "var(--palette-200)", accentBorder: "var(--palette-700)" },
      { textColor: "var(--palette-400)", bgColor: "var(--palette-50)", borderColor: "var(--palette-100)", accentBorder: "var(--palette-400)" },
      { textColor: "var(--palette-500)", bgColor: "var(--palette-50)", borderColor: "var(--palette-200)", accentBorder: "var(--palette-500)" },
      { textColor: "var(--palette-800)", bgColor: "var(--palette-50)", borderColor: "var(--palette-300)", accentBorder: "var(--palette-800)" },
      { textColor: "var(--palette-600)", bgColor: "var(--palette-50)", borderColor: "var(--palette-200)", accentBorder: "var(--palette-600)" }
    ];
    return ramp[index % ramp.length];
  }
}

// Rendu des Actualités
function renderArticles() {
  const containers = [
    document.getElementById("actus-container"),
    document.getElementById("actus-container-events"),
  ];

  // Grille principale : 3 derniers articles
  const activeArticles = articles.slice(0, 3);
  const remainingArticles = articles.slice(3);

  containers.forEach((container) => {
    if (!container) return;

    if (activeArticles.length === 0) {
      container.classList.remove("single-article");
      const isEventsPage = container.id === "actus-container-events";
      container.innerHTML = `
                <div class="actu-empty-state">
                    <h3 class="actu-empty-title font-style-serif">${isEventsPage ? "Aucun événement ou communiqué pour le moment" : "Aucun communiqué disponible pour le moment"}</h3>
                    <p class="actu-empty-desc">${isEventsPage ? "Le secrétariat de l'USBL et du BCL prépare actuellement les prochains événements et annonces officielles. Retrouvez très bientôt toute l'actualité et l'agenda de nos équipes !" : "Le secrétariat de l'USBL et du BCL prépare actuellement les prochains communiqués officiels. Retrouvez très bientôt toute l'actualité de nos équipes et de la vie du club !"}</p>
                </div>
            `;
      return;
    }

    const featured = activeArticles[0];
    const secondary = activeArticles.slice(1);

    if (secondary.length === 0) {
      container.classList.add("single-article");
    } else {
      container.classList.remove("single-article");
    }

    let featuredPhotoHtml = "";
    if (featured.image && featured.image.trim() !== "") {
      featuredPhotoHtml = `<img src="${featured.image}" alt="${featured.title}" class="actu-featured-img" style="cursor: pointer;">`;
    } else {
      featuredPhotoHtml = `
                <div class="actu-photo-placeholder" style="width: 100%; height: 100%; min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #f2ece4 0%, #e6dfd5 100%); color: #a69b8f; font-family: var(--font-body); font-size: 0.85rem; font-weight: 500; gap: 8px; cursor: pointer;">
                    <span style="font-size: 2.5rem; filter: grayscale(100%); opacity: 0.55;">📷</span>
                    <span>Aucune illustration</span>
                </div>
            `;
    }

    const featuredIdOrIndex = featured.id || "0";
    const fStyle = getArticlePaletteStyle(featured.category, 0);

    let html = `
            <!-- Left: Featured large article (2/3) -->
            <div class="actu-featured-card" style="border-top: 3px solid ${fStyle.accentBorder} !important;">
                <div class="actu-featured-photo-frame" onclick="window.readArticle('${featuredIdOrIndex}')">
                    ${featuredPhotoHtml}
                </div>
                <div class="actu-featured-info">
                    <div class="actu-meta" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <span class="actu-category" style="color: ${fStyle.textColor} !important; background-color: ${fStyle.bgColor} !important; border: 1px solid ${fStyle.borderColor} !important; padding: 3px 10px; border-radius: 3px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; font-size: 0.72rem;">${featured.category}</span>
                        <span class="actu-date">${featured.date}</span>
                    </div>
                    <h3 class="actu-title-large font-style-serif">
                        <a href="#" onclick="event.preventDefault(); window.readArticle('${featuredIdOrIndex}')">${featured.title}</a>
                    </h3>
                    <p class="actu-excerpt-large">${featured.excerpt}</p>
                    <a href="#" class="actu-link" style="color: ${fStyle.textColor} !important;" onclick="event.preventDefault(); window.readArticle('${featuredIdOrIndex}')">Lire la suite <span class="arrow">→</span></a>
                </div>
            </div>
        `;

    if (secondary.length > 0) {
      html += `
                <!-- Right: Stack of secondary news (1/3) -->
                <div class="actu-secondary-list">
                    ${secondary
                      .map((art, sIndex) => {
                        const sideImg = art.image ? art.image : "";
                        const sideIdOrIndex = art.id || String(sIndex + 1);
                        const sideStyle = getArticlePaletteStyle(art.category, sIndex + 1);
                        const sidePhotoHtml = sideImg
                          ? `<img src="${sideImg}" alt="${art.title}" style="width: 100px; height: 100px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.05); cursor: pointer; border-radius: 2px;" onclick="window.readArticle('${sideIdOrIndex}')">`
                          : `
                                <div class="actu-photo-placeholder-thumbnail" style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; background: #f2ece4; color: #a69b8f; font-size: 1.5rem; flex-shrink: 0; cursor: pointer; border-radius: 2px;" onclick="window.readArticle('${sideIdOrIndex}')">
                                    <span style="filter: grayscale(100%); opacity: 0.55;">📷</span>
                                </div>
                            `;

                        return `
                        <article class="actu-side-card" style="display: flex; gap: 20px; align-items: flex-start; border-left: 3px solid ${sideStyle.accentBorder}; padding-left: 14px;">
                            ${sidePhotoHtml}
                            <div style="flex: 1;">
                                <div class="actu-meta" style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                    <span class="actu-category" style="color: ${sideStyle.textColor} !important; background-color: ${sideStyle.bgColor} !important; border: 1px solid ${sideStyle.borderColor} !important; padding: 2px 8px; border-radius: 3px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.68rem;">${art.category}</span>
                                    <span class="actu-date">${art.date}</span>
                                </div>
                                <h4 class="actu-title-side font-style-serif" style="margin-top: 5px;">
                                    <a href="#" onclick="event.preventDefault(); window.readArticle('${sideIdOrIndex}')">${art.title}</a>
                                </h4>
                                <p class="actu-excerpt-side">${art.excerpt}</p>
                                <a href="#" class="actu-link-side" style="color: ${sideStyle.textColor} !important;" onclick="event.preventDefault(); window.readArticle('${sideIdOrIndex}')">En savoir plus <span class="arrow">→</span></a>
                            </div>
                        </article>
                        `;
                      })
                      .join("")}
                </div>
            `;
    }

    // Si on est sur evenements.html et qu'il y a plus de 3 articles, afficher les articles précédents
    if (container.id === "actus-container-events" && remainingArticles.length > 0) {
      html += `
            <div class="actu-archive-section" style="grid-column: 1 / -1; margin-top: 40px; border-top: 1px solid var(--border-color); padding-top: 30px;">
                <h4 style="font-family: var(--font-serif); font-size: 1.15rem; margin-bottom: 25px; color: var(--text-color);">Précédents communiqués</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px;">
                    ${remainingArticles
                      .map((art, rIndex) => {
                        const rIdOrIndex = art.id || String(rIndex + 3);
                        const rStyle = getArticlePaletteStyle(art.category, rIndex + 3);
                        return `
                            <article style="border-bottom: 1px dashed var(--border-color); padding-bottom: 18px; border-top: 2px solid ${rStyle.accentBorder}; padding-top: 12px;">
                                <div class="actu-meta" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                    <span class="actu-category" style="color: ${rStyle.textColor} !important; background-color: ${rStyle.bgColor} !important; border: 1px solid ${rStyle.borderColor} !important; padding: 2px 7px; border-radius: 2px; font-weight: 700; font-size: 0.65rem; text-transform: uppercase;">${art.category}</span>
                                    <span class="actu-date">${art.date}</span>
                                </div>
                                <h5 class="font-style-serif" style="font-size: 1.05rem; margin-bottom: 8px;">
                                    <a href="#" onclick="event.preventDefault(); window.readArticle('${rIdOrIndex}')">${art.title}</a>
                                </h5>
                                <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 10px;">${art.excerpt}</p>
                                <a href="#" class="actu-link-side" style="color: ${rStyle.textColor} !important;" onclick="event.preventDefault(); window.readArticle('${rIdOrIndex}')">Lire l'article <span class="arrow">→</span></a>
                            </article>
                        `;
                      })
                      .join("")}
                </div>
            </div>
      `;
    }

    container.innerHTML = html;
  });
}
window.renderArticles = renderArticles;

// Rendu du Bandeau Défilant des Actualités (Ticker dynamique BDD)
function renderTicker() {
  const track = document.getElementById("club-ticker-track");
  if (!track) return;

  if (!articles || articles.length === 0) {
    const emptyMsgs = [
      "Aucune actualité publiée pour le moment",
      "Le secrétariat de l'USBL & BCL prépare les prochains communiqués officiels",
      "Retrouvez très bientôt toute l'actualité de nos équipes et de la vie du club",
    ];

    const emptyHtml = emptyMsgs
      .map(
        (msg) => `
          <span class="ticker-item ticker-item-empty">
            <span class="ticker-empty-text">${msg}</span>
          </span>
          <span class="ticker-separator" aria-hidden="true">•</span>
        `,
      )
      .join("");

    track.innerHTML = `
      <div class="ticker-marquee-content">
        ${emptyHtml}
      </div>
      <div class="ticker-marquee-content" aria-hidden="true">
        ${emptyHtml}
      </div>
    `;
    return;
  }

  // Si des articles existent dans la BDD, on s'assure d'avoir au moins 4 éléments pour que le défilement infini soit continu et sans coupure
  let displayList = [...articles];
  while (displayList.length < 4) {
    displayList = displayList.concat(articles);
  }

  const itemsHtml = displayList
    .map((art, idx) => {
      const artIdOrIndex = art.id || String(idx % articles.length);
      const dateStr = art.date ? art.date.toUpperCase() : "";
      const catStr = art.category ? art.category.toUpperCase() : "";

      return `
        <a href="article-detail.html?article=${encodeURIComponent(artIdOrIndex)}" class="ticker-item">
          ${dateStr ? `<span class="ticker-date">${dateStr}</span>` : ""}
          ${catStr ? `<span class="ticker-cat">${catStr}</span>` : ""}
          <span class="ticker-title">${art.title}</span>
        </a>
        <span class="ticker-separator" aria-hidden="true">•</span>
      `;
    })
    .join("");

  track.innerHTML = `
    <div class="ticker-marquee-content">
      ${itemsHtml}
    </div>
    <div class="ticker-marquee-content" aria-hidden="true">
      ${itemsHtml}
    </div>
  `;
}
window.renderTicker = renderTicker;

// Rendu des Scores (Match Center + Base de données Résultats)
function renderScores() {
  // 1. Rendu du Match Center (Accueil dans Le Club)
  const matchCenterContainer = document.querySelector(
    "#page-leclub .matchs-chronicle-list",
  );
  if (matchCenterContainer) {
    const recentMatches = matchs.slice(0, 3);
    matchCenterContainer.innerHTML = recentMatches
      .map((match) => {
        if (match.isPlayed) {
          const homeWinner = match.scoreHome > match.scoreAway;
          const awayWinner = match.scoreAway > match.scoreHome;

          return `
                    <div class="chronicle-match-row">
                        <div class="match-meta">${match.competitionLabel}</div>
                        <div class="match-teams-display">
                            <div class="team-col home">
                                <span class="team-name ${homeWinner ? "winner" : ""}">${match.teamHome}</span>
                            </div>
                            <div class="score-col">
                                <span class="score ${homeWinner ? "winner" : ""}">${match.scoreHome}</span>
                                <span class="sep">—</span>
                                <span class="score ${awayWinner ? "winner" : ""}">${match.scoreAway}</span>
                            </div>
                            <div class="team-col away">
                                <span class="team-name ${awayWinner ? "winner" : ""}">${match.teamAway}</span>
                            </div>
                        </div>
                        <div class="match-venue">${match.venue} • ${match.resultText}</div>
                    </div>
                `;
        } else {
          return `
                    <div class="chronicle-match-row upcoming-match">
                        <div class="match-meta highlight">${match.competitionLabel}</div>
                        <div class="match-teams-display">
                            <div class="team-col home">
                                <span class="team-name">${match.teamHome}</span>
                            </div>
                            <div class="score-col vs-col">
                                <span class="vs-badge">VS</span>
                            </div>
                            <div class="team-col away">
                                <span class="team-name">${match.teamAway}</span>
                            </div>
                        </div>
                        <div class="match-venue">${match.venue}</div>
                    </div>
                `;
        }
      })
      .join("");
  }

  // 2. Rendu de la Base de Données Résultats (SPA Page)
  const resultsTableBody = document.getElementById("results-table-body");
  if (resultsTableBody) {
    // Filtrer les matchs selon la catégorie sélectionnée
    let filtered = matchs;
    if (currentFilter !== "toutes") {
      filtered = matchs.filter((m) => {
        if (currentFilter === "RM3") return m.competition === "RM3";
        if (currentFilter === "RMU21") return m.competition === "RMU21";
        if (currentFilter === "DMU13")
          return m.competition === "DMU13-3" || m.competition === "DMU13";
        return true;
      });
    }

    // Filtrer selon la barre de recherche
    const searchInput = document.getElementById("match-search-input");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (query) {
      filtered = filtered.filter(
        (m) =>
          m.teamHome.toLowerCase().includes(query) ||
          m.teamAway.toLowerCase().includes(query) ||
          m.competition.toLowerCase().includes(query) ||
          m.competitionLabel.toLowerCase().includes(query),
      );
    }

    if (filtered.length === 0) {
      resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Aucun match trouvé pour cette sélection.</td>
                </tr>
            `;
    } else {
      resultsTableBody.innerHTML = filtered
        .map((m) => {
          let scoreText = "VS";
          let resultBadge = `<span class="badge-result">À venir</span>`;

          if (m.isPlayed) {
            scoreText = `${m.scoreHome} - ${m.scoreAway}`;
            const isUsblWin = m.scoreUSBL > m.scoreOpp;
            resultBadge = isUsblWin
              ? `<span class="badge-result win">Victoire</span>`
              : `<span class="badge-result loss">Défaite</span>`;
          }

          // Formater l'affichage du match
          let matchText = `<strong>${m.teamHome}</strong> vs ${m.teamAway}`;
          if (m.teamAway.includes("L'Isle Jourdain")) {
            matchText = `${m.teamHome} vs <strong>${m.teamAway}</strong>`;
          }

          return `
                    <tr class="animate-fade">
                        <td>${m.date}</td>
                        <td>${m.competitionLabel.split(" • ")[0]}</td>
                        <td>${matchText}</td>
                        <td>${scoreText}</td>
                        <td>${resultBadge}</td>
                    </tr>
                `;
        })
        .join("");
    }
  }
}

// ----------------------------------------------------------------------
// 12. ACTIONS UTILISATEUR GLOBALES
// ----------------------------------------------------------------------

window.filterMatches = (category) => {
  currentFilter = category;

  const badges = document.querySelectorAll(".filter-badge");
  badges.forEach((badge) => {
    if (badge.id === `badge-filter-${category}`) {
      badge.classList.add("active");
    } else {
      badge.classList.remove("active");
    }
  });

  renderScores();
};

window.searchMatches = () => {
  renderScores();
};

// ----------------------------------------------------------------------
// 13. ACCÈS SÉCURISÉ & ESPACE ADMIN & DYNAMISATION (PHASE 2)
// ----------------------------------------------------------------------

// Données par défaut pour les Bénévoles (démarrage propre à vide)
const defaultVolunteers = [];

// Données par défaut pour les Partenaires (démarrage propre à vide)
const defaultPartners = [];

// Données par défaut pour les Coachs (initialisé propre avec fallback)
const defaultCoachs = [];
let coachs = [...defaultCoachs];

// Données par défaut Instagram (@usbl_bcl32)
const defaultInstagramPosts = [
  {
    id: "post1",
    url: "https://www.instagram.com/p/C7u1_BCL32/",
    icon: "🛡️🏀",
    label: "USBL SPARTIATES",
    likes: 184,
    comments: 24,
    caption:
      "VICTOIRE ! Nos U21 Espoirs s'imposent 78-68 contre le TOAC Basket en phase finale éliminatoire ! Une ambiance de folie à Gasco'Sport. Merci à tous nos supporters d'avoir poussé le club ! 🔴🛡️ #Spartiates #USBL #Gers #BasketOccitanie",
    isFeatured: true,
  },
  {
    id: "post2",
    url: "https://www.instagram.com/p/C7s8_BCL32/",
    icon: "🔥🔴",
    likes: 142,
    comments: 12,
    caption:
      "JOUR DE DERBY ! Notre équipe 1 RM3 reçoit Auch Basket Club 2 pour un derby du Gers qui s'annonce électrique. Coup d'envoi à 20h30. Soyez prêts à faire du bruit ! #DerbyDuGers",
    isFeatured: false,
  },
  {
    id: "post3",
    url: "https://www.instagram.com/p/C7a4_BCL32/",
    icon: "🏆👶",
    likes: 115,
    comments: 8,
    caption:
      "EXCELLENCE ! Le Label d'Excellence Occitanie a été renouvelé pour notre école de Mini-Basket. Une reconnaissance pour nos éducateurs ! 🛡️🏀",
    isFeatured: false,
  },
  {
    id: "post4",
    url: "https://www.instagram.com/p/C7O2_BCL32/",
    icon: "☀️🗓️",
    likes: 98,
    comments: 15,
    caption:
      "STAGES D'ÉTÉ 2026. Ouverture des inscriptions pour nos stages de perfectionnement en juillet. U9 à U18 garçons et filles. Rejoignez-nous ! 🏀☀️",
    isFeatured: false,
  },
  {
    id: "post5",
    url: "https://www.instagram.com/p/C6_1_BCL32/",
    icon: "📜🛡️",
    likes: 127,
    comments: 6,
    caption:
      "DEPUIS 1960. Plus de 60 ans d'histoire pour l'Union Sportive de Basket Lislois. Merci à toutes les générations de Spartiates. 🔴🛡️ #Fierte #HistoireUSBL",
    isFeatured: false,
  },
];

// Routeur Hash de l'URL
// Routeur Hash (obsolète dans l'architecture MPA)
window.handleHashRouting = () => {};

// Rendu des Bénévoles Publics
window.renderVolunteers = () => {
  const grid = document.getElementById("volunteers-grid");
  if (!grid) return;

  if (volunteers.length === 0) {
    grid.innerHTML = `
          <div class="actu-empty-state" style="grid-column: 1 / -1; width: 100%;">
              <div class="actu-empty-icon">👤</div>
              <h3 class="actu-empty-title font-style-serif">Aucun membre dans le bureau</h3>
              <p class="actu-empty-desc">Le secrétariat prépare actuellement la liste des bénévoles pour la saison. Revenez très bientôt !</p>
          </div>
      `;
    return;
  }

  grid.innerHTML = volunteers
    .map((v) => {
      const photoHtml = v.photo
        ? `<img src="${v.photo}" alt="${v.firstname} ${v.lastname}" class="volunteer-img">`
        : `<span class="volunteer-avatar-placeholder">👤</span>`;

      return `
            <div class="volunteer-card animate-fade">
                <div class="volunteer-avatar-frame">
                    ${photoHtml}
                </div>
                <h4 class="volunteer-name">${v.firstname} ${v.lastname}</h4>
                <p class="volunteer-role">${v.role}</p>
            </div>
        `;
    })
    .join("");
};

// Rendu des Partenaires Publics
window.renderPartners = () => {
  const container = document.getElementById("partners-container");
  if (!container) return;

  if (partners.length === 0) {
    container.innerHTML = `
          <div class="actu-empty-state" style="grid-column: 1 / -1; width: 100%;">
              <div class="actu-empty-icon">🤝</div>
              <h3 class="actu-empty-title font-style-serif">Aucun partenaire enregistré</h3>
              <p class="actu-empty-desc">Le club recherche activement des partenaires pour soutenir le projet sportif. Contactez-nous pour rejoindre l'aventure !</p>
          </div>
      `;
    return;
  }

  const categories = {
    Institutionnels: { title: "PARTENAIRES INSTITUTIONNELS", list: [] },
    Majeurs: { title: "PARTENAIRES MAJEURS", list: [] },
    Supports: { title: "SUPPORTS OFFICIELS", list: [] },
  };

  partners.forEach((p) => {
    if (categories[p.category]) {
      categories[p.category].list.push(p);
    } else {
      categories["Supports"].list.push(p);
    }
  });

  let html = "";

  Object.keys(categories).forEach((catKey, index) => {
    const cat = categories[catKey];
    if (cat.list.length === 0) return;

    const mtClass = index > 0 ? "margin-top-50" : "";
    const gridColClass = catKey === "Supports" ? "col-2" : "";

    html += `
            <div class="partner-category-block ${mtClass}">
                <h3 class="partner-cat-title font-style-serif">${cat.title}</h3>
                <div class="partners-grid-layout ${gridColClass}">
                    ${cat.list
                      .map((p) => {
                        let logoWrapperHtml =
                          p.logo &&
                          (p.logo.startsWith("data:image") ||
                            p.logo.startsWith("http"))
                            ? `<div class="partner-logo-frame" style="padding: 0; background-color: transparent;"><img src="${p.logo}" alt="${p.name}" style="width:100%; height:100%; object-fit:contain;"></div>`
                            : `<div class="partner-logo-frame">${p.logo || "🤝"}</div>`;

                        return `
                            <div class="partner-card">
                                ${logoWrapperHtml}
                                <div class="partner-info">
                                    <h4>${p.name}</h4>
                                    <p class="partner-role">${p.role}</p>
                                </div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `;
  });

  container.innerHTML = html;
};

// Rendu du bandeau Sponsors dynamique en bas de toutes les pages
function renderSponsorsBand() {
  const bands = document.querySelectorAll(".sponsors-row");
  if (bands.length === 0) return;

  let html = "";
  if (partners.length === 0) {
    html = `<span style="font-style: italic; opacity: 0.7;">Aucun partenaire enregistré</span>`;
  } else {
    html = partners
      .map(p => `<span>${p.name}</span>`)
      .join('\n            <span class="dot">•</span>\n            ');
  }

  bands.forEach(band => {
    band.innerHTML = html;
  });
}
window.renderSponsorsBand = renderSponsorsBand;

// Rendu des posts Instagram réels via Embeds officiels interactifs (pour 100% de données réelles)
window.renderInstagram = (embeds) => {
  const grid = document.querySelector(".instagram-posts-grid");
  if (!grid) return;

  // Fallback automatique avec les 3 publications réelles et vérifiées du compte
  const postsToRender =
    embeds && embeds.length >= 3
      ? embeds.slice(0, 3)
      : [
          "https://www.instagram.com/p/DYkP90jCD17/",
          "https://www.instagram.com/reel/DYjqIKWN9DJ/",
          "https://www.instagram.com/p/DYSHmlAjkeK/",
        ];

  let html = postsToRender
    .map((url) => {
      // Nettoyage et formatage de l'URL pour assurer un rendu parfait
      let cleanUrl = url.trim();
      if (!cleanUrl.endsWith("/")) {
        cleanUrl += "/";
      }

      return `
        <div class="insta-embed-card">
            <blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${cleanUrl}?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);">
                <div style="padding:16px;">
                    <a href="${cleanUrl}?utm_source=ig_embed&amp;utm_campaign=loading" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank">
                        <div style="display: flex; flex-direction: row; align-items: center;">
                            <div style="background-color: #F4F4F4; border-radius: 50%; flex-grow: 0; height: 40px; margin-right: 14px; width: 40px;"></div>
                            <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center;">
                                <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; margin-bottom: 6px; width: 100px;"></div>
                                <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; width: 60px;"></div>
                            </div>
                        </div>
                        <div style="padding: 19% 0;"></div>
                        <div style="display:block; height:50px; margin:0 auto 12px; width:50px;">
                            <svg width="50px" height="50px" viewBox="0 0 60 60" version="1.1" xmlns="https://www.w3.org/2000/svg" xmlns:xlink="https://www.w3.org/1999/xlink">
                                <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                                    <g transform="translate(-511.000000, -20.000000)" fill="#000000">
                                        <g>
                                            <path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,60.657 C535.114,60.657 530.342,55.887 530.342,50 C530.342,44.114 535.114,39.342 541,39.342 C546.887,39.342 551.658,44.114 551.658,50 C551.658,55.887 546.887,60.657 541,60.657 M541,33.886 C532.1,33.886 524.886,41.1 524.886,50 C524.886,58.899 532.1,66.113 541,66.113 C549.9,66.113 557.115,58.899 557.115,50 C557.115,41.1 549.9,33.886 541,33.886 M565.378,62.101 C565.244,65.022 564.756,66.606 564.346,67.663 C563.803,69.06 563.154,70.057 562.106,71.106 C561.058,72.155 560.06,72.803 558.662,73.347 C557.607,73.757 556.021,74.244 553.102,74.378 C549.944,74.521 548.997,74.552 541,74.552 C533.003,74.552 532.056,74.521 528.898,74.378 C525.979,74.244 524.393,73.757 523.338,73.347 C521.94,72.803 520.942,72.155 519.894,71.106 C518.846,70.057 518.197,69.06 517.654,67.663 C517.244,66.606 516.755,65.022 516.623,62.101 C516.479,58.943 516.448,57.996 516.448,50 C516.448,42.003 516.479,41.056 516.623,37.899 C516.755,34.978 517.244,33.391 517.654,32.338 C518.197,30.938 518.846,29.942 519.894,28.894 C520.942,27.846 521.94,27.196 523.338,26.654 C524.393,26.244 525.979,25.756 528.898,25.623 C532.057,25.479 533.004,25.448 541,25.448 C548.997,25.448 549.943,25.479 553.102,25.623 C556.021,25.756 557.607,26.244 558.662,26.654 C560.06,27.196 561.058,27.846 562.106,28.894 C563.154,29.942 563.803,30.938 564.346,32.338 C564.756,33.391 565.244,34.978 565.378,37.899 C565.522,41.056 565.552,42.003 565.552,50 C565.552,57.996 565.522,58.943 565.378,62.101 M570.82,37.631 C570.674,34.438 570.167,32.258 569.425,30.349 C568.659,28.377 567.633,26.702 565.965,25.035 C564.297,23.368 562.623,22.342 560.652,21.575 C558.743,20.834 556.562,20.326 553.369,20.18 C550.169,20.033 549.148,20 541,20 C532.853,20 531.831,20.033 528.631,20.18 C525.438,20.326 523.257,20.834 521.349,21.575 C519.376,22.342 517.703,23.368 516.035,25.035 C514.368,26.702 513.342,28.377 512.574,30.349 C511.834,32.258 511.326,34.438 511.181,37.631 C511.035,40.831 511,41.851 511,50 C511,58.147 511.035,59.17 511.181,62.369 C511.326,65.562 511.834,67.743 512.574,69.651 C513.342,71.625 514.368,73.296 516.035,74.965 C517.703,76.634 519.376,77.658 521.349,78.425 C523.257,79.167 525.438,79.673 528.631,79.82 C531.831,79.965 532.853,80.001 541,80.001 C549.148,80.001 550.169,79.965 553.369,79.82 C556.562,79.673 558.743,79.167 560.652,78.425 C562.623,77.658 564.297,76.634 565.965,74.965 C567.633,73.296 568.659,71.625 569.425,69.651 C570.167,67.743 570.674,65.562 570.82,62.369 C570.966,59.17 571,58.147 571,50 C571,41.851 570.966,40.831 570.82,37.631"></path>
                                        </g>
                                    </g>
                                </g>
                            </svg>
                        </div>
                        <div style="padding-top: 8px;">
                            <div style="color:#3897f0; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:550; line-height:18px;">Voir cette publication sur Instagram</div>
                        </div>
                        <div style="padding: 12.5% 0;"></div>
                        <div style="display: flex; flex-direction: row; margin-bottom: 14px; align-items: center;">
                            <div>
                                <div style="background-color: #F4F4F4; border-radius: 50%; height: 12.5px; width: 12.5px; transform: translateX(0px) translateY(7px);"></div>
                                <div style="background-color: #F4F4F4; height: 12.5px; transform: rotate(-45deg) translateX(3px) translateY(1px); width: 12.5px; flex-grow: 0; margin-right: 14px; margin-left: 2px;"></div>
                                <div style="background-color: #F4F4F4; border-radius: 50%; height: 12.5px; width: 12.5px; transform: translateX(9px) translateY(-18px);"></div>
                            </div>
                            <div style="margin-left: 8px;">
                                <div style="background-color: #F4F4F4; border-radius: 50%; flex-grow: 0; height: 20px; width: 20px;"></div>
                                <div style="width: 0; height: 0; border-top: 2px solid transparent; border-left: 6px solid #f4f4f4; border-bottom: 2px solid transparent; transform: translateX(16px) translateY(-4px) rotate(30deg)"></div>
                            </div>
                            <div style="margin-left: auto;">
                                <div style="width: 0px; border-top: 8px solid #F4F4F4; border-right: 8px solid transparent; transform: translateY(16px);"></div>
                                <div style="background-color: #F4F4F4; flex-grow: 0; height: 12px; width: 16px; transform: translateY(-4px);"></div>
                                <div style="width: 0; height: 0; border-top: 8px solid #F4F4F4; border-left: 8px solid transparent; transform: translateY(-4px) translateX(8px);"></div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center; margin-bottom: 24px;">
                            <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; margin-bottom: 6px; width: 224px;"></div>
                            <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; width: 144px;"></div>
                        </div>
                    </a>
                    <p style="color:#c9c8cd; font-family:Arial,sans-serif; font-size:14px; line-height:17px; margin-bottom:0; margin-top:8px; overflow:hidden; padding:8px 0 7px; text-align:center; text-overflow:ellipsis; white-space:nowrap;">
                        <a href="${cleanUrl}?utm_source=ig_embed&amp;utm_campaign=loading" style="color:#c9c8cd; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:normal; line-height:17px; text-decoration:none;" target="_blank">Une publication partagée par Union Sportive Basket L’Isle-Jourdain x BC L’islois (@usbl_bcl32)</a>
                    </p>
                </div>
            </blockquote>
        </div>
        `;
    })
    .join("");

  grid.innerHTML = html;

  // Injecter script Instagram de manière asynchrone pour traiter et habiller les publications
  if (!window.instgrm) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(script);
  } else {
    window.instgrm.Embeds.process();
  }
};

window.fetchInstagramFeed = async () => {
  const grid = document.querySelector(".instagram-posts-grid");
  if (grid) {
    // Injecter immédiatement 3 cartes de chargement animées (skeletons)
    grid.innerHTML = Array(3)
      .fill(
        `
            <div class="insta-skeleton-card">
                <div class="insta-skeleton-header">
                    <div class="insta-skeleton-avatar"></div>
                    <div class="insta-skeleton-meta">
                        <div class="insta-skeleton-line short"></div>
                        <div class="insta-skeleton-line tiny"></div>
                    </div>
                </div>
                <div class="insta-skeleton-media"></div>
                <div class="insta-skeleton-footer">
                    <div class="insta-skeleton-line medium"></div>
                    <div class="insta-skeleton-line long"></div>
                </div>
            </div>
        `,
      )
      .join("");
  }

  const fallbackUrls = [
    "https://www.instagram.com/p/DYkP90jCD17/",
    "https://www.instagram.com/reel/DYjqIKWN9DJ/",
    "https://www.instagram.com/p/DYSHmlAjkeK/",
  ];

  try {
    console.log("Tentative de récupération dynamique du flux Instagram...");

    // Liste des configurations de scraping client-side légères
    const scrapingTargets = [
      {
        proxy: "https://api.allorigins.win/get?url=",
        url: "https://imginn.com/usbl_bcl32/",
        jsonMode: true,
      },
      {
        proxy: "https://api.codetabs.com/v1/proxy?quest=",
        url: "https://imginn.com/usbl_bcl32/",
        jsonMode: false,
      },
      {
        proxy: "https://api.allorigins.win/get?url=",
        url: "https://pixwox.com/profile/usbl_bcl32/",
        jsonMode: true,
      },
    ];

    let foundShortcodes = [];

    // Nous essayons les cibles de scraping l'une après l'autre
    for (const target of scrapingTargets) {
      try {
        const fetchUrl = `${target.proxy}${encodeURIComponent(target.url)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout max par proxy

        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        let htmlContent = "";
        if (target.jsonMode) {
          const json = await response.json();
          htmlContent = json.contents || "";
        } else {
          htmlContent = await response.text();
        }

        if (htmlContent) {
          const shortcodes = new Set();
          let match;

          // Recherche des shortcodes de posts et de reels
          const reP = /\/p\/([A-Za-z0-9_-]+)/g;
          while ((match = reP.exec(htmlContent)) !== null) {
            if (match[1] !== "loading" && match[1].length > 4) {
              shortcodes.add(match[1]);
            }
          }

          const reReel = /\/reel\/([A-Za-z0-9_-]+)/g;
          while ((match = reReel.exec(htmlContent)) !== null) {
            if (match[1].length > 4) {
              shortcodes.add(match[1]);
            }
          }

          if (shortcodes.size >= 3) {
            foundShortcodes = [...shortcodes].slice(0, 3);
            console.log(
              "Flux Instagram dynamique récupéré avec succès :",
              foundShortcodes,
            );
            break;
          }
        }
      } catch (err) {
        console.warn(`Scraping target failed: ${target.url}`, err);
      }
    }

    // Petite attente artificielle pour un effet de transition visuel fluide
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (foundShortcodes.length >= 3) {
      const dynamicUrls = foundShortcodes.map(
        (code) => `https://www.instagram.com/p/${code}/`,
      );
      window.renderInstagram(dynamicUrls);
    } else {
      console.log(
        "Scraping indisponible (bloqué par Cloudflare), utilisation des 3 publications réelles et vérifiées du compte.",
      );
      window.renderInstagram(fallbackUrls);
    }
  } catch (e) {
    console.error("Erreur générale Instagram, fallback appliqué :", e);
    window.renderInstagram(fallbackUrls);
  }
};

// ==========================================================================
// SYSTÈME DE GESTION DU PANEL D'ADMINISTRATION : MODALES & UTILITAIRES
// ==========================================================================

// Gestion de l'affichage des formulaires / fenêtres modales
window.openAdminModal = (modalId) => {
  const formBoxId = modalId.startsWith("modal-") ? modalId.replace("modal-", "form-box-") : modalId;
  const formBox = document.getElementById(formBoxId);
  if (formBox) {
    formBox.classList.add("open");
    formBox.style.display = "block";
    formBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
};

window.closeAdminModal = (modalId) => {
  const formBoxId = modalId.startsWith("modal-") ? modalId.replace("modal-", "form-box-") : modalId;
  const formBox = document.getElementById(formBoxId);
  if (formBox) {
    formBox.classList.remove("open");
    formBox.style.display = "none";
    return;
  }
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    if (!document.querySelector(".admin-modal-overlay.active")) {
      document.body.style.overflow = "";
    }
  }
};

// Système de notifications Toast ergonomiques et non-bloquantes
window.showAdminToast = (message, type = "success") => {
  let container = document.getElementById("admin-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "admin-toast-container";
    container.className = "admin-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `admin-toast admin-toast-${type}`;
  const icon = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");
  toast.innerHTML = `<span style="font-size: 1.15rem; line-height: 1;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Filtrage instantané des tableaux d'administration
window.filterAdminTable = (tableId, query) => {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = table.querySelectorAll("tbody tr");
  const q = (query || "").toLowerCase().trim();
  rows.forEach(row => {
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) return;
    const text = row.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
};

// Bascule sous-onglets Équipes / Effectifs
window.switchPlayerSubtab = (subtab) => {
  const teamsView = document.getElementById("subtab-content-teams");
  const rostersView = document.getElementById("subtab-content-rosters");
  const btnTeams = document.getElementById("subtab-btn-teams");
  const btnRosters = document.getElementById("subtab-btn-rosters");
  if (subtab === "teams") {
    if (teamsView) teamsView.style.display = "block";
    if (rostersView) rostersView.style.display = "none";
    if (btnTeams) btnTeams.classList.add("active");
    if (btnRosters) btnRosters.classList.remove("active");
  } else {
    if (teamsView) teamsView.style.display = "none";
    if (rostersView) rostersView.style.display = "block";
    if (btnTeams) btnTeams.classList.remove("active");
    if (btnRosters) btnRosters.classList.add("active");
  }
};

// ----------------------------------------------------------------------
// GESTIONNAIRES D'OUVERTURE DES MODALES (CRÉATION ET MODIFICATION)
// ----------------------------------------------------------------------

// 1. Publications & Événements
window.openCreateActualite = () => {
  const form = document.getElementById("admin-news-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-news-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("modal-news-title");
  if (title) title.innerHTML = `<span>📰</span> Nouvelle Publication / Événement`;
  const submitBtn = document.getElementById("admin-news-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer la publication";
  
  const coverPreview = document.getElementById("news-cover-preview");
  if (coverPreview) coverPreview.innerHTML = `<span>Aucune photo</span>`;
  const coverBase64 = document.getElementById("admin-news-base64-cover");
  if (coverBase64) coverBase64.value = "";

  const galleryPreview = document.getElementById("news-gallery-preview");
  if (galleryPreview) galleryPreview.innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">Aucune photo sélectionnée</span>`;
  const galleryBase64 = document.getElementById("admin-news-base64-gallery");
  if (galleryBase64) galleryBase64.value = "";

  const dateInput = document.getElementById("admin-news-date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  window.openAdminModal("modal-news");
};

window.openEditActualite = (indexOrId) => {
  let article = null;
  let artIndex = -1;
  if (typeof indexOrId === "number" || (!isNaN(parseInt(indexOrId, 10)) && String(parseInt(indexOrId, 10)) === String(indexOrId))) {
    artIndex = parseInt(indexOrId, 10);
    article = articles[artIndex];
  } else {
    artIndex = articles.findIndex(a => a.id === indexOrId);
    article = articles[artIndex];
  }
  if (!article) {
    window.showAdminToast("Publication introuvable.", "error");
    return;
  }

  const form = document.getElementById("admin-news-form");
  if (form) form.reset();

  const editId = document.getElementById("admin-news-edit-id");
  if (editId) editId.value = article.id || String(artIndex);

  const title = document.getElementById("modal-news-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier la Publication`;
  const submitBtn = document.getElementById("admin-news-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour la publication";

  if (document.getElementById("admin-news-title")) document.getElementById("admin-news-title").value = article.title || "";
  if (document.getElementById("admin-news-category")) document.getElementById("admin-news-category").value = article.category || "Événement Club";
  if (document.getElementById("admin-news-excerpt")) document.getElementById("admin-news-excerpt").value = article.excerpt || "";
  if (document.getElementById("admin-news-content")) document.getElementById("admin-news-content").value = article.content || "";

  const dateInput = document.getElementById("admin-news-date");
  if (dateInput) {
    dateInput.value = "";
    if (article.date) {
      if (article.date.includes("/")) {
        const p = article.date.split("/");
        if (p.length === 3) dateInput.value = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      } else if (article.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateInput.value = article.date;
      }
    }
  }

  const coverPreview = document.getElementById("news-cover-preview");
  const coverBase64 = document.getElementById("admin-news-base64-cover");
  if (coverBase64) coverBase64.value = article.image || "";
  if (coverPreview) {
    if (article.image) {
      coverPreview.innerHTML = `<img src="${article.image}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      coverPreview.innerHTML = `<span>Aucune photo</span>`;
    }
  }

  const galleryPreview = document.getElementById("news-gallery-preview");
  const galleryBase64 = document.getElementById("admin-news-base64-gallery");
  if (galleryBase64) galleryBase64.value = article.images ? JSON.stringify(article.images) : "";
  if (galleryPreview) {
    if (Array.isArray(article.images) && article.images.length > 0) {
      galleryPreview.innerHTML = article.images.map(img => `<img src="${img}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px;">`).join("");
    } else {
      galleryPreview.innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">Aucune photo sélectionnée</span>`;
    }
  }

  window.openAdminModal("modal-news");
};

// 2. Bénévoles
window.openCreateVolunteer = () => {
  const form = document.getElementById("admin-volunteer-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-vol-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("modal-volunteer-title");
  if (title) title.innerHTML = `<span>👤</span> Ajouter un Bénévole`;
  const submitBtn = document.getElementById("admin-vol-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer le bénévole";
  const preview = document.getElementById("vol-preview");
  if (preview) preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
  const base64 = document.getElementById("admin-vol-base64");
  if (base64) base64.value = "";
  window.openAdminModal("modal-volunteer");
};

window.openEditVolunteer = (id) => {
  const v = volunteers.find(x => x.id === id);
  if (!v) {
    window.showAdminToast("Bénévole introuvable.", "error");
    return;
  }
  const form = document.getElementById("admin-volunteer-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-vol-edit-id");
  if (editId) editId.value = v.id;
  const title = document.getElementById("modal-volunteer-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier le Bénévole`;
  const submitBtn = document.getElementById("admin-vol-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour le bénévole";

  if (document.getElementById("admin-vol-firstname")) document.getElementById("admin-vol-firstname").value = v.firstname || "";
  if (document.getElementById("admin-vol-lastname")) document.getElementById("admin-vol-lastname").value = v.lastname || "";
  if (document.getElementById("admin-vol-role")) document.getElementById("admin-vol-role").value = v.role || "";

  const base64 = document.getElementById("admin-vol-base64");
  if (base64) base64.value = v.photo || "";
  const preview = document.getElementById("vol-preview");
  if (preview) {
    if (v.photo) {
      preview.innerHTML = `<img src="${v.photo}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
    }
  }
  window.openAdminModal("modal-volunteer");
};

// 3. Partenaires
window.openCreatePartner = () => {
  const form = document.getElementById("admin-partner-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-part-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("modal-partner-title");
  if (title) title.innerHTML = `<span>🤝</span> Ajouter un Partenaire`;
  const submitBtn = document.getElementById("admin-part-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer le partenaire";
  const preview = document.getElementById("part-preview");
  if (preview) preview.innerHTML = `<span>Aucun logo sélectionné</span>`;
  const base64 = document.getElementById("admin-part-base64");
  if (base64) base64.value = "";
  window.openAdminModal("modal-partner");
};

window.openEditPartner = (id) => {
  const p = partners.find(x => x.id === id);
  if (!p) {
    window.showAdminToast("Partenaire introuvable.", "error");
    return;
  }
  const form = document.getElementById("admin-partner-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-part-edit-id");
  if (editId) editId.value = p.id;
  const title = document.getElementById("modal-partner-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier le Partenaire`;
  const submitBtn = document.getElementById("admin-part-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour le partenaire";

  if (document.getElementById("admin-part-name")) document.getElementById("admin-part-name").value = p.name || "";
  if (document.getElementById("admin-part-category")) document.getElementById("admin-part-category").value = p.category || "Majeurs";
  if (document.getElementById("admin-part-role")) document.getElementById("admin-part-role").value = p.role || "";

  const base64 = document.getElementById("admin-part-base64");
  if (base64) base64.value = p.logo || "";
  const preview = document.getElementById("part-preview");
  if (preview) {
    if (p.logo && (p.logo.startsWith("data:image") || p.logo.startsWith("http"))) {
      preview.innerHTML = `<img src="${p.logo}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      preview.innerHTML = `<span>${p.logo || "Aucun logo"}</span>`;
    }
  }
  window.openAdminModal("modal-partner");
};

// 4. Équipes
window.openCreateTeam = () => {
  const form = document.getElementById("admin-team-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-team-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("modal-team-title");
  if (title) title.innerHTML = `<span>🏀</span> Créer une Équipe`;
  const submitBtn = document.getElementById("admin-team-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer l'équipe";
  const preview = document.getElementById("team-preview");
  if (preview) preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
  const base64 = document.getElementById("admin-team-base64");
  if (base64) base64.value = "";
  window.openAdminModal("modal-team");
};

window.openEditTeam = (teamId) => {
  const team = rosters[teamId];
  if (!team) {
    window.showAdminToast("Équipe introuvable.", "error");
    return;
  }
  const form = document.getElementById("admin-team-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-team-edit-id");
  if (editId) editId.value = teamId;
  const title = document.getElementById("modal-team-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier l'Équipe "${team.name}"`;
  const submitBtn = document.getElementById("admin-team-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour l'équipe";

  const isBcl = team.club === 'bcl' || (!team.club && /fille|fem|bcl|cadette|benjamine|df|rf/i.test((team.name || '') + ' ' + (team.category || '')));
  if (document.getElementById("admin-team-club")) document.getElementById("admin-team-club").value = team.club || (isBcl ? "bcl" : "usbl");
  if (document.getElementById("admin-team-category")) document.getElementById("admin-team-category").value = team.category || "";
  if (document.getElementById("admin-team-name")) document.getElementById("admin-team-name").value = team.name || "";
  if (document.getElementById("admin-team-coach")) document.getElementById("admin-team-coach").value = team.coach || "";
  if (document.getElementById("admin-team-link-games")) document.getElementById("admin-team-link-games").value = team.linkedCategory || "";
  if (document.getElementById("admin-team-ffbb")) document.getElementById("admin-team-ffbb").value = team.ffbbLink || "";

  const base64 = document.getElementById("admin-team-base64");
  if (base64) base64.value = team.photo || "";
  const preview = document.getElementById("team-preview");
  if (preview) {
    if (team.photo) {
      preview.innerHTML = `<img src="${team.photo}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
    }
  }
  window.openAdminModal("modal-team");
};

// 5. Joueurs
window.openCreatePlayer = () => {
  const form = document.getElementById("admin-player-form");
  if (form) form.reset();
  const editTeam = document.getElementById("admin-player-edit-team-id");
  if (editTeam) editTeam.value = "";
  const editIndex = document.getElementById("admin-player-edit-index");
  if (editIndex) editIndex.value = "";

  const title = document.getElementById("modal-player-title");
  if (title) title.innerHTML = `<span>👟</span> Ajouter un Joueur`;
  const submitBtn = document.getElementById("admin-player-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer le joueur";

  const filterSelect = document.getElementById("admin-player-team-filter");
  const formSelect = document.getElementById("admin-player-team");
  if (filterSelect && formSelect && filterSelect.value) {
    formSelect.value = filterSelect.value;
  }

  window.openAdminModal("modal-player");
};

window.openEditPlayer = (teamId, playerIndex) => {
  if (!rosters[teamId] || !rosters[teamId].players || !rosters[teamId].players[playerIndex]) {
    window.showAdminToast("Joueur introuvable.", "error");
    return;
  }
  const player = rosters[teamId].players[playerIndex];
  const form = document.getElementById("admin-player-form");
  if (form) form.reset();

  const editTeam = document.getElementById("admin-player-edit-team-id");
  if (editTeam) editTeam.value = teamId;
  const editIndex = document.getElementById("admin-player-edit-index");
  if (editIndex) editIndex.value = String(playerIndex);

  const title = document.getElementById("modal-player-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier le Joueur "${player.name}"`;
  const submitBtn = document.getElementById("admin-player-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour le joueur";

  const formSelect = document.getElementById("admin-player-team");
  if (formSelect) formSelect.value = teamId;
  if (document.getElementById("admin-player-num")) document.getElementById("admin-player-num").value = player.num;
  if (document.getElementById("admin-player-name")) document.getElementById("admin-player-name").value = player.name || "";
  if (document.getElementById("admin-player-height")) document.getElementById("admin-player-height").value = player.height || "";
  if (document.getElementById("admin-player-position")) document.getElementById("admin-player-position").value = player.position || "Meneur";

  window.openAdminModal("modal-player");
};

// 6. Coachs
window.openCreateCoach = () => {
  const form = document.getElementById("admin-coach-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-coach-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("modal-coach-title");
  if (title) title.innerHTML = `<span>📋</span> Ajouter un Coach / Entraîneur`;
  const submitBtn = document.getElementById("admin-coach-submit-btn");
  if (submitBtn) submitBtn.textContent = "Enregistrer le coach";
  const preview = document.getElementById("coach-preview");
  if (preview) preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
  const base64 = document.getElementById("admin-coach-base64");
  if (base64) base64.value = "";
  window.openAdminModal("modal-coach");
};

window.openEditCoach = (id) => {
  const c = coachs.find(x => x.id === id);
  if (!c) {
    window.showAdminToast("Coach introuvable.", "error");
    return;
  }
  const form = document.getElementById("admin-coach-form");
  if (form) form.reset();
  const editId = document.getElementById("admin-coach-edit-id");
  if (editId) editId.value = c.id;
  const title = document.getElementById("modal-coach-title");
  if (title) title.innerHTML = `<span>✏️</span> Modifier le Coach "${c.firstname} ${c.lastname}"`;
  const submitBtn = document.getElementById("admin-coach-submit-btn");
  if (submitBtn) submitBtn.textContent = "Mettre à jour le coach";

  if (document.getElementById("admin-coach-firstname")) document.getElementById("admin-coach-firstname").value = c.firstname || "";
  if (document.getElementById("admin-coach-lastname")) document.getElementById("admin-coach-lastname").value = c.lastname || "";
  if (document.getElementById("admin-coach-club")) document.getElementById("admin-coach-club").value = c.club || "usbl";
  if (document.getElementById("admin-coach-role")) document.getElementById("admin-coach-role").value = c.role || "Coach Principal";
  if (document.getElementById("admin-coach-team")) document.getElementById("admin-coach-team").value = c.teamId || "";
  if (document.getElementById("admin-coach-bio")) document.getElementById("admin-coach-bio").value = c.bio || "";

  const base64 = document.getElementById("admin-coach-base64");
  if (base64) base64.value = c.photo || "";
  const preview = document.getElementById("coach-preview");
  if (preview) {
    if (c.photo) {
      preview.innerHTML = `<img src="${c.photo}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
    }
  }
  window.openAdminModal("modal-coach");
};

// ----------------------------------------------------------------------
// RENDU DES TABLES DANS LE DASHBOARD ADMIN & GESTION DES COMPTEURS KPI
// ----------------------------------------------------------------------
window.renderAdminTables = () => {
  // Mettre à jour les indicateurs statistiques (KPI)
  const kpiNews = document.getElementById("kpi-news-count") || document.getElementById("kpi-count-news");
  if (kpiNews) kpiNews.textContent = articles.length;
  const kpiTeams = document.getElementById("kpi-teams-count") || document.getElementById("kpi-count-teams");
  if (kpiTeams) kpiTeams.textContent = Object.keys(rosters).length;
  const kpiMembers = document.getElementById("kpi-members-count") || document.getElementById("kpi-count-members");
  if (kpiMembers) kpiMembers.textContent = volunteers.length + coachs.length;

  // Badges des onglets & en-têtes
  const badgeNews = document.getElementById("badge-news");
  if (badgeNews) badgeNews.textContent = articles.length;
  const cardBadgeNews = document.getElementById("card-badge-news");
  if (cardBadgeNews) cardBadgeNews.textContent = `${articles.length} ${articles.length > 1 ? "publications" : "publication"}`;

  const badgeTeams = document.getElementById("badge-teams");
  if (badgeTeams) badgeTeams.textContent = Object.keys(rosters).length;
  const cardBadgeTeams = document.getElementById("card-badge-teams");
  if (cardBadgeTeams) cardBadgeTeams.textContent = `${Object.keys(rosters).length} ${Object.keys(rosters).length > 1 ? "équipes" : "équipe"}`;

  const badgeVol = document.getElementById("badge-volunteers");
  if (badgeVol) badgeVol.textContent = volunteers.length;
  const cardBadgeVol = document.getElementById("card-badge-volunteers");
  if (cardBadgeVol) cardBadgeVol.textContent = `${volunteers.length} ${volunteers.length > 1 ? "bénévoles" : "bénévole"}`;

  const badgeCoachs = document.getElementById("badge-coachs");
  if (badgeCoachs) badgeCoachs.textContent = coachs.length;
  const cardBadgeCoachs = document.getElementById("card-badge-coachs");
  if (cardBadgeCoachs) cardBadgeCoachs.textContent = `${coachs.length} ${coachs.length > 1 ? "coachs" : "coach"}`;

  const badgePartners = document.getElementById("badge-partners");
  if (badgePartners) badgePartners.textContent = partners.length;
  const cardBadgePartners = document.getElementById("card-badge-partners");
  if (cardBadgePartners) cardBadgePartners.textContent = `${partners.length} ${partners.length > 1 ? "partenaires" : "partenaire"}`;

  const populateSuggestions = async () => {
    const nameDatalist = document.getElementById("name-suggestions");
    const categoryDatalist = document.getElementById("category-suggestions");
    const linkGamesSelect = document.getElementById("admin-team-link-games");

    let gamesData = {};
    try {
      let res = await fetch("data/games.json");
      if (!res.ok && window.location.protocol === "file:") {
        res = await fetch("http://localhost:3001/data/games.json");
      }
      if (res.ok) {
        gamesData = await res.json();
      }
    } catch (e) {
      try {
        const fallbackRes = await fetch("http://localhost:3001/data/games.json");
        if (fallbackRes.ok) {
          gamesData = await fallbackRes.json();
        }
      } catch (err2) {}
    }

    const gamesCategories = Object.keys(gamesData);

    if (linkGamesSelect) {
      const currentValue = linkGamesSelect.value;
      let optHtml = `<option value="">-- Ne pas lier (Équipe personnalisée) --</option>`;
      if (gamesCategories.length === 0) {
        optHtml += `<option disabled value="">⚠️ Aucune poule FFBB chargée (synchronisation requise)</option>`;
      } else {
        gamesCategories.forEach(cat => {
          const club = gamesData[cat]?.club ? `[${gamesData[cat].club}] ` : "";
          const poule = gamesData[cat]?.pouleNom ? ` (Poule: ${gamesData[cat].pouleNom})` : "";
          optHtml += `<option value="${cat}">${club}${cat}${poule}</option>`;
        });
      }
      linkGamesSelect.innerHTML = optHtml;
      if (gamesCategories.includes(currentValue)) {
        linkGamesSelect.value = currentValue;
      }
    }

    if (!nameDatalist || !categoryDatalist) return;

    const unmatched = [];
    gamesCategories.forEach(cat => {
      let matched = false;
      Object.keys(rosters).forEach(teamKey => {
        const team = rosters[teamKey];
        const teamKeyLower = teamKey.toLowerCase();
        const catLower = cat.toLowerCase();
        if (team.linkedCategory === cat) {
          matched = true;
          return;
        }
        const catNorm = team.category.toLowerCase().replace(/[^a-z0-9]/g, "");
        const nameNorm = team.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (teamKeyLower === 'rm3' && (catLower.includes('seniors') || catLower.includes('rm3') || catLower.includes('esteve'))) {
          matched = true;
        } else if (teamKeyLower === 'rmu21' && (catLower.includes('u21') || catLower.includes('rmu21'))) {
          matched = true;
        } else if (teamKeyLower === 'dmu18' && (catLower.includes('u18') || catLower.includes('dmu18'))) {
          matched = true;
        } else if (teamKeyLower === 'dmu13' && (catLower.includes('u13') || catLower.includes('franceschin'))) {
          matched = true;
        } else if (teamKeyLower === 'dmu15' && (catLower.includes('u15') || catLower.includes('dmu15'))) {
          matched = true;
        } else if (catLower.includes(teamKeyLower) || catLower.includes(catNorm) || catLower.includes(nameNorm)) {
          matched = true;
        }
      });
      if (!matched) unmatched.push(cat);
    });

    nameDatalist.innerHTML = unmatched.map(cat => {
      let cleanName = cat
        .replace("Départementale masculine ", "Cadets ")
        .replace("Régionale masculine ", "Seniors ")
        .replace("Brassages ", "Brassage ")
        .replace("Brassage ", "Brassage ")
        .trim();
      return `<option value="${cleanName}">${cat}</option>`;
    }).join("");

    categoryDatalist.innerHTML = unmatched.map(cat => {
      let code = cat;
      const catLower = cat.toLowerCase();
      if (catLower.includes("u13") && catLower.includes("division 3")) code = "DMU13-3";
      else if (catLower.includes("u13") && catLower.includes("division 2")) code = "RMU13-2";
      else if (catLower.includes("u15") && catLower.includes("division 3")) code = "DMU15-3";
      else if (catLower.includes("u15") && catLower.includes("division 2")) code = "DMU15-2";
      else if (catLower.includes("u18") && catLower.includes("division 2")) code = "DMU18-2";
      else if (catLower.includes("seniors") && catLower.includes("division 3")) code = "RM3";
      else {
        const matchU = cat.match(/u\d{2}/i);
        if (matchU) code = matchU[0].toUpperCase();
      }
      return `<option value="${code}">${cat}</option>`;
    }).join("");
  };

  populateSuggestions();

  // 1. Table Bénévoles
  const volTableBody = document.querySelector("#admin-volunteers-table tbody");
  if (volTableBody) {
    if (volunteers.length === 0) {
      volTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px; font-style: italic;">Aucun bénévole enregistré. Cliquez sur "+ Ajouter un Bénévole" ci-dessus pour en ajouter un.</td></tr>`;
    } else {
      volTableBody.innerHTML = volunteers
        .map((v) => {
          const imgHtml = v.photo
            ? `<img src="${v.photo}" class="admin-table-photo" alt="Photo">`
            : `<div class="admin-table-logo-placeholder">👤</div>`;

          return `
                    <tr>
                        <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
                        <td><strong>${v.firstname} ${v.lastname}</strong></td>
                        <td>${v.role}</td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button type="button" class="btn-action-edit" onclick="window.openEditVolunteer('${v.id}')">Modifier</button>
                            <button type="button" class="btn-delete" onclick="window.deleteVolunteer('${v.id}')">Supprimer</button>
                        </td>
                    </tr>
                `;
        })
        .join("");
    }
  }

  // 2. Table Événements & Actualités
  const newsTableBody = document.querySelector("#admin-news-table tbody");
  if (newsTableBody) {
    if (articles.length === 0) {
      newsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 15px; font-style: italic;">Aucun événement ou article publié pour le moment. Cliquez sur "+ Créer une Publication" pour ajouter un événement officiel.</td></tr>`;
    } else {
      newsTableBody.innerHTML = articles
        .map((art, index) => {
          const artIdOrIndex = art.id || String(index);
          return `
                    <tr>
                        <td style="white-space: nowrap; font-size: 0.82rem; color: var(--text-muted);">${art.date}</td>
                        <td><span class="pillar-badge-tag" style="background-color:rgba(138, 29, 34, 0.08); color:var(--primary-color); font-weight:700; font-size:0.75rem;">${art.category}</span></td>
                        <td>
                            <strong style="color: var(--text-color); font-size: 0.9rem;">${art.title}</strong>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; max-width: 380px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${art.excerpt}</div>
                        </td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button type="button" class="btn-action-view" onclick="window.open('article-detail.html?article=${encodeURIComponent(artIdOrIndex)}', '_blank')" title="Consulter l'article">Voir ↗</button>
                            <button type="button" class="btn-action-edit" onclick="window.openEditActualite(${index})">Modifier</button>
                            <button type="button" class="btn-delete" onclick="window.deleteActualite(${index})">Supprimer</button>
                        </td>
                    </tr>
                `;
        })
        .join("");
    }
  }

  // 3. Table Partenaires
  const partnersTableBody = document.querySelector("#admin-partners-table tbody");
  if (partnersTableBody) {
    if (partners.length === 0) {
      partnersTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px; font-style: italic;">Aucun partenaire enregistré. Cliquez sur "+ Ajouter un Partenaire" ci-dessus.</td></tr>`;
    } else {
      partnersTableBody.innerHTML = partners
        .map((p) => {
          let logoHtml = "";
          if (p.logo && (p.logo.startsWith("data:image") || p.logo.startsWith("http"))) {
            logoHtml = `<img src="${p.logo}" class="admin-table-photo" alt="Logo" style="border-radius:4px;">`;
          } else {
            logoHtml = `<div class="admin-table-logo-placeholder">${p.logo || "🤝"}</div>`;
          }

          return `
                    <tr>
                        <td style="text-align: center; vertical-align: middle;">${logoHtml}</td>
                        <td><strong>${p.name}</strong></td>
                        <td><span class="pillar-badge-tag" style="background-color:#f4efea; font-size:0.75rem;">${p.category}</span></td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button type="button" class="btn-action-edit" onclick="window.openEditPartner('${p.id}')">Modifier</button>
                            <button type="button" class="btn-delete" onclick="window.deletePartner('${p.id}')">Supprimer</button>
                        </td>
                    </tr>
                `;
        })
        .join("");
    }
  }

  // 4. Sélecteurs d'équipe pour effectifs et création
  const filterSelect = document.getElementById("admin-player-team-filter");
  const formSelect = document.getElementById("admin-player-team");
  if (filterSelect && formSelect) {
    const currentFilterVal = filterSelect.value;
    const currentFormVal = formSelect.value;
    
    let optionsHtml = Object.keys(rosters)
      .map(key => `<option value="${key}">${rosters[key].name} (${rosters[key].category})</option>`)
      .join("");
      
    filterSelect.innerHTML = optionsHtml;
    formSelect.innerHTML = `<option value="" disabled selected hidden>Sélectionnez une équipe...</option>` + optionsHtml;
    
    if (Object.keys(rosters).includes(currentFilterVal)) {
      filterSelect.value = currentFilterVal;
    } else {
      filterSelect.value = Object.keys(rosters)[0] || "";
    }
    
    if (Object.keys(rosters).includes(currentFormVal)) {
      formSelect.value = currentFormVal;
    }
  }

  // 4.B Table des Équipes (Teams Management)
  const teamsTableBody = document.querySelector("#admin-teams-table tbody");
  if (teamsTableBody) {
    if (Object.keys(rosters).length === 0) {
      teamsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px; font-style: italic;">Aucune équipe enregistrée. Cliquez sur "+ Créer une Équipe" ci-dessus.</td></tr>`;
    } else {
      teamsTableBody.innerHTML = Object.keys(rosters)
        .map((teamId) => {
          const team = rosters[teamId];
          const imgHtml = team.photo
            ? `<img src="${team.photo}" class="admin-table-photo" alt="Photo" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;">`
            : `<div class="admin-table-logo-placeholder" style="width: 50px; height: 35px; line-height: 35px; font-size: 1rem; border-radius: 4px;">🏀</div>`;

          const linkedLbl = team.linkedCategory 
            ? `<span class="pillar-badge-tag" style="background-color:rgba(138, 29, 34, 0.06); color: var(--primary-color); font-size:0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 4px;">${team.linkedCategory}</span>`
            : `<span class="pillar-badge-tag" style="background-color:#eae5de; color:#6e625d; font-size:0.75rem; padding: 4px 8px; border-radius: 4px;">Aucune</span>`;

          const isBcl = team.club === 'bcl' || (!team.club && /fille|fem|bcl|cadette|benjamine|df|rf/i.test((team.name || '') + ' ' + (team.category || '')));
          const clubBadge = isBcl
            ? `<span class="pillar-badge-tag" style="background-color:rgba(255, 106, 47, 0.12); color:#FF6A2F; font-weight:700; white-space: nowrap; padding: 3px 8px;">BCL</span>`
            : `<span class="pillar-badge-tag" style="background-color:rgba(210, 26, 0, 0.12); color:#D21A00; font-weight:700; white-space: nowrap; padding: 3px 8px;">USBL</span>`;

          return `
                    <tr>
                        <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
                        <td style="text-align: center; vertical-align: middle;">${clubBadge}</td>
                        <td><span class="pillar-badge-tag" style="background-color:#f4efea; font-size:0.75rem; white-space: nowrap; padding: 3px 8px;">${team.category}</span></td>
                        <td style="white-space: nowrap; font-size: 0.88rem;"><strong>${team.name}</strong></td>
                        <td style="white-space: nowrap; font-size: 0.86rem;">${team.coach || '<span style="color:var(--text-muted);">-</span>'}</td>
                        <td style="min-width: 170px;">${linkedLbl}</td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button type="button" class="btn-action-edit" onclick="window.openEditTeam('${teamId}')">Modifier</button>
                            <button type="button" class="btn-delete" onclick="window.deleteTeam('${teamId}')">Supprimer</button>
                        </td>
                    </tr>
                `;
        })
        .join("");
    }
  }

  // 4.C Table Joueurs (Effectifs)
  const playersTableBody = document.querySelector("#admin-players-table tbody");
  if (playersTableBody) {
    const filterEl = document.getElementById("admin-player-team-filter");
    const teamFilter = filterEl ? filterEl.value : "";
    
    const listTitle = document.getElementById("admin-players-list-title");
    const rosterBadge = document.getElementById("card-badge-rosters");
    if (listTitle && rosters[teamFilter]) {
      listTitle.textContent = `Effectif Actuel - ${rosters[teamFilter].name}`;
    }
    const currentTeamPlayers = (rosters[teamFilter] && rosters[teamFilter].players) ? rosters[teamFilter].players.length : 0;
    if (rosterBadge) {
      rosterBadge.textContent = `${currentTeamPlayers} ${currentTeamPlayers > 1 ? "joueurs" : "joueur"}`;
    }

    if (!teamFilter || !rosters[teamFilter]) {
      playersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">Veuillez d'abord sélectionner ou créer une équipe.</td></tr>`;
    } else {
      const teamData = rosters[teamFilter];
      if (!teamData.players || teamData.players.length === 0) {
        playersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted); font-style: italic;">Aucun joueur enregistré dans cette équipe. Cliquez sur "+ Ajouter un Joueur" ci-dessus pour compléter l'effectif.</td></tr>`;
      } else {
        playersTableBody.innerHTML = teamData.players
          .map((p, index) => {
            return `
                      <tr>
                          <td style="text-align: center;"><strong>#${p.num}</strong></td>
                          <td><strong>${p.name}</strong></td>
                          <td>${p.height}</td>
                          <td><span class="pillar-badge-tag" style="background-color:#f4efea; font-size:0.75rem;">${p.position}</span></td>
                          <td style="text-align: center; white-space: nowrap;">
                              <button type="button" class="btn-action-edit" onclick="window.openEditPlayer('${teamFilter}', ${index})">Modifier</button>
                              <button type="button" class="btn-delete" onclick="window.deletePlayer('${teamFilter}', ${index})">Supprimer</button>
                          </td>
                      </tr>
                  `;
          })
          .join("");
      }
    }
  }

  // 4.D Table des Coachs
  const coachTeamSelect = document.getElementById("admin-coach-team");
  if (coachTeamSelect) {
    const currentCoachTeam = coachTeamSelect.value;
    let optHtml = `<option value="">-- Aucune équipe spécifique --</option>`;
    optHtml += Object.keys(rosters).map(k => {
      return `<option value="${k}">${rosters[k].name} (${rosters[k].category})</option>`;
    }).join("");
    coachTeamSelect.innerHTML = optHtml;
    if (Object.keys(rosters).includes(currentCoachTeam)) {
      coachTeamSelect.value = currentCoachTeam;
    }
  }

  const coachSuggestions = document.getElementById("coach-suggestions");
  if (coachSuggestions) {
    coachSuggestions.innerHTML = coachs.map(c => `<option value="${c.firstname} ${c.lastname}">${c.role}</option>`).join("");
  }

  const coachsTableBody = document.querySelector("#admin-coachs-table tbody");
  if (coachsTableBody) {
    if (coachs.length === 0) {
      coachsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px; font-style: italic;">Aucun coach enregistré. Cliquez sur "+ Ajouter un Coach" ci-dessus.</td></tr>`;
    } else {
      coachsTableBody.innerHTML = coachs.map(c => {
        const imgHtml = c.photo
          ? `<img src="${c.photo}" class="admin-table-photo" alt="Photo" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">`
          : `<div class="admin-table-logo-placeholder" style="width: 40px; height: 40px; line-height: 40px; border-radius: 50%;">🏀</div>`;

        const isBcl = c.club === 'bcl';
        const clubBadge = isBcl
          ? `<span class="pillar-badge-tag" style="background-color:rgba(255, 106, 47, 0.12); color:#FF6A2F; font-weight:700;">BCL</span>`
          : `<span class="pillar-badge-tag" style="background-color:rgba(210, 26, 0, 0.12); color:#D21A00; font-weight:700;">USBL</span>`;

        let teamLabel = "Non assignée";
        if (c.teamId && rosters[c.teamId]) {
          teamLabel = rosters[c.teamId].name;
        } else {
          for (const t of Object.values(rosters)) {
            if (t.coach && t.coach.toLowerCase().includes(c.lastname.toLowerCase())) {
              teamLabel = t.name;
              break;
            }
          }
        }

        return `
          <tr>
            <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
            <td><strong>${c.firstname} ${c.lastname}</strong> <br>${clubBadge}</td>
            <td><span class="pillar-badge-tag" style="background-color:#f4efea; font-size:0.75rem;">${c.role}</span></td>
            <td><span class="pillar-badge-tag" style="background-color:rgba(138, 29, 34, 0.05); color:var(--primary-color); font-size:0.75rem;">${teamLabel}</span></td>
            <td style="text-align: center; white-space: nowrap;">
              <a href="coach-detail.html?id=${c.id}&name=${encodeURIComponent(c.firstname + ' ' + c.lastname)}${c.teamId ? '&team=' + encodeURIComponent(c.teamId) : ''}" target="_blank" class="btn-action-view" style="margin-right: 5px;">Fiche ↗</a>
              <button type="button" class="btn-action-edit" onclick="window.openEditCoach('${c.id}')">Modifier</button>
              <button type="button" class="btn-delete" onclick="window.deleteCoach('${c.id}')">Supprimer</button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  if (typeof window.loadAdminInformations === "function") {
    window.loadAdminInformations();
  }
};

// Changement d'onglets Admin
window.switchAdminTab = (tabName) => {
  const contents = document.querySelectorAll(".admin-tab-content");
  contents.forEach((content) => content.classList.remove("active"));

  const targetContent = document.getElementById(`admin-tab-${tabName}`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  const buttons = document.querySelectorAll(".admin-tab-btn, .admin-simple-tab-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  if (tabName === "clubs" && typeof window.selectAdminClub === "function") {
    window.selectAdminClub(window.currentAdminClub || "usbl");
  } else if (tabName === "informations" && typeof window.loadAdminInformations === "function") {
    window.loadAdminInformations();
  } else if (typeof window.renderAdminTables === "function") {
    window.renderAdminTables();
  }
};

// Déclenchement manuel de la synchronisation FFBB depuis l'Admin
window.triggerAdminFFBBSync = async (btnEl) => {
  const originalHtml = btnEl ? btnEl.innerHTML : "";
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = "⏳ Synchronisation FFBB en cours...";
  }
  try {
    const res = await fetch("/api/trigger-scraping");
    const json = await res.json();
    if (json.success) {
      window.showAdminToast("🏆 Synchronisation FFBB réussie ! Données et classements mis à jour.");
      if (typeof window.renderAdminTables === "function") {
        window.renderAdminTables();
      }
      if (typeof window.renderCompetitionPages === "function") {
        window.renderCompetitionPages();
      }
      if (typeof window.renderCompetitionsHub === "function") {
        window.renderCompetitionsHub();
      }
    } else {
      window.showAdminToast("⚠️ Erreur lors de la synchronisation FFBB : " + (json.error || "Échec"), "error");
    }
  } catch (err) {
    window.showAdminToast("❌ Impossible de joindre le serveur local (port 3001).", "error");
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalHtml;
    }
  }
};

// Prévisualisation des images importées localement (Base64)
window.previewImage = (event, previewId) => {
  const file = event.target.files[0];
  const previewContainer = document.getElementById(previewId);
  let hiddenInputId = "admin-vol-base64";
  if (previewId === "vol-preview") hiddenInputId = "admin-vol-base64";
  else if (previewId === "part-preview") hiddenInputId = "admin-part-base64";
  else if (previewId === "team-preview") hiddenInputId = "admin-team-base64";
  else if (previewId === "coach-preview") hiddenInputId = "admin-coach-base64";
  
  const hiddenInput = document.getElementById(hiddenInputId);

  if (file && previewContainer && hiddenInput) {
    previewContainer.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Compression en cours...</span>`;
    compressImage(file, (base64) => {
      previewContainer.innerHTML = `<img src="${base64}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
      hiddenInput.value = base64;
    }, 600, 600, 0.7);
  } else if (previewContainer) {
    previewContainer.innerHTML = `<span>Aucune photo sélectionnée</span>`;
    if (hiddenInput) hiddenInput.value = "";
  }
};

// Authentification Administrateur
window.loginAdmin = () => {
  const passcode = document.getElementById("admin-passcode").value;
  const errorBox = document.getElementById("login-error-msg");

  if (passcode === "admin" || passcode === "usbl32") {
    sessionStorage.setItem("admin_authenticated", "true");
    if (errorBox) errorBox.style.display = "none";
    document.getElementById("admin-passcode").value = "";

    const loginPage = document.getElementById("page-admin-login");
    const dashPage = document.getElementById("page-admin-dashboard");
    if (loginPage) loginPage.style.display = "none";
    if (dashPage) {
      dashPage.style.display = "block";
      renderAdminTables();
    }
  } else {
    if (errorBox) {
      errorBox.style.display = "block";
    }
  }
};

// Déconnexion Administrateur
window.logoutAdmin = () => {
  sessionStorage.removeItem("admin_authenticated");
  window.location.href = "index.html";
};

// CRUD Actions: BÉNÉVOLES
window.addVolunteer = () => {
  const editIdInput = document.getElementById("admin-vol-edit-id");
  const editId = editIdInput ? editIdInput.value : "";
  const firstname = document.getElementById("admin-vol-firstname").value.trim();
  const lastname = document.getElementById("admin-vol-lastname").value.trim();
  const role = document.getElementById("admin-vol-role").value.trim();
  const photo = document.getElementById("admin-vol-base64").value;

  if (!firstname || !lastname || !role) {
    window.showAdminToast("Veuillez renseigner le prénom, le nom et le rôle.", "error");
    return;
  }

  if (editId) {
    const v = volunteers.find((x) => x.id === editId);
    if (v) {
      v.firstname = firstname;
      v.lastname = lastname;
      v.role = role;
      if (photo) v.photo = photo;
    }
    safeSetLocalStorage("usbl_volunteers", volunteers);
    window.saveCollectionToDisk("usbl_volunteers", volunteers);
    window.showAdminToast("Bénévole mis à jour avec succès !");
  } else {
    const newVol = {
      id: "vol-" + Date.now(),
      firstname: firstname,
      lastname: lastname,
      role: role,
      photo: photo || "",
    };
    volunteers.push(newVol);
    safeSetLocalStorage("usbl_volunteers", volunteers);
    window.saveCollectionToDisk("usbl_volunteers", volunteers);
    window.showAdminToast("Bénévole ajouté avec succès !");
  }

  window.closeAdminModal("modal-volunteer");
  document.getElementById("admin-volunteer-form").reset();
  document.getElementById("vol-preview").innerHTML = `<span>Aucune photo sélectionnée</span>`;
  document.getElementById("admin-vol-base64").value = "";

  window.renderAdminTables();
  window.renderVolunteers();
};

window.deleteVolunteer = (id) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce bénévole ?")) {
    volunteers = volunteers.filter((v) => v.id !== id);
    safeSetLocalStorage("usbl_volunteers", volunteers);
    window.saveCollectionToDisk("usbl_volunteers", volunteers);

    window.renderAdminTables();
    window.renderVolunteers();
    window.showAdminToast("Bénévole supprimé.");
  }
};

// CRUD Actions: ACTUALITÉS
window.previewNewsCover = (event) => {
  const file = event.target.files[0];
  const previewContainer = document.getElementById("news-cover-preview");
  const hiddenInput = document.getElementById("admin-news-base64-cover");

  if (file && previewContainer && hiddenInput) {
    previewContainer.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Compression en cours...</span>`;
    compressImage(file, (base64) => {
      previewContainer.innerHTML = `<img src="${base64}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
      hiddenInput.value = base64;
    }, 1000, 800, 0.7);
  } else if (previewContainer) {
    previewContainer.innerHTML = `<span>Aucune photo</span>`;
    if (hiddenInput) hiddenInput.value = "";
  }
};

window.previewNewsGallery = (event) => {
  const files = event.target.files;
  const previewContainer = document.getElementById("news-gallery-preview");
  const hiddenInput = document.getElementById("admin-news-base64-gallery");

  if (files && files.length > 0 && previewContainer && hiddenInput) {
    previewContainer.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Compression en cours...</span>`;
    const base64List = [];
    let loadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      compressImage(files[i], (base64) => {
        base64List.push(base64);
        loadedCount++;
        if (loadedCount === 1) {
          previewContainer.innerHTML = "";
        }
        const img = document.createElement("img");
        img.src = base64;
        img.style.width = "45px";
        img.style.height = "45px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "4px";
        previewContainer.appendChild(img);

        if (loadedCount === files.length) {
          hiddenInput.value = JSON.stringify(base64List);
        }
      }, 800, 600, 0.7);
    }
  } else if (previewContainer) {
    previewContainer.innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">Aucune photo sélectionnée</span>`;
    if (hiddenInput) hiddenInput.value = "";
  }
};

window.addActualite = () => {
  try {
    const editIdInput = document.getElementById("admin-news-edit-id");
    const editId = editIdInput ? editIdInput.value : "";
    const title = document.getElementById("admin-news-title").value.trim();
    const category = document.getElementById("admin-news-category").value;
    const excerpt = document.getElementById("admin-news-excerpt").value.trim();
    const dateInput = document.getElementById("admin-news-date");
    const content = document.getElementById("admin-news-content").value.trim();
    const coverBase64 = document.getElementById("admin-news-base64-cover").value;
    const galleryBase64Str = document.getElementById("admin-news-base64-gallery").value;

    if (!title || !category || !excerpt || !content) {
      window.showAdminToast("Veuillez remplir tous les champs obligatoires (Titre, Catégorie, Résumé court, Contenu).", "error");
      return;
    }

    let formattedDate = "";
    if (dateInput && dateInput.value) {
      const parts = dateInput.value.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        formattedDate = formatDate(d);
      }
    }
    if (!formattedDate) {
      formattedDate = formatDate(new Date());
    }

    let galleryImages = [];
    if (galleryBase64Str) {
      try {
        galleryImages = JSON.parse(galleryBase64Str);
      } catch (e) {
        console.error("Failed to parse gallery images", e);
      }
    }

    if (editId) {
      let artIdx = -1;
      if (!isNaN(parseInt(editId, 10)) && String(parseInt(editId, 10)) === editId) {
        artIdx = parseInt(editId, 10);
      } else {
        artIdx = articles.findIndex(a => a.id === editId);
      }

      if (artIdx >= 0 && articles[artIdx]) {
        articles[artIdx].title = title;
        articles[artIdx].category = category;
        if (dateInput && dateInput.value) {
          articles[artIdx].date = formattedDate;
        }
        articles[artIdx].excerpt = excerpt;
        articles[artIdx].content = content;
        if (coverBase64) {
          articles[artIdx].image = coverBase64;
        }
        if (galleryBase64Str) {
          articles[artIdx].images = galleryImages;
        }
      }
      safeSetLocalStorage("usbl_articles", articles);
      window.saveCollectionToDisk("usbl_articles", articles);
      window.showAdminToast("Publication mise à jour avec succès !");
    } else {
      const newArt = {
        id: "art-" + Date.now(),
        title: title,
        category: category,
        date: formattedDate,
        excerpt: excerpt,
        content: content,
        image: coverBase64 || "",
        images: galleryImages,
      };

      articles.unshift(newArt);
      const saveSuccess = safeSetLocalStorage("usbl_articles", articles);
      if (!saveSuccess) {
        articles.shift();
        window.showAdminToast("Erreur lors de la sauvegarde locale.", "error");
        return;
      }
      window.saveCollectionToDisk("usbl_articles", articles);
      window.showAdminToast("Publication enregistrée avec succès !");
    }

    window.closeAdminModal("modal-news");
    document.getElementById("admin-news-form").reset();
    document.getElementById("news-cover-preview").innerHTML = `<span>Aucune photo</span>`;
    document.getElementById("admin-news-base64-cover").value = "";
    document.getElementById("news-gallery-preview").innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">Aucune photo sélectionnée</span>`;
    document.getElementById("admin-news-base64-gallery").value = "";

    window.renderAdminTables();
    window.renderArticles();
    if (window.renderTicker) window.renderTicker();
  } catch (err) {
    console.error("Error in addActualite", err);
    window.showAdminToast("Erreur : " + err.message, "error");
  }
};

window.deleteActualite = (index) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer cette publication ?")) {
    articles.splice(index, 1);
    safeSetLocalStorage("usbl_articles", articles);
    window.saveCollectionToDisk("usbl_articles", articles);

    window.renderAdminTables();
    window.renderArticles();
    if (window.renderTicker) window.renderTicker();
    window.showAdminToast("Publication supprimée.");
  }
};

// Écouteur de synchronisation multi-onglets pour actualités
window.addEventListener("storage", (e) => {
  if (e.key === "usbl_articles") {
    try {
      const updated = JSON.parse(e.newValue);
      if (Array.isArray(updated)) {
        articles.length = 0;
        articles.push(...updated);
        if (typeof renderArticles === "function") renderArticles();
        if (typeof renderTicker === "function") renderTicker();
      }
    } catch (err) {}
  }
});

// CRUD Actions: PARTENAIRES
window.addPartner = () => {
  const editIdInput = document.getElementById("admin-part-edit-id");
  const editId = editIdInput ? editIdInput.value : "";
  const name = document.getElementById("admin-part-name").value.trim();
  const category = document.getElementById("admin-part-category").value;
  const role = document.getElementById("admin-part-role").value.trim();
  const logo = document.getElementById("admin-part-base64").value;

  if (!name || !category || !role) {
    window.showAdminToast("Veuillez renseigner le nom, la catégorie et le rôle.", "error");
    return;
  }

  let finalLogo = logo;
  if (!finalLogo) {
    if (category === "Institutionnels") finalLogo = "🏛️";
    else if (category === "Majeurs") finalLogo = "🤝";
    else finalLogo = "🏦";
  }

  if (editId) {
    const p = partners.find(x => x.id === editId);
    if (p) {
      p.name = name;
      p.category = category;
      p.role = role;
      if (logo) p.logo = logo;
    }
    safeSetLocalStorage("usbl_partners", partners);
    window.saveCollectionToDisk("usbl_partners", partners);
    window.showAdminToast("Partenaire mis à jour avec succès !");
  } else {
    const newPart = {
      id: "part-" + Date.now(),
      name: name,
      category: category,
      role: role,
      logo: finalLogo,
    };
    partners.push(newPart);
    safeSetLocalStorage("usbl_partners", partners);
    window.saveCollectionToDisk("usbl_partners", partners);
    window.showAdminToast("Partenaire ajouté avec succès !");
  }

  window.closeAdminModal("modal-partner");
  document.getElementById("admin-partner-form").reset();
  document.getElementById("part-preview").innerHTML = `<span>Aucun logo sélectionné</span>`;
  document.getElementById("admin-part-base64").value = "";

  window.renderAdminTables();
  window.renderPartners();
  window.renderSponsorsBand();
};

window.deletePartner = (id) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce partenaire ?")) {
    partners = partners.filter((p) => p.id !== id);
    safeSetLocalStorage("usbl_partners", partners);
    window.saveCollectionToDisk("usbl_partners", partners);

    window.renderAdminTables();
    window.renderPartners();
    window.renderSponsorsBand();
    window.showAdminToast("Partenaire supprimé.");
  }
};

// CRUD Actions: ROSTERS (Joueurs)
window.addPlayer = () => {
  const editTeamId = document.getElementById("admin-player-edit-team-id").value;
  const editIndexStr = document.getElementById("admin-player-edit-index").value;
  const num = parseInt(document.getElementById("admin-player-num").value, 10);
  const name = document.getElementById("admin-player-name").value.trim();
  const height = document.getElementById("admin-player-height").value.trim();
  const position = document.getElementById("admin-player-position").value;
  const teamId = document.getElementById("admin-player-team").value;

  if (isNaN(num) || !name || !height || !position || !teamId) {
    window.showAdminToast("Veuillez remplir tous les champs obligatoires du joueur.", "error");
    return;
  }

  if (!rosters[teamId]) {
    window.showAdminToast("Équipe introuvable.", "error");
    return;
  }

  if (editIndexStr !== "") {
    const editIndex = parseInt(editIndexStr, 10);
    const updatedPlayer = { num, name, height, position };
    if (editTeamId === teamId) {
      if (rosters[teamId].players && rosters[teamId].players[editIndex]) {
        rosters[teamId].players[editIndex] = updatedPlayer;
      }
    } else {
      if (rosters[editTeamId] && rosters[editTeamId].players) {
        rosters[editTeamId].players.splice(editIndex, 1);
      }
      if (!rosters[teamId].players) rosters[teamId].players = [];
      rosters[teamId].players.push(updatedPlayer);
    }
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);
    window.showAdminToast("Joueur mis à jour avec succès !");
  } else {
    const newPlayer = { num, name, height, position };
    if (!rosters[teamId].players) rosters[teamId].players = [];
    rosters[teamId].players.push(newPlayer);
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);
    window.showAdminToast("Joueur ajouté à l'effectif !");
  }

  window.closeAdminModal("modal-player");
  document.getElementById("admin-player-form").reset();

  window.renderAdminTables();
  window.renderCompetitionPages();
  window.renderCompetitionsHub();
};

window.deletePlayer = (teamId, index) => {
  if (!rosters[teamId] || !rosters[teamId].players) return;
  if (confirm("Êtes-vous sûr de vouloir retirer ce joueur de l'effectif ?")) {
    rosters[teamId].players.splice(index, 1);
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);

    window.renderAdminTables();
    window.renderCompetitionPages();
    window.renderCompetitionsHub();
    window.showAdminToast("Joueur retiré de l'effectif.");
  }
};

// CRUD Actions: TEAMS (Équipes)
window.addTeam = () => {
  const editIdInput = document.getElementById("admin-team-edit-id");
  const editId = editIdInput ? editIdInput.value : "";
  const name = document.getElementById("admin-team-name").value.trim();
  const category = document.getElementById("admin-team-category").value.trim();
  const coach = document.getElementById("admin-team-coach").value.trim();
  const photo = document.getElementById("admin-team-base64").value;
  const ffbb = document.getElementById("admin-team-ffbb").value.trim();
  const linkSelect = document.getElementById("admin-team-link-games");
  const linkedCategory = linkSelect ? linkSelect.value : "";
  const clubInput = document.getElementById("admin-team-club");
  const club = clubInput ? clubInput.value : "usbl";

  if (!name || !category || !coach) {
    window.showAdminToast("Veuillez renseigner le nom, la catégorie et l'entraîneur.", "error");
    return;
  }

  if (editId && rosters[editId]) {
    rosters[editId].club = club;
    rosters[editId].category = category;
    rosters[editId].name = name;
    rosters[editId].coach = coach;
    rosters[editId].linkedCategory = linkedCategory || "";
    rosters[editId].ffbbLink = ffbb || "";
    if (photo) rosters[editId].photo = photo;
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);
    window.showAdminToast("Équipe mise à jour avec succès !");
  } else {
    const teamId = "team-" + Date.now();
    rosters[teamId] = {
      club: club,
      category: category,
      name: name,
      coach: coach,
      photo: photo || "",
      ffbbLink: ffbb || "",
      linkedCategory: linkedCategory || "",
      players: [],
      isCustom: true
    };
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);
    window.showAdminToast("Équipe créée avec succès !");
  }

  window.closeAdminModal("modal-team");
  document.getElementById("admin-team-form").reset();
  document.getElementById("team-preview").innerHTML = `<span>Aucune photo sélectionnée</span>`;
  document.getElementById("admin-team-base64").value = "";

  window.renderAdminTables();
  window.renderCompetitionPages();
  window.renderCompetitionsHub();
};

window.deleteTeam = (teamId) => {
  if (!rosters[teamId]) return;
  if (confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${rosters[teamId].name}" et tout son effectif ?`)) {
    delete rosters[teamId];
    safeSetLocalStorage("usbl_rosters", rosters);
    window.saveCollectionToDisk("usbl_rosters", rosters);

    window.renderAdminTables();
    window.renderCompetitionPages();
    window.renderCompetitionsHub();
    window.showAdminToast("Équipe supprimée.");
  }
};

// CRUD Actions: COACHS (Entraîneurs & Éducateurs)
window.addCoach = () => {
  const editIdInput = document.getElementById("admin-coach-edit-id");
  const editId = editIdInput ? editIdInput.value : "";
  const firstname = document.getElementById("admin-coach-firstname").value.trim();
  const lastname = document.getElementById("admin-coach-lastname").value.trim();
  const role = document.getElementById("admin-coach-role").value.trim();
  const club = document.getElementById("admin-coach-club") ? document.getElementById("admin-coach-club").value : "usbl";
  const teamId = document.getElementById("admin-coach-team") ? document.getElementById("admin-coach-team").value : "";
  const bio = document.getElementById("admin-coach-bio") ? document.getElementById("admin-coach-bio").value.trim() : "";
  const photo = document.getElementById("admin-coach-base64") ? document.getElementById("admin-coach-base64").value : "";

  if (!firstname || !lastname) {
    window.showAdminToast("Veuillez renseigner le prénom et le nom du coach.", "error");
    return;
  }

  if (editId) {
    const c = coachs.find(x => x.id === editId);
    if (c) {
      c.firstname = firstname;
      c.lastname = lastname;
      c.role = role || "Coach Principal";
      c.club = club || "usbl";
      c.teamId = teamId || "";
      c.bio = bio || "";
      if (photo) c.photo = photo;
    }
    if (teamId && rosters[teamId]) {
      rosters[teamId].coach = `${firstname} ${lastname}`.trim();
      safeSetLocalStorage("usbl_rosters", rosters);
      window.saveCollectionToDisk("usbl_rosters", rosters);
    }
    safeSetLocalStorage("usbl_coachs", coachs);
    window.saveCollectionToDisk("usbl_coachs", coachs);
    window.showAdminToast("Coach mis à jour avec succès !");
  } else {
    const coachId = "coach-" + Date.now();
    const newCoach = {
      id: coachId,
      firstname: firstname,
      lastname: lastname,
      role: role || "Coach Principal",
      club: club || "usbl",
      teamId: teamId || "",
      bio: bio || "",
      photo: photo || ""
    };
    coachs.push(newCoach);
    safeSetLocalStorage("usbl_coachs", coachs);
    window.saveCollectionToDisk("usbl_coachs", coachs);

    if (teamId && rosters[teamId]) {
      rosters[teamId].coach = `${firstname} ${lastname}`.trim();
      safeSetLocalStorage("usbl_rosters", rosters);
      window.saveCollectionToDisk("usbl_rosters", rosters);
    }
    window.showAdminToast("Coach ajouté avec succès !");
  }

  window.closeAdminModal("modal-coach");
  const coachForm = document.getElementById("admin-coach-form");
  if (coachForm) coachForm.reset();
  const preview = document.getElementById("coach-preview");
  if (preview) preview.innerHTML = `<span>Aucune photo sélectionnée</span>`;
  const base64Input = document.getElementById("admin-coach-base64");
  if (base64Input) base64Input.value = "";

  window.renderAdminTables();
  if (typeof window.renderCompetitionPages === "function") window.renderCompetitionPages();
  if (typeof window.renderCompetitionsHub === "function") window.renderCompetitionsHub();
};

window.deleteCoach = (id) => {
  const c = coachs.find(x => x.id === id);
  if (!c) return;

  if (confirm(`Êtes-vous sûr de vouloir supprimer le coach "${c.firstname} ${c.lastname}" ?`)) {
    coachs = coachs.filter(x => x.id !== id);
    safeSetLocalStorage("usbl_coachs", coachs);
    window.saveCollectionToDisk("usbl_coachs", coachs);

    window.renderAdminTables();
    if (typeof window.renderCompetitionPages === "function") window.renderCompetitionPages();
    if (typeof window.renderCompetitionsHub === "function") window.renderCompetitionsHub();
    window.showAdminToast("Coach supprimé.");
  }
};

// ----------------------------------------------------------------------
// PANEL D'ADMINISTRATION : CONSTRUCTEUR MODULAIRE DE PAGES DE CLUBS
// ----------------------------------------------------------------------

window.currentAdminClub = "usbl";
window.currentAdminClubSections = [];

window.selectAdminClub = (clubKey) => {
  // Sauvegarde silencieuse du club précédent avant de changer de club
  if (window.currentAdminClub && window.currentAdminClub !== clubKey && document.getElementById("admin-club-header-title")) {
    window.saveClubData(true);
  }
  window.currentAdminClub = clubKey;

  // Boutons de bascule USBL / BCL
  const btnUsbl = document.getElementById("admin-club-toggle-usbl");
  const btnBcl = document.getElementById("admin-club-toggle-bcl");
  if (btnUsbl && btnBcl) {
    if (clubKey === "usbl") {
      btnUsbl.classList.add("active");
      btnBcl.classList.remove("active");
    } else {
      btnBcl.classList.add("active");
      btnUsbl.classList.remove("active");
    }
  }

  // Lien direct
  const liveLink = document.getElementById("admin-club-live-link");
  if (liveLink) {
    liveLink.href = clubKey === "bcl" ? "qui-sommes-nous-bcl.html" : "qui-sommes-nous-usbl.html";
    liveLink.textContent = clubKey === "bcl" ? "Voir la page BCL en direct ↗" : "Voir la page USBL en direct ↗";
  }

  // Libellé des boutons de sauvegarde
  const saveBtn = document.getElementById("admin-club-save-btn");
  if (saveBtn) {
    saveBtn.textContent = clubKey === "bcl" ? "Enregistrer les modifications pour le BCL" : "Enregistrer les modifications pour l'USBL";
  }
  const saveBtnTop = document.getElementById("admin-club-save-btn-top");
  if (saveBtnTop) {
    saveBtnTop.textContent = clubKey === "bcl" ? "Enregistrer pour le BCL" : "Enregistrer pour l'USBL";
  }

  // Chargement des données
  const data = window.getClubPresentationData(clubKey);

  const titleInput = document.getElementById("admin-club-header-title");
  const subInput = document.getElementById("admin-club-header-sub");
  const textInput = document.getElementById("admin-club-header-text");
  const photoHidden = document.getElementById("admin-club-header-photo-base64");
  const photoPreview = document.getElementById("admin-club-header-preview");
  const photoFileInput = document.getElementById("admin-club-header-photo-file");
  const photoRemoveBtn = document.getElementById("admin-club-header-photo-remove");
  const captionInput = document.getElementById("admin-club-header-caption");

  if (titleInput) titleInput.value = data.header.title || "";
  if (subInput) subInput.value = data.header.subtitle || "";
  if (textInput) textInput.value = data.header.text || "";
  if (photoFileInput) photoFileInput.value = "";
  if (photoHidden) photoHidden.value = data.header.photo || "";
  if (captionInput) captionInput.value = data.header.photoCaption || "";

  if (photoPreview) {
    if (data.header.photo) {
      photoPreview.innerHTML = `<img src="${data.header.photo}" alt="Aperçu photo en-tête">`;
      if (photoRemoveBtn) photoRemoveBtn.style.display = "inline-block";
    } else {
      photoPreview.innerHTML = `<span>Aucune photo</span>`;
      if (photoRemoveBtn) photoRemoveBtn.style.display = "none";
    }
  }

  // Chargement des sous-parties dynamiques
  window.currentAdminClubSections = Array.isArray(data.sections) ? JSON.parse(JSON.stringify(data.sections)) : [];
  window.renderAdminClubSections();

  const statusEls = [
    document.getElementById("admin-club-save-status"),
    document.getElementById("admin-club-save-status-top")
  ];
  statusEls.forEach(el => {
    if (el) {
      el.textContent = `Édition : ${clubKey.toUpperCase()}`;
      el.classList.remove("saved");
    }
  });
};

window.renderAdminClubSections = () => {
  const container = document.getElementById("admin-club-sections-container");
  if (!container) return;

  if (window.currentAdminClubSections.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.9rem; background: #ffffff; border: 1px dashed var(--border-color); border-radius: 4px;">
        Aucune sous-partie créée pour le moment.<br>
        Cliquez sur le bouton ci-dessous pour ajouter votre première sous-partie (ex: Histoire, Formation, Équipes, Salles...).
      </div>
    `;
    return;
  }

  container.innerHTML = window.currentAdminClubSections.map((sec, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === window.currentAdminClubSections.length - 1;
    const hasPhoto = !!(sec.photo && sec.photo.trim());

    return `
      <div class="admin-section-item" data-index="${idx}">
        <div class="admin-section-header">
          <span class="admin-section-num">Sous-partie ${idx + 1} ${sec.title ? `— ${escapeClubHtml(sec.title)}` : ""}</span>
          <div class="admin-section-actions">
            <button type="button" class="admin-section-btn" onclick="window.moveAdminClubSection(${idx}, -1)" ${isFirst ? "disabled" : ""} title="Monter d'un cran">↑ Monter</button>
            <button type="button" class="admin-section-btn" onclick="window.moveAdminClubSection(${idx}, 1)" ${isLast ? "disabled" : ""} title="Descendre d'un cran">↓ Descendre</button>
            <button type="button" class="admin-section-btn-remove" onclick="window.removeAdminClubSection(${idx})" title="Supprimer cette sous-partie">Supprimer</button>
          </div>
        </div>

        <div class="admin-club-input-group">
          <label class="admin-club-label">Titre de la sous-partie</label>
          <input type="text" class="admin-club-input" value="${escapeClubHtml(sec.title || "")}" placeholder="Ex: Notre histoire, L'école de basket, Les bénévoles..." oninput="window.updateAdminClubSection(${idx}, 'title', this.value); window.autoSaveClubData();">
        </div>

        <div class="admin-club-input-group">
          <label class="admin-club-label">Texte de la sous-partie</label>
          <textarea class="admin-club-textarea" rows="4" placeholder="Rédigez votre texte librement. Les sauts de ligne créent automatiquement des paragraphes distincts." oninput="window.updateAdminClubSection(${idx}, 'text', this.value); window.autoSaveClubData();">${escapeClubHtml(sec.text || "")}</textarea>
        </div>

        <div class="admin-photo-edit-row">
          <div class="admin-photo-preview-box" id="admin-sec-preview-${idx}">
            ${hasPhoto ? `<img src="${sec.photo}" alt="Aperçu">` : `<span>Aucune photo</span>`}
          </div>
          <div class="admin-photo-controls">
            <label class="admin-club-label">Photo de la sous-partie (optionnelle)</label>
            <input type="file" accept="image/*" onchange="window.previewSectionImage(event, ${idx})">
            ${hasPhoto ? `<button type="button" class="admin-photo-remove-btn" onclick="window.removeSectionPhoto(${idx})">Supprimer la photo</button>` : ""}
            <div style="margin-top: 10px;">
              <label class="admin-club-label">Légende de la photo</label>
              <input type="text" class="admin-club-input" value="${escapeClubHtml(sec.photoCaption || "")}" placeholder="Légende affichée sous la photo" oninput="window.updateAdminClubSection(${idx}, 'photoCaption', this.value); window.autoSaveClubData();">
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
};

window.addAdminClubSection = () => {
  window.currentAdminClubSections.push({
    id: "sec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    title: "",
    text: "",
    photo: "",
    photoCaption: ""
  });
  window.renderAdminClubSections();
  window.autoSaveClubData();

  const items = document.querySelectorAll(".admin-section-item");
  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    const input = lastItem.querySelector("input[type='text']");
    if (input) input.focus();
  }
};

window.removeAdminClubSection = (idx) => {
  const sec = window.currentAdminClubSections[idx];
  const label = sec && sec.title ? `la sous-partie "${sec.title}"` : `la sous-partie ${idx + 1}`;
  if (confirm(`Êtes-vous sûr de vouloir supprimer ${label} ?`)) {
    window.currentAdminClubSections.splice(idx, 1);
    window.renderAdminClubSections();
    window.autoSaveClubData();
  }
};

window.moveAdminClubSection = (idx, direction) => {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= window.currentAdminClubSections.length) return;

  const temp = window.currentAdminClubSections[idx];
  window.currentAdminClubSections[idx] = window.currentAdminClubSections[targetIdx];
  window.currentAdminClubSections[targetIdx] = temp;
  window.renderAdminClubSections();
  window.autoSaveClubData();
};

window.updateAdminClubSection = (idx, field, value) => {
  if (window.currentAdminClubSections[idx]) {
    window.currentAdminClubSections[idx][field] = value;
    const cards = document.querySelectorAll(".admin-section-item");
    const card = cards[idx];
    if (card) {
      if (field === "title") {
        const numSpan = card.querySelector(".admin-section-num");
        if (numSpan) numSpan.textContent = `Sous-partie ${idx + 1} ${value ? `— ${value}` : ""}`;
        const input = card.querySelector("input.admin-club-input");
        if (input && input.value !== value) input.value = value;
      }
      if (field === "text") {
        const txt = card.querySelector("textarea.admin-club-textarea");
        if (txt && txt.value !== value) txt.value = value;
      }
      if (field === "photoCaption") {
        const inputs = card.querySelectorAll("input.admin-club-input");
        if (inputs[1] && inputs[1].value !== value) inputs[1].value = value;
      }
    }
  }
};

window.previewClubImage = (event, previewId, hiddenInputId, removeBtnId) => {
  const file = event.target.files[0];
  const previewBox = document.getElementById(previewId);
  const hiddenInput = document.getElementById(hiddenInputId);
  const removeBtn = removeBtnId ? document.getElementById(removeBtnId) : null;

  if (file && previewBox && hiddenInput) {
    previewBox.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Compression...</span>`;
    compressImage(file, (base64) => {
      previewBox.innerHTML = `<img src="${base64}" alt="Aperçu">`;
      hiddenInput.value = base64;
      if (removeBtn) removeBtn.style.display = "inline-block";
      window.autoSaveClubData();
    }, 1200, 800, 0.75);
  }
};

window.removeClubHeaderPhoto = () => {
  const photoHidden = document.getElementById("admin-club-header-photo-base64");
  const photoPreview = document.getElementById("admin-club-header-preview");
  const photoFileInput = document.getElementById("admin-club-header-photo-file");
  const removeBtn = document.getElementById("admin-club-header-photo-remove");

  if (photoFileInput) photoFileInput.value = "";
  if (photoHidden) photoHidden.value = "";
  if (photoPreview) photoPreview.innerHTML = `<span>Aucune photo</span>`;
  if (removeBtn) removeBtn.style.display = "none";
  window.autoSaveClubData();
};

window.previewSectionImage = (event, idx) => {
  const file = event.target.files[0];
  if (file && window.currentAdminClubSections[idx]) {
    const previewBox = document.getElementById(`admin-sec-preview-${idx}`);
    if (previewBox) {
      previewBox.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Compression...</span>`;
    }
    compressImage(file, (base64) => {
      window.currentAdminClubSections[idx].photo = base64;
      window.renderAdminClubSections();
      window.autoSaveClubData();
    }, 1200, 800, 0.75);
  }
};

window.removeSectionPhoto = (idx) => {
  if (window.currentAdminClubSections[idx]) {
    window.currentAdminClubSections[idx].photo = "";
    window.currentAdminClubSections[idx].photoCaption = "";
    window.renderAdminClubSections();
    window.autoSaveClubData();
  }
};

let autoSaveClubTimer = null;
window.autoSaveClubData = () => {
  clearTimeout(autoSaveClubTimer);
  const statusEls = [
    document.getElementById("admin-club-save-status"),
    document.getElementById("admin-club-save-status-top")
  ];
  statusEls.forEach(el => {
    if (el) {
      el.textContent = "Enregistrement en cours...";
      el.classList.remove("saved");
    }
  });
  autoSaveClubTimer = setTimeout(() => {
    window.saveClubData(true);
  }, 250);
};

window.openClubLivePage = (e) => {
  if (e && e.preventDefault) e.preventDefault();
  const clubKey = window.currentAdminClub || "usbl";
  window.saveClubData(true);
  const data = window.getClubPresentationData(clubKey);

  let hashParam = "";
  try {
    const serialized = encodeURIComponent(JSON.stringify(data));
    if (serialized.length < 80000) {
      hashParam = "#sync=" + serialized;
    }
  } catch (err) {}

  const targetUrl = (clubKey === "bcl" ? "qui-sommes-nous-bcl.html" : "qui-sommes-nous-usbl.html") + hashParam;
  const newWin = window.open(targetUrl, "_blank");
  if (newWin) {
    [100, 300, 600, 1200].forEach(delay => {
      setTimeout(() => {
        try {
          newWin.postMessage({ type: "USBL_RECEIVE_CLUB_DATA", clubKey, data }, "*");
        } catch (err) {}
      }, delay);
    });
  }
};

window.saveClubData = (silent = false) => {
  const clubKey = window.currentAdminClub || "usbl";
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  const photoHiddenVal = document.getElementById("admin-club-header-photo-base64")?.value || "";

  // Synchronisation avec les champs du DOM pour chaque carte de sous-partie
  const sectionCards = document.querySelectorAll(".admin-section-item");
  const syncedSections = [];

  sectionCards.forEach((card, idx) => {
    const inputs = card.querySelectorAll("input.admin-club-input");
    const titleInput = inputs[0];
    const captionInput = inputs[1];
    const textArea = card.querySelector("textarea.admin-club-textarea");
    const existing = window.currentAdminClubSections[idx] || {};

    const finalTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : (existing.title || "").trim();
    const finalText = (textArea && textArea.value.trim()) ? textArea.value.trim() : (existing.text || "").trim();
    const finalCaption = (captionInput && captionInput.value.trim()) ? captionInput.value.trim() : (existing.photoCaption || "").trim();

    syncedSections.push({
      id: existing.id || ("sec_" + Date.now() + "_" + idx),
      title: finalTitle,
      text: finalText,
      photo: existing.photo || "",
      photoCaption: finalCaption
    });
  });

  window.currentAdminClubSections = syncedSections;

  const dataToSave = {
    header: {
      title: getVal("admin-club-header-title"),
      subtitle: getVal("admin-club-header-sub"),
      text: getVal("admin-club-header-text"),
      photo: photoHiddenVal,
      photoCaption: getVal("admin-club-header-caption")
    },
    sections: window.currentAdminClubSections.map(s => ({
      id: s.id || ("sec_" + Date.now()),
      title: (s.title || "").trim(),
      text: (s.text || "").trim(),
      photo: s.photo || "",
      photoCaption: (s.photoCaption || "").trim()
    }))
  };

  window.currentAdminClubData = dataToSave;

  const collectionKey = "usbl_club_" + clubKey;
  const saveSuccess = safeSetLocalStorage(collectionKey, dataToSave);

  if (saveSuccess) {
    const statusEls = [
      document.getElementById("admin-club-save-status"),
      document.getElementById("admin-club-save-status-top")
    ];
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    if (typeof window.saveCollectionToDisk === "function") {
      window.saveCollectionToDisk(collectionKey, dataToSave).then(savedToDisk => {
        const diskTag = savedToDisk ? " (disque & navigateur)" : "";
        const statusText = silent
          ? `✓ Enregistré automatiquement (${clubKey.toUpperCase()} à ${timeStr})${diskTag}`
          : `✓ Modifications enregistrées avec succès (${clubKey.toUpperCase()} à ${timeStr})${diskTag}`;
        statusEls.forEach(el => {
          if (el) {
            el.textContent = statusText;
            el.classList.add("saved");
          }
        });
      });
    }

    const defaultStatusText = silent
      ? `✓ Enregistré automatiquement (${clubKey.toUpperCase()} à ${timeStr})`
      : `✓ Modifications enregistrées avec succès (${clubKey.toUpperCase()} à ${timeStr})`;

    statusEls.forEach(el => {
      if (el) {
        el.textContent = defaultStatusText;
        el.classList.add("saved");
      }
    });

    if (!silent) {
      alert(`Les modifications de la page ${clubKey.toUpperCase()} ont été enregistrées avec succès.`);
    }
  }
};

window.resetClubDataToEmpty = () => {
  const clubKey = window.currentAdminClub || "usbl";
  if (confirm(`Voulez-vous réinitialiser la page ${clubKey.toUpperCase()} à vide ?\nElle affichera le message "Page en cours de création par le club".`)) {
    const emptyData = createEmptyClubData();
    const collectionKey = "usbl_club_" + clubKey;
    safeSetLocalStorage(collectionKey, emptyData);
    if (typeof window.saveCollectionToDisk === "function") {
      window.saveCollectionToDisk(collectionKey, emptyData);
    }
    window.selectAdminClub(clubKey);
    alert(`La page ${clubKey.toUpperCase()} a été réinitialisée à vide.`);
  }
};

// ----------------------------------------------------------------------
// OFFLINE JSON FILE BACKUPS (IMPORT / EXPORT INTERACTIVE SYSTEM)
// ----------------------------------------------------------------------

window.toggleBackupDropdown = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  
  // Close other open backup dropdowns first
  document.querySelectorAll(".backup-dropdown").forEach(dropdown => {
    if (dropdown.id !== id) {
      dropdown.classList.remove("active");
    }
  });
  
  el.classList.toggle("active");
};

// Close dropdowns if clicked outside
window.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-actions")) {
    document.querySelectorAll(".backup-dropdown").forEach(dropdown => {
      dropdown.classList.remove("active");
    });
  }
});

window.exportCollectionJSON = (collectionKey) => {
  const data = localStorage.getItem(collectionKey);
  if (!data) {
    alert("Aucune donnée enregistrée pour cette collection.");
    return;
  }
  
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${collectionKey}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.importCollectionJSON = (event, collectionKey) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (typeof parsed !== "object" || parsed === null) {
        alert("Erreur de format : Le fichier JSON doit être un tableau ou un objet valide.");
        return;
      }
      
      safeSetLocalStorage(collectionKey, parsed);
      alert("La base de données locale a été restaurée avec succès depuis votre fichier JSON !");
      
      // Close dropdowns
      document.querySelectorAll(".backup-dropdown").forEach(dropdown => {
        dropdown.classList.remove("active");
      });
      
      // Refresh page to apply new database state
      window.location.reload();
    } catch (err) {
      alert("Erreur de lecture du fichier JSON : " + err.message);
    }
  };
  reader.readAsText(file);
};

// ----------------------------------------------------------------------
// DYNAMIC COMPETITIONS DATA HELPERS & GROUPING PATTERNS
// ----------------------------------------------------------------------

const getMatchesAndStandingsForTeam = (teamKey, rostersObj, gamesData) => {
  const team = rostersObj[teamKey];
  if (!team) return { categories: [], matches: [], standings: [], mainPoule: "" };

  const matchedCategories = [];
  
  if (team.linkedCategory) {
    if (gamesData[team.linkedCategory]) {
      matchedCategories.push(team.linkedCategory);
    }
    // Also capture sister phases that share the base name prefix
    const baseName = team.linkedCategory.split(" - ")[0].trim().toLowerCase();
    Object.keys(gamesData).forEach(cat => {
      if (cat !== team.linkedCategory && cat.toLowerCase().startsWith(baseName)) {
        matchedCategories.push(cat);
      }
    });
  } else {
    const teamKeyLower = teamKey.toLowerCase();
    
    // Rules for grouping phases by category of team
    Object.keys(gamesData).forEach(cat => {
      const catLower = cat.toLowerCase();
      if (teamKeyLower === 'rm3') {
        if (catLower.includes('seniors') || catLower.includes('rm3') || catLower.includes('esteve')) {
          matchedCategories.push(cat);
        }
      } else if (teamKeyLower === 'rmu21') {
        if (catLower.includes('u21') || catLower.includes('rmu21')) {
          matchedCategories.push(cat);
        }
      } else if (teamKeyLower === 'dmu18') {
        if (catLower.includes('u18') || catLower.includes('dmu18')) {
          matchedCategories.push(cat);
        }
      } else if (teamKeyLower === 'dmu13') {
        if (catLower.includes('u13') || catLower.includes('franceschin')) {
          matchedCategories.push(cat);
        }
      } else if (teamKeyLower === 'dmu15') {
        if (catLower.includes('u15') || catLower.includes('dmu15')) {
          matchedCategories.push(cat);
        }
      } else {
        // Custom team matching: check if name or category matches
        const catNorm = team.category.toLowerCase().replace(/[^a-z0-9]/g, "");
        const nameNorm = team.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (catLower.includes(teamKeyLower) || catLower.includes(catNorm) || catLower.includes(nameNorm)) {
          matchedCategories.push(cat);
        }
      }
    });
  }

  // Sort matched categories: Phase 2 or main division first
  matchedCategories.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower.includes("phase 2") && !bLower.includes("phase 2")) return -1;
    if (!aLower.includes("phase 2") && bLower.includes("phase 2")) return 1;
    if (aLower.includes("division 2") && bLower.includes("division 3")) return -1;
    return b.length - a.length;
  });

  let allMatches = [];
  let standings = [];
  let mainPoule = "";
  
  matchedCategories.forEach((cat, index) => {
    const data = gamesData[cat];
    if (!data) return;
    
    const phaseName = cat.replace(" - Phase 2", "").replace("Pyrenées", "Pyr").replace("Départementale", "Dép").replace("Régionale", "Rég");
    const matchesWithPhase = (data.matchs || []).map(m => ({ ...m, phase: phaseName }));
    allMatches.push(...matchesWithPhase);
    
    if (index === 0) {
      standings = data.classement || [];
      mainPoule = data.pouleNom || "";
    }
  });

  // Sort matches by date, most recent first (format YYYY-MM-DD à HH:)
  allMatches.sort((a, b) => {
    const dateA = a.date.substring(0, 10);
    const dateB = b.date.substring(0, 10);
    return dateB.localeCompare(dateA);
  });

  return {
    categories: matchedCategories,
    matches: allMatches,
    standings: standings,
    mainPoule: mainPoule
  };
};

const findUsblPosition = (standings) => {
  if (!standings || standings.length === 0) return null;
  const usblEntry = standings.find(s => {
    const name = s.team.toLowerCase();
    return name.includes("jourdain") || name.includes("usbl");
  });
  return usblEntry ? usblEntry.pos : null;
};

// ----------------------------------------------------------------------
// COACHS DATA HELPERS & DETAIL PAGE RENDERER
// ----------------------------------------------------------------------

window.getCoachForTeam = (teamKey, team) => {
  if (!Array.isArray(coachs) || coachs.length === 0) {
    try {
      const stored = localStorage.getItem("usbl_coachs");
      if (stored) coachs = JSON.parse(stored);
    } catch (e) {}
  }
  if (!Array.isArray(coachs)) return null;

  // 1. Chercher par ID d'équipe explicite
  if (teamKey) {
    const byTeamId = coachs.find(c => c.teamId && c.teamId.toLowerCase() === teamKey.toLowerCase());
    if (byTeamId) return byTeamId;
  }

  // 2. Chercher par correspondance de nom avec team.coach
  if (team && team.coach) {
    const coachStr = team.coach.trim().toLowerCase();
    const byName = coachs.find(c => {
      const fn = (c.firstname || "").trim().toLowerCase();
      const ln = (c.lastname || "").trim().toLowerCase();
      const fullName1 = `${fn} ${ln}`.trim();
      const fullName2 = `${ln} ${fn}`.trim();
      return (
        fullName1 === coachStr ||
        fullName2 === coachStr ||
        (ln.length >= 3 && coachStr.includes(ln))
      );
    });
    if (byName) return byName;
  }

  return null;
};

window.buildCoachDetailUrl = (coachObj, coachName, teamKey) => {
  if (!coachObj && !coachName && !teamKey) return null;
  const params = new URLSearchParams();
  if (coachObj && coachObj.id) params.set("id", coachObj.id);
  if (coachName) params.set("name", coachName.trim());
  if (teamKey) params.set("team", teamKey);
  return `coach-detail.html?${params.toString()}`;
};

window.renderCoachDetailPage = async () => {
  // 1. S'assurer que coachs est chargé et fusionné (mémoire + localStorage + data/coachs.json)
  if (!Array.isArray(coachs)) coachs = [];
  try {
    const stored = localStorage.getItem("usbl_coachs");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(coachs.map(c => c.id));
        parsed.forEach(c => {
          if (!existingIds.has(c.id)) coachs.push(c);
        });
      }
    }
  } catch (e) {}

  const coachPorts = [null, 3001, 3000, 8080];
  for (const p of coachPorts) {
    try {
      const url = p ? `http://localhost:${p}/data/coachs.json?t=${Date.now()}` : `data/coachs.json?t=${Date.now()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const existingIds = new Set(coachs.map(c => c.id));
          data.forEach(c => {
            if (!existingIds.has(c.id)) coachs.push(c);
          });
          try { localStorage.setItem("usbl_coachs", JSON.stringify(coachs)); } catch(e) {}
          break;
        }
      }
    } catch (e) {}
  }

  // 2. S'assurer que rosters est fusionné avec data/rosters.json et localStorage
  try {
    const storedR = localStorage.getItem("usbl_rosters");
    if (storedR) {
      const parsedR = JSON.parse(storedR);
      if (parsedR && typeof parsedR === "object") {
        rosters = { ...(rosters || {}), ...parsedR };
      }
    }
  } catch (e) {}

  const rosterPorts = [null, 3001, 3000, 8080];
  for (const p of rosterPorts) {
    try {
      const url = p ? `http://localhost:${p}/data/rosters.json?t=${Date.now()}` : `data/rosters.json?t=${Date.now()}`;
      const resR = await fetch(url);
      if (resR.ok) {
        const dataR = await resR.json();
        if (dataR && typeof dataR === "object" && Object.keys(dataR).length > 0) {
          rosters = { ...(rosters || {}), ...dataR };
          try { localStorage.setItem("usbl_rosters", JSON.stringify(rosters)); } catch(e) {}
          break;
        }
      }
    } catch (e) {}
  }

  const localRosters = (typeof rosters !== "undefined" && rosters) ? rosters : {};

  const urlParams = new URLSearchParams(window.location.search);
  const coachId = urlParams.get("id");
  const coachNameParam = urlParams.get("name");
  const teamParam = urlParams.get("team");

  let coach = null;
  let associatedTeam = null;
  let teamKey = null;

  // Résolution Étape 1 : par id exact dans coachs
  if (coachId && Array.isArray(coachs)) {
    coach = coachs.find(c => c.id === coachId);
  }

  // Résolution Étape 2 : par correspondance teamId dans coachs (si coachId est un teamId ou via teamParam)
  if (!coach && Array.isArray(coachs)) {
    const targetTeam = teamParam || coachId;
    if (targetTeam) {
      coach = coachs.find(c => c.teamId && c.teamId.toLowerCase() === targetTeam.toLowerCase());
    }
  }

  // Résolution Étape 3 : par nom dans coachs
  if (!coach && coachNameParam && Array.isArray(coachs)) {
    const cleanParam = decodeURIComponent(coachNameParam).trim().toLowerCase();
    coach = coachs.find(c => {
      const fn = (c.firstname || "").trim().toLowerCase();
      const ln = (c.lastname || "").trim().toLowerCase();
      const fullName1 = `${fn} ${ln}`.trim();
      const fullName2 = `${ln} ${fn}`.trim();
      return (
        fullName1 === cleanParam ||
        fullName2 === cleanParam ||
        (ln.length >= 3 && cleanParam.includes(ln)) ||
        (fn.length >= 3 && cleanParam.includes(fn))
      );
    });
  }

  // Résolution Étape 4 : recherche de l'équipe via rosters
  if (teamParam && localRosters[teamParam]) {
    teamKey = teamParam;
    associatedTeam = localRosters[teamParam];
  } else if (coachId && localRosters[coachId]) {
    teamKey = coachId;
    associatedTeam = localRosters[coachId];
  } else if (coach && coach.teamId && localRosters[coach.teamId]) {
    teamKey = coach.teamId;
    associatedTeam = localRosters[coach.teamId];
  }

  // Si on a l'équipe et qu'elle a un coach renseigné
  if (associatedTeam && associatedTeam.coach) {
    const teamCoachName = associatedTeam.coach.trim();
    if (!coach && Array.isArray(coachs)) {
      const cleanTeamCoach = teamCoachName.toLowerCase();
      coach = coachs.find(c => {
        const fn = (c.firstname || "").trim().toLowerCase();
        const ln = (c.lastname || "").trim().toLowerCase();
        const fullName1 = `${fn} ${ln}`.trim();
        const fullName2 = `${ln} ${fn}`.trim();
        return (
          fullName1 === cleanTeamCoach ||
          fullName2 === cleanTeamCoach ||
          (ln.length >= 3 && cleanTeamCoach.includes(ln))
        );
      });
    }

    // S'il n'est toujours pas dans coachs, fabriquer son profil à partir des infos de l'équipe
    if (!coach) {
      const parts = teamCoachName.split(" ");
      const fn = parts[0] || teamCoachName;
      const ln = parts.slice(1).join(" ") || "";
      coach = {
        id: "coach-" + (teamKey || Date.now()),
        firstname: fn,
        lastname: ln,
        role: "Coach Principal",
        club: associatedTeam.club || "usbl",
        teamId: teamKey || "",
        photo: "",
        bio: `Entraîneur principal de l'équipe ${associatedTeam.name} (${associatedTeam.category || 'Compétition'}). Éducateur passionné, engagé auprès des joueurs pour porter haut les couleurs du club.`
      };
    }
  }

  // Résolution Étape 5 : nom dans l'URL mais pas de coach
  if (!coach && coachNameParam) {
    const raw = decodeURIComponent(coachNameParam).trim();
    const parts = raw.split(" ");
    const fn = parts[0] || raw;
    const ln = parts.slice(1).join(" ") || "";

    // Chercher si ce nom correspond à une équipe dans rosters
    if (!associatedTeam) {
      const foundK = Object.keys(localRosters).find(k => {
        const t = localRosters[k];
        return t && t.coach && (
          t.coach.toLowerCase().includes(raw.toLowerCase()) || 
          (ln && t.coach.toLowerCase().includes(ln.toLowerCase()))
        );
      });
      if (foundK) {
        teamKey = foundK;
        associatedTeam = localRosters[foundK];
      }
    }

    coach = {
      id: "temp-" + Date.now(),
      firstname: fn,
      lastname: ln,
      role: "Coach Principal",
      club: (associatedTeam && associatedTeam.club) ? associatedTeam.club : "usbl",
      teamId: teamKey || "",
      photo: "",
      bio: associatedTeam
        ? `Entraîneur principal de l'équipe ${associatedTeam.name}. Éducateur passionné, engagé au quotidien auprès de son effectif.`
        : "Entraîneur et éducateur sportif engagé auprès des collectifs de l'entente USBL & BCL."
    };
  }

  // Résolution Étape 6 : Si aucun paramètre ou recherche infructueuse, prendre le premier coach existant
  if (!coach) {
    if (Array.isArray(coachs) && coachs.length > 0) {
      coach = coachs[0];
    } else {
      const firstTeamKeyWithCoach = Object.keys(localRosters).find(k => localRosters[k] && localRosters[k].coach);
      if (firstTeamKeyWithCoach) {
        const t = localRosters[firstTeamKeyWithCoach];
        const parts = (t.coach || "Entraîneur").trim().split(" ");
        coach = {
          id: "coach-first-" + firstTeamKeyWithCoach,
          firstname: parts[0] || "Coach",
          lastname: parts.slice(1).join(" ") || "",
          role: "Coach Principal",
          club: t.club || "usbl",
          teamId: firstTeamKeyWithCoach,
          photo: "",
          bio: `Entraîneur principal de l'équipe ${t.name}.`
        };
        associatedTeam = t;
        teamKey = firstTeamKeyWithCoach;
      }
    }
  }

  // Recherche de l'équipe associée finale si coach existe mais associatedTeam est encore null
  if (coach && !associatedTeam) {
    if (coach.teamId && localRosters[coach.teamId]) {
      teamKey = coach.teamId;
      associatedTeam = localRosters[coach.teamId];
    } else {
      const ln = (coach.lastname || "").trim().toLowerCase();
      const fn = (coach.firstname || "").trim().toLowerCase();
      const foundK = Object.keys(localRosters).find(k => {
        const t = localRosters[k];
        if (!t || !t.coach) return false;
        const cStr = t.coach.toLowerCase();
        return (ln.length >= 3 && cStr.includes(ln)) || (fn.length >= 3 && cStr.includes(fn));
      });
      if (foundK) {
        teamKey = foundK;
        associatedTeam = localRosters[foundK];
      }
    }
  }

  const container = document.getElementById("coach-detail-container");
  if (!coach) {
    if (container) {
      container.innerHTML = `
        <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 60px 20px; text-align: center;">
          <div style="font-size: 3.5rem; margin-bottom: 15px;">🏀</div>
          <h2 style="font-family: var(--font-heading); font-size: 2rem; margin-bottom: 12px;">Profil d'entraîneur introuvable</h2>
          <p style="color: var(--text-muted); margin-bottom: 25px;">Aucune fiche d'entraîneur ne correspond à cette requête.</p>
          <a href="competitions.html" class="btn btn-outline">← Retour à nos équipes</a>
        </div>
      `;
    }
    return;
  }

  const fullnameEl = document.getElementById("coach-fullname");
  const roleEl = document.getElementById("coach-role");
  const clubBadge = document.getElementById("coach-club-badge");
  const photoBox = document.getElementById("coach-photo-box");
  const teamNameEl = document.getElementById("coach-team-name");
  const teamLinkEl = document.getElementById("coach-team-link");
  const bioEl = document.getElementById("coach-bio");

  const fullName = `${coach.firstname || ''} ${coach.lastname || ''}`.trim() || "Entraîneur";
  if (fullnameEl) fullnameEl.textContent = fullName;
  document.title = `${fullName} - Fiche Entraîneur | USBL & BCL Basket`;

  if (roleEl) roleEl.textContent = coach.role || "Coach Principal";

  if (clubBadge) {
    const isBcl = (coach.club === "bcl") || (associatedTeam && associatedTeam.club === "bcl");
    clubBadge.textContent = isBcl ? "BCL (Féminin)" : "USBL Spartiates (Masculin)";
    clubBadge.style.backgroundColor = isBcl ? "#e6007e" : "var(--primary-color)";
    clubBadge.style.color = "#ffffff";
  }

  if (photoBox) {
    if (coach.photo) {
      photoBox.innerHTML = `<img src="${coach.photo}" alt="${fullName}" class="coach-photo-img">`;
    } else {
      const fnChar = (coach.firstname || '').charAt(0);
      const lnChar = (coach.lastname || '').charAt(0);
      const initials = (fnChar + lnChar).toUpperCase() || "🏀";
      photoBox.innerHTML = `<div class="coach-avatar-placeholder">${initials}</div>`;
    }
  }

  if (teamNameEl) {
    if (associatedTeam) {
      teamNameEl.textContent = `${associatedTeam.name} (${associatedTeam.category || 'Compétition'})`;
    } else {
      teamNameEl.textContent = "Collectif en préparation / Non assigné";
    }
  }

  if (teamLinkEl) {
    if (associatedTeam && teamKey) {
      teamLinkEl.style.display = "inline-flex";
      teamLinkEl.href = `competition-detail.html?team=${teamKey}`;
      teamLinkEl.innerHTML = `Consulter l'équipe ${associatedTeam.name} ↗`;
    } else {
      teamLinkEl.style.display = "inline-flex";
      teamLinkEl.href = "competitions.html";
      teamLinkEl.innerHTML = `Consulter toutes nos équipes ↗`;
    }
  }

  if (bioEl) {
    const defaultBio = `Éducateur et entraîneur passionné, engagé au quotidien auprès des joueurs pour développer leurs compétences techniques, leur rigueur tactique et les valeurs collectives du club.`;
    bioEl.innerHTML = `<p>${coach.bio || defaultBio}</p>`;
  }
};

// ----------------------------------------------------------------------
// DYNAMIC COMPETITIONS GRID RENDERER
// ----------------------------------------------------------------------

window.renderCompetitionsHub = async () => {
  const grid = document.querySelector("#page-competitions .teams-grid-layout");
  if (!grid) return;

  if (Object.keys(rosters).length === 0) {
    grid.innerHTML = `
          <div class="actu-empty-state" style="grid-column: 1 / -1; width: 100%;">
              <div class="actu-empty-icon">🛡️</div>
              <h3 class="actu-empty-title font-style-serif">Aucune équipe active</h3>
              <p class="actu-empty-desc">Le secrétariat prépare actuellement les engagements d'équipes pour la saison sportive.</p>
          </div>
      `;
    return;
  }

  // Load gamesData dynamically to show 3 last matches & standings position on cards!
  let gamesData = {};
  try {
    const res = await fetch("data/games.json");
    if (res.ok) {
      gamesData = await res.json();
    }
  } catch (err) {
    console.warn("Could not load games.json for dynamic standings/matches, using fallback", err);
  }

  grid.innerHTML = Object.keys(rosters)
    .map((key) => {
      const team = rosters[key];
      let icon = "🏀";
      if (key === "rm3") icon = "🛡️";
      else if (key === "rmu21") icon = "🏀";
      else if (key === "dmu18") icon = "🔴";
      else if (key === "dmu13") icon = "👶";

      // Match category data from games.json
      const teamStats = getMatchesAndStandingsForTeam(key, rosters, gamesData);
      const usblPos = findUsblPosition(teamStats.standings);
      const playedMatches = teamStats.matches.filter(m => m.joue);
      const last3 = playedMatches.slice(0, 3);

      const clickAction = `window.location.href='competition-detail.html?team=${key}'`;

      const getMatchResultBadge = (m) => {
        if (m.notreScore === null || m.scoreAdverse === null) return "";
        if (m.notreScore > m.scoreAdverse) return '<span class="result-badge win">G</span>';
        if (m.notreScore < m.scoreAdverse) return '<span class="result-badge loss">P</span>';
        return "";
      };

      const coachObj = (typeof window.getCoachForTeam === "function") ? window.getCoachForTeam(key, team) : null;
      const coachName = (team.coach || "").trim();
      const coachLink = (typeof window.buildCoachDetailUrl === "function") 
        ? window.buildCoachDetailUrl(coachObj, coachName, key)
        : (coachObj ? `coach-detail.html?id=${coachObj.id}` : (coachName ? `coach-detail.html?name=${encodeURIComponent(coachName)}` : null));
      const coachDisplayHtml = coachLink
        ? `<a href="${coachLink}" onclick="event.stopPropagation();" class="team-coach-link">${coachName}</a>`
        : (coachName || '<span style="color: var(--text-muted);">À désigner</span>');

      return `
            <div class="team-explorer-card" onclick="${clickAction}" style="cursor: pointer;">
                <div class="team-card-frame">
                    ${team.photo
                      ? `<div class="team-card-img" style="background-image: url('${team.photo}'); width: 100%; height: 100%; background-size: cover; background-position: center;"></div>`
                      : `<div class="team-card-placeholder">
                           <span class="placeholder-icon">${icon}</span>
                           <span class="placeholder-team-lbl">${team.name}</span>
                         </div>`
                    }
                </div>
                <div class="team-card-info">
                    <span class="team-cat-tag">${team.category.toUpperCase()}</span>
                    <h3>${team.name}</h3>
                    <p class="team-coach" onclick="event.stopPropagation();"><strong>Coach principal :</strong> ${coachDisplayHtml}</p>
                    
                    ${usblPos 
                      ? `<span class="team-standing-badge">🏆 Rang: #${usblPos}</span>` 
                      : ``
                    }

                    <div class="team-card-matches">
                        <h4 class="matches-section-title">Derniers Matchs :</h4>
                        ${last3.length > 0 
                          ? `<div class="mini-matches-list">
                              ${last3.map(m => `
                                <div class="mini-match-item">
                                  <span class="mini-match-opp">vs ${m.equipeAdverse.substring(0, 20).replace("US BASKET ", "")}</span>
                                  <span class="mini-match-score">${m.notreScore} - ${m.scoreAdverse} ${getMatchResultBadge(m)}</span>
                                </div>
                              `).join('')}
                             </div>`
                          : `<div class="mini-match-empty">Aucun match joué enregistré.</div>`
                        }
                    </div>

                    <button class="btn btn-outline full-width-btn" onclick="event.stopPropagation(); ${clickAction}">Voir l'Équipe</button>
                </div>
            </div>
        `;
    })
    .join("");
};

// ----------------------------------------------------------------------
// DYNAMIC COMPETITION DETAILS RENDERER (competition-detail.html)
// ----------------------------------------------------------------------

window.loadCompetitionDetailPage = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const teamKey = urlParams.get("team");
  if (!teamKey || !rosters[teamKey]) {
    window.location.href = "competitions.html";
    return;
  }

  const team = rosters[teamKey];

  const categoryBadge = document.getElementById("team-category-badge");
  const mainTitle = document.getElementById("team-main-title");
  const bannerName = document.getElementById("team-banner-name");
  const coachNameDetail = document.getElementById("coach-name-detail");
  const ffbbLink = document.getElementById("team-ffbb-link");
  const teamPhotoDisplay = document.getElementById("team-photo-display");

  if (categoryBadge) categoryBadge.textContent = team.category;
  if (mainTitle) mainTitle.textContent = team.name.toUpperCase();
  if (bannerName) bannerName.textContent = team.name;
  if (coachNameDetail) {
    const coachObj = (typeof window.getCoachForTeam === "function") ? window.getCoachForTeam(teamKey, team) : null;
    const coachName = (team.coach || "").trim();
    const coachLink = (typeof window.buildCoachDetailUrl === "function") 
      ? window.buildCoachDetailUrl(coachObj, coachName, teamKey)
      : (coachObj ? `coach-detail.html?id=${coachObj.id}` : (coachName ? `coach-detail.html?name=${encodeURIComponent(coachName)}` : null));
    const coachDisplayHtml = coachLink
      ? `<a href="${coachLink}" class="team-coach-link">${coachName}</a>`
      : (coachName || 'Non renseigné');
    coachNameDetail.innerHTML = `<strong>Coach principal :</strong> ${coachDisplayHtml}`;
  }
  
  if (teamPhotoDisplay) {
    if (team.photo) {
      teamPhotoDisplay.style.backgroundImage = `linear-gradient(rgba(26, 20, 18, 0.2), rgba(26, 20, 18, 0.6)), url('${team.photo}')`;
    } else {
      teamPhotoDisplay.style.backgroundImage = `linear-gradient(rgba(26, 20, 18, 0.2), rgba(26, 20, 18, 0.6)), url('assets/court_bg.jpg')`;
    }
  }

  // Load gamesData dynamically to group phases
  let gamesData = {};
  try {
    const res = await fetch("data/games.json");
    if (res.ok) {
      gamesData = await res.json();
    }
  } catch (err) {
    console.error("Failed to load games.json on details page", err);
  }

  const teamStats = getMatchesAndStandingsForTeam(teamKey, rosters, gamesData);

  if (ffbbLink) {
    let link = team.ffbbLink || "https://competitions.ffbb.com/ligues/occ/comites/0032/clubs/occ0032061";
    if (!team.ffbbLink) {
      if (teamKey === 'rm3') link = "https://competitions.ffbb.com/equipe/1036-occ0032061-000000000000000305886";
      else if (teamKey === 'rmu21') link = "https://competitions.ffbb.com/equipe/1036-occ0032061-000000000000000455447";
      else if (teamKey === 'dmu18') link = "https://competitions.ffbb.com/equipe/1036-occ0032061-000000000000000421378";
      else if (teamKey === 'dmu13') link = "https://competitions.ffbb.com/equipe/1036-occ0032061-000000000000000421882";
    }
    ffbbLink.href = link;
  }

  // Render Roster
  const rosterBody = document.querySelector("#roster-table-detail tbody");
  if (rosterBody) {
    const playersList = team.players || [];
    if (playersList.length === 0) {
      rosterBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 25px 0; font-style: italic;">Aucun joueur enregistré dans cette équipe.</td></tr>`;
    } else {
      rosterBody.innerHTML = playersList
        .map(p => `
          <tr>
              <td><strong>${p.num}</strong></td>
              <td class="player-name-cell">${p.name}</td>
              <td>${p.height}</td>
              <td>${p.position}</td>
          </tr>
        `)
        .join("");
    }
  }

  // Phase Switching
  const phaseTabsContainer = document.getElementById("phase-tabs-container");
  const phaseSwitcherWrapper = document.getElementById("phase-switcher-wrapper");

  const renderActivePhaseData = (phaseName) => {
    const data = gamesData[phaseName];
    if (!data) return;

    const playedContainer = document.getElementById("played-matches-detail");
    const upcomingContainer = document.getElementById("upcoming-matches-detail");
    const currentPouleName = document.getElementById("current-poule-name");

    if (currentPouleName) {
      currentPouleName.textContent = data.pouleNom || "Sans Poule";
    }

    const matches = data.matchs || [];
    const played = matches.filter(m => m.joue);
    const upcoming = matches.filter(m => !m.joue);

    const getMatchResultBadge = (m) => {
      if (m.notreScore === null || m.scoreAdverse === null) return "";
      if (m.notreScore > m.scoreAdverse) return '<span class="result-badge win">G</span>';
      if (m.notreScore < m.scoreAdverse) return '<span class="result-badge loss">P</span>';
      return "";
    };

    if (playedContainer) {
      if (played.length === 0) {
        playedContainer.innerHTML = '<div class="comp-match-empty-state">Aucun match joué dans cette phase.</div>';
      } else {
        playedContainer.innerHTML = played
          .map(m => `
            <div class="comp-match-item">
                <div class="comp-match-meta">${m.date} • ${m.salle}</div>
                <div class="comp-match-main">
                    <span class="comp-match-opp">${m.notreEquipe.replace("US BASKET ", "")} vs ${m.equipeAdverse.replace("US BASKET ", "")}</span>
                    <div class="comp-match-score">
                        <span class="${m.notreScore > m.scoreAdverse ? 'winner-score' : ''}">${m.notreScore}</span>
                        <span class="sep">-</span>
                        <span class="${m.scoreAdverse > m.notreScore ? 'winner-score' : ''}">${m.scoreAdverse}</span>
                        ${getMatchResultBadge(m)}
                    </div>
                </div>
            </div>
          `)
          .join("");
      }
    }

    if (upcomingContainer) {
      if (upcoming.length === 0) {
        upcomingContainer.innerHTML = '<div class="comp-match-empty-state">Aucune rencontre à venir de planifiée.</div>';
      } else {
        upcomingContainer.innerHTML = upcoming
          .map(m => `
            <div class="comp-match-item upcoming">
                <div class="comp-match-meta">${m.date}</div>
                <div class="comp-match-main">
                    <span class="comp-match-opp">${m.notreEquipe.replace("US BASKET ", "")} vs ${m.equipeAdverse.replace("US BASKET ", "")}</span>
                    <span class="comp-match-venue">📍 ${m.salle}</span>
                </div>
            </div>
          `)
          .join("");
      }
    }

    const standingsBody = document.querySelector("#standings-table-detail tbody");
    
    if (standingsBody) {
      const standings = data.classement || [];
      if (standings.length === 0) {
        standingsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 15px 0; font-style: italic;">Le classement officiel pour cette phase n'est pas encore disponible.</td></tr>`;
      } else {
        standings.sort((a, b) => a.pos - b.pos);
        standingsBody.innerHTML = standings
          .map(s => {
            const isUsbl = s.team.toLowerCase().includes("jourdain") || s.team.toLowerCase().includes("usbl");
            return `
              <tr class="${isUsbl ? 'usbl-row' : ''}">
                  <td><strong>${s.pos}</strong></td>
                  <td class="team-name-cell">${s.team}</td>
                  <td><strong>${s.pts}</strong></td>
                  <td>${s.j}</td>
                  <td>${s.g}</td>
                  <td>${s.p}</td>
              </tr>
            `;
          })
          .join("");
      }
    }
  };

  if (teamStats.categories.length > 0) {
    if (teamStats.categories.length > 1) {
      if (phaseSwitcherWrapper && phaseTabsContainer) {
        phaseSwitcherWrapper.style.display = "flex";
        phaseTabsContainer.innerHTML = teamStats.categories
          .map((cat, index) => {
            let displayName = cat
              .replace("Départementale masculine ", "Dép ")
              .replace("Régionale masculine ", "Rég ")
              .replace("Pyrenées", "Pyr")
              .replace("Trophée Georges ESTEVE Masculins - 8ème", "Coupe G. Estève")
              .replace("Trophée Enzo FRANCESCHIN U13M - Finale", "Coupe E. Franceschin")
              .replace("Brassages", "Brass.")
              .replace("Brassage", "Brass.")
              .replace("classement", "Class.")
              .replace("tour final", "Tour Final")
              .trim();

            return `<button class="comp-phase-tab-btn ${index === 0 ? 'active' : ''}" data-phase="${cat}">${displayName}</button>`;
          })
          .join("");

        const buttons = phaseTabsContainer.querySelectorAll(".comp-phase-tab-btn");
        buttons.forEach(btn => {
          btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderActivePhaseData(btn.getAttribute("data-phase"));
          });
        });
      }
    } else {
      if (phaseSwitcherWrapper) phaseSwitcherWrapper.style.display = "none";
    }

    renderActivePhaseData(teamStats.categories[0]);
  } else {
    if (phaseSwitcherWrapper) phaseSwitcherWrapper.style.display = "none";
    const playedContainer = document.getElementById("played-matches-detail");
    const upcomingContainer = document.getElementById("upcoming-matches-detail");
    const standingsBody = document.querySelector("#standings-table-detail tbody");

    if (playedContainer) playedContainer.innerHTML = '<div class="comp-match-empty-state">Aucun match disponible. Lancez le scraper FFBB.</div>';
    if (upcomingContainer) upcomingContainer.innerHTML = '<div class="comp-match-empty-state">Aucune rencontre disponible.</div>';
    if (standingsBody) standingsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 15px 0;">Données de la saison indisponibles.</td></tr>';
  }
};

// ----------------------------------------------------------------------
// 12. GESTION DES DOCUMENTS PDF DU CLUB & RUBRIQUE INFORMATIONS
// (BDD INTERNE STRICTEMENT : data/informations.json & documents/*.pdf)
// ----------------------------------------------------------------------

// Récupération en temps réel de la base de données interne sans cache
async function fetchInformationsDb() {
  try {
    const res = await fetch(`data/informations.json?t=${Date.now()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("[Informations DB] Erreur de lecture de data/informations.json :", e);
  }
  return null;
}
window.fetchInformationsDb = fetchInformationsDb;

// Initialisation de la visionneuse PDF sur les 5 pages de catégories
async function initCategoryPdfPage() {
  const container = document.getElementById("category-pdf-viewer-container");
  if (!container) return;

  const category = container.getAttribute("data-category");
  if (!category) return;

  const infoDb = await fetchInformationsDb();
  const doc = infoDb ? infoDb[category] : null;

  if (doc && doc.url) {
    let updatedDateFormatted = "";
    if (doc.updatedAt) {
      try {
        const d = new Date(doc.updatedAt);
        updatedDateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      } catch (e) {}
    }

    container.innerHTML = `
      <div class="pdf-viewer-section">
        <div class="pdf-document-card">
          <div class="pdf-doc-meta">
            <span class="pdf-doc-icon">📄</span>
            <div>
              <h2 class="pdf-doc-title">${doc.title || "Document Officiel"}</h2>
              <p class="pdf-doc-details">
                ${doc.filesize ? `<span><strong>Taille :</strong> ${doc.filesize}</span>` : ""}
                ${updatedDateFormatted ? `<span><strong>Mis à jour le :</strong> ${updatedDateFormatted}</span>` : ""}
                <span><strong>Format :</strong> PDF Officiel</span>
              </p>
            </div>
          </div>
          <div class="pdf-actions-bar">
            <a href="${doc.url}" download="${doc.filename || category + '.pdf'}" class="btn-pdf-action btn-pdf-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Télécharger le document
            </a>
            <a href="${doc.url}" target="_blank" rel="noopener noreferrer" class="btn-pdf-action btn-pdf-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Plein écran
            </a>
          </div>
        </div>
        <div class="pdf-frame-wrapper">
          <iframe class="pdf-viewer-frame" src="${doc.url}#toolbar=1&navpanes=0" title="${doc.title || 'Document PDF'}"></iframe>
        </div>
      </div>
    `;
  } else {
    const titles = {
      inscriptions: "Inscriptions & Licences",
      planning: "Planning des Entraînements",
      boutiques: "Boutiques Officielles (Catalogue)",
      charte: "Charte Interne & Fair-Play",
      commissions: "Organisation des Commissions"
    };
    const titleName = titles[category] || "cette rubrique";

    container.innerHTML = `
      <div class="pdf-empty-state">
        <span class="pdf-empty-icon">📄</span>
        <h3 class="pdf-empty-title">Document en cours de finalisation</h3>
        <p class="pdf-empty-desc">
          Le document officiel pour <strong>${titleName}</strong> sera prochainement mis en ligne par l'administration du club.<br>
          Il sera directement consultable et téléchargeable ici en haute résolution.
        </p>
        <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
          <a href="informations.html" class="btn btn-outline" style="font-size: 0.85rem; padding: 10px 22px;">← Retour aux Informations</a>
          <a href="contact.html" class="btn btn-primary" style="font-size: 0.85rem; padding: 10px 22px;">Contacter le secrétariat</a>
        </div>
      </div>
    `;
  }
}
window.initCategoryPdfPage = initCategoryPdfPage;

// Initialisation du hub dynamique Informations (informations.html)
async function initInformationsHubPage() {
  const hubGrid = document.getElementById("informations-hub-grid");
  if (!hubGrid) return;

  const infoDb = await fetchInformationsDb();

  const categoriesConfig = [
    {
      id: "inscriptions",
      title: "Inscriptions & Licences",
      desc: "Démarches dématérialisées e-Licence FFBB, tarifs par catégorie, dispositifs Pass'Sport et permanences du club.",
      href: "inscriptions.html",
      icon: "📝",
      accent: "#D21A00"
    },
    {
      id: "planning",
      title: "Planning des Entraînements",
      desc: "Grille complète des créneaux hebdomadaires pour l'ensemble des équipes masculines et féminines (Gasco'Sport et Gymnase Municipal).",
      href: "planning.html",
      icon: "⏱️",
      accent: "#F92C00"
    },
    {
      id: "boutiques",
      title: "Boutiques Officielles",
      desc: "Habillez-vous aux couleurs de votre club ! Survêtements, maillots d'échauffement, sacs et catalogue textile officiel.",
      href: "boutiques.html",
      icon: "🛍️",
      accent: "#FF6A2F"
    },
    {
      id: "charte",
      title: "Charte Interne & Fair-Play",
      desc: "Les valeurs fondatrices de l'USBL et du BCL : respect de l'arbitrage, esprit d'équipe, convivialité et engagement citoyen.",
      href: "charte-interne.html",
      icon: "📜",
      accent: "#A31609"
    },
    {
      id: "commissions",
      title: "Commissions du Club",
      desc: "Organisation interne, rôles et composition des pôles du club : Communication, Partenaires, OTM, Animations & Événements.",
      href: "commissions.html",
      icon: "🏛️",
      accent: "#B82400"
    }
  ];

  hubGrid.innerHTML = categoriesConfig.map(cat => {
    const doc = infoDb ? infoDb[cat.id] : null;
    const isPublished = Boolean(doc && doc.url);
    const badgeHtml = isPublished
      ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 700; background: #e6f7ec; color: #0d8a43; border: 1px solid #b7ecc8; padding: 2px 8px; border-radius: 20px; margin-bottom: 12px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #0d8a43;"></span> Document officiel disponible (PDF)</span>`
      : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 700; background: #fff6ed; color: #c45e00; border: 1px solid #ffd4a8; padding: 2px 8px; border-radius: 20px; margin-bottom: 12px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #c45e00;"></span> En attente de publication</span>`;

    return `
      <div class="info-hub-card" style="--card-accent: ${cat.accent};">
        <div>
          <span class="info-card-icon">${cat.icon}</span>
          <div>${badgeHtml}</div>
          <h2 class="info-card-title">${cat.title}</h2>
          <p class="info-card-desc">${cat.desc}</p>
        </div>
        <div>
          <a href="${cat.href}" class="info-card-link-btn">
            ${isPublished ? "Consulter le document PDF" : "Accéder à la rubrique"} <span>→</span>
          </a>
        </div>
      </div>
    `;
  }).join("");
}
window.initInformationsHubPage = initInformationsHubPage;

// ----------------------------------------------------------------------
// GESTION ADMIN DES DOCUMENTS PDF (admin.html)
// ----------------------------------------------------------------------
const ADMIN_PDF_CATEGORIES = [
  { id: "inscriptions", name: "Inscriptions & Licences", defaultTitle: "Inscriptions & Licences 2025-2026", color: "#D21A00" },
  { id: "planning", name: "Planning des Entraînements", defaultTitle: "Planning des Entraînements 2025-2026", color: "#F92C00" },
  { id: "boutiques", name: "Boutiques Officielles", defaultTitle: "Catalogue des Boutiques Officielles 2025-2026", color: "#FF6A2F" },
  { id: "charte", name: "Charte Interne & Fair-Play", defaultTitle: "Charte Interne & Fair-Play Commune", color: "#A31609" },
  { id: "commissions", name: "Commissions du Club", defaultTitle: "Organisation des Commissions 2025-2026", color: "#B82400" }
];

window.selectedAdminPdfFiles = window.selectedAdminPdfFiles || {};

window.loadAdminInformations = async function() {
  const container = document.getElementById("admin-pdf-cards-container");
  if (!container) return;

  container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Chargement des documents depuis la base interne...</div>';

  const infoDb = await fetchInformationsDb() || {};

  const publishedDocs = ADMIN_PDF_CATEGORIES.filter(cat => infoDb[cat.id] && infoDb[cat.id].url).length;
  const kpiPdf = document.getElementById("kpi-pdf-count") || document.getElementById("kpi-count-pdf");
  if (kpiPdf) kpiPdf.textContent = `${publishedDocs}/${ADMIN_PDF_CATEGORIES.length}`;
  const badgeInfo = document.getElementById("badge-informations");
  if (badgeInfo) badgeInfo.textContent = publishedDocs;

  container.innerHTML = ADMIN_PDF_CATEGORIES.map(cat => {
    const doc = infoDb[cat.id] || {};
    const isPublished = Boolean(doc.url);
    const titleVal = doc.title || cat.defaultTitle;
    let updateFormatted = "";
    if (doc.updatedAt) {
      try {
        const d = new Date(doc.updatedAt);
        updateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      } catch (e) {}
    }

    return `
      <div class="admin-pdf-card" style="--card-color: ${cat.color};">
        <div>
          <div class="admin-pdf-card-top">
            <div>
              <span class="admin-pdf-category-slug">Catégorie : ${cat.id}</span>
              <h4 class="admin-pdf-name">${cat.name}</h4>
            </div>
            <span class="admin-pdf-status-pill ${isPublished ? 'published' : 'empty'}">
              ${isPublished ? '✓ Publié' : '○ Non publié'}
            </span>
          </div>

          <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-color); display: block; margin-bottom: 4px;">Titre public du document :</label>
            <input type="text" id="admin-pdf-title-${cat.id}" class="admin-pdf-input" value="${titleVal.replace(/"/g, '&quot;')}" placeholder="Ex: ${cat.defaultTitle}">
          </div>

          <div style="background: #fcfbf9; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 14px; font-size: 0.82rem;">
            ${isPublished ? `
              <div style="color: #2b7a42; font-weight: 600; margin-bottom: 4px;">Fichier actif : <strong>${doc.filename || cat.id + '.pdf'}</strong> (${doc.filesize || 'PDF'})</div>
              <div style="color: var(--text-muted);">Dernière mise en ligne : ${updateFormatted || 'Récemment'}</div>
              <div style="margin-top: 6px;"><a href="${doc.url}" target="_blank" style="color: var(--primary-color); text-decoration: underline; font-weight: 600;">Consulter le PDF actuel ↗</a></div>
            ` : `
              <div style="color: var(--text-muted); font-style: italic;">Aucun fichier PDF n'est actuellement en ligne pour cette catégorie.</div>
            `}
          </div>

          <div class="admin-pdf-dropzone" onclick="document.getElementById('admin-pdf-file-${cat.id}').click();">
            <input type="file" id="admin-pdf-file-${cat.id}" accept="application/pdf,.pdf" style="display: none;" onchange="window.handlePdfFileSelected('${cat.id}', this)">
            <div style="font-size: 1.6rem; margin-bottom: 6px;">📂</div>
            <div id="admin-pdf-label-${cat.id}" style="font-size: 0.85rem; font-weight: 600; color: #1a1a1a;">
              ${isPublished ? 'Remplacer par un nouveau PDF' : 'Sélectionner un fichier PDF'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Cliquez pour parcourir (format .pdf uniquement, max 25 Mo)</div>
          </div>
        </div>

        <div class="admin-pdf-btn-row">
          <button type="button" class="btn btn-primary" id="admin-pdf-btn-${cat.id}" onclick="window.submitAdminPdf('${cat.id}')" style="flex: 1; justify-content: center; padding: 10px 16px; font-size: 0.82rem;">
            ${isPublished ? 'Mettre à jour le PDF' : 'Téléverser le PDF'}
          </button>
          ${isPublished ? `
            <button type="button" class="btn btn-outline" onclick="window.deleteAdminPdf('${cat.id}')" style="color: #c53030; border-color: #feb2b2; padding: 10px 14px; font-size: 0.82rem;" title="Supprimer ce document">
              🗑️ Supprimer
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
};

window.handlePdfFileSelected = function(category, inputElement) {
  const file = inputElement.files && inputElement.files[0];
  const labelEl = document.getElementById(`admin-pdf-label-${category}`);
  const btnEl = document.getElementById(`admin-pdf-btn-${category}`);

  if (file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Format de fichier non valide. Veuillez choisir un document au format PDF (.pdf).");
      inputElement.value = "";
      return;
    }
    window.selectedAdminPdfFiles[category] = file;
    const sizeFormatted = file.size >= 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + " Mo"
      : Math.max(1, Math.round(file.size / 1024)) + " Ko";

    if (labelEl) {
      labelEl.innerHTML = `📄 <span style="color: var(--primary-color);">${file.name}</span> (${sizeFormatted})`;
    }
    if (btnEl) {
      btnEl.textContent = `Téléverser "${file.name}"`;
      btnEl.style.boxShadow = "0 0 10px rgba(210, 26, 0, 0.4)";
    }
  }
};

window.submitAdminPdf = async function(category) {
  const file = window.selectedAdminPdfFiles[category];
  const titleInput = document.getElementById(`admin-pdf-title-${category}`);
  const title = titleInput ? titleInput.value.trim() : "";
  const globalAlert = document.getElementById("admin-pdf-global-alert");
  const btnEl = document.getElementById(`admin-pdf-btn-${category}`);

  if (!file) {
    alert("Veuillez d'abord sélectionner un fichier PDF à téléverser en cliquant sur le bloc de sélection.");
    return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Téléversement en cours...";
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;

    try {
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category,
          filename: file.name,
          title: title,
          data: base64Data
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        delete window.selectedAdminPdfFiles[category];

        if (globalAlert) {
          globalAlert.style.display = "block";
          globalAlert.style.backgroundColor = "#e6f7ec";
          globalAlert.style.color = "#0d8a43";
          globalAlert.style.border = "1px solid #b7ecc8";
          globalAlert.innerHTML = `✓ Succès : Le document officiel pour <strong>${category}</strong> a été enregistré dans la base de données interne locale et publié pour tous les utilisateurs.`;
          setTimeout(() => { globalAlert.style.display = "none"; }, 6000);
        }

        await window.loadAdminInformations();
      } else {
        alert("Erreur lors de l'enregistrement du PDF : " + (result.error || "Erreur inconnue"));
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion avec le serveur interne.");
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
      }
    }
  };
  reader.readAsDataURL(file);
};

window.deleteAdminPdf = async function(category) {
  if (!confirm(`Confirmez-vous la suppression du document PDF pour la catégorie "${category}" ? Il ne sera plus visible par les utilisateurs.`)) {
    return;
  }

  const globalAlert = document.getElementById("admin-pdf-global-alert");

  try {
    const response = await fetch("/api/delete-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      delete window.selectedAdminPdfFiles[category];

      if (globalAlert) {
        globalAlert.style.display = "block";
        globalAlert.style.backgroundColor = "#fff6ed";
        globalAlert.style.color = "#c45e00";
        globalAlert.style.border = "1px solid #ffd4a8";
        globalAlert.innerHTML = `Document pour <strong>${category}</strong> supprimé de la base de données interne.`;
        setTimeout(() => { globalAlert.style.display = "none"; }, 5000);
      }

      await window.loadAdminInformations();
    } else {
      alert("Erreur lors de la suppression : " + (result.error || "Erreur serveur"));
    }
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la communication avec le serveur.");
  }
};
