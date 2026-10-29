import type { CredentialType } from '@/db/schema';

export const STANDARD_CREDENTIAL_TITLES: Record<string, string> = {
  digital_access: 'Akun & Akses Digital',
  civil_identity: 'Identitas Resmi & Sipil',
  financial_instrument: 'Finansial & Perbankan',
  cryptographic_token: 'Kunci Kriptografi & Lisensi',
  physical_access: 'Akses Fisik & PIN',
  other: 'Kredensial Lainnya',
};

export function formatCredentialTypeTitle(type: string): string {
  const key = type.toLowerCase().trim();
  if (STANDARD_CREDENTIAL_TITLES[key]) {
    return STANDARD_CREDENTIAL_TITLES[key];
  }
  return key
    .split(/[_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function normalizeCredentialType(raw: any): CredentialType {
  const val = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!val) return 'other';

  if (
    [
      'digital_access',
      'account',
      'akun',
      'login',
      'user',
      'password',
      'web',
      'email',
      'network',
      'jaringan',
      'wifi',
      'router',
      'iot',
      'ssh',
      'server',
      'database_login',
      'hosting',
    ].includes(val)
  ) {
    return 'digital_access';
  }

  if (
    [
      'civil_identity',
      'identity',
      'identitas',
      'ktp',
      'nik',
      'sim',
      'paspor',
      'passport',
      'npwp',
      'bpjs',
      'kk',
      'pribadi',
      'legal',
      'sipil',
      'akta',
      'nip',
      'nim',
    ].includes(val)
  ) {
    return 'civil_identity';
  }

  if (
    [
      'financial_instrument',
      'finance',
      'finansial',
      'bank',
      'rekening',
      'atm',
      'pin',
      'kartu',
      'credit_card',
      'debit',
      'cvv',
      'wallet',
      'ewallet',
      'crypto',
      'sekuritas',
      'saham',
    ].includes(val)
  ) {
    return 'financial_instrument';
  }

  if (
    [
      'cryptographic_token',
      'license',
      'lisensi',
      'token',
      'key',
      'api',
      'api_key',
      'seed',
      'seed_phrase',
      'mnemonic',
      'secret',
      'voucher',
      '2fa',
      'recovery',
      'product_key',
      'serial',
    ].includes(val)
  ) {
    return 'cryptographic_token';
  }

  if (
    [
      'physical_access',
      'physical',
      'fisik',
      'pintu',
      'door',
      'smart_lock',
      'loker',
      'koper',
      'brankas',
      'gate',
      'gerbang',
      'gembok',
    ].includes(val)
  ) {
    return 'physical_access';
  }

  return val as CredentialType;
}
