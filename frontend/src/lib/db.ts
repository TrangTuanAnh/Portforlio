import { CTF_CATEGORIES, DEFAULT_PROFILE, DEFAULT_SITE_CONFIG } from './models';
import type {
  CtfCategory,
  PostListFilter,
  PostMutationInput,
  PostRecord,
  PostType,
  ProfileData,
  SiteConfig,
} from './models';
import type { D1DatabaseLike } from './env';

interface ProfileRow {
  name: string;
  headline: string;
  email: string;
  github: string;
  linkedin: string;
  location: string;
  orientation: string;
  about_intro: string;
  resume_url: string | null;
  focus_areas_json: string;
  tech_stack_json: string;
  goals_json: string;
}

interface SiteConfigRow {
  hero_primary: string;
  hero_secondary: string;
  hero_contact: string;
  writeup_repo_root: string | null;
  theme: string;
  enable_3d_effects: number;
  hero_tilt_max: number;
  card_tilt_max: number;
  info_tilt_max: number;
}

interface PostRow {
  id: number;
  type: PostType;
  slug: string;
  title: string;
  summary: string;
  content_markdown: string;
  date: string;
  featured: number;
  is_published: number;
  tags_json: string;
  ctf_category: string | null;
  ctf_event: string | null;
  ctf_difficulty: string | null;
  ctf_external_url: string | null;
  project_stack_json: string;
  project_repo: string | null;
  project_demo: string | null;
  created_at: string;
  updated_at: string;
}

const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
};

const toProfile = (row: ProfileRow | null): ProfileData => {
  if (!row) return DEFAULT_PROFILE;
  return {
    name: row.name,
    headline: row.headline,
    email: row.email,
    github: row.github,
    linkedin: row.linkedin,
    location: row.location,
    orientation: row.orientation,
    aboutIntro: row.about_intro,
    resumeUrl: row.resume_url ?? undefined,
    focusAreas: parseStringArray(row.focus_areas_json),
    techStack: parseStringArray(row.tech_stack_json),
    goals: parseStringArray(row.goals_json),
  };
};

const toSiteConfig = (row: SiteConfigRow | null): SiteConfig => {
  if (!row) return DEFAULT_SITE_CONFIG;
  return {
    links: {
      heroPrimary: row.hero_primary,
      heroSecondary: row.hero_secondary,
      heroContact: row.hero_contact,
      writeupRepoRoot: row.writeup_repo_root ?? undefined,
    },
    ui: {
      theme: row.theme,
      enable3dEffects: Boolean(row.enable_3d_effects),
      heroTiltMax: Number(row.hero_tilt_max),
      cardTiltMax: Number(row.card_tilt_max),
      infoTiltMax: Number(row.info_tilt_max),
    },
  };
};

const toCtfCategory = (value: string | null): CtfCategory | undefined => {
  if (!value) return undefined;
  if (CTF_CATEGORIES.includes(value as CtfCategory)) return value as CtfCategory;
  return undefined;
};

