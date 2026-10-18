import { resolveCanonicalTag } from './index';

export interface TagClusterDef {
  key: string;
  icon: string;
  name: {
    id: string;
    en: string;
  };
  shortName: {
    id: string;
    en: string;
  };
  umbrellas: string[];
}

export const TAG_CLUSTERS: TagClusterDef[] = [
  {
    key: 'culinary',
    icon: '🍔',
    name: {
      id: 'Kuliner & Minuman',
      en: 'Culinary & Drinks',
    },
    shortName: {
      id: 'Kuliner',
      en: 'Culinary',
    },
    umbrellas: [
      'food',
      'drink',
      'kopi',
      'snack',
      'cimin',
      'seblak',
      'martabak',
      'cilok',
      'nasgor',
      'tequila',
      'cooking',
      'recipe',
      'resto',
      'cafe',
      'makan',
      'minum',
      'kuliner',
      'beverage',
      'coffee',
      'tea',
      'mie',
      'bakso',
      'soto',
      'burger',
      'pizza',
      'ayam',
      'nasi',
      'sarapan',
      'lunch',
      'dinner',
      'dessert',
      'jajan',
      'gorengan',
      'tahu',
      'tempe',
      'sambal',
      'bumbu',
      'hangout',
      'tahu-gejrot',
      'kopi-kenangan',
    ],
  },
  {
    key: 'work',
    icon: '💼',
    name: {
      id: 'Pekerjaan & Bisnis',
      en: 'Work & Business',
    },
    shortName: {
      id: 'Kerja & Bisnis',
      en: 'Work & Business',
    },
    umbrellas: [
      'work',
      'client',
      'meeting',
      'project',
      'proposal',
      'shirobit',
      'demo',
      'q4-roadmap',
      'deploy',
      'hotfix',
      'bug',
      'evaluasi-sprint',
      'follow-up',
      'admin',
      'desain',
      'design',
      'presentation',
      'call',
      'sync',
      'kerja',
      'kantor',
      'bisnis',
      'business',
      'job',
      'sprint',
      'roadmap',
      'pitching',
      'klien',
      'vendor',
      'collab',
      'review',
      'pr-review',
      'brief',
      'tugas-kantor',
    ],
  },
  {
    key: 'finance',
    icon: '💳',
    name: {
      id: 'Keuangan & Akun',
      en: 'Finance & Accounts',
    },
    shortName: {
      id: 'Keuangan & Akun',
      en: 'Finance & Accounts',
    },
    umbrellas: [
      'finance',
      'bca',
      'mandiri',
      'bni',
      'bri',
      'jago',
      'rekening',
      'qris',
      'cash',
      'iuran',
      'kas-rt',
      'kas',
      'crypto-wallet',
      'metamask',
      'seed-phrase',
      'utang',
      'piutang',
      'fee',
      'tax',
      'uang',
      'money',
      'bank',
      'transfer',
      'tfr',
      'gopay',
      'ovo',
      'dana',
      'spay',
      'wallet',
      'crypto',
      'bitcoin',
      'btc',
      'eth',
      'usdt',
      'invoice',
      'pembayaran',
      'payment',
      'pajak',
      'gaji',
      'salary',
      'income',
      'expense',
      'investasi',
      'saham',
      'reksadana',
      'saldo',
      'rekening-bank',
      'pinjaman',
      'kredit',
    ],
  },
  {
    key: 'tech',
    icon: '🛠️',
    name: {
      id: 'Teknologi & Server',
      en: 'Tech & Infrastructure',
    },
    shortName: {
      id: 'Teknologi & Server',
      en: 'Tech & Server',
    },
    umbrellas: [
      'tech',
      'server',
      'vps',
      'hetzner',
      'ssh-key',
      'ssh',
      'wifi',
      'ssid',
      'database',
      'drizzle-orm',
      'orm',
      'cursor',
      'subscription',
      'dashboard',
      'login',
      'user-id',
      'dev',
      'api',
      'github',
      'devops',
      'code',
      'editor',
      'saas',
      'cloud',
      'ai',
      'ml',
      'ed25519',
      'sha256',
      'rsa4096',
      'password',
      'token',
      'postgres',
      'mysql',
      'redis',
      'docker',
      'linux',
      'ubuntu',
      'ip',
      'domain',
      'hosting',
      'ssl',
      'koding',
      'software',
      'git',
      'infrastructure',
      'backend',
      'frontend',
      'macbook',
      'medium',
      'app',
    ],
  },
  {
    key: 'shopping',
    icon: '🛒',
    name: {
      id: 'Belanja & Logistik',
      en: 'Shopping & Logistics',
    },
    shortName: {
      id: 'Belanja & Logistik',
      en: 'Shopping & Logistics',
    },
    umbrellas: [
      'shopping',
      'shopee',
      'tokopedia',
      'lazada',
      'amazon',
      'tiktok-shop',
      'uniqlo',
      'biore',
      'laundry',
      'cod',
      'jnt',
      'jne',
      'sicepat',
      'anteraja',
      'delivery',
      'paket',
      'belanja',
      'groceries',
      'supermarket',
      'indomaret',
      'alfamart',
      'pos-indonesia',
      'courier',
      'logistik',
      'baju',
      'kaos',
      'sepatu',
      'pakaian',
      'wardah',
      'rohto',
      'sabun',
      'clothing',
    ],
  },
  {
    key: 'mobility',
    icon: '🚗',
    name: {
      id: 'Mobilitas & Kendaraan',
      en: 'Mobility & Vehicles',
    },
    shortName: {
      id: 'Mobilitas & Kendaraan',
      en: 'Mobility & Vehicles',
    },
    umbrellas: [
      'mobility',
      'travel',
      'gojek',
      'grab',
      'motorcycle',
      'motor',
      'mobil',
      'tire-replacement',
      'tire',
      'ban',
      'tubeless',
      'sim',
      'driver-license',
      'drivers-license',
      'ktp',
      'parkir',
      'bensin',
      'bbm',
      'pertalite',
      'pertamax',
      'solar',
      'vehicle',
      'transit',
      'transport',
      'kodepos',
      'paspor',
      'flight',
      'kereta',
      'pesawat',
      'ojol',
      'kendaraan',
      'bengkel',
      'toll',
      'etoll',
      'commuter',
      'busway',
      'mrt',
      'lrt',
      'trip',
      'liburan',
      'wisata',
      'piknik',
      'macet',
      'polres',
    ],
  },
  {
    key: 'education',
    icon: '📚',
    name: {
      id: 'Kuliah & Belajar',
      en: 'Education & Study',
    },
    shortName: {
      id: 'Kuliah & Belajar',
      en: 'Education & Study',
    },
    umbrellas: [
      'education',
      'study',
      'kuliah',
      'itb',
      'ui',
      'ugm',
      'kampus',
      'universitas',
      'sekolah',
      'bimbingan',
      'bab',
      'skripsi',
      'ujian',
      'exam',
      'tugas',
      'materi',
      'course',
      'kursus',
      'belajar',
      'pr',
      'tugas-kuliah',
      'dosen',
      'matkul',
      'academic',
      'thesis',
      'buku',
      'book',
      'reading',
      'paper',
      'jurnal',
      'tutorial',
    ],
  },
  {
    key: 'lifestyle',
    icon: '🎬',
    name: {
      id: 'Hiburan & Gaya Hidup',
      en: 'Entertainment & Lifestyle',
    },
    shortName: {
      id: 'Hiburan & Gaya Hidup',
      en: 'Entertainment & Lifestyle',
    },
    umbrellas: [
      'lifestyle',
      'entertainment',
      'avatar',
      'movie',
      'film',
      'bioskop',
      'cinema',
      'cgv',
      'xxi',
      'cinepolis',
      'music',
      'spotify',
      'sound',
      'lofi',
      'instagram',
      'tiktok',
      'post',
      'article',
      'documentation',
      'cats',
      'kucing',
      'pet',
      'sleep',
      'tidur',
      'keyboard',
      'lube',
      'switch',
      'game',
      'gaming',
      'steam',
      'playstation',
      'anime',
      'manga',
      'health',
      'fitness',
      'workout',
      'gym',
      'medical',
      'paracetamol',
      'squat',
      'obat',
      'olahraga',
      'sehat',
      'klinik',
      'dokter',
      'vitamin',
      'hobi',
      'hobby',
      'konser',
      'youtube',
      'podcast',
      'netflix',
      'series',
      'wellness',
      'leg-day',
      'animasi',
      'voice-note',
    ],
  },
  {
    key: 'thoughts',
    icon: '💡',
    name: {
      id: 'Ide & Renungan',
      en: 'Ideas & Reflections',
    },
    shortName: {
      id: 'Ide & Renungan',
      en: 'Ideas & Reflections',
    },
    umbrellas: [
      'thoughts',
      'idea',
      'quote',
      'renungan',
      'philosophy',
      'nietzsche',
      'astronomy',
      'reflection',
      'quran',
      'hadits',
      'doa',
      'surah',
      'ayat',
      'rant',
      'curhat',
      'uneg-uneg',
      'shower-thought',
      'random-yap',
      'mindset',
      'filsafat',
      'ide-fitur',
      'fitur',
      'konsep',
      'brainstorm',
      'catatan-pribadi',
      'refleksi',
      'motivation',
      'inspirasi',
      'surah-asy-syarh',
    ],
  },
  {
    key: 'others',
    icon: '🏷️',
    name: {
      id: 'Lainnya',
      en: 'Others',
    },
    shortName: {
      id: 'Lainnya',
      en: 'Others',
    },
    umbrellas: [],
  },
];

