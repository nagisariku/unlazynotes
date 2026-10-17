import type { CanonicalTagDef } from './types';

export const GENERAL_TAXONOMY: CanonicalTagDef[] = [
  {
    canonical: 'travel',
    category: 'schedule',
    description: 'Vacations, trips, tours, and travel plans',
    aliases: {
      id: ['travel', 'trip', 'liburan', 'wisata', 'piknik', 'holiday'],
      en: ['travel', 'trip', 'vacation', 'holiday', 'tour', 'flight', 'journey'],
    },
  },
  {
    canonical: 'meeting',
    category: 'schedule',
    description: 'Meetings, syncs, and appointments',
    aliases: {
      id: ['meeting', 'rapat', 'sprint', 'sync', 'kumpul'],
      en: ['meeting', 'sync', 'call', 'appointment'],
    },
  },
  {
    canonical: 'event',
    category: 'schedule',
    description: 'General events and scheduled dates',
    aliases: {
      id: ['jadwal', 'acara', 'agenda', 'kegiatan', 'event'],
      en: ['event', 'schedule', 'agenda'],
    },
  },
  {
    canonical: 'recipe',
    category: 'reference',
    description: 'Food recipes, cooking instructions, and culinary guides',
    aliases: {
      id: ['resep', 'masak', 'bumbu', 'sambal', 'makanan', 'kuliner', 'matah'],
      en: ['recipe', 'cooking', 'cookbook', 'culinary'],
    },
  },
  {
    canonical: 'tech',
    category: 'reference',
    description: 'Technical notes, snippets, and system architecture',
    aliases: {
      id: ['arsitektur', 'koding', 'snippet', 'database', 'clean code'],
      en: ['tech', 'architecture', 'snippet', 'code', 'system'],
    },
  },
  {
    canonical: 'kodepos',
    category: 'reference',
    description: 'Postal codes and addresses',
    aliases: {
      id: ['kodepos', 'pos', 'alamat', 'zipcode'],
      en: ['kodepos', 'postal', 'zipcode', 'address'],
    },
  },
  {
    canonical: 'rant',
    category: 'random-yap',
    description: 'Emotional venting, complaints, and rants',
    aliases: {
      id: ['curhat', 'labrak', 'ngeluh', 'kesal', 'tetangga', 'berisik', 'marah', 'uneg-uneg'],
      en: ['rant', 'vent', 'complaint'],
    },
  },
  {
    canonical: 'kesehatan',
    category: 'others',
    description: 'Health symptoms, medications, and wellness notes',
    aliases: {
      id: ['kesehatan', 'medis', 'gejala', 'obat'],
      en: ['health', 'medical', 'symptom'],
    },
  },
  {
    canonical: 'desain',
    category: 'schedule',
    description: 'Design reviews, UI/UX sessions, and creative work',
    aliases: {
      id: ['desain', 'design', 'ui', 'ux'],
      en: ['design', 'ui', 'ux'],
    },
  },
  {
    canonical: 'ide',
    category: 'others',
    description: 'Creative ideas, content brainstorms, and raw concepts',
    aliases: {
      id: ['ide', 'konsep', 'inovasi'],
      en: ['idea', 'concept'],
    },
  },
  {
    canonical: 'idea',
    category: 'random-yap',
    description: 'Spontaneous ideas, brainstorming, and concepts',
    aliases: {
      id: ['kepikiran'],
      en: ['brainstorm'],
    },
  },
];
