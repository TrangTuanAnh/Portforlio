CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  email TEXT NOT NULL,
  github TEXT NOT NULL,
  linkedin TEXT NOT NULL,
  location TEXT NOT NULL,
  orientation TEXT NOT NULL,
  about_intro TEXT NOT NULL,
  resume_url TEXT,
  focus_areas_json TEXT NOT NULL,
  tech_stack_json TEXT NOT NULL,
  goals_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_configs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hero_primary TEXT NOT NULL,
  hero_secondary TEXT NOT NULL,
  hero_contact TEXT NOT NULL,
  writeup_repo_root TEXT,
  theme TEXT NOT NULL,
  enable_3d_effects INTEGER NOT NULL DEFAULT 1,
  hero_tilt_max REAL NOT NULL DEFAULT 5.5,
  card_tilt_max REAL NOT NULL DEFAULT 4.6,
  info_tilt_max REAL NOT NULL DEFAULT 3.8,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('ctf', 'project', 'blog')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  date TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  ctf_category TEXT,
  ctf_event TEXT,
  ctf_difficulty TEXT,
  ctf_external_url TEXT,
  project_stack_json TEXT NOT NULL DEFAULT '[]',
  project_repo TEXT,
  project_demo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_type_published_date
  ON posts (type, is_published, date DESC);

CREATE INDEX IF NOT EXISTS idx_posts_type_featured_published_date
  ON posts (type, featured, is_published, date DESC);
