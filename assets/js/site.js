/* TMS NeuroPilot documentation — theme toggle, search, copy buttons, scrollspy. */
(() => {
  "use strict";

  const ROOT = window.SITE_ROOT || "";
  const root = (path) => (ROOT + path).replace(/\/{2,}/g, "/");

  /* ── theme ─────────────────────────────────────────────────────────── */
  const html = document.documentElement;
  const stored = localStorage.getItem("np-theme");
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const label = (button, theme) => {
    // The label names the theme in use; the tooltip names the action.
    button.textContent = theme === "dark" ? "Dark" : "Light";
    button.title = theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme";
  };
  const apply = (theme) => {
    html.dataset.theme = theme;
    html.style.colorScheme = theme;
    localStorage.setItem("np-theme", theme);
    document.querySelectorAll(".theme").forEach((button) => label(button, theme));
  };
  html.dataset.theme = stored || (system.matches ? "dark" : "light");
  html.style.colorScheme = html.dataset.theme;
  document.querySelectorAll(".theme").forEach((button) => label(button, html.dataset.theme));
  system.addEventListener("change", (event) => {
    if (!localStorage.getItem("np-theme")) html.dataset.theme = event.matches ? "dark" : "light";
  });

  document.querySelectorAll(".theme").forEach((button) => {
    button.addEventListener("click", () => {
      apply(html.dataset.theme === "dark" ? "light" : "dark");
    });
  });

  /* ── mobile navigation ─────────────────────────────────────────────── */
  const menu = document.querySelector(".menu");
  if (menu) {
    menu.addEventListener("click", () => document.body.classList.toggle("nav-open"));
  }
  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("nav-open")) return;
    if (event.target.closest(".sidebar") || event.target.closest(".menu")) return;
    document.body.classList.remove("nav-open");
  });

  /* ── in-page scrollspy ─────────────────────────────────────────────── */
  const tocLinks = [...document.querySelectorAll(".toc a[href^='#']")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.remove("active"));
        const link = byId.get(entry.target.id);
        if (link) link.classList.add("active");
      });
    }, { rootMargin: "-70px 0px -75% 0px" });
    document.querySelectorAll("article h2[id], article h3[id]").forEach((h) => observer.observe(h));
  }

  /* ── copy buttons ──────────────────────────────────────────────────── */
  document.querySelectorAll(".code .copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".code").querySelector("code");
      const text = code ? code.innerText : "";
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
      } catch (_) {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        button.textContent = "Copied";
      }
      setTimeout(() => { button.textContent = "Copy"; }, 1400);
    });
  });

  /* ── search ────────────────────────────────────────────────────────── */
  let indexPromise = null;
  const loadIndex = () => {
    if (!indexPromise) {
      indexPromise = fetch(root("search-index.json"))
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []);
    }
    return indexPromise;
  };

  const escape = (text) => text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  // Readers search for the word they know, not the one the page uses.
  const SYNONYMS = {
    efield: ["e-field", "electric field", "e_mag", "library", "fem"],
    "e-field": ["efield", "electric field", "e_mag"],
    mep: ["emg", "evoked", "amplitude", "response"],
    emg: ["mep", "muscle", "channel"],
    placement: ["coil", "target", "position", "pose"],
    target: ["placement", "coil", "marker"],
    config: ["setting", "settings", "env", "configuration", "lab profile"],
    env: ["environment", "dotenv", "configuration"],
    robot: ["omron", "arm", "cobot", "twin"],
    run: ["session", "experiment", "start", "mapping"],
    error: ["troubleshooting", "problem", "fail", "broken"],
    install: ["setup", "environment", "conda"],
    sim: ["simulation", "simulator", "virtual"],
  };

  // One group per query word: the page may match any synonym in the group,
  // but must match every group (AND across words, OR within a word).
  const groupsOf = (terms) => terms.map(
    (term) => [term].concat(SYNONYMS[term] || []));

  const score = (page, groups) => {
    const title = page.title.toLowerCase();
    const headings = page.headings.join(" ").toLowerCase();
    const blurb = (page.blurb || "").toLowerCase();
    const body = (page.text || "").toLowerCase();
    let total = 0;
    for (const group of groups) {
      let best = 0;
      for (const term of group) {
        let value = 0;
        if (title.includes(term)) value += 10;
        if (headings.includes(term)) value += 5;
        if (blurb.includes(term)) value += 2;
        if (body.includes(term)) value += 1;
        best = Math.max(best, value);
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  };

  const render = (container, pages, terms) => {
    container.innerHTML = "";
    if (!pages.length) {
      container.innerHTML = '<p class="empty">No page matches those words.</p>';
      return;
    }
    const highlight = (text) => {
      let out = escape(text);
      terms.forEach((term) => {
        if (term.length < 2) return;
        const safe = escape(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(safe, "gi"), (match) => `<mark>${match}</mark>`);
      });
      return out;
    };
    pages.slice(0, 12).forEach((page) => {
      const link = document.createElement("a");
      link.href = root(page.url.replace(/^\.\//, ""));
      const matchHeading = page.headings.find((h) => terms.some((t) => h.toLowerCase().includes(t)));
      link.innerHTML =
        `<span class="r-section">${escape(page.section)}</span>` +
        `<div class="r-title">${highlight(page.title)}</div>` +
        (matchHeading ? `<div class="r-blurb">${highlight(matchHeading)}</div>`
                      : `<div class="r-blurb">${highlight(page.blurb || "")}</div>`);
      container.appendChild(link);
    });
  };

  const runSearch = async (input, container) => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    const words = query.split(/\s+/).filter(Boolean);
    const groups = groupsOf(words);
    const terms = groups.flat();
    const pages = await loadIndex();
    const hits = pages
      .map((page) => ({ page, value: score(page, groups) }))
      .filter((hit) => hit.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((hit) => hit.page);
    container.hidden = false;
    render(container, hits, terms);
  };

  const search = document.getElementById("search");
  const results = document.getElementById("results");
  if (search && results) {
    let timer = 0;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => runSearch(search, results), 90);
    });
    search.addEventListener("focus", () => {
      if (search.value.trim().length >= 2) results.hidden = false;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape") {
        results.hidden = true;
        search.blur();
      }
    });
    search.closest(".topbar").addEventListener("click", (event) => {
      if (event.target.closest(".search")) return;
      results.hidden = true;
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".search")) return;
      results.hidden = true;
    });
  }

  const pageSearch = document.getElementById("search-page");
  const pageResults = document.getElementById("search-page-results");
  if (pageSearch && pageResults) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) {
      pageSearch.value = params.get("q");
      runSearch(pageSearch, pageResults);
    }
    let timer = 0;
    pageSearch.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => runSearch(pageSearch, pageResults), 90);
    });
    pageSearch.focus();
  }
})();

