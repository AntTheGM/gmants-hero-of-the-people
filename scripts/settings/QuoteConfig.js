import { MODULE_ID } from "../const.js";
import { getAllQuotes } from "../chat/quotes.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings dialog for managing heroic quotes shown in winner announcements.
 * Accessed via Configure Settings → Module Settings → Hero of the People → Configure Quotes.
 */
export class QuoteConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-quote-config`,
    classes: [MODULE_ID, `${MODULE_ID}-quote-config`],
    window: {
      title: "HERO_OF_THE_PEOPLE.Settings.QuoteConfig",
      icon: "fas fa-quote-left",
      resizable: true,
    },
    position: { width: 550, height: 600 },
    actions: {
      deleteQuote: QuoteConfig.#onDeleteQuote,
      restoreQuote: QuoteConfig.#onRestoreQuote,
      addQuote: QuoteConfig.#onAddQuote,
      removeQuote: QuoteConfig.#onRemoveQuote,
      resetAll: QuoteConfig.#onResetAll,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/quote-config.hbs`,
    },
  };

  async _prepareContext(_options) {
    const quotes = getAllQuotes();
    return { quotes };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
  }

  /** Mark a default quote as deleted (strike-through). */
  static async #onDeleteQuote(_event, target) {
    const { quoteText, quoteAuthor } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "quoteOverrides");
    const entry = { text: quoteText, author: quoteAuthor };

    if (!overrides.deleted) overrides.deleted = [];
    const alreadyDeleted = overrides.deleted.some((q) => q.text === quoteText && q.author === quoteAuthor);
    if (!alreadyDeleted) {
      overrides.deleted.push(entry);
    }
    await game.settings.set(MODULE_ID, "quoteOverrides", overrides);
    this.render();
  }

  /** Restore a deleted default quote. */
  static async #onRestoreQuote(_event, target) {
    const { quoteText, quoteAuthor } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "quoteOverrides");

    overrides.deleted = (overrides.deleted ?? []).filter(
      (q) => !(q.text === quoteText && q.author === quoteAuthor)
    );
    await game.settings.set(MODULE_ID, "quoteOverrides", overrides);
    this.render();
  }

  /** Add a new custom quote. */
  static async #onAddQuote(_event, _target) {
    const textInput = this.element.querySelector('input[name="new-quote-text"]');
    const authorInput = this.element.querySelector('input[name="new-quote-author"]');
    const text = textInput?.value?.trim();
    const author = authorInput?.value?.trim();
    if (!text) return;

    const overrides = game.settings.get(MODULE_ID, "quoteOverrides");
    if (!overrides.added) overrides.added = [];
    overrides.added.push({ text, author: author || "Unknown" });
    await game.settings.set(MODULE_ID, "quoteOverrides", overrides);
    this.render();
  }

  /** Remove a user-added custom quote. */
  static async #onRemoveQuote(_event, target) {
    const { quoteText, quoteAuthor } = target.dataset;
    const overrides = game.settings.get(MODULE_ID, "quoteOverrides");

    overrides.added = (overrides.added ?? []).filter(
      (q) => !(q.text === quoteText && q.author === quoteAuthor)
    );
    await game.settings.set(MODULE_ID, "quoteOverrides", overrides);
    this.render();
  }

  /** Reset all quote customizations back to defaults. */
  static async #onResetAll() {
    await game.settings.set(MODULE_ID, "quoteOverrides", { added: [], deleted: [] });
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Settings.QuotesReset"));
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
