import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SiteConfig {
  links: {
    heroPrimary: string;
    heroSecondary: string;
    heroContact: string;
    writeupRepoRoot?: string;
  };
  ui: {
    theme: string;
    enable3dEffects: boolean;
    heroTiltMax: number;
    cardTiltMax: number;
    infoTiltMax: number;
  };
}

const configPath = join(process.cwd(), 'public', 'personal', 'site-config.json');

const defaults: SiteConfig = {
  links: {
    heroPrimary: '/ctf',
    heroSecondary: '/project',
    heroContact: 'mailto:security.example@gmail.com',
    writeupRepoRoot: 'https://github.com/example-security/ctf-writeups',
  },
  ui: {
    theme: 'light-glass-pastel',
    enable3dEffects: true,
    heroTiltMax: 5.5,
    cardTiltMax: 4.6,
    infoTiltMax: 3.8,
  },
};

const toNumber = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

const readConfig = (): SiteConfig => {
  let parsed: Record<string, unknown>;
  try {
    const raw = readFileSync(configPath, 'utf-8').replace(/^\uFEFF/, '');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Khong doc duoc ${configPath}. Kiem tra file site-config.json.`, {
      cause: error,
    });
  }

  const links = (parsed.links as Record<string, unknown>) ?? {};
  const ui = (parsed.ui as Record<string, unknown>) ?? {};

  return {
    links: {
      heroPrimary: typeof links.heroPrimary === 'string' ? links.heroPrimary : defaults.links.heroPrimary,
      heroSecondary: typeof links.heroSecondary === 'string' ? links.heroSecondary : defaults.links.heroSecondary,
      heroContact: typeof links.heroContact === 'string' ? links.heroContact : defaults.links.heroContact,
      writeupRepoRoot: typeof links.writeupRepoRoot === 'string' ? links.writeupRepoRoot : defaults.links.writeupRepoRoot,
    },
    ui: {
      theme: typeof ui.theme === 'string' ? ui.theme : defaults.ui.theme,
      enable3dEffects: typeof ui.enable3dEffects === 'boolean' ? ui.enable3dEffects : defaults.ui.enable3dEffects,
      heroTiltMax: toNumber(ui.heroTiltMax, defaults.ui.heroTiltMax),
      cardTiltMax: toNumber(ui.cardTiltMax, defaults.ui.cardTiltMax),
      infoTiltMax: toNumber(ui.infoTiltMax, defaults.ui.infoTiltMax),
    },
  };
};

export const SITE_CONFIG = readConfig();
