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
    description: 'Meetings, syncs, product demos, and discussions',
    aliases: {
      id: ['meeting', 'rapat', 'sprint', 'sync', 'kumpul', 'demo', 'diskusi', 'roadmap', 'q4-roadmap'],
      en: ['meeting', 'sync', 'call', 'demo', 'presentation', 'discuss', 'coffee-break', 'roadmap', 'q4-roadmap'],
    },
  },
  {
    canonical: 'entertainment',
    category: 'schedule',
    description: 'Cinemas, movies, concerts, shows, and streaming entertainment',
    aliases: {
      id: ['bioskop', 'cinema', 'nonton', 'cgv', 'xxi', 'cinepolis', 'film', 'movie', 'avatar', 'konser', 'hiburan'],
      en: ['entertainment', 'cinema', 'movie', 'concert', 'show', 'theater', 'avatar'],
    },
  },
  {
    canonical: 'work',
    category: 'schedule',
    description: 'Work, client projects, and professional tasks',
    aliases: {
      id: ['kerja', 'pekerjaan', 'kantor', 'projek', 'klien', 'client'],
      en: ['work', 'job', 'project', 'client'],
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
    canonical: 'health',
    category: 'random-yap',
    description: 'Health symptoms, medications, and wellness notes',
    aliases: {
      id: ['kesehatan', 'medis', 'gejala', 'obat', 'paracetamol', 'panadol', 'bodrex', 'migrain', 'pusing', 'demam', 'flu', 'batuk', 'vitamin', 'apotek', 'dokter', 'klinik'],
      en: ['health', 'medical', 'symptom', 'medicine', 'paracetamol', 'panadol', 'vitamin', 'clinic', 'doctor'],
    },
  },
  {
    canonical: 'workout',
    category: 'others',
    description: 'Gym, fitness, and workout exercises',
    aliases: {
      id: ['fitness', 'gym', 'workout', 'squat', 'bench-press', 'deadlift', 'pushup', 'pullup', 'cardio', 'leg-day'],
      en: ['fitness', 'gym', 'workout', 'squat', 'bench-press', 'deadlift', 'pushup', 'pullup', 'cardio', 'exercise'],
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
    canonical: 'idea',
    category: 'others',
    description: 'Creative ideas, content brainstorms, and raw concepts',
    aliases: {
      id: ['ide', 'konsep', 'inovasi', 'kepikiran', 'ide-fitur', 'fitur', 'konten'],
      en: ['idea', 'concept', 'brainstorm', 'feature-idea'],
    },
  },
];
