import type { CanonicalTagDef } from './types';

export const CREDENTIAL_TAXONOMY: CanonicalTagDef[] = [
  {
    canonical: 'wifi',
    category: 'credential',
    description: 'Wi-Fi network passwords and hotspot credentials',
    aliases: {
      id: ['wifi', 'hotspot', 'ssid', 'wlan'],
      en: ['wifi', 'hotspot', 'ssid', 'wlan'],
    },
  },
  {
    canonical: 'server',
    category: 'credential',
    description: 'Server SSH, VPS, cloud, and hosting credentials',
    aliases: {
      id: ['server', 'ssh', 'vps', 'root', 'hosting', 'ip', 'port'],
      en: ['server', 'ssh', 'vps', 'root', 'hosting', 'cloud', 'ip', 'port'],
    },
  },
  {
    canonical: 'account',
    category: 'credential',
    description: 'User login credentials, usernames, and emails',
    aliases: {
      id: ['akun', 'login', 'email', 'username', 'sandi', 'sandi: '],
      en: ['account', 'login', 'email', 'username', 'credentials'],
    },
  },
  {
    canonical: 'database',
    category: 'credential',
    description: 'Database connection strings and database credentials',
    aliases: {
      id: ['database', 'db', 'postgres', 'mysql', 'mongodb', 'redis'],
      en: ['database', 'db', 'postgres', 'mysql', 'mongodb', 'redis'],
    },
  },
  {
    canonical: 'api',
    category: 'credential',
    description: 'API keys, client secrets, and bearer tokens',
    aliases: {
      id: ['api', 'token', 'secret', 'apikey', 'bearer'],
      en: ['api', 'token', 'secret', 'apikey', 'bearer', 'jwt'],
    },
  },
  {
    canonical: 'bank',
    category: 'credential',
    description: 'General mobile banking and bank credentials',
    aliases: {
      id: ['bank', 'mandiri', 'bri', 'bni', 'cimb'],
      en: ['bank', 'banking'],
    },
  },
  {
    canonical: 'bca',
    category: 'credential',
    description: 'Bank Central Asia credentials and accounts',
    aliases: {
      id: ['bca'],
      en: ['bca'],
    },
  },
  {
    canonical: 'rekening',
    category: 'credential',
    description: 'Bank account number credentials (no rek / nomor rekening)',
    aliases: {
      id: ['rekening', 'no rek', 'nomor rekening', 'norek'],
      en: ['account-number', 'bank-account'],
    },
  },
  {
    canonical: 'atm',
    category: 'credential',
    description: 'ATM PINs and cards',
    aliases: {
      id: ['atm'],
      en: ['atm'],
    },
  },
  {
    canonical: 'pin',
    category: 'credential',
    description: 'Security PIN numbers',
    aliases: {
      id: ['pin'],
      en: ['pin'],
    },
  },
];
