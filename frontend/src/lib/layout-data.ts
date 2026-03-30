import { getProfile, getSiteConfig } from './db';
import { getPublicEnv } from './env';

export const getLayoutData = async (locals: App.Locals) => {
  const env = getPublicEnv(locals);
  const [profile, siteConfig] = await Promise.all([getProfile(env.DB), getSiteConfig(env.DB)]);
  return { env, profile, siteConfig };
};
