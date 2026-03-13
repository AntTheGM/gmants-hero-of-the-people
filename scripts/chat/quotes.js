import { MODULE_ID } from "../const.js";

/**
 * Default heroic quotes from real people, displayed in winner announcements.
 */
export const DEFAULT_QUOTES = [
  { text: "A hero is someone who has given his or her life to something bigger than oneself.", author: "Joseph Campbell" },
  { text: "True heroism is remarkably sober, very undramatic. It is not the urge to surpass all others at whatever cost, but the urge to serve others at whatever cost.", author: "Arthur Ashe" },
  { text: "The hero is one who kindles a great light in the world.", author: "Felix Adler" },
  { text: "Heroes are made by the paths they choose, not the powers they are graced with.", author: "Brodi Ashton" },
  { text: "You cannot do a kindness too soon, for you never know how soon it will be too late.", author: "Ralph Waldo Emerson" },
  { text: "No act of kindness, no matter how small, is ever wasted.", author: "Aesop" },
  { text: "What is a hero without love for mankind?", author: "Doris Lessing" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "I learned that courage was not the absence of fear, but the triumph over it.", author: "Wangari Maathai" },
  { text: "There is no gate, no lock, no bolt that you can set upon the freedom of my mind.", author: "Virginia Woolf" },
  { text: "A hero is somebody who voluntarily walks into the unknown.", author: "Tom Hanks" },
  { text: "Sometimes standing against evil is more important than defeating it.", author: "N.D. Wilson" },
];

/**
 * Get the effective quote list, merging defaults with user overrides.
 * @returns {{ text: string, author: string, isDefault: boolean, isDeleted: boolean }[]}
 */
export function getAllQuotes() {
  const overrides = game.settings.get(MODULE_ID, "quoteOverrides");
  const deletedSet = new Set((overrides.deleted ?? []).map((q) => `${q.text}|||${q.author}`));

  const defaults = DEFAULT_QUOTES.map((q) => ({
    ...q,
    isDefault: true,
    isDeleted: deletedSet.has(`${q.text}|||${q.author}`),
  }));

  const added = (overrides.added ?? []).map((q) => ({
    ...q,
    isDefault: false,
    isDeleted: false,
  }));

  return [...defaults, ...added];
}

/**
 * Get a random heroic quote from the active (non-deleted) pool.
 * @returns {{ text: string, author: string }}
 */
export function getRandomQuote() {
  const active = getAllQuotes().filter((q) => !q.isDeleted);
  if (active.length === 0) {
    // Fallback if everything is deleted
    return DEFAULT_QUOTES[Math.floor(Math.random() * DEFAULT_QUOTES.length)];
  }
  return active[Math.floor(Math.random() * active.length)];
}