const toPost = (row: PostRow): PostRecord => {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    contentMarkdown: row.content_markdown,
    date: row.date,
    featured: Boolean(row.featured),
    isPublished: Boolean(row.is_published),
    tags: parseStringArray(row.tags_json),
    ctfCategory: toCtfCategory(row.ctf_category),
    ctfEvent: row.ctf_event ?? undefined,
    ctfDifficulty: row.ctf_difficulty ?? undefined,
    ctfExternalUrl: row.ctf_external_url ?? undefined,
    projectStack: parseStringArray(row.project_stack_json),
    projectRepo: row.project_repo ?? undefined,
    projectDemo: row.project_demo ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const basePostSelect = `SELECT
  id, type, slug, title, summary, content_markdown, date, featured, is_published,
  tags_json, ctf_category, ctf_event, ctf_difficulty, ctf_external_url,
  project_stack_json, project_repo, project_demo, created_at, updated_at
FROM posts`;

export const getProfile = async (db: D1DatabaseLike): Promise<ProfileData> => {
  const row = await db.prepare('SELECT * FROM profiles WHERE id = 1 LIMIT 1').first<ProfileRow>();
  return toProfile(row);
};

export const saveProfile = async (db: D1DatabaseLike, input: ProfileData): Promise<ProfileData> => {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO profiles (
        id, name, headline, email, github, linkedin, location, orientation,
        about_intro, resume_url, focus_areas_json, tech_stack_json, goals_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        headline = excluded.headline,
        email = excluded.email,
        github = excluded.github,
        linkedin = excluded.linkedin,
        location = excluded.location,
        orientation = excluded.orientation,
        about_intro = excluded.about_intro,
        resume_url = excluded.resume_url,
        focus_areas_json = excluded.focus_areas_json,
        tech_stack_json = excluded.tech_stack_json,
        goals_json = excluded.goals_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      1,
      input.name,
      input.headline,
      input.email,
      input.github,
      input.linkedin,
      input.location,
      input.orientation,
      input.aboutIntro,
      input.resumeUrl ?? null,
      JSON.stringify(input.focusAreas),
      JSON.stringify(input.techStack),
      JSON.stringify(input.goals),
      now,
    )
    .run();

  return getProfile(db);
};

export const getSiteConfig = async (db: D1DatabaseLike): Promise<SiteConfig> => {
  const row = await db.prepare('SELECT * FROM site_configs WHERE id = 1 LIMIT 1').first<SiteConfigRow>();
  return toSiteConfig(row);
};

export const saveSiteConfig = async (db: D1DatabaseLike, input: SiteConfig): Promise<SiteConfig> => {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO site_configs (
        id, hero_primary, hero_secondary, hero_contact, writeup_repo_root, theme,
        enable_3d_effects, hero_tilt_max, card_tilt_max, info_tilt_max, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hero_primary = excluded.hero_primary,
        hero_secondary = excluded.hero_secondary,
        hero_contact = excluded.hero_contact,
        writeup_repo_root = excluded.writeup_repo_root,
        theme = excluded.theme,
        enable_3d_effects = excluded.enable_3d_effects,
        hero_tilt_max = excluded.hero_tilt_max,
        card_tilt_max = excluded.card_tilt_max,
        info_tilt_max = excluded.info_tilt_max,
        updated_at = excluded.updated_at`,
    )
    .bind(
      1,
      input.links.heroPrimary,
      input.links.heroSecondary,
      input.links.heroContact,
      input.links.writeupRepoRoot ?? null,
      input.ui.theme,
      input.ui.enable3dEffects ? 1 : 0,
      input.ui.heroTiltMax,
      input.ui.cardTiltMax,
      input.ui.infoTiltMax,
      now,
    )
    .run();

  return getSiteConfig(db);
};

export const listPosts = async (db: D1DatabaseLike, filter: PostListFilter = {}): Promise<PostRecord[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.type) {
    where.push('type = ?');
    params.push(filter.type);
  }

  if (!filter.includeDrafts) {
    where.push('is_published = 1');
  }

  if (filter.featuredOnly) {
    where.push('featured = 1');
  }

  let sql = basePostSelect;
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ' ORDER BY date DESC, id DESC';

  if (filter.limit && filter.limit > 0) {
    sql += ' LIMIT ?';
    params.push(Math.floor(filter.limit));
  }

  const { results } = await db.prepare(sql).bind(...params).all<PostRow>();
  return results.map(toPost);
};

export const getPostById = async (db: D1DatabaseLike, id: number): Promise<PostRecord | null> => {
  const row = await db.prepare(`${basePostSelect} WHERE id = ? LIMIT 1`).bind(id).first<PostRow>();
  return row ? toPost(row) : null;
};

export const getPostBySlug = async (
  db: D1DatabaseLike,
  type: PostType,
  slug: string,
  includeDrafts = false,
): Promise<PostRecord | null> => {
  const row = await db
    .prepare(
      `${basePostSelect} WHERE type = ? AND slug = ? ${includeDrafts ? '' : 'AND is_published = 1'} LIMIT 1`,
    )
    .bind(type, slug)
    .first<PostRow>();
  return row ? toPost(row) : null;
};

export const slugExists = async (db: D1DatabaseLike, slug: string, excludeId?: number): Promise<boolean> => {
  if (excludeId !== undefined) {
    const row = await db
      .prepare('SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1')
      .bind(slug, excludeId)
      .first<{ id: number }>();
    return Boolean(row);
  }

  const row = await db.prepare('SELECT id FROM posts WHERE slug = ? LIMIT 1').bind(slug).first<{ id: number }>();
  return Boolean(row);
};

export const createPost = async (db: D1DatabaseLike, input: PostMutationInput): Promise<PostRecord> => {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO posts (
        type, slug, title, summary, content_markdown, date, featured, is_published, tags_json,
        ctf_category, ctf_event, ctf_difficulty, ctf_external_url,
        project_stack_json, project_repo, project_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.type,
      input.slug,
      input.title,
      input.summary,
      input.contentMarkdown,
      input.date,
      input.featured ? 1 : 0,
      input.isPublished ? 1 : 0,
      JSON.stringify(input.tags),
      input.ctfCategory ?? null,
      input.ctfEvent ?? null,
      input.ctfDifficulty ?? null,
      input.ctfExternalUrl ?? null,
      JSON.stringify(input.projectStack),
      input.projectRepo ?? null,
      input.projectDemo ?? null,
      now,
      now,
    )
    .run();

  const created = await getPostBySlug(db, input.type, input.slug, true);
  if (!created) throw new Error('Failed to create post.');
  return created;
};

export const updatePost = async (db: D1DatabaseLike, id: number, input: PostMutationInput): Promise<PostRecord | null> => {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE posts SET
        type = ?, slug = ?, title = ?, summary = ?, content_markdown = ?, date = ?,
        featured = ?, is_published = ?, tags_json = ?,
        ctf_category = ?, ctf_event = ?, ctf_difficulty = ?, ctf_external_url = ?,
        project_stack_json = ?, project_repo = ?, project_demo = ?, updated_at = ?
      WHERE id = ?`,
    )
    .bind(
      input.type,
      input.slug,
      input.title,
      input.summary,
      input.contentMarkdown,
      input.date,
      input.featured ? 1 : 0,
      input.isPublished ? 1 : 0,
      JSON.stringify(input.tags),
      input.ctfCategory ?? null,
      input.ctfEvent ?? null,
      input.ctfDifficulty ?? null,
      input.ctfExternalUrl ?? null,
      JSON.stringify(input.projectStack),
      input.projectRepo ?? null,
      input.projectDemo ?? null,
      now,
      id,
    )
    .run();

  return getPostById(db, id);
};

export const deletePost = async (db: D1DatabaseLike, id: number): Promise<void> => {
  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
};
