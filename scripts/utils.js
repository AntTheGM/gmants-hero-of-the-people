import { MODULE_ID } from "./const.js";
import { getExcludedActorNames } from "./settings.js";

/**
 * Get the primary character actor for a user.
 * Checks user.character first (Selected Player Character in user config),
 * then falls back to the first PC-type actor the user owns.
 * @param {User} user
 * @returns {Actor|null}
 */
export function getPlayerCharacter(user) {
  if (user.character) return user.character;
  return game.actors.find((a) => {
    if (!a.hasPlayerOwner) return false;
    if (a.ownership?.[user.id] !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return false;
    return a.type === "character";
  }) ?? null;
}

/**
 * Check if an actor is at max hero points (PF2e) or already has inspiration (5e).
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isAtMax(actor) {
  const systemId = game.system.id;
  if (systemId === "pf2e") {
    const hp = actor.system?.resources?.heroPoints;
    return hp && hp.value >= hp.max;
  } else if (systemId === "dnd5e") {
    return !!actor.system?.attributes?.inspiration;
  }
  return false;
}

/**
 * Get the owning non-GM player name for an actor, or empty string.
 * @param {Actor} actor
 * @returns {string}
 */
export function getOwnerName(actor) {
  if (!actor) return "";
  const owner = game.users.find(
    (u) => !u.isGM && actor.ownership?.[u.id] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
  );
  return owner?.name ?? "";
}

/**
 * Format a target name with optional player name in parentheses.
 * @param {Actor} actor
 * @returns {string}
 */
export function formatTargetName(actor) {
  if (!actor) return "Someone";
  const ownerName = getOwnerName(actor);
  return ownerName ? `${actor.name} (${ownerName})` : actor.name;
}

/**
 * Get all PC actors that have a non-GM owner.
 * @returns {Actor[]}
 */
export function getPlayerCharacterActors() {
  return game.actors.filter((a) => {
    if (a.type !== "character" || !a.hasPlayerOwner) return false;
    return game.users.some(
      (u) => !u.isGM && a.ownership?.[u.id] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );
  });
}

/**
 * Get all eligible PC actors for voting (excludes session winners, maxed, and excluded names).
 * @returns {Actor[]}
 */
export function getEligibleActors() {
  const sessionWinners = game.settings.get(MODULE_ID, "sessionWinners");
  const excluded = getExcludedActorNames();
  return getPlayerCharacterActors().filter((a) => {
    if (excluded.has(a.name.toLowerCase())) return false;
    if (sessionWinners.includes(a.id)) return false;
    return !isAtMax(a);
  });
}

/** Hype tag definitions — single source of truth for both dialog checkboxes and display. */
export const HYPE_TAGS = [
  { key: "roleplay", icon: "fas fa-theater-masks", label: "HERO_OF_THE_PEOPLE.Hype.Roleplay" },
  { key: "tactical", icon: "fas fa-chess-knight", label: "HERO_OF_THE_PEOPLE.Hype.Tactical" },
  { key: "puzzle", icon: "fas fa-puzzle-piece", label: "HERO_OF_THE_PEOPLE.Hype.Puzzle" },
  { key: "helper", icon: "fas fa-hands-helping", label: "HERO_OF_THE_PEOPLE.Hype.Helper" },
];
