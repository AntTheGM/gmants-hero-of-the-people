import { MODULE_ID } from "../const.js";

/**
 * Post the startup chat message announcing the module is active.
 */
export function postStartupChat() {
  // Pick the system-appropriate interval message
  const systemId = game.system.id;
  let intervalKey = "HERO_OF_THE_PEOPLE.Chat.StartupInterval.generic";
  if (systemId === "pf2e") intervalKey = "HERO_OF_THE_PEOPLE.Chat.StartupInterval.heroPoint";
  else if (systemId === "dnd5e") intervalKey = "HERO_OF_THE_PEOPLE.Chat.StartupInterval.inspiration";

  const content = `
    <div class="gmants-hero-of-the-people-chat-card">
      <div class="gmants-hero-of-the-people-chat-header">
        <i class="fas fa-medal"></i>
        <strong>${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.Startup")}</strong>
      </div>
      <div class="gmants-hero-of-the-people-chat-award">
        ${game.i18n.localize(intervalKey)}
      </div>
      <div class="gmants-hero-of-the-people-chat-quote">
        <em>${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.StartupHint")}</em>
      </div>
      <a class="gmants-hero-of-the-people-chat-open-link" data-action="openHero">
        <i class="fas fa-external-link-alt"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.OpenLink")}
      </a>
    </div>
  `;

  ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Dialog.Title") },
    flags: { [MODULE_ID]: { type: "startup" } },
  });
}
