import type { CollectionEntry } from 'astro:content';

type KnownCollection = 'ctf' | 'projects' | 'blog';

type Entry<T extends KnownCollection> = CollectionEntry<T>;

const byDateDesc = <T extends KnownCollection>(a: Entry<T>, b: Entry<T>) =>
  b.data.date.getTime() - a.data.date.getTime();

export const publishedOnly = <T extends KnownCollection>(entry: Entry<T>) => !entry.data.draft;

export const sortByDateDesc = <T extends KnownCollection>(entries: Entry<T>[]) =>
  [...entries].sort(byDateDesc);

export const featuredOnly = <T extends KnownCollection>(entry: Entry<T>) =>
  !entry.data.draft && entry.data.featured;

export const entrySlug = <T extends KnownCollection>(entry: Entry<T>) =>
  (entry.slug ?? entry.id).replace(/\.[^/.]+$/, '');
