/**
 * Tags are matched exactly, so "Front End", "front-end" and " front-end " must
 * all become the same tag. Shared by the server actions and the tag editor.
 */
export const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, "-");

/** Normalized, empty ones dropped, duplicates removed, first spelling's position kept. */
export const normalizeTags = (tags: string[]) => [
  ...new Set(tags.map(normalizeTag).filter(Boolean)),
];

/** A repo matches a tag filter when it carries every selected tag. */
export const hasTags = (repoTags: string[], wanted: string[]) =>
  wanted.every((tag) => repoTags.includes(tag));
