import { CTF_CATEGORIES, DEFAULT_PROFILE, DEFAULT_SITE_CONFIG } from './models';
import type { CtfCategory, PostMutationInput, PostType, ProfileData, SiteConfig } from './models';
import { normalizeSlug } from './slug';

const assertRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const toString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback);

const toOptionalString = (value: unknown): string | undefined => {
  const parsed = toString(value);
  return parsed.length > 0 ? parsed : undefined;
};

const toBoolean = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const toNumber = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const requireString = (value: unknown, fieldName: string): string => {
  const parsed = toString(value);
  if (!parsed) throw new Error(`${fieldName} is required.`);
  return parsed;
};

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parsePostType = (value: unknown): PostType => {
  if (value === 'ctf' || value === 'project' || value === 'blog') return value;
  throw new Error('type must be one of: ctf, project, blog.');
};

export const parseProfileInput = (value: unknown): ProfileData => {
  const input = assertRecord(value, 'Profile payload');
  return {
    name: requireString(input.name, 'name'),
    headline: requireString(input.headline, 'headline'),
    email: requireString(input.email, 'email'),
    github: requireString(input.github, 'github'),
    linkedin: requireString(input.linkedin, 'linkedin'),
    location: requireString(input.location, 'location'),
    orientation: requireString(input.orientation, 'orientation'),
    aboutIntro: requireString(input.aboutIntro, 'aboutIntro'),
    focusAreas: toStringArray(input.focusAreas),
    techStack: toStringArray(input.techStack),
    goals: toStringArray(input.goals),
    resumeUrl: toOptionalString(input.resumeUrl),
  };
};

export const parseSiteConfigInput = (value: unknown): SiteConfig => {
  const input = assertRecord(value, 'Site config payload');
  const links = assertRecord(input.links, 'links');
  const ui = assertRecord(input.ui, 'ui');
  return {
    links: {
      heroPrimary: toString(links.heroPrimary, DEFAULT_SITE_CONFIG.links.heroPrimary),
      heroSecondary: toString(links.heroSecondary, DEFAULT_SITE_CONFIG.links.heroSecondary),
      heroContact: toString(links.heroContact, DEFAULT_SITE_CONFIG.links.heroContact),
      writeupRepoRoot: toOptionalString(links.writeupRepoRoot),
    },
    ui: {
      theme: toString(ui.theme, DEFAULT_SITE_CONFIG.ui.theme),
      enable3dEffects: toBoolean(ui.enable3dEffects, DEFAULT_SITE_CONFIG.ui.enable3dEffects),
      heroTiltMax: toNumber(ui.heroTiltMax, DEFAULT_SITE_CONFIG.ui.heroTiltMax),
      cardTiltMax: toNumber(ui.cardTiltMax, DEFAULT_SITE_CONFIG.ui.cardTiltMax),
      infoTiltMax: toNumber(ui.infoTiltMax, DEFAULT_SITE_CONFIG.ui.infoTiltMax),
    },
  };
};

export const parsePostInput = (value: unknown): PostMutationInput => {
  const input = assertRecord(value, 'Post payload');
  const type = parsePostType(input.type);
  const title = requireString(input.title, 'title');
  const requestedSlug = toString(input.slug);
  const slug = normalizeSlug(requestedSlug || title);
  if (!slug) throw new Error('slug cannot be empty.');

  const date = requireString(input.date, 'date');
  if (!isDateOnly(date)) throw new Error('date must use format YYYY-MM-DD.');

  const tags = toStringArray(input.tags);
  const projectStack = toStringArray(input.projectStack);
  const ctfCategoryRaw = toOptionalString(input.ctfCategory);
  let ctfCategory: CtfCategory | undefined;
  if (ctfCategoryRaw) {
    if (!CTF_CATEGORIES.includes(ctfCategoryRaw as CtfCategory)) {
      throw new Error('ctfCategory is invalid.');
    }
    ctfCategory = ctfCategoryRaw as CtfCategory;
  }

  return {
    type,
    slug,
    title,
    summary: requireString(input.summary, 'summary'),
    contentMarkdown: toString(input.contentMarkdown),
    date,
    featured: toBoolean(input.featured, false),
    isPublished: toBoolean(input.isPublished, false),
    tags,
    ctfCategory: type === 'ctf' ? ctfCategory : undefined,
    ctfEvent: type === 'ctf' ? toOptionalString(input.ctfEvent) : undefined,
    ctfDifficulty: type === 'ctf' ? toOptionalString(input.ctfDifficulty) : undefined,
    ctfExternalUrl: type === 'ctf' ? toOptionalString(input.ctfExternalUrl) : undefined,
    projectStack: type === 'project' ? projectStack : [],
    projectRepo: type === 'project' ? toOptionalString(input.projectRepo) : undefined,
    projectDemo: type === 'project' ? toOptionalString(input.projectDemo) : undefined,
  };
};

export const toProfileEditorModel = (profile: ProfileData) => ({
  ...profile,
  focusAreasText: profile.focusAreas.join('\n'),
  techStackText: profile.techStack.join('\n'),
  goalsText: profile.goals.join('\n'),
});

export const toProfileFromEditor = (input: Record<string, unknown>): ProfileData => {
  return parseProfileInput({
    ...DEFAULT_PROFILE,
    ...input,
    focusAreas: toStringArray(input.focusAreasText),
    techStack: toStringArray(input.techStackText),
    goals: toStringArray(input.goalsText),
  });
};
