import { MODULE_ID } from "../const.js";
import { formatTargetName, getOwnerName, getPlayerCharacterActors, HYPE_TAGS } from "../utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Lookup map from tag key to {icon, label} for display purposes. */
const HYPE_TAGS_BY_KEY = Object.fromEntries(HYPE_TAGS.map((t) => [t.key, { icon: t.icon, label: t.label }]));

/**
 * GM-only dialog showing vote results with accept/override options and collected hype.
 */
export class ResultsDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-results`,
    classes: [MODULE_ID],
    window: {
      title: "HERO_OF_THE_PEOPLE.Results.Title",
      icon: "fas fa-trophy",
      resizable: false,
    },
    position: { width: 420, height: "auto" },
    actions: {
      accept: ResultsDialog.#onAccept,
      override: ResultsDialog.#onOverride,
      postHype: ResultsDialog.#onPostHype,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/results-dialog.hbs`,
    },
  };

  /** @type {object} Vote results from VoteCollector */
  #results;

  /** @type {object[]} Collected hype entries */
  #hypeEntries;

  /** @type {Function} Called with winnerId when GM accepts/overrides */
  #onAcceptCallback;

  /**
   * @param {object} options
   * @param {object} options.results - Results from VoteCollector
   * @param {object[]} options.hypeEntries - Collected hype submissions
   * @param {Function} options.onAccept - Called with final winnerId
   */
  constructor({ results, hypeEntries = [], onAccept }) {
    super();
    this.#results = results;
    this.#hypeEntries = hypeEntries;
    this.#onAcceptCallback = onAccept;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.results = this.#results;

    // Build override candidates — actor-based
    context.overrideCandidates = getPlayerCharacterActors().map((a) => {
      const owner = getOwnerName(a);
      return {
        actorId: a.id,
        name: owner ? `${a.name} (${owner})` : a.name,
        isWinner: a.id === this.#results.winnerId,
      };
    });

    // Process hype entries for display — targetId is an actor ID
    context.hypeEntries = this.#hypeEntries.map((entry) => {
      const actor = game.actors.get(entry.targetId);
      const tagLabels = (entry.tags || []).map((key) => {
        const info = HYPE_TAGS_BY_KEY[key];
        return info ? { icon: info.icon, label: game.i18n.localize(info.label) } : null;
      }).filter(Boolean);

      return {
        targetName: formatTargetName(actor),
        tags: tagLabels,
        message: entry.message || "",
      };
    });
    context.hasHype = context.hypeEntries.length > 0;

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
  }

  static #onAccept(event, target) {
    this.#onAcceptCallback(this.#results.winnerId);
    this.close();
  }

  static #onOverride(event, target) {
    const select = this.element.querySelector(".gmants-hero-of-the-people-override-select");
    const overrideId = select?.value;
    if (overrideId) {
      this.#onAcceptCallback(overrideId);
      this.close();
    }
  }

  static async #onPostHype(event, target) {
    if (this.#hypeEntries.length === 0) return;

    // Build anonymous hype chat messages
    for (const entry of this.#hypeEntries) {
      const targetActor = game.actors.get(entry.targetId);
      const targetName = formatTargetName(targetActor);

      const tagLabels = (entry.tags || []).map((key) => {
        const info = HYPE_TAGS_BY_KEY[key];
        return info ? `<i class="${info.icon}"></i> ${game.i18n.localize(info.label)}` : null;
      }).filter(Boolean);

      const tagsHtml = tagLabels.length > 0
        ? `<div class="gmants-hero-of-the-people-chat-hype-tags">${tagLabels.join(" &middot; ")}</div>`
        : "";
      const messageHtml = entry.message
        ? `<div class="gmants-hero-of-the-people-chat-hype-message">&ldquo;${entry.message}&rdquo;</div>`
        : "";

      if (!tagsHtml && !messageHtml) continue;

      const content = `
        <div class="gmants-hero-of-the-people-chat-card">
          <div class="gmants-hero-of-the-people-chat-header">
            <i class="fas fa-fire"></i>
            <strong>${game.i18n.format("HERO_OF_THE_PEOPLE.Hype.ChatHeader", { name: targetName })}</strong>
          </div>
          ${tagsHtml}
          ${messageHtml}
        </div>
      `;

      await ChatMessage.create({
        content,
        speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Anonymous") },
        flags: { [MODULE_ID]: { type: "hype" } },
      });
    }

    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Posted"));

    // Disable the button after posting
    const btn = this.element.querySelector('[data-action="postHype"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Posted");
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
