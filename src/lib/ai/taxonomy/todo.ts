import type { CanonicalTagDef } from './types';

export const TODO_TAXONOMY: CanonicalTagDef[] = [
  {
    canonical: 'study',
    category: 'todo',
    description: 'Learning, coursework, study sessions, and homework',
    aliases: {
      id: ['belajar', 'kuliah', 'kursus', 'materi', 'pr', 'tugas', 'skripsi', 'baca'],
      en: ['study', 'course', 'homework', 'lecture', 'tutorial', 'class', 'reading', 'syllabus'],
    },
  },
  {
    canonical: 'exam',
    category: 'todo',
    description: 'Exams, tests, quizzes, and academic evaluations',
    aliases: {
      id: ['ujian', 'uts', 'uas', 'kuis', 'tes', 'sidang', 'evaluasi'],
      en: ['exam', 'test', 'quiz', 'midterm', 'finals', 'assessment', 'defense'],
    },
  },
  {
    canonical: 'work',
    category: 'todo',
    description: 'Employment, company tasks, client meetings, and professional projects',
    aliases: {
      id: ['kantor', 'kerja', 'rapat', 'klien', 'proyek', 'tim', 'atasan'],
      en: ['work', 'job', 'office', 'client', 'project', 'team', 'boss', 'deliverable'],
    },
  },
  {
    canonical: 'dev',
    category: 'todo',
    description: 'Software development, bug fixes, features, and deployment',
    aliases: {
      id: ['koding', 'refactor', 'fitur', 'deploy', 'desain'],
      en: ['code', 'coding', 'dev', 'bug', 'feature', 'deploy', 'api', 'refactor', 'pullrequest'],
    },
  },
  {
    canonical: 'health',
    category: 'todo',
    description: 'Physical fitness, doctor visits, and health habits',
    aliases: {
      id: ['lari', 'dokter', 'obat', 'sehat', 'istirahat'],
      en: ['health', 'doctor', 'medicine', 'dental', 'rest'],
    },
  },
  {
    canonical: 'workout',
    category: 'todo',
    description: 'Strength training, workout sessions, and exercises',
    aliases: {
      id: ['workout', 'olahraga', 'latihan'],
      en: ['workout', 'training', 'exercise'],
    },
  },
  {
    canonical: 'gym',
    category: 'todo',
    description: 'Gym fitness and weightlifting',
    aliases: {
      id: ['gym', 'fitness'],
      en: ['gym', 'fitness'],
    },
  },
  {
    canonical: 'errands',
    category: 'todo',
    description: 'Daily chores, grocery runs, and household tasks',
    aliases: {
      id: ['pasar', 'bersih', 'jemput', 'antar', 'paket'],
      en: ['errands', 'cleaning', 'pickup', 'delivery', 'chores', 'housework'],
    },
  },
];