export const CLUSTER_CATEGORY_ALIASES: Record<string, string> = {
  // culinary
  culinary: 'culinary',
  kuliner: 'culinary',
  food: 'culinary',
  drink: 'culinary',
  makanan: 'culinary',
  minuman: 'culinary',

  // work
  work: 'work',
  kerja: 'work',
  pekerjaan: 'work',
  bisnis: 'work',
  business: 'work',
  proyek: 'work',
  project: 'work',

  // finance
  finance: 'finance',
  keuangan: 'finance',
  finansial: 'finance',
  akun: 'finance',
  account: 'finance',
  uang: 'finance',

  // tech
  tech: 'tech',
  teknologi: 'tech',
  server: 'tech',
  infrastructure: 'tech',
  infrastruktur: 'tech',

  // shopping
  shopping: 'shopping',
  belanja: 'shopping',
  logistik: 'shopping',
  logistics: 'shopping',

  // mobility
  mobility: 'mobility',
  mobilitas: 'mobility',
  kendaraan: 'mobility',
  vehicle: 'mobility',
  travel: 'mobility',

  // education
  education: 'education',
  edukasi: 'education',
  kuliah: 'education',
  belajar: 'education',
  study: 'education',

  // lifestyle
  lifestyle: 'lifestyle',
  hiburan: 'lifestyle',
  entertainment: 'lifestyle',
  'gaya-hidup': 'lifestyle',
  gayahidup: 'lifestyle',

  // thoughts
  thoughts: 'thoughts',
  ide: 'thoughts',
  renungan: 'thoughts',
  idea: 'thoughts',
  ideas: 'thoughts',
  refleksi: 'thoughts',

  // others
  others: 'others',
  lainnya: 'others',
  other: 'others',
  lain: 'others',
};