/* ── tabs ──────────────────────────────────────────────────────────── */
document.querySelectorAll(".tabs").forEach((group) => {
  const buttons = [...group.querySelectorAll(".tablist .tab")];
  const panes = [...group.querySelectorAll(".panes .pane")];
  const select = (index) => {
    buttons.forEach((button, i) => {
      button.classList.toggle("active", i === index);
      button.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    panes.forEach((pane, i) => pane.classList.toggle("active", i === index));
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(index));
  });
});


/* ── collapsible navigation ────────────────────────────────────────── */
(() => {
  const STORE_KEY = "np-nav-open";
  const sections = [...document.querySelectorAll(".nav-section")];
  if (!sections.length) return;

  const readOpen = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || "[]"));
    } catch (_) {
      return new Set();
    }
  };
  const open = readOpen();

  const setExpanded = (section, expanded) => {
    const button = section.querySelector(".nav-toggle");
    const pages = section.querySelector(".nav-pages");
    if (!button || !pages) return;
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    pages.hidden = !expanded;
  };

  sections.forEach((section) => {
    const name = section.dataset.section || "";
    const button = section.querySelector(".nav-toggle");
    if (!button) return;
    // The server opens the section that contains this page; restore any
    // other section the reader opened earlier.
    if (open.has(name)) setExpanded(section, true);
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      setExpanded(section, expanded);
      if (expanded) open.add(name); else open.delete(name);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify([...open]));
      } catch (_) {
        /* private mode: the state simply does not persist */
      }
    });
  });
})();

/* ── clickable table rows ──────────────────────────────────────────────── */
/* Rows whose first cell links to a section (e.g. the use-case table) jump
   there when the reader clicks anywhere in the row. */
document.querySelectorAll(".table-wrap table tbody tr").forEach((row) => {
  const link = row.querySelector("td:first-child a[href^='#']");
  if (!link) return;
  row.dataset.link = link.getAttribute("href");
  row.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;  // the anchor handles itself
    window.location.hash = row.dataset.link;
  });
});
