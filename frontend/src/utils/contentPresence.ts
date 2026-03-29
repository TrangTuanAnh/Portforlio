import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const hasMarkdownContent = (relativeDir: string) => {
  try {
    const fullPath = join(process.cwd(), relativeDir);
    return readdirSync(fullPath, { withFileTypes: true }).some(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'),
    );
  } catch {
    return false;
  }
};
