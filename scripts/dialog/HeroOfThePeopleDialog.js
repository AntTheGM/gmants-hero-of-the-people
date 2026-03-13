import { MODULE_ID } from "../const.js";
import { getPlayerCharacter, isAtMax, getPlayerCharacterActors, getOwnerName, HYPE_TAGS } from "../utils.js";
import { getExcludedActorNames } from "../settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

  /** @type {number|null} Seconds remaining (null = no timer) */
  #secondsLeft = null;

  /** @type {boolean} Whether the vote has been submitted */
  #submitted = false;

  /** @type {boolean} Whether this is hype-only mode (no active vote) */
  #hypeOnly = false;

  /**
   * @param {object} options
   * @param {Function} [options.onVote] - Called with (voterId, targetId, hypeData) on submit
   * @param {Function} [options.onHype] - Called with hypeData in hype-only mode
   * @param {boolean} [options.hypeOnly=false] - If true, only show the hype section (no voting)
   * @param {number|null} [options.timeoutSeconds=120] - Countdown seconds, or null for no timer
   */
  constructor({ onVote, onHype, hypeOnly = false, timeoutSeconds = 120 } = {}) {
    super();
    this.#onVoteCallback = onVote;
    this.#onHypeCallback = onHype;
    this.#hypeOnly = hypeOnly;
    this.#secondsLeft = timeoutSeconds;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sessionWinners = game.settings.get(MODULE_ID, "sessionWinners");

    context.hypeOnly = this.#hypeOnly;

    // Build candidate list: PC actors with player ownership, excluding own character (players only)
    const myCharacter = game.user.isGM ? null : getPlayerCharacter(game.user);
    const hideWinners = game.settings.get(MODULE_ID, "hideSessionWinners");
    const excluded = getExcludedActorNames();
    context.players = getPlayerCharacterActors()
      .filter((a) => !excluded.has(a.name.toLowerCase()))
      .filter((a) => !(myCharacter && a.id === myCharacter.id))
      .filter((a) => !(hideWinners && sessionWinners.includes(a.id)))
      .map((a) => {
        const isSessionWinner = sessionWinners.includes(a.id);
        const isMaxed = isAtMax(a);
        const greyed = isSessionWinner || isMaxed;
        let reason = "";
        if (isMaxed) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AtMax");
        else if (isSessionWinner) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AlreadyWon");

        return {
          actorId: a.id,
          playerName: getOwnerName(a),
          characterName: a.name,
          img: a.img,
          greyed,
          reason,
        };
      });

    // Hype tags
    context.hypeTags = HYPE_TAGS.map((t) => ({
      ...t,
      localizedLabel: game.i18n.localize(t.label),
    }));

    // Hype target list: all PC actors with player ownership (excluding excluded actors)
    context.hypeTargets = getPlayerCharacterActors().filter((a) => !excluded.has(a.name.toLowerCase())).map((a) => {
      const owner = getOwnerName(a);
      return { actorId: a.id, name: owner ? `${a.name} (${owner})` : a.name };
    });

    context.secondsLeft = this.#secondsLeft;
    context.hasTimer = this.#secondsLeft != null;
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
      const randomEntry = this.element.querySelector('[data-actor-id="random"]');
      if (randomEntry) randomEntry.classList.add("selected");
    }
  }

  #bindPlayerClicks() {
    const entries = this.element.querySelectorAll(".hero-of-the-people-player-entry:not(.greyed-out)");
    const selectEntry = (entry) => {
      if (this.#submitted) return;
      this.element.querySelectorAll(".hero-of-the-people-player-entry").forEach((e) =>
        e.classList.remove("selected")
      );
      entry.classList.add("selected");
      this.#selectedTarget = entry.dataset.actorId;
    };
    for (const entry of entries) {
      entry.setAttribute("tabindex", "0");
      entry.setAttribute("role", "option");
      entry.addEventListener("click", () => selectEntry(entry));
      entry.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectEntry(entry);
        }
      });
    }
  }

  #startCountdown() {
    if (this.#submitted || this.#secondsLeft == null) return;
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
      await game.settings.set(MODULE_ID, "dialogPosition", { left: pos.left, top: pos.top });
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
