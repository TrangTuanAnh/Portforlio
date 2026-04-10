const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");
const OUTPUT = path.join(ROOT, "posts.json");

function parseValue(raw) {
  const value = raw.trim();

  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((part) => part.trim().replace(/^['\"]|['\"]$/g, ""))
      .filter(Boolean);
  }

  return value;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }

  const metaBlock = match[1];
  const body = match[2] || "";
  const meta = {};

  metaBlock.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) {
      return;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    meta[key] = parseValue(value);
  });

  return { meta, body };
}

function getDescription(meta, body) {
  if (typeof meta.description === "string" && meta.description.trim()) {
    return meta.description.trim();
  }

  const cleaned = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  return (cleaned[0] || "No description provided.").slice(0, 180);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string" && tags.trim()) {
    return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  return ["MISC"];
}

if (!fs.existsSync(POSTS_DIR)) {
  throw new Error("Missing posts directory: " + POSTS_DIR);
}

const files = fs.readdirSync(POSTS_DIR).filter((name) => name.toLowerCase().endsWith(".md"));

const posts = files.map((file) => {
  const fullPath = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);

  const title = typeof meta.title === "string" && meta.title.trim() ? meta.title.trim() : file.replace(/\.md$/i, "");
  const date = typeof meta.date === "string" && meta.date.trim() ? meta.date.trim() : "1970-01-01";
  const type = typeof meta.type === "string" && meta.type.trim() ? meta.type.trim().toLowerCase() : "writeup";
  const url = typeof meta.url === "string" && meta.url.trim()
    ? meta.url.trim()
    : path.posix.join("posts", file);

  return {
    title,
    date,
    tags: normalizeTags(meta.tags),
    type: type === "blog" ? "blog" : "writeup",
    description: getDescription(meta, body),
    url
  };
});

posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

fs.writeFileSync(OUTPUT, JSON.stringify(posts, null, 2));
console.log(`Generated ${posts.length} posts -> ${path.basename(OUTPUT)}`);
