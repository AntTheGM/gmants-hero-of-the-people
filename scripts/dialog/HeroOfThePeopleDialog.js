import { MODULE_ID } from "../const.js";
import { getPlayerCharacter } from "../utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Tag definitions for Hero Hype checkboxes */
const HYPE_TAGS = [
  { key: "roleplay", icon: "fas fa-theater-masks", label: "HERO_OF_THE_PEOPLE.Hype.Roleplay" },
  { key: "tactical", icon: "fas fa-chess-knight", label: "HERO_OF_THE_PEOPLE.Hype.Tactical" },
  { key: "puzzle", icon: "fas fa-puzzle-piece", label: "HERO_OF_THE_PEOPLE.Hype.Puzzle" },
  { key: "helper", icon: "fas fa-hands-helping", label: "HERO_OF_THE_PEOPLE.Hype.Helper" },
];

/**
 * Main voting dialog shown to all clients during a hero vote.
 * Also used in "hype-only" mode when a player opens it via the macro outside of a vote.
 */
export class HeroOfThePeopleDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-dialog`,
    classes: [MODULE_ID],
    window: {
      title: "HERO_OF_THE_PEOPLE.Dialog.Title",
      icon: "fas fa-medal",
      resizable: false,
    },
    position: { width: 400, height: "auto" },
    actions: {
      submit: HeroOfThePeopleDialog.#onSubmit,
      submitHype: HeroOfThePeopleDialog.#onSubmitHype,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/main-dialog.hbs`,
    },
  };

  /** @type {string|null} Selected user ID or "random" */
  #selectedTarget = "random";

  /** @type {Function|null} Called with (voterId, targetId, hypeData) when vote is cast */
  #onVoteCallback;

  /** @type {Function|null} Called with hypeData when hype-only is submitted */
  #onHypeCallback;

  /** @type {number|null} Countdown interval ID */
  #countdownInterval = null;

  /** @type {number} Seconds remaining */
  #secondsLeft = 60;

  /** @type {boolean} Whether the vote has been submitted */
  #submitted = false;

  /** @type {boolean} Whether this is hype-only mode (no active vote) */
  #hypeOnly = false;

  /**
   * @param {object} options
   * @param {Function} [options.onVote] - Called with (voterId, targetId, hypeData) on submit
   * @param {Function} [options.onHype] - Called with hypeData in hype-only mode
   * @param {boolean} [options.hypeOnly=false] - If true, only show the hype section (no voting)
   */
  constructor({ onVote, onHype, hypeOnly = false } = {}) {
    super();
    this.#onVoteCallback = onVote;
    this.#onHypeCallback = onHype;
    this.#hypeOnly = hypeOnly;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sessionWinners = game.settings.get(MODULE_ID, "sessionWinners");
    const currentUserId = game.user.id;

    context.hypeOnly = this.#hypeOnly;

    // Build candidate list: non-GM users with characters, excluding self
    context.players = game.users
      .filter((u) => !u.isGM && u.active && getPlayerCharacter(u) && u.id !== currentUserId)
      .map((u) => {
        const actor = getPlayerCharacter(u);
        const isSessionWinner = sessionWinners.includes(u.id);
        const isMaxed = this.#isAtMax(actor);
        const greyed = isSessionWinner || isMaxed;
        let reason = "";
        if (isSessionWinner) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AlreadyWon");
        else if (isMaxed) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AtMax");

        return {
          userId: u.id,
          playerName: u.name,
          characterName: actor.name,
          img: actor.img,
          greyed,
          reason,
        };
      });

    // Hype tags
    context.hypeTags = HYPE_TAGS.map((t) => ({
      ...t,
      localizedLabel: game.i18n.localize(t.label),
    }));

    // Hype target list: all non-GM users with characters (including self for hype)
    context.hypeTargets = game.users
      .filter((u) => !u.isGM && u.active && getPlayerCharacter(u))
      .map((u) => {
        const pc = getPlayerCharacter(u);
        return { userId: u.id, name: `${pc.name} (${u.name})` };
      });

    context.secondsLeft = this.#secondsLeft;
    context.submitted = this.#submitted;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
    if (!this.#hypeOnly) {
      this.#bindPlayerClicks();
      this.#startCountdown();
    }
    this.#restorePosition();

    // Mark the "random" entry as selected by default
    if (!this.#hypeOnly) {
      const randomEntry = this.element.querySelector('[data-user-id="random"]');
      if (randomEntry) randomEntry.classList.add("selected");
    }
  }

  /** Check if an actor is at max hero points (PF2e) or already has inspiration (5e). */
  #isAtMax(actor) {
    const systemId = game.system.id;
    if (systemId === "pf2e") {
      const hp = actor.system?.resources?.heroPoints;
      return hp && hp.value >= hp.max;
    } else if (systemId === "dnd5e") {
      return !!actor.system?.attributes?.inspiration;
    }
    return false;
  }

  #bindPlayerClicks() {
    const entries = this.element.querySelectorAll(".hero-of-the-people-player-entry:not(.greyed-out)");
    for (const entry of entries) {
      entry.addEventListener("click", () => {
        if (this.#submitted) return;
        this.element.querySelectorAll(".hero-of-the-people-player-entry").forEach((e) =>
          e.classList.remove("selected")
        );
        entry.classList.add("selected");
        this.#selectedTarget = entry.dataset.userId;
      });
    }
  }

  #startCountdown() {
    if (this.#submitted) return;
    if (this.#countdownInterval) clearInterval(this.#countdownInterval);

    const timerEl = this.element.querySelector(".hero-of-the-people-countdown");
    if (!timerEl) return;

    this.#countdownInterval = setInterval(() => {
      this.#secondsLeft--;
      if (timerEl) timerEl.textContent = `${this.#secondsLeft}s`;
      if (this.#secondsLeft <= 0) {
        clearInterval(this.#countdownInterval);
        this.#countdownInterval = null;
        if (!this.#submitted) this.#castVote();
      }
    }, 1000);
  }

  /** Gather hype data from the form. */
  #gatherHypeData() {
    const tags = [];
    for (const tag of HYPE_TAGS) {
      const cb = this.element.querySelector(`input[name="hype-${tag.key}"]`);
      if (cb?.checked) tags.push(tag.key);
    }
    const message = this.element.querySelector('textarea[name="hype-message"]')?.value?.trim() ?? "";
    const targetSelect = this.element.querySelector('select[name="hype-target"]');
    const targetId = targetSelect?.value ?? "";

    if (tags.length === 0 && !message) return null;
    return { targetId, tags, message };
  }

  #castVote() {
    if (this.#submitted) return;
    this.#submitted = true;
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }

    const voterId = game.user.id;
    const targetId = this.#selectedTarget || "random";
    const hypeData = this.#gatherHypeData();

    if (this.#onVoteCallback) {
      this.#onVoteCallback(voterId, targetId, hypeData);
    }

    this.close();
  }

  static #onSubmit(event, target) {
    this.#castVote();
  }

  static #onSubmitHype(event, target) {
    const hypeData = this.#gatherHypeData();
    if (!hypeData) {
      ui.notifications.warn(game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Empty"));
      return;
    }
    if (this.#onHypeCallback) {
      this.#onHypeCallback(hypeData);
    }
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Sent"));
    this.close();
  }

  async close(options) {
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }
    const pos = this.position;
    if (pos?.left != null && pos?.top != null) {
      game.settings.set(MODULE_ID, "dialogPosition", { left: pos.left, top: pos.top });
    }
    return super.close(options);
  }

  #restorePosition() {
    const saved = game.settings.get(MODULE_ID, "dialogPosition");
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
