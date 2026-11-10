import * as S from './store.js';
import { go } from './router.js';

export function requireSession() {
  if (S.get().session) return true;
  go(S.get().onboarded ? '/auth/login' : '/onboarding');
  return false;
}
