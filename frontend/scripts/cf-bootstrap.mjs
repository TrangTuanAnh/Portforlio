import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';

const FRONTEND_ROOT = process.cwd();
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const args = process.argv.slice(2);
const getArg = (key, fallback = '') => {
  const exact = args.find((item) => item.startsWith(`--${key}=`));
  if (exact) return exact.slice(key.length + 3);
  const idx = args.indexOf(`--${key}`);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return fallback;
};

const hasFlag = (key) => args.includes(`--${key}`);

if (hasFlag('help') || hasFlag('h')) {
  console.log(`Usage:
  npm run cf:bootstrap -- --project <pages-project> --admin-user <username> --admin-pass <password>

Options:
  --project <name>              Cloudflare Pages project name (default: my-portfolio)
  --db-name <name>              D1 database name for auto-create (default: my-portfolio-db)
  --admin-user <username>       Admin username secret (default: admin)
  --admin-pass <password>       Admin plain password (required, script will bcrypt-hash it)
  --session-secret <secret>     Custom ADMIN_SESSION_SECRET (optional)
  --skip-project-create         Skip wrangler pages project create
  --skip-deploy                 Skip build + deploy
  --help                        Show this help
`);
  process.exit(0);
}

const projectName = getArg('project', process.env.CF_PROJECT_NAME || 'my-portfolio');
const dbName = getArg('db-name', process.env.CF_D1_NAME || 'my-portfolio-db');
const adminUsername = getArg('admin-user', process.env.ADMIN_USERNAME || 'admin');
const adminPassword = getArg('admin-pass', process.env.ADMIN_PASSWORD || '');
const adminSessionSecret = getArg('session-secret', process.env.ADMIN_SESSION_SECRET || '');
const skipDeploy = hasFlag('skip-deploy');
const skipProjectCreate = hasFlag('skip-project-create');

if (!adminPassword) {
  console.error(
    'Missing admin password. Pass via --admin-pass "<password>" or env ADMIN_PASSWORD before running this script.',
  );
  process.exit(1);
}

const run = (command, commandArgs, options = {}) => {
  const { input, allowFailure = false, capture = false } = options;
  const result = spawnSync(command, commandArgs, {
    cwd: FRONTEND_ROOT,
    encoding: 'utf-8',
    input,
    stdio: capture ? 'pipe' : ['pipe', 'inherit', 'inherit'],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }

  return result;
};

const runWrangler = (wranglerArgs, options = {}) => run(npxCmd, ['wrangler', ...wranglerArgs], options);
const runNpm = (npmArgs, options = {}) => run(npmCmd, npmArgs, options);

const ensureWranglerLogin = () => {
  const whoami = runWrangler(['whoami'], { allowFailure: true, capture: true });
  const output = `${whoami.stdout || ''}\n${whoami.stderr || ''}`;
  if (whoami.status !== 0 || output.includes('You are not authenticated')) {
    console.error('Wrangler is not authenticated. Run `npx wrangler login` first.');
    process.exit(1);
  }
};

const ensureD1Configured = () => {
  const configPath = join(FRONTEND_ROOT, 'wrangler.toml');
  if (!existsSync(configPath)) {
    throw new Error('wrangler.toml not found in frontend root.');
  }
  const configRaw = readFileSync(configPath, 'utf-8');
  const needsCreate =
    configRaw.includes('REPLACE_WITH_D1_DATABASE_ID') ||
    !/\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"DB"[\s\S]*?database_id\s*=\s*".+?"/m.test(configRaw);

  if (!needsCreate) {
    console.log('D1 binding already configured in wrangler.toml.');
    return;
  }

  console.log(`Creating D1 database "${dbName}" and updating wrangler.toml...`);
  const createResult = runWrangler(['d1', 'create', dbName, '--binding', 'DB', '--update-config'], {
    allowFailure: true,
    capture: true,
  });
  const output = `${createResult.stdout || ''}\n${createResult.stderr || ''}`;
  if (createResult.status !== 0) {
    if (output.toLowerCase().includes('already exists')) {
      throw new Error(
        `D1 database "${dbName}" already exists but wrangler.toml is still missing database_id. ` +
          'Open wrangler.toml and set database_id manually from `npx wrangler d1 list`.',
      );
    }
    throw new Error(`Unable to create D1 database.\n${output}`);
  }
};

const ensurePagesProject = () => {
  if (skipProjectCreate) {
    console.log('Skipping Pages project creation step (--skip-project-create).');
    return;
  }

  console.log(`Ensuring Pages project "${projectName}" exists...`);
  const create = runWrangler(
    [
      'pages',
      'project',
      'create',
      projectName,
      '--production-branch',
      'main',
      '--compatibility-date',
      '2026-03-17',
      '--compatibility-flag',
      'nodejs_compat',
    ],
    { allowFailure: true, capture: true },
  );

  const output = `${create.stdout || ''}\n${create.stderr || ''}`;
  if (create.status !== 0) {
    if (output.toLowerCase().includes('already exists')) {
      console.log('Pages project already exists, continuing...');
      return;
    }
    throw new Error(`Unable to create Pages project.\n${output}`);
  }
};

const putSecret = (key, value) => {
  runWrangler(['pages', 'secret', 'put', key, '--project-name', projectName], { input: `${value}\n` });
};

const setAdminSecrets = async () => {
  console.log('Hashing admin password...');
  const passwordHash = await hash(adminPassword, 12);
  const sessionSecret = adminSessionSecret || randomBytes(32).toString('base64url');

  console.log('Updating Pages secrets...');
  putSecret('ADMIN_USERNAME', adminUsername);
  putSecret('ADMIN_PASSWORD_HASH', passwordHash);
  putSecret('ADMIN_SESSION_SECRET', sessionSecret);
};

const runDatabaseSetup = () => {
  console.log('Generating seed SQL from current content...');
  runNpm(['run', 'db:seed:generate']);
  console.log('Applying D1 migrations (remote)...');
  runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote'], { input: 'y\n' });
  console.log('Seeding D1 (remote)...');
  runWrangler(['d1', 'execute', 'DB', '--file', 'migrations/0002_seed.sql', '--remote']);
};

const buildAndDeploy = () => {
  if (skipDeploy) {
    console.log('Skipping deploy step (--skip-deploy).');
    return;
  }
  console.log('Building project...');
  runNpm(['run', 'build']);
  console.log('Deploying to Cloudflare Pages...');
  runWrangler(['pages', 'deploy', 'dist', '--project-name', projectName, '--branch', 'main']);
};

const main = async () => {
  ensureWranglerLogin();
  ensureD1Configured();
  ensurePagesProject();
  await setAdminSecrets();
  runDatabaseSetup();
  buildAndDeploy();

  console.log('\nBootstrap complete.');
  console.log(`Project: ${projectName}`);
  console.log('Try opening: /admin/login');
};

main().catch((error) => {
  console.error(`\nBootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
