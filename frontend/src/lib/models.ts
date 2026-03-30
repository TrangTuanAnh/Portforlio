export const CTF_CATEGORIES = ['web', 'pwn', 'reverse', 'crypto', 'forensics', 'osint'] as const;

export type CtfCategory = (typeof CTF_CATEGORIES)[number];
export type PostType = 'ctf' | 'project' | 'blog';

export interface ProfileData {
  name: string;
  headline: string;
  email: string;
  github: string;
  linkedin: string;
  location: string;
  orientation: string;
  aboutIntro: string;
  focusAreas: string[];
  techStack: string[];
  goals: string[];
  resumeUrl?: string;
}

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

export interface PostRecord {
  id: number;
  type: PostType;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  date: string;
  featured: boolean;
  isPublished: boolean;
  tags: string[];
  ctfCategory?: CtfCategory;
  ctfEvent?: string;
  ctfDifficulty?: string;
  ctfExternalUrl?: string;
  projectStack: string[];
  projectRepo?: string;
  projectDemo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostMutationInput {
  type: PostType;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  date: string;
  featured: boolean;
  isPublished: boolean;
  tags: string[];
  ctfCategory?: CtfCategory;
  ctfEvent?: string;
  ctfDifficulty?: string;
  ctfExternalUrl?: string;
  projectStack: string[];
  projectRepo?: string;
  projectDemo?: string;
}

export interface PostListFilter {
  type?: PostType;
  includeDrafts?: boolean;
  featuredOnly?: boolean;
  limit?: number;
}

export const DEFAULT_PROFILE: ProfileData = {
  name: 'Nguyen Security',
  headline: 'Cybersecurity Learner | CTF Player | Security Builder',
  email: 'security.example@gmail.com',
  github: 'https://github.com/example-security',
  linkedin: 'https://www.linkedin.com/in/example-security',
  location: 'Ho Chi Minh City, Vietnam',
  orientation: 'Security Research + Practical Tooling',
  aboutIntro:
    'Mình tập trung vào web security, forensics và quy trình học theo hướng có hệ thống. Mục tiêu hiện tại là nâng chất lượng writeup, xây thêm công cụ tự động hóa nhỏ và cải thiện khả năng threat thinking.',
  focusAreas: [
    'CTF writeup theo hướng tái hiện được',
    'Phân tích hành vi hệ thống và log',
    'Xây utility nhỏ phục vụ blue team workflow',
  ],
  techStack: ['Python, Go, Bash/PowerShell', 'Linux tooling, Docker, GitHub Actions', 'Markdown-first knowledge management'],
  goals: [
    'Hoàn thiện portfolio với writeup chất lượng cao',
    'Ra mắt thêm 2 project security có tài liệu rõ ràng',
    'Duy trì nhịp học CTF đều mỗi tuần',
  ],
  resumeUrl: '/personal/uploads/resume.pdf',
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
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

export const toDateObject = (dateValue: string) => new Date(`${dateValue}T00:00:00.000Z`);
