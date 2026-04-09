import { MODULE_ID } from "../const.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Small GM-only dialog that prompts to initiate a hero vote or snooze.
 * Features two collapsible cards: Random Hero (spotlight) and Initiate Vote.
 */
export class ReminderDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-reminder`,
    classes: [MODULE_ID],
    window: {
      title: "HERO_OF_THE_PEOPLE.Dialog.Title",
      icon: "fas fa-medal",
      resizable: false,
    },
    position: { width: 380, height: "auto" },
    actions: {
      spotlight: ReminderDialog.#onSpotlight,
      hideSpotlight: ReminderDialog.#onHideSpotlight,
      spotlightFromAdvanced: ReminderDialog.#onSpotlightFromAdvanced,
      initiate: ReminderDialog.#onInitiate,
      snooze1: ReminderDialog.#onSnooze1,
      snooze5: ReminderDialog.#onSnooze5,
      snooze10: ReminderDialog.#onSnooze10,
      snoozeUntil: ReminderDialog.#onSnoozeUntil,
      skipSession: ReminderDialog.#onSkipSession,
      clearHistory: ReminderDialog.#onClearHistory,
      resetPoints: ReminderDialog.#onResetPoints,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/reminder-dialog.hbs`,
    },
  };

  /** @type {Function} */
  #onInitiateCallback;

  /** @type {Function} */
  #onSpotlightCallback;

  /** @type {Function} */
  #onSnoozeCallback;

  /** @type {Function} */
  #onSkipCallback;

  /** @type {string} */
  #elapsed;

  /** @type {boolean} */
  #hasVoted;

  /** @type {string|null} */
  #nextFireTime;

  /**
   * @param {object} callbacks
   * @param {Function} callbacks.onInitiate - Called when GM clicks "Initiate Vote"
   * @param {Function} callbacks.onSpotlight - Called when GM clicks "Random Hero"
   * @param {Function} callbacks.onSnooze - Called with minutes when GM snoozes
   * @param {Function} callbacks.onSkip - Called when GM skips rest of session
   * @param {string} [callbacks.elapsed] - Elapsed time since last vote or session start
   * @param {boolean} [callbacks.hasVoted] - Whether a vote has occurred this session
   * @param {string|null} [callbacks.nextFireTime] - Formatted time for next vote
   */
  constructor(callbacks) {
    super();
    this.#onInitiateCallback = callbacks.onInitiate;
    this.#onSpotlightCallback = callbacks.onSpotlight;
    this.#onSnoozeCallback = callbacks.onSnooze;
    this.#onSkipCallback = callbacks.onSkip;
    this.#elapsed = callbacks.elapsed ?? "";
    this.#hasVoted = callbacks.hasVoted ?? false;
    this.#nextFireTime = callbacks.nextFireTime ?? null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.elapsed = this.#elapsed;
    context.hasVoted = this.#hasVoted;
    const winners = game.settings.get(MODULE_ID, "sessionWinners");
    context.hasWinners = winners.length > 0;
    context.winnerCount = winners.length;
    // Default the time picker to 30 minutes from now
    const defaultTime = new Date(Date.now() + 30 * 60 * 1000);
    const hh = String(defaultTime.getHours()).padStart(2, "0");
    const mm = String(defaultTime.getMinutes()).padStart(2, "0");
    context.snoozeUntilDefault = `${hh}:${mm}`;
    context.nextFireTime = this.#nextFireTime;
    // System chip for reset button
    const systemId = game.system.id;
    if (systemId === "pf2e") {
      context.systemId = "pf2e";
      context.systemLabel = "PF2e";
    } else if (systemId === "dnd5e") {
      context.systemId = "dnd5e";
      context.systemLabel = "D&D 5e";
    }
    // Spotlight state
    context.spotlightDismissed = game.settings.get(MODULE_ID, "spotlightDismissed");
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
    this.#restorePosition();
  }

  async close(options) {
    const pos = this.position;
    if (pos?.left != null && pos?.top != null) {
      await game.settings.set(MODULE_ID, "reminderPosition", { left: pos.left, top: pos.top });
    }
    return super.close(options);
  }

  #restorePosition() {
    const saved = game.settings.get(MODULE_ID, "reminderPosition");
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

  /** Dismiss the spotlight card from the top and move it into Advanced. */
  async #dismissSpotlight() {
    await game.settings.set(MODULE_ID, "spotlightDismissed", true);
    // Re-render to reflect the new layout
    this.render(true);
  }

  static #onSpotlight(event, target) {
    this.#dismissSpotlight().then(() => {
      this.#onSpotlightCallback();
      this.close();
    });
  }

  static #onHideSpotlight(event, target) {
    this.#dismissSpotlight();
  }

  static #onSpotlightFromAdvanced(event, target) {
    this.#onSpotlightCallback();
    this.close();
  }

  static #onInitiate(event, target) {
    this.#onInitiateCallback();
    this.close();
  }

  static #onSnooze1(event, target) {
    this.#onSnoozeCallback(1);
    this.close();
  }

  static #onSnooze5(event, target) {
    this.#onSnoozeCallback(5);
    this.close();
  }

  static #onSnooze10(event, target) {
    this.#onSnoozeCallback(10);
    this.close();
  }

  static #onSnoozeUntil(event, target) {
    const input = this.element.querySelector(".gmants-hero-of-the-people-snooze-time-input");
    if (!input?.value) return;
    const [hours, mins] = input.value.split(":").map(Number);
    const now = new Date();
    const target_time = new Date(now);
    target_time.setHours(hours, mins, 0, 0);
    // If the chosen time is in the past, assume tomorrow
    if (target_time <= now) target_time.setDate(target_time.getDate() + 1);
    const deltaMinutes = (target_time - now) / 60000;
    this.#onSnoozeCallback(deltaMinutes);
    this.close();
  }

  static #onSkipSession(event, target) {
    this.#onSkipCallback();
    this.close();
  }

  static async #onResetPoints(event, target) {
    const systemId = game.system.id;
    // Get unique actors from all tokens on the current scene
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.warn("No active scene.");
      return;
    }
    const seen = new Set();
    const actors = [];
    for (const token of scene.tokens) {
      const actor = token.actor;
      if (!actor || seen.has(actor.id)) continue;
      seen.add(actor.id);
      actors.push(actor);
    }
    const affected = [];

    if (systemId === "pf2e") {
      for (const actor of actors) {
        const hp = actor.system?.resources?.heroPoints;
        if (hp && hp.value !== 1) {
          await actor.update({ "system.resources.heroPoints.value": 1 });
          affected.push(actor.name);
        }
      }
      ui.notifications.info(game.i18n.format("HERO_OF_THE_PEOPLE.Status.PointsReset", { count: affected.length, names: affected.join(", ") }));
    } else if (systemId === "dnd5e") {
      for (const actor of actors) {
        // In dnd5e 5.x, system.details.race is a LocalDocumentField resolving to an Item.
        const raceRef = actor.system?.details?.race;
        const raceName = raceRef?.name
          ?? actor.items.find((i) => i.type === "race")?.name
          ?? (typeof raceRef === "string" ? raceRef : "");
        const isHuman = raceName.toLowerCase().includes("human");
        const current = !!actor.system?.attributes?.inspiration;
        if (isHuman && !current) {
          await actor.update({ "system.attributes.inspiration": true });
          affected.push(actor.name);
        } else if (!isHuman && current) {
          await actor.update({ "system.attributes.inspiration": false });
          affected.push(actor.name);
        }
      }
      ui.notifications.info(game.i18n.format("HERO_OF_THE_PEOPLE.Status.InspirationReset", { count: affected.length, names: affected.join(", ") }));
    }

    // Disable the button after reset
    const btn = this.element.querySelector('[data-action="resetPoints"]');
    if (btn) {
      btn.disabled = true;
    }
  }

  static async #onClearHistory(event, target) {
    await game.settings.set(MODULE_ID, "sessionWinners", []);
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.HistoryCleared"));
    // Disable the button after clearing
    const btn = this.element.querySelector('[data-action="clearHistory"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.HistoryCleared");
    }
  }
}
