import { MODULE_ID } from "../const.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Small GM-only dialog that prompts to initiate a hero vote or snooze.
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
    position: { width: 360, height: "auto" },
    actions: {
      initiate: ReminderDialog.#onInitiate,
      snooze1: ReminderDialog.#onSnooze1,
      snooze5: ReminderDialog.#onSnooze5,
      snooze10: ReminderDialog.#onSnooze10,
      skipSession: ReminderDialog.#onSkipSession,
      clearHistory: ReminderDialog.#onClearHistory,
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
  #onSnoozeCallback;

  /** @type {Function} */
  #onSkipCallback;

  /** @type {string} */
  #elapsed;

  /**
   * @param {object} callbacks
   * @param {Function} callbacks.onInitiate - Called when GM clicks "Initiate Vote"
   * @param {Function} callbacks.onSnooze - Called with minutes when GM snoozes
   * @param {Function} callbacks.onSkip - Called when GM skips rest of session
   * @param {string} [callbacks.elapsed] - Elapsed time since last vote
   */
  constructor(callbacks) {
    super();
    this.#onInitiateCallback = callbacks.onInitiate;
    this.#onSnoozeCallback = callbacks.onSnooze;
    this.#onSkipCallback = callbacks.onSkip;
    this.#elapsed = callbacks.elapsed ?? "";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const quoteIndex = Math.floor(Math.random() * 6) + 1;
    context.quote = game.i18n.localize(`HERO_OF_THE_PEOPLE.Quote.${quoteIndex}`);
    context.elapsed = this.#elapsed;
    const winners = game.settings.get(MODULE_ID, "sessionWinners");
    context.hasWinners = winners.length > 0;
    context.winnerCount = winners.length;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
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

  static #onSkipSession(event, target) {
    this.#onSkipCallback();
    this.close();
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