/**
 * Resolves a keyword or sub-command string to a matching TagClusterDef.
 */
export function findClusterByKeyOrAlias(input: string): TagClusterDef | null {
  const norm = input.trim().toLowerCase();
  for (const c of TAG_CLUSTERS) {
    if (c.key === norm) return c;
  }
  const mappedKey = CLUSTER_CATEGORY_ALIASES[norm];
  if (mappedKey) {
    return TAG_CLUSTERS.find((c) => c.key === mappedKey) || null;
  }
  return null;
}

export interface ClusteredTags {
  cluster: TagClusterDef;
  tags: string[];
}

/**
 * Matches a specific raw tag to one of the 9 cluster categories or fallback 'others'.
 */
export function matchTagToCluster(tag: string): string {
  const normTag = tag.trim().toLowerCase();
  const canonical = resolveCanonicalTag(normTag);

  // 1. Direct match on tag or resolved canonical tag
  for (const c of TAG_CLUSTERS) {
    if (c.key === 'others') continue;
    if (
      c.umbrellas.includes(normTag) ||
      (canonical && c.umbrellas.includes(canonical))
    ) {
      return c.key;
    }
  }

  // 2. Subtoken / compound slug matching (e.g. crypto-wallet, seed-phrase, tire-replacement, q4-roadmap, evaluasi-sprint)
  const tokens = normTag.split(/[-_]+/).filter(Boolean);
  if (tokens.length > 1) {
    for (const c of TAG_CLUSTERS) {
      if (c.key === 'others') continue;
      for (const token of tokens) {
        const tokenCanonical = resolveCanonicalTag(token);
        if (
          c.umbrellas.includes(token) ||
          (tokenCanonical && c.umbrellas.includes(tokenCanonical))
        ) {
          return c.key;
        }
      }
    }
  }

  return 'others';
}

