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
    description: 'ATM PINs, mobile banking, and bank account credentials',
    aliases: {
      id: ['pin', 'atm', 'bank', 'bca', 'mandiri', 'bri', 'bni', 'cimb'],
      en: ['pin', 'atm', 'bank', 'banking'],
    },
  },
];
