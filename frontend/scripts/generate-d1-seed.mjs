import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import matter from 'gray-matter';

const projectRoot = process.cwd();
const nowIso = new Date().toISOString();

const readJson = (relativePath) => {
  const absolutePath = join(projectRoot, relativePath);
  const raw = readFileSync(absolutePath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
};

const toSqlString = (value) => {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const toSqlBool = (value) => (value ? '1' : '0');

const toSqlJson = (value) => toSqlString(JSON.stringify(value ?? []));

const toDateOnly = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const collectMarkdownFiles = (relativeDir) => {
  const absoluteDir = join(projectRoot, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.md')
    .map((entry) => join(absoluteDir, entry.name));
};

const readPosts = () => {
  const sources = [
    { type: 'ctf', dir: 'src/content/ctf' },
    { type: 'project', dir: 'src/content/projects' },
    { type: 'blog', dir: 'src/content/blog' },
  ];

  const posts = [];
  for (const source of sources) {
    const files = collectMarkdownFiles(source.dir);
    for (const filePath of files) {
      const raw = readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      const slug = basename(filePath, '.md');
      posts.push({
        type: source.type,
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        summary: typeof data.summary === 'string' ? data.summary : '',
        contentMarkdown: content.trim(),
        date: toDateOnly(data.date) ?? new Date().toISOString().slice(0, 10),
        featured: Boolean(data.featured),
        isPublished: !Boolean(data.draft),
        tags: Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string') : [],
        ctfCategory: typeof data.category === 'string' ? data.category : null,
        ctfEvent: typeof data.event === 'string' ? data.event : null,
        ctfDifficulty: typeof data.difficulty === 'string' ? data.difficulty : null,
        ctfExternalUrl: typeof data.externalUrl === 'string' ? data.externalUrl : null,
        projectStack: Array.isArray(data.stack) ? data.stack.filter((item) => typeof item === 'string') : [],
        projectRepo: typeof data.repo === 'string' ? data.repo : null,
        projectDemo: typeof data.demo === 'string' ? data.demo : null,
      });
    }
  }
  return posts;
};

const buildProfileSql = (profile) => {
  return [
    'DELETE FROM profiles WHERE id = 1;',
    `INSERT INTO profiles (
      id, name, headline, email, github, linkedin, location, orientation, about_intro,
      resume_url, focus_areas_json, tech_stack_json, goals_json, updated_at
    ) VALUES (
      1,
      ${toSqlString(profile.name)},
      ${toSqlString(profile.headline)},
      ${toSqlString(profile.email)},
      ${toSqlString(profile.github)},
      ${toSqlString(profile.linkedin)},
      ${toSqlString(profile.location)},
      ${toSqlString(profile.orientation)},
      ${toSqlString(profile.aboutIntro)},
      ${toSqlString(profile.resumeFile ?? null)},
      ${toSqlJson(Array.isArray(profile.focusAreas) ? profile.focusAreas : [])},
      ${toSqlJson(Array.isArray(profile.techStack) ? profile.techStack : [])},
      ${toSqlJson(Array.isArray(profile.goals) ? profile.goals : [])},
      ${toSqlString(nowIso)}
    );`,
  ].join('\n');
};

const buildSiteConfigSql = (config) => {
  const links = config.links ?? {};
  const ui = config.ui ?? {};
  return [
    'DELETE FROM site_configs WHERE id = 1;',
    `INSERT INTO site_configs (
      id, hero_primary, hero_secondary, hero_contact, writeup_repo_root,
      theme, enable_3d_effects, hero_tilt_max, card_tilt_max, info_tilt_max, updated_at
    ) VALUES (
      1,
      ${toSqlString(links.heroPrimary ?? '/ctf')},
      ${toSqlString(links.heroSecondary ?? '/project')},
      ${toSqlString(links.heroContact ?? '')},
      ${toSqlString(links.writeupRepoRoot ?? null)},
      ${toSqlString(ui.theme ?? 'light-glass-pastel')},
      ${toSqlBool(ui.enable3dEffects !== false)},
      ${Number.isFinite(ui.heroTiltMax) ? Number(ui.heroTiltMax) : 5.5},
      ${Number.isFinite(ui.cardTiltMax) ? Number(ui.cardTiltMax) : 4.6},
      ${Number.isFinite(ui.infoTiltMax) ? Number(ui.infoTiltMax) : 3.8},
      ${toSqlString(nowIso)}
    );`,
  ].join('\n');
};

const buildPostsSql = (posts) => {
  const lines = ['DELETE FROM posts;'];
  for (const post of posts) {
    lines.push(`INSERT INTO posts (
      type, slug, title, summary, content_markdown, date, featured, is_published, tags_json,
      ctf_category, ctf_event, ctf_difficulty, ctf_external_url,
      project_stack_json, project_repo, project_demo, created_at, updated_at
    ) VALUES (
      ${toSqlString(post.type)},
      ${toSqlString(post.slug)},
      ${toSqlString(post.title)},
      ${toSqlString(post.summary)},
      ${toSqlString(post.contentMarkdown)},
      ${toSqlString(post.date)},
      ${toSqlBool(post.featured)},
      ${toSqlBool(post.isPublished)},
      ${toSqlJson(post.tags)},
      ${toSqlString(post.ctfCategory)},
      ${toSqlString(post.ctfEvent)},
      ${toSqlString(post.ctfDifficulty)},
      ${toSqlString(post.ctfExternalUrl)},
      ${toSqlJson(post.projectStack)},
      ${toSqlString(post.projectRepo)},
      ${toSqlString(post.projectDemo)},
      ${toSqlString(nowIso)},
      ${toSqlString(nowIso)}
    );`);
  }
  return lines.join('\n');
};

const profile = readJson('public/personal/profile.json');
const siteConfig = readJson('public/personal/site-config.json');
const posts = readPosts();

const outputDir = join(projectRoot, 'migrations');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const outputPath = join(outputDir, '0002_seed.sql');
const sqlContent = [
  '-- Auto-generated by scripts/generate-d1-seed.mjs',
  buildProfileSql(profile),
  buildSiteConfigSql(siteConfig),
  buildPostsSql(posts),
  '',
].join('\n\n');

writeFileSync(outputPath, sqlContent, 'utf-8');

console.log(`Generated ${outputPath} with ${posts.length} posts.`);
