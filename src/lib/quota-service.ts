import { db } from '@/db';
import { users, subscriptions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTelegramMsg, type SupportedLocale } from '@/lib/i18n/telegram';

export const FREE_MONTHLY_QUOTA = 30;

/**
 * Mendapatkan identifier periode penagihan/kuota bulanan berjalan dalam format YYYY-MM
 * berdasarkan zona waktu Asia/Jakarta (WIB).
 */
export function getCurrentBillingPeriod(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}

export interface QuotaCheckResult {
  allowed: boolean;
  isPro: boolean;
  tier: 'free' | 'pro';
  currentCount: number;
  maxQuota: number | null;
  remainingQuota: number | null;
  reason?: 'monthly_quota_exceeded' | 'pro_expired';
}

/**
 * Memeriksa status tier dan kuota pengguna:
 * 1. Pengecekan kedaluwarsa akun Pro (auto downgrade jika sudah lewat pro_expires_at).
 * 2. Pengecekan reset bulanan (lazy reset tiap awal bulan kalender Asia/Jakarta).
 * 3. Penegakan batas kuota (Free: 30 catatan/bulan, Pro: Unlimited).
 */
export async function checkUserQuotaAndTier(userId: string): Promise<QuotaCheckResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return {
      allowed: false,
      isPro: false,
      tier: 'free',
      currentCount: 0,
      maxQuota: FREE_MONTHLY_QUOTA,
      remainingQuota: 0,
    };
  }

  let userTier = (user.tier === 'pro' ? 'pro' : 'free') as 'free' | 'pro';

  // 1. Cek apakah masa berlaku Pro sudah habis
  if (userTier === 'pro' && user.proExpiresAt) {
    const now = new Date();
    if (new Date(user.proExpiresAt).getTime() < now.getTime()) {
      // Downgrade otomatis ke Free tier
      userTier = 'free';
      await db
        .update(users)
        .set({
          tier: 'free',
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      await db
        .update(subscriptions)
        .set({
          plan: 'free',
          status: 'expired',
        })
        .where(eq(subscriptions.userId, userId));
    }
  }

  // 2. Cek Pergantian Bulan Kalender (Lazy Reset)
  const currentPeriod = getCurrentBillingPeriod();
  let currentCount = user.monthlyNotesCount;

  if (user.currentBillingPeriod !== currentPeriod) {
    // Bulan telah berganti: reset kuota bulanan menjadi 0
    currentCount = 0;
    await db
      .update(users)
      .set({
        monthlyNotesCount: 0,
        currentBillingPeriod: currentPeriod,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // 3. Penegakan Kuota Catatan
  const isPro = userTier === 'pro';

  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      tier: 'pro',
      currentCount,
      maxQuota: null,
      remainingQuota: null,
    };
  }

  // Pengguna Free Tier
  if (currentCount >= FREE_MONTHLY_QUOTA) {
    return {
      allowed: false,
      isPro: false,
      tier: 'free',
      currentCount,
      maxQuota: FREE_MONTHLY_QUOTA,
      remainingQuota: 0,
      reason: 'monthly_quota_exceeded',
    };
  }

  return {
    allowed: true,
    isPro: false,
    tier: 'free',
    currentCount,
    maxQuota: FREE_MONTHLY_QUOTA,
    remainingQuota: FREE_MONTHLY_QUOTA - currentCount,
  };
}

/**
 * Menambahkan pemakaian catatan bulanan pengguna (+1).
 * Menghapus catatan TIDAK memanggil fungsi ini (kuota dihitung per konsumsi pembuatan).
 */
export async function incrementUserMonthlyNotes(userId: string): Promise<number> {
  const currentPeriod = getCurrentBillingPeriod();

  const [updated] = await db
    .update(users)
    .set({
      monthlyNotesCount: sql`${users.monthlyNotesCount} + 1`,
      currentBillingPeriod: currentPeriod,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ count: users.monthlyNotesCount });

  return updated?.count ?? 1;
}

/**
 * Template Pesan Paywall / Upgrade untuk Batas Kuota Bulanan di Telegram (30/30)
 */
export function getTelegramQuotaExceededMessage(webUrl = 'http://localhost:4321', locale: SupportedLocale = 'id'): {
  text: string;
  replyMarkup: { inline_keyboard: Array<Array<{ text: string; url: string }>> };
} {
  const settingsUrl = `${webUrl.replace(/\/$/, '')}/dashboard/settings#upgrade`;
  const text = getTelegramMsg('quota_exceeded', locale, { upgradeUrl: settingsUrl });
  const buttonText = getTelegramMsg('upgrade_button_pro', locale);

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: buttonText, url: settingsUrl }]],
    },
  };
}

/**
 * Template Pesan Gatekeeping untuk Fitur Eksklusif Pro (/secure, /vault, atau /ask)
 */
export function getTelegramProGatedMessage(webUrl = 'http://localhost:4321', locale: SupportedLocale = 'id'): {
  text: string;
  replyMarkup: { inline_keyboard: Array<Array<{ text: string; url: string }>> };
} {
  const settingsUrl = `${webUrl.replace(/\/$/, '')}/dashboard/settings#upgrade`;
  const text = getTelegramMsg('pro_gated', locale, { upgradeUrl: settingsUrl });
  const buttonText = getTelegramMsg('pro_gated_button', locale);

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: buttonText, url: settingsUrl }]],
    },
  };
}

// Aliases untuk backward compatibility
export const getTelegramVaultGatedMessage = getTelegramProGatedMessage;
export const getTelegramAskGatedMessage = getTelegramProGatedMessage;
