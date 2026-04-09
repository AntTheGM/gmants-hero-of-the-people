import { MODULE_ID } from "../const.js";
import { getAllSpotlightQuotes } from "../spotlight/spotlight-phrases.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings dialog for managing spotlight roulette quotes.
 */
export class SpotlightQuoteConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-spotlight-quote-config`,
    classes: [MODULE_ID, `${MODULE_ID}-quote-config`],
    window: {
      title: "HERO_OF_THE_PEOPLE.Settings.SpotlightQuoteConfig",
      icon: "fas fa-star",
      resizable: true,
    },
    position: { width: 550, height: 500 },
    actions: {
      deleteQuote: SpotlightQuoteConfig.#onDeleteQuote,
      restoreQuote: SpotlightQuoteConfig.#onRestoreQuote,
      addQuote: SpotlightQuoteConfig.#onAddQuote,
      removeQuote: SpotlightQuoteConfig.#onRemoveQuote,
      resetAll: SpotlightQuoteConfig.#onResetAll,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/spotlight-quote-config.hbs`,
    },
  };

  async _prepareContext(_options) {
    const quotes = getAllSpotlightQuotes();
    return { quotes };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
  }

  /** Mark a default quote as deleted. */
  static async #onDeleteQuote(_event, target) {
    const { quoteText } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "spotlightQuoteOverrides");
    if (!overrides.deleted) overrides.deleted = [];
    if (!overrides.deleted.includes(quoteText)) {
      overrides.deleted.push(quoteText);
    }
    await game.settings.set(MODULE_ID, "spotlightQuoteOverrides", overrides);
    this.render();
  }

  /** Restore a deleted default quote. */
  static async #onRestoreQuote(_event, target) {
    const { quoteText } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "spotlightQuoteOverrides");
    overrides.deleted = (overrides.deleted ?? []).filter((t) => t !== quoteText);
    await game.settings.set(MODULE_ID, "spotlightQuoteOverrides", overrides);
    this.render();
  }

  /** Add a new custom quote. */
  static async #onAddQuote(_event, _target) {
    const textInput = this.element.querySelector('input[name="new-quote-text"]');
    const text = textInput?.value?.trim();
    if (!text) return;

    const overrides = game.settings.get(MODULE_ID, "spotlightQuoteOverrides");
    if (!overrides.added) overrides.added = [];
    overrides.added.push(text);
    await game.settings.set(MODULE_ID, "spotlightQuoteOverrides", overrides);
    this.render();
  }

  /** Remove a user-added custom quote. */
  static async #onRemoveQuote(_event, target) {
    const { quoteText } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "spotlightQuoteOverrides");
    overrides.added = (overrides.added ?? []).filter((t) => t !== quoteText);
    await game.settings.set(MODULE_ID, "spotlightQuoteOverrides", overrides);
    this.render();
  }

  /** Reset all quote customizations back to defaults. */
  static async #onResetAll() {
    await game.settings.set(MODULE_ID, "spotlightQuoteOverrides", { added: [], deleted: [] });
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Settings.SpotlightQuotesReset"));
    this.render();
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
