/**
 * Fun announcement phrases for the Spotlight Roulette.
 * {name} is replaced with the winner's character name.
 */
export const SPOTLIGHT_PHRASES = [
  "{name} is going to be EPIC this game!",
  "Time for {name} to shine!",
  "{name} is the Hero of the People!",
  "All eyes on {name} — legend in the making!",
  "The spotlight chooses {name}!",
  "{name} has been chosen by fate!",
  "Tonight belongs to {name}!",
  "{name} is about to do something incredible!",
  "Brace yourselves — {name} is feeling heroic!",
  "The stars align for {name}!",
  "{name} steps into the spotlight!",
  "May the dice favor {name} today!",
  "{name} — born to be a hero!",
  "This is {name}'s moment of glory!",
  "Get ready, {name} is on fire!",
];

/**
 * Get a random spotlight phrase with the winner's name inserted.
 * @param {string} name - The character name
 * @returns {string}
 */
export function getRandomPhrase(name) {
  const phrase = SPOTLIGHT_PHRASES[Math.floor(Math.random() * SPOTLIGHT_PHRASES.length)];
  return phrase.replace("{name}", name);
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
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.HeroPointAwarded", { name: winnerName });
  } else if (awardType === "inspiration") {
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.InspirationAwarded", { name: winnerName });
  }

  const actor = game.actors.get(winnerId);
  const img = actor?.img ?? "icons/svg/mystery-man.svg";

  const content = `
    <div class="gmants-hero-of-the-people-chat-card gmants-hero-of-the-people-spotlight-chat">
      <div class="gmants-hero-of-the-people-chat-header">
        <i class="fas fa-star"></i>
        <strong>${game.i18n.localize("HERO_OF_THE_PEOPLE.Spotlight.ChatHeader")}</strong>
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
