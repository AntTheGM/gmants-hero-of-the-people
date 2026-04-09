const MODULE_ID_LOCAL = "gmants-hero-of-the-people";

/**
 * Default spotlight roulette quotes.
 * {name} is replaced with the winner's character name.
 */
export const DEFAULT_SPOTLIGHT_QUOTES = [
  "{name} is going to be EPIC this game!",
  "Time for {name} to shine!",
  "The spotlight chooses {name}!",
  "Tonight belongs to {name}!",
  "The stars align for {name}!",
];

/**
 * Get all spotlight quotes, merging defaults with user overrides.
 * @returns {{ text: string, isDefault: boolean, isDeleted: boolean }[]}
 */
export function getAllSpotlightQuotes() {
  const overrides = game.settings.get(MODULE_ID_LOCAL, "spotlightQuoteOverrides");
  const deletedSet = new Set(overrides.deleted ?? []);

  const defaults = DEFAULT_SPOTLIGHT_QUOTES.map((text) => ({
    text,
    isDefault: true,
    isDeleted: deletedSet.has(text),
  }));

  const added = (overrides.added ?? []).map((text) => ({
    text,
    isDefault: false,
    isDeleted: false,
  }));

  return [...defaults, ...added];
}

/**
 * Get a random spotlight phrase with the winner's name inserted.
 * @param {string} name - The character name
 * @returns {string}
 */
export function getRandomPhrase(name) {
  const active = getAllSpotlightQuotes().filter((q) => !q.isDeleted);
  const pool = active.length > 0 ? active : DEFAULT_SPOTLIGHT_QUOTES.map((text) => ({ text }));
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return chosen.text.replace("{name}", name);
}

/**
 * Post a spotlight winner chat message with a fun phrase.
 * @param {object} options
 * @param {string} options.winnerId - Actor ID of the winner
 * @param {string} options.winnerName - Character name
 * @param {string} options.awardType - "heroPoint", "inspiration", or "none"
 */
export async function postSpotlightChat({ winnerId, winnerName, awardType }) {
  const MODULE_ID = "gmants-hero-of-the-people";
  const phrase = getRandomPhrase(winnerName);

  let awardText = "";
  if (awardType === "heroPoint") {
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Spotlight.AwardedHeroPoint", { name: winnerName });
  } else if (awardType === "inspiration") {
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Spotlight.AwardedInspiration", { name: winnerName });
  }

  const actor = game.actors.get(winnerId);
  const img = actor?.img ?? "icons/svg/mystery-man.svg";

  const announcement = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.HeroAnnouncement", { name: winnerName });

  const content = `
    <div class="gmants-hero-of-the-people-chat-card gmants-hero-of-the-people-spotlight-chat">
      <div class="gmants-hero-of-the-people-chat-header">
        <i class="fas fa-star"></i>
        <strong>${announcement}</strong>
      </div>
      <div class="gmants-hero-of-the-people-spotlight-chat-body">
        <img src="${img}" alt="${winnerName}" class="gmants-hero-of-the-people-spotlight-chat-portrait" />
        <div class="gmants-hero-of-the-people-spotlight-chat-text">
          <div class="gmants-hero-of-the-people-spotlight-chat-phrase">${phrase}</div>
          ${awardText ? `<div class="gmants-hero-of-the-people-chat-award">${awardText}</div>` : ""}
        </div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.Title") },
    flags: { [MODULE_ID]: { type: "spotlight-announcement", winnerId } },
  });
}
