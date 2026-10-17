import { resolveCanonicalTag } from './index';

export interface TagClusterDef {
  key: string;
  icon: string;
  name: {
    id: string;
    en: string;
  };
  umbrellas: string[];
}

export const TAG_CLUSTERS: TagClusterDef[] = [
  {
    key: 'culinary',
    icon: '🍽️',
    name: {
      id: 'Kuliner & Minuman',
      en: 'Culinary & Drinks',
    },
    umbrellas: ['food', 'drink', 'kopi', 'snack', 'recipe', 'culinary', 'hangout'],
  },
  {
    key: 'work',
    icon: '💼',
    name: {
      id: 'Pekerjaan & Proyek',
      en: 'Work & Projects',
    },
    umbrellas: [
      'work',
      'client',
      'meeting',
      'project',
      'admin',
      'call',
      'desain',
      'design',
      'presentation',
      'demo',
    ],
  },
  {
    key: 'tech',
    icon: '🛠️',
    name: {
      id: 'Teknologi & Server',
      en: 'Tech & Infrastructure',
    },
    umbrellas: [
      'tech',
      'server',
      'database',
      'subscription',
      'dev',
      'api',
      'github',
      'devops',
      'code',
      'editor',
      'cursor',
      'saas',
      'cloud',
      'ai',
      'ml',
    ],
  },
  {
    key: 'shopping',
    icon: '🛒',
    name: {
      id: 'Belanja & Logistik',
      en: 'Shopping & Logistics',
    },
    umbrellas: ['shopping', 'delivery', 'laundry', 'groceries', 'belanja'],
  },
  {
    key: 'mobility',
    icon: '🚗',
    name: {
      id: 'Mobilitas & Dokumen',
      en: 'Mobility & Documents',
    },
    umbrellas: [
      'travel',
      'vehicle',
      'transit',
      'transport',
      'kodepos',
      'sim',
      'ktp',
      'paspor',
      'flight',
    ],
  },
  {
    key: 'wellness',
    icon: '🧘',
    name: {
      id: 'Kesehatan & Personal',
      en: 'Health & Wellness',
    },
    umbrellas: ['health', 'fitness', 'medical', 'workout', 'gym'],
  },
  {
    key: 'thoughts',
    icon: '💡',
    name: {
      id: 'Ide & Renungan',
      en: 'Ideas & Reflections',
    },
    umbrellas: [
      'idea',
      'reflection',
      'quote',
      'quran',
      'hadits',
      'doa',
      'rant',
      'curhat',
      'renungan',
    ],
  },
  {
    key: 'others',
    icon: '🏷️',
    name: {
      id: 'Lainnya',
      en: 'Others',
    },
    umbrellas: [],
  },
];

export interface ClusteredTags {
  cluster: TagClusterDef;
  tags: string[];
}

/**
 * Dynamically clusters raw specific tags by resolving their root canonical umbrella.
 * DILARANG hardcode daftar tag spesifik (kata benda).
 * Evaluasi dinamis:
 * 1. Cek canonical umbrella via resolveCanonicalTag(tag).
 * 2. Masukkan ke cluster yang menaungi umbrella tersebut.
 * 3. Jika tidak cocok, masukkan ke cluster 'others' (Lainnya).
 * 4. Urutkan tag per cluster Alphabetical Ascending (A ke Z).
 * 5. Hanya kembalikan cluster yang memiliki minimal 1 tag aktif.
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
    const canonical = resolveCanonicalTag(tag);
    let matchedClusterKey: string | null = null;

    for (const c of TAG_CLUSTERS) {
      if (c.key === 'others') continue;
      if (
        (canonical && c.umbrellas.includes(canonical)) ||
        c.umbrellas.includes(tag)
      ) {
        matchedClusterKey = c.key;
        break;
      }
    }

    if (!matchedClusterKey) {
      matchedClusterKey = 'others';
    }

    clusterMap.get(matchedClusterKey)!.push(tag);
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
 * Formats clustered tags into markdown text block for Telegram:
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