/**
 * Dynamically clusters raw specific tags by resolving their root canonical umbrella and compound tokens.
 * Sorts tags alphabetically ascending (A-Z) per cluster and returns only non-empty clusters.
 */
export function clusterTags(tags: string[]): ClusteredTags[] {
  const uniqueTags = Array.from(
    new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
  );
  const clusterMap = new Map<string, string[]>();

  for (const c of TAG_CLUSTERS) {
    clusterMap.set(c.key, []);
  }

  for (const tag of uniqueTags) {
    const clusterKey = matchTagToCluster(tag);
    clusterMap.get(clusterKey)!.push(tag);
  }

  const result: ClusteredTags[] = [];

  for (const c of TAG_CLUSTERS) {
    const clusterTagList = clusterMap.get(c.key) || [];
    if (clusterTagList.length > 0) {
      clusterTagList.sort((a, b) => a.localeCompare(b));
      result.push({
        cluster: c,
        tags: clusterTagList,
      });
    }
  }

  return result;
}

/**
 * Calculates tag frequency and returns the top N most active tags.
 */
export function getTopTags(
  rawTags: string[],
  limit = 9
): { tag: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const t of rawTags) {
    const norm = t.trim().toLowerCase();
    if (!norm) continue;
    freq.set(norm, (freq.get(norm) || 0) + 1);
  }

  return Array.from(freq.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/**
 * Formats top active tags into compact bullet list for Telegram:
 * • #tag (count)
 */
export function formatTopTagsMarkdown(
  topTags: { tag: string; count: number }[],
  locale: 'id' | 'en' = 'id'
): string {
  if (topTags.length === 0) {
    return locale === 'en' ? '_No active tags._' : '_Belum ada tag aktif._';
  }

  const escapeMd = (str: string) => str.replace(/([_*`\[\]])/g, '\\$1');
  return topTags
    .map((item) => `• #${escapeMd(item.tag)} (${item.count})`)
    .join('\n');
}

/**
 * Formats cluster summary with count of unique tags into compact bullet list for Telegram:
 * • 🍔 Kuliner (11 tag)
 */
export function formatClustersSummaryMarkdown(
  clusters: ClusteredTags[],
  locale: 'id' | 'en' = 'id'
): string {
  const activeClusters = clusters.filter((c) => c.tags.length > 0);
  if (activeClusters.length === 0) {
    return locale === 'en'
      ? '_No category clusters recorded._'
      : '_Belum ada klaster kategori tercatat._';
  }

  return activeClusters
    .map(({ cluster, tags }) => {
      const clusterShort =
        locale === 'en' ? cluster.shortName.en : cluster.shortName.id;
      const count = tags.length;
      const tagLabel =
        locale === 'en' ? (count === 1 ? '1 tag' : `${count} tags`) : `${count} tag`;
      return `• ${cluster.icon} ${clusterShort} (${tagLabel})`;
    })
    .join('\n');
}

/**
 * Legacy formatter for detailed clustered tags:
 * {icon} *{Nama Cluster}:*
 * #tag-a, #tag-b, #tag-c
 */
export function formatTagClustersMarkdown(
  clusters: ClusteredTags[],
  locale: 'id' | 'en' = 'id'
): string {
  if (clusters.length === 0) return '';

  const escapeMd = (str: string) => str.replace(/([_*`\[\]])/g, '\\$1');

  return clusters
    .map(({ cluster, tags }) => {
      const clusterTitle = locale === 'en' ? cluster.name.en : cluster.name.id;
      const formattedTags = tags
        .map((t) => (t.startsWith('#') ? escapeMd(t) : `#${escapeMd(t)}`))
        .join(', ');
      return `${cluster.icon} *${clusterTitle}:*\n${formattedTags}`;
    })
    .join('\n\n');
}
