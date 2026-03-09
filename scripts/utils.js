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
