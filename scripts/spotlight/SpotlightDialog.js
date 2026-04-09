import { MODULE_ID } from "../const.js";
import { getPlayerCharacterActors, getOwnerName } from "../utils.js";
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

  /** @type {Function} Called with (actorId) when the spin completes */
  #onWinner;

  /** @type {boolean} Whether the spin is in progress or complete */
  #spinning = false;

  /** @type {boolean} Whether a winner has been selected */
  #done = false;

  /** @type {object[]} Cached candidate list */
  #candidates = [];

  /**
   * @param {object} options
   * @param {Function} options.onWinner - Called with the winning actor's ID
   */
  constructor({ onWinner } = {}) {
    super();
    this.#onWinner = onWinner;
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
      }));
    context.candidates = this.#candidates;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
    this.#restorePosition();
  }

  /**
   * Run the roulette spin animation.
   * Cycles through portraits with decelerating speed, then reveals the winner.
   */
  static #onSpin(event, target) {
    if (this.#spinning || this.#done) return;
    if (this.#candidates.length === 0) {
      ui.notifications.warn(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.NoEligible"));
      return;
    }

    this.#spinning = true;

    // Disable the spin button
    const btn = this.element.querySelector('[data-action="spin"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.Spinning")}`;
    }

    // Pick the winner randomly ahead of time
    const winnerIdx = Math.floor(Math.random() * this.#candidates.length);
    const winner = this.#candidates[winnerIdx];

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
      // Use cubic easing for a natural "wheel of fortune" slowdown
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

        // Change button to "Award" / close
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fas fa-trophy"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.Award")}`;
          btn.dataset.action = "award";
        }

        // Rebind the button for the award action
        btn?.addEventListener("click", () => {
          if (this.#onWinner) this.#onWinner(winner.actorId);
          this.close();
        }, { once: true });
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
