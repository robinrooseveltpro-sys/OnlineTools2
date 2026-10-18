/* =========================================================
   ONLINE TOOLS & CONVERTERS
   Main script for onlinetoolsandconverters.cc
   File: /script.js
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     Common helpers
     --------------------------------------------------------- */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const normalizeText = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  function formatNumber(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(value)) return "—";

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: clamp(
        maximumFractionDigits,
        0,
        10
      ),
    }).format(value);
  }

  function formatBytes(bytes, decimalPlaces = 2) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Invalid size";
    }

    if (bytes === 0) return "0 Bytes";

    const units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1000)),
      units.length - 1
    );

    const result = bytes / Math.pow(1000, exponent);

    return (
      formatNumber(result, decimalPlaces) +
      " " +
      units[exponent]
    );
  }

  function formatBinaryBytes(bytes, decimalPlaces = 2) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Invalid size";
    }

    if (bytes === 0) return "0 Bytes";

    const units = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB"];
    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const result = bytes / Math.pow(1024, exponent);

    return (
      formatNumber(result, decimalPlaces) +
      " " +
      units[exponent]
    );
  }

  function debounce(callback, delay = 200) {
    let timerId = null;

    return function (...args) {
      window.clearTimeout(timerId);

      timerId = window.setTimeout(() => {
        callback.apply(this, args);
      }, delay);
    };
  }

  function setText(target, value) {
    const element =
      typeof target === "string" ? $(target) : target;

    if (!element) return;

    element.textContent = String(value ?? "");
  }

  function setStatus(target, message, type = "info") {
    const element =
      typeof target === "string" ? $(target) : target;

    if (!element) return;

    const classes = {
      info: "alert-info",
      success: "alert-ok",
      error: "alert-error",
    };

    element.classList.remove(
      "alert-info",
      "alert-ok",
      "alert-error"
    );

    element.classList.add(classes[type] || classes.info);
    element.textContent = String(message ?? "");
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
  }


  /* ---------------------------------------------------------
     Clipboard
     --------------------------------------------------------- */

  async function copyText(value) {
    const text = String(value ?? "");

    if (!text) {
      throw new Error("There is no content to copy.");
    }

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Try the compatibility fallback.
      }
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");

    Object.assign(textarea.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      opacity: "0",
    });

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    } finally {
      textarea.remove();
    }

    if (!copied) {
      throw new Error(
        "Copy was blocked. Select the output and copy it manually."
      );
    }

    return true;
  }


  /* ---------------------------------------------------------
     Downloads
     --------------------------------------------------------- */

  function downloadBlob(blob, filename = "download.txt") {
    if (!(blob instanceof Blob)) {
      throw new TypeError("A valid Blob is required.");
    }

    const safeFilename = String(filename || "download.txt")
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
      .slice(0, 180);

    const objectURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectURL;
    link.download = safeFilename;
    link.hidden = true;

    document.body.appendChild(link);

    try {
      link.click();
    } catch (error) {
      URL.revokeObjectURL(objectURL);
      link.remove();
      throw error;
    }

    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(objectURL);
    }, 2000);
  }

  function downloadText(
    text,
    filename = "download.txt",
    mimeType = "text/plain;charset=utf-8"
  ) {
    const blob = new Blob([String(text ?? "")], {
      type: mimeType,
    });

    downloadBlob(blob, filename);
  }


  /* ---------------------------------------------------------
     Current year
     --------------------------------------------------------- */

  function initializeYear() {
    const year = String(new Date().getFullYear());

    const selectors = [
      "[data-current-year]",
      "#current-year",
      "#year",
      "#ir-year",
      "#chYear",
    ];

    const processed = new Set();

    selectors.forEach((selector) => {
      $$(selector).forEach((element) => {
        if (processed.has(element)) return;

        processed.add(element);
        element.textContent = year;
      });
    });
  }


  /* ---------------------------------------------------------
     Responsive navigation
     Supports:
       .nav-toggle + .primary-nav
       .menu-toggle + .main-nav
     --------------------------------------------------------- */

  function initializeNavigation() {
    const pairs = [
      {
        buttonSelector: ".nav-toggle",
        navSelector: ".primary-nav",
      },
      {
        buttonSelector: ".menu-toggle",
        navSelector: ".main-nav",
      },
    ];

    const initialized = new WeakSet();
    const mobileQuery = window.matchMedia("(max-width: 820px)");

    pairs.forEach(({ buttonSelector, navSelector }) => {
      $$(buttonSelector).forEach((button) => {
        if (initialized.has(button)) return;

        const header = button.closest("header") || document;
        const nav =
          $(navSelector, header) ||
          $(navSelector, document);

        if (!nav) return;

        initialized.add(button);

        const isExpanded = () =>
          button.getAttribute("aria-expanded") === "true";

        function closeMenu(returnFocus = false) {
          nav.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");

          if (returnFocus) {
            button.focus();
          }
        }

        function openMenu() {
          nav.classList.add("is-open");
          button.setAttribute("aria-expanded", "true");
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();

          if (isExpanded()) {
            closeMenu();
          } else {
            openMenu();
          }
        });

        nav.addEventListener("click", (event) => {
          const link = event.target.closest("a");

          if (link) {
            closeMenu();
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isExpanded()) {
            closeMenu(true);
          }
        });

        document.addEventListener("click", (event) => {
          if (!isExpanded()) return;

          if (
            nav.contains(event.target) ||
            button.contains(event.target)
          ) {
            return;
          }

          closeMenu();
        });

        function handleBreakpointChange(event) {
          if (!event.matches) {
            closeMenu();
          }
        }

        if (typeof mobileQuery.addEventListener === "function") {
          mobileQuery.addEventListener(
            "change",
            handleBreakpointChange
          );
        } else if (typeof mobileQuery.addListener === "function") {
          mobileQuery.addListener(handleBreakpointChange);
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Homepage directory
     Powers:
       #toolSearch
       #clearToolSearch
       [data-filter]
       [data-tool-card]
       #toolCount
       #toolSearchStatus
       #noToolsFound
       #resetToolFilters
       [data-hero-category]
     --------------------------------------------------------- */

  function initializeToolDirectory() {
    const grid = $("#toolGrid");
    const searchInput = $("#toolSearch");

    // Tool pages don't have this directory, so exit safely.
    if (!grid || !searchInput) return;

    const cards = $$("[data-tool-card]", grid);
    const filterButtons = $$(".otc-filter[data-filter]");
    const categoryCards = $$(".otc-category-card[data-filter]");
    const heroShortcuts = $$("[data-hero-category]");

    const clearButton = $("#clearToolSearch");
    const status = $("#toolSearchStatus");
    const totalCount = $("#toolCount");
    const noResults = $("#noToolsFound");
    const resetButton = $("#resetToolFilters");

    let activeCategory = "all";

    // Cache searchable text to keep repeated searches responsive.
    const searchableCards = cards.map((card) => ({
      card,
      category: card.dataset.category || "",
      text: normalizeText(
        [
          card.textContent,
          card.dataset.search || "",
          card.getAttribute("aria-label") || "",
        ].join(" ")
      ),
    }));

    function updateActiveButtons() {
      filterButtons.forEach((button) => {
        const active =
          (button.dataset.filter || "all") === activeCategory;

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      categoryCards.forEach((button) => {
        const active =
          button.dataset.filter === activeCategory &&
          activeCategory !== "all";

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function updateCategoryCounts() {
      const counts = {
        all: searchableCards.length,
      };

      searchableCards.forEach(({ category }) => {
        counts[category] = (counts[category] || 0) + 1;
      });

      $$("[data-count]").forEach((element) => {
        const key = element.dataset.count || "all";
        element.textContent = String(counts[key] || 0);
      });

      if (totalCount) {
        totalCount.textContent = String(searchableCards.length);
      }
    }

    function updateDirectory() {
      const rawQuery = normalizeText(searchInput.value);
      const terms = rawQuery
        .split(/\s+/)
        .filter(Boolean);

      let visibleCount = 0;

      searchableCards.forEach(({ card, category, text }) => {
        const matchesCategory =
          activeCategory === "all" ||
          category === activeCategory;

        // Every search term must match somewhere in the card.
        const matchesSearch =
          terms.length === 0 ||
          terms.every((term) => text.includes(term));

        const visible = matchesCategory && matchesSearch;

        card.hidden = !visible;

        if (visible) visibleCount += 1;
      });

      if (noResults) {
        noResults.hidden = visibleCount > 0;
      }

      if (status) {
        if (rawQuery && activeCategory !== "all") {
          status.textContent =
            `Showing ${visibleCount} of ${cards.length} tools ` +
            "matching the search and category.";
        } else if (rawQuery) {
          status.textContent =
            `Showing ${visibleCount} of ${cards.length} tools matching your search.`;
        } else if (activeCategory !== "all") {
          const activeButton = filterButtons.find(
            (button) => button.dataset.filter === activeCategory
          );

          const categoryName = activeButton
            ? activeButton.textContent.trim().replace(/\s+\d+\s*$/, "")
            : "selected category";

          status.textContent =
            `Showing ${visibleCount} tools in ${categoryName}.`;
        } else {
          status.textContent =
            `Showing all ${cards.length} tools.`;
        }
      }

      updateActiveButtons();
    }

    function chooseCategory(category) {
      const exists =
        category === "all" ||
        filterButtons.some(
          (button) => button.dataset.filter === category
        );

      if (!exists) return;

      activeCategory = category;
      updateDirectory();
    }

    function resetDirectory({ focusSearch = false } = {}) {
      searchInput.value = "";
      activeCategory = "all";
      updateDirectory();

      if (focusSearch) {
        searchInput.focus();
      }
    }

    searchInput.addEventListener(
      "input",
      debounce(updateDirectory, 80)
    );

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        updateDirectory();
        searchInput.focus();
      });
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        chooseCategory(button.dataset.filter || "all");
      });
    });

    categoryCards.forEach((button) => {
      button.addEventListener("click", () => {
        chooseCategory(button.dataset.filter || "all");

        // Let the filter apply before moving to the directory.
        const directory = $("#tools");

        if (directory) {
          directory.scrollIntoView({
            behavior: window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches
              ? "auto"
              : "smooth",
            block: "start",
          });
        }
      });
    });

    heroShortcuts.forEach((shortcut) => {
      shortcut.addEventListener("click", () => {
        const category = shortcut.dataset.heroCategory;

        if (category) {
          chooseCategory(category);
        }
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        resetDirectory({ focusSearch: true });
      });
    }

    // Allow Escape to clear an active search.
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && searchInput.value) {
        searchInput.value = "";
        updateDirectory();
      }
    });

    updateCategoryCounts();
    updateDirectory();
  }


  /* ---------------------------------------------------------
     Optional generic copy buttons

     Example:
     <button data-copy-target="#generatedText"
             data-copy-status="#copyStatus">
       Copy
     </button>

     Target can be an input, textarea, or ordinary text element.
     --------------------------------------------------------- */

  function initializeCopyButtons() {
    $$("[data-copy-target]").forEach((button) => {
      if (button.dataset.otcCopyBound === "true") return;

      button.dataset.otcCopyBound = "true";

      button.addEventListener("click", async () => {
        const selector = button.dataset.copyTarget;
        let target = null;

        try {
          target = $(selector);
        } catch (error) {
          target = null;
        }

        const statusTarget = button.dataset.copyStatus
          ? $(button.dataset.copyStatus)
          : null;

        if (!target) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              "The copy target could not be found.",
              "error"
            );
          }
          return;
        }

        const text =
          "value" in target
            ? target.value
            : target.innerText || target.textContent || "";

        const oldLabel = button.textContent;

        try {
          await copyText(text);

          if (statusTarget) {
            setStatus(statusTarget, "Copied successfully.", "success");
          } else {
            button.textContent = "Copied!";

            window.setTimeout(() => {
              button.textContent = oldLabel;
            }, 1400);
          }
        } catch (error) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              error.message || "Copy failed.",
              "error"
            );
          }
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Optional generic download buttons

     Example:
     <button data-download-target="#csvOutput"
             data-download-filename="data.csv"
             data-download-mime="text/csv;charset=utf-8">
       Download CSV
     </button>
     --------------------------------------------------------- */

  function initializeDownloadButtons() {
    $$("[data-download-target]").forEach((button) => {
      if (button.dataset.otcDownloadBound === "true") return;

      button.dataset.otcDownloadBound = "true";

      button.addEventListener("click", () => {
        let target = null;

        try {
          target = $(button.dataset.downloadTarget);
        } catch (error) {
          target = null;
        }

        if (!target) return;

        const text =
          "value" in target
            ? target.value
            : target.innerText || target.textContent || "";

        const filename =
          button.dataset.downloadFilename || "download.txt";

        const mimeType =
          button.dataset.downloadMime ||
          "text/plain;charset=utf-8";

        const statusTarget = button.dataset.downloadStatus
          ? $(button.dataset.downloadStatus)
          : null;

        try {
          downloadText(text, filename, mimeType);

          if (statusTarget) {
            setStatus(statusTarget, "Download started.", "success");
          }
        } catch (error) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              error.message || "Download failed.",
              "error"
            );
          }
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Public helpers for tool-page scripts

     Example:
     OTC.copyText("Text to copy");
     OTC.downloadText("Hello", "example.txt");
     OTC.formatBytes(1500000);
     --------------------------------------------------------- */

  window.OTC = Object.freeze({
    $,
    $$,
    normalizeText,
    clamp,
    debounce,
    formatNumber,
    formatBytes,
    formatBinaryBytes,
    copyText,
    downloadBlob,
    downloadText,
    setText,
    setStatus,
  });


  /* ---------------------------------------------------------
     Initialize website behavior
     --------------------------------------------------------- */

  function initializeWebsite() {
    initializeYear();
    initializeNavigation();
    initializeToolDirectory();
    initializeCopyButtons();
    initializeDownloadButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeWebsite,
      { once: true }
    );
  } else {
    initializeWebsite();
  }
})();
