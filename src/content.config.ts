import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ctf = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ctf' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['web', 'pwn', 'reverse', 'crypto', 'forensics', 'osint']),
    event: z.string(),
    difficulty: z.string().optional(),
    tags: z.array(z.string()).default([]),
    summary: z.string(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    stack: z.array(z.string()).default([]),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    summary: z.string(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { ctf, projects, blog };
