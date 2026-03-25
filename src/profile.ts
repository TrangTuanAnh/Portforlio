import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  resumeFile?: string;
}

const profilePath = join(process.cwd(), 'public', 'personal', 'profile.json');

const defaults: ProfileData = {
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
  techStack: [
    'Python, Go, Bash/PowerShell',
    'Linux tooling, Docker, GitHub Actions',
    'Markdown-first knowledge management',
  ],
  goals: [
    'Hoàn thiện portfolio với writeup chất lượng cao',
    'Ra mắt thêm 2 project security có tài liệu rõ ràng',
    'Duy trì nhịp học CTF đều mỗi tuần',
  ],
  resumeFile: '/personal/uploads/resume.pdf',
};

const ensureStringList = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;

const readProfile = (): ProfileData => {
  let parsed: Record<string, unknown>;
  try {
    const raw = readFileSync(profilePath, 'utf-8').replace(/^\uFEFF/, '');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Khong doc duoc ${profilePath}. Kiem tra file profile.json.`, {
      cause: error,
    });
  }

  return {
    name: typeof parsed.name === 'string' ? parsed.name : defaults.name,
    headline: typeof parsed.headline === 'string' ? parsed.headline : defaults.headline,
    email: typeof parsed.email === 'string' ? parsed.email : defaults.email,
    github: typeof parsed.github === 'string' ? parsed.github : defaults.github,
    linkedin: typeof parsed.linkedin === 'string' ? parsed.linkedin : defaults.linkedin,
    location: typeof parsed.location === 'string' ? parsed.location : defaults.location,
    orientation: typeof parsed.orientation === 'string' ? parsed.orientation : defaults.orientation,
    aboutIntro: typeof parsed.aboutIntro === 'string' ? parsed.aboutIntro : defaults.aboutIntro,
    focusAreas: ensureStringList(parsed.focusAreas, defaults.focusAreas),
    techStack: ensureStringList(parsed.techStack, defaults.techStack),
    goals: ensureStringList(parsed.goals, defaults.goals),
    resumeFile: typeof parsed.resumeFile === 'string' ? parsed.resumeFile : undefined,
  };
};

export const PROFILE = readProfile();
