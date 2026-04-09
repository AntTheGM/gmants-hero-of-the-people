import { MODULE_ID } from "../const.js";
import { getPlayerCharacterActors, getOwnerName, isAtMax } from "../utils.js";
import { getExcludedActorNames } from "../settings.js";
import { getRandomPhrase } from "./spotlight-phrases.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Spotlight Roulette — spins through character portraits and lands on a random winner.
 * The winner gets a golden glow animation, a fun chat message, and inspiration/hero point.
 */
export class SpotlightDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-spotlight`,
    classes: [MODULE_ID],
    window: {
      title: "HERO_OF_THE_PEOPLE.Spotlight.Title",
      icon: "fas fa-star",
      resizable: false,
    },
    position: { width: 500, height: "auto" },
    actions: {
      spin: SpotlightDialog.#onSpin,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/spotlight-dialog.hbs`,
    },
  };

  /** @type {Function|null} Called with (actorId) when the GM awards the winner */
  #onWinner;

  /** @type {Function|null} Called with (winnerId) when the GM starts the spin (to broadcast) */
  #onSpinCallback;

  /** @type {boolean} Whether the spin is in progress or complete */
  #spinning = false;

  /** @type {boolean} Whether a winner has been selected */
  #done = false;

  /** @type {object[]} Cached candidate list */
  #candidates = [];

  /** @type {boolean} Viewer mode — no spin button, waits for startSpin() */
  #isViewer = false;

  /**
   * @param {object} options
   * @param {Function} [options.onWinner] - Called with the winning actor's ID (GM only)
   * @param {Function} [options.onSpin] - Called with winnerId when GM starts spin (to broadcast)
   * @param {boolean} [options.isViewer] - Viewer mode (no spin button, waits for startSpin call)
   */
  constructor({ onWinner, onSpin, isViewer } = {}) {
    super();
    this.#onWinner = onWinner || null;
    this.#onSpinCallback = onSpin || null;
    this.#isViewer = !!isViewer;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const excluded = getExcludedActorNames();
    this.#candidates = getPlayerCharacterActors()
      .filter((a) => !excluded.has(a.name.toLowerCase()))
      .map((a) => ({
        actorId: a.id,
        characterName: a.name,
        playerName: getOwnerName(a),
        img: a.img,
        maxed: isAtMax(a),
      }));
    context.candidates = this.#candidates;
    context.isViewer = this.#isViewer;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
    this.#restorePosition();
  }

  /**
   * Public method to start the spin from outside (used by socket handler).
   * @param {string} winnerId - The actor ID the spin will land on
   */
  startSpin(winnerId) {
    this.#runSpin(winnerId);
  }

  /**
   * GM clicks the spin button.
   */
  static #onSpin(event, target) {
    if (this.#spinning || this.#done || this.#isViewer) return;

    // Filter eligible candidates
    const eligible = this.#candidates.filter((c) => !c.maxed);
    if (eligible.length === 0) {
      ui.notifications.warn(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.NoEligible"));
      return;
    }

    // Check the GM override dropdown
    const overrideSelect = this.element.querySelector('select[name="spotlight-override"]');
    const overrideValue = overrideSelect?.value ?? "random";

    let winner;
    if (overrideValue !== "random") {
      winner = this.#candidates.find((c) => c.actorId === overrideValue);
    }
    if (!winner) {
      winner = eligible[Math.floor(Math.random() * eligible.length)];
    }

    // Broadcast to players before starting local animation
    if (this.#onSpinCallback) this.#onSpinCallback(winner.actorId);

    this.#runSpin(winner.actorId);
  }

  /**
   * Run the roulette spin animation for a given winner.
   * Used by both GM (after clicking spin) and viewers (auto-started).
   * @param {string} winnerId - The actor ID that the spin will land on
   */
  #runSpin(winnerId) {
    if (this.#spinning || this.#done) return;
    if (this.#candidates.length === 0) return;

    const winnerIdx = this.#candidates.findIndex((c) => c.actorId === winnerId);
    if (winnerIdx === -1) return;
    const winner = this.#candidates[winnerIdx];

    this.#spinning = true;

    // Disable/update the spin button (may not exist in viewer mode)
    const btn = this.element.querySelector('[data-action="spin"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.Spinning")}`;
    }

    const cards = this.element.querySelectorAll(".gmants-hero-of-the-people-spotlight-card");
    if (cards.length === 0) return;

    // Animation parameters
    const totalCycles = this.#candidates.length * 3 + winnerIdx; // ~3 full loops + land on winner
    const baseInterval = 60; // fastest speed (ms)
    const maxInterval = 400; // slowest speed before final stop
    let step = 0;

    const highlightStep = () => {
      // Clear all highlights
      cards.forEach((c) => c.classList.remove("spotlight-active", "spotlight-passing"));

      const currentIdx = step % this.#candidates.length;
      cards[currentIdx].classList.add("spotlight-active");

      // Add a "passing" flash to the previous card
      const prevIdx = (currentIdx - 1 + this.#candidates.length) % this.#candidates.length;
      cards[prevIdx].classList.add("spotlight-passing");

      step++;

      if (step > totalCycles) {
        // Animation complete — reveal the winner
        this.#spinning = false;
        this.#done = true;
        this.#revealWinner(winner, cards[winnerIdx]);
        return;
      }

      // Ease-out deceleration: speed slows as we approach the end
      const progress = step / totalCycles;
      const eased = progress * progress * progress;
      const interval = baseInterval + (maxInterval - baseInterval) * eased;

      setTimeout(highlightStep, interval);
    };

    highlightStep();
  }

  /**
   * Show the winner with a dramatic reveal animation.
   */
  #revealWinner(winner, winnerCard) {
    // Flash the winner card with the golden glow
    winnerCard.classList.add("spotlight-winner");

    // After a brief pause, show the big reveal
    setTimeout(() => {
      const stage = this.element.querySelector(".gmants-hero-of-the-people-spotlight-stage");
      const instruction = this.element.querySelector(".gmants-hero-of-the-people-spotlight-instruction");
      const reveal = this.element.querySelector(".gmants-hero-of-the-people-spotlight-reveal");
      const btn = this.element.querySelector('[data-action="spin"]');

      // Fade out the carousel
      if (stage) stage.classList.add("spotlight-fade-out");
      if (instruction) instruction.classList.add("spotlight-fade-out");

      setTimeout(() => {
        // Hide carousel, show reveal
        if (stage) stage.style.display = "none";
        if (instruction) instruction.style.display = "none";
        if (reveal) {
          reveal.style.display = "";
          const portrait = reveal.querySelector(".gmants-hero-of-the-people-spotlight-winner-portrait");
          const nameEl = reveal.querySelector(".gmants-hero-of-the-people-spotlight-winner-name");
          const phraseEl = reveal.querySelector(".gmants-hero-of-the-people-spotlight-winner-phrase");
          if (portrait) {
            portrait.src = winner.img;
            portrait.alt = winner.characterName;
          }
          if (nameEl) nameEl.textContent = winner.characterName;
          if (phraseEl) phraseEl.textContent = getRandomPhrase(winner.characterName);

          // Trigger the entrance animation
          requestAnimationFrame(() => reveal.classList.add("spotlight-reveal-active"));
        }

        if (this.#isViewer) {
          // Viewers: hide button, auto-close after a delay
          if (btn) btn.style.display = "none";
          setTimeout(() => this.close(), 5000);
        } else {
          // GM: show the "Award & Close" button
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-trophy"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.Award")}`;
            btn.dataset.action = "award";
          }
          btn?.addEventListener("click", () => {
            if (this.#onWinner) this.#onWinner(winner.actorId);
            this.close();
          }, { once: true });
        }
      }, 400);
    }, 800);
  }

  async close(options) {
    const pos = this.position;
    if (pos?.left != null && pos?.top != null) {
      await game.settings.set(MODULE_ID, "spotlightPosition", { left: pos.left, top: pos.top });
    }
    return super.close(options);
  }

  #restorePosition() {
    const saved = game.settings.get(MODULE_ID, "spotlightPosition");
    if (saved?.left != null && saved?.top != null) {
      this.setPosition({ left: saved.left, top: saved.top });
    }
  }

  #injectBranding() {
    const header = this.element.querySelector(".window-header");
    if (!header || header.querySelector(`.${MODULE_ID}-branding`)) return;
    const brand = document.createElement("a");
    brand.className = `${MODULE_ID}-branding`;
    brand.textContent = "VTTools by GM Ant";
    brand.href = "https://roleplayr.com/gmant";
    brand.target = "_blank";
    brand.rel = "noopener";
    header.insertBefore(brand, header.lastElementChild);
  }
}
