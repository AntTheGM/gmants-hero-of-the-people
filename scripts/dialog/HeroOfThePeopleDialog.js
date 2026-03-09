import { MODULE_ID } from "../const.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    actions: {},
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/main-dialog.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
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
}
