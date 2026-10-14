import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthSessionUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  preferredLocale: string;
  image?: string | null;
}

/**
 * Get current authenticated user from request headers, with dev fallback for local tests.
 */
export async function getSessionUser(request: Request): Promise<AuthSessionUser | null> {
  try {
    const sessionData = await auth.api.getSession({ headers: request.headers });
    if (sessionData && sessionData.user) {
      return {
        id: sessionData.user.id,
        name: sessionData.user.name || null,
        email: sessionData.user.email,
        role: (sessionData.user as any).role || 'user',
        preferredLocale: (sessionData.user as any).preferredLocale || 'id',
        image: sessionData.user.image || null,
      };
    }
  } catch (err) {
    // Session parse error
  }

  // Fallback dev testing session via Cookie 'dev_user_id' or test header 'X-Dev-User-Id'
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/dev_user_id=([^;]+)/);
  const devUserId = match ? match[1] : request.headers.get('X-Dev-User-Id');

  if (devUserId) {
    const [user] = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);
    if (user) {
      return {
        id: user.id,
        name: user.name || null,
        email: user.email,
        role: user.role,
        preferredLocale: user.preferredLocale,
        image: user.image || null,
      };
    }
  }

  return null;
}
