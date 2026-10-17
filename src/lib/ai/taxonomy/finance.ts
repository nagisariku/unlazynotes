import type { CanonicalTagDef } from './types';

export const FINANCE_TAXONOMY: CanonicalTagDef[] = [
  {
    canonical: 'expenses',
    category: 'finance',
    description: 'General outflow, purchases, and payments',
    aliases: {
      id: ['pengeluaran', 'belanja', 'beli', 'bayar', 'traktir', 'nraktir', 'cash', 'ongkos'],
      en: ['expense', 'expenses', 'spending', 'purchase', 'spent', 'bought', 'cost', 'pay', 'paid'],
    },
  },
  {
    canonical: 'income',
    category: 'finance',
    description: 'Inflow, earnings, wages, and revenue',
    aliases: {
      id: ['pemasukan', 'gaji', 'salary', 'cair', 'transfer masuk', 'bonus', 'omset', 'dividen', 'upah'],
      en: ['income', 'salary', 'earnings', 'wage', 'dividend', 'bonus', 'revenue', 'inflow', 'paycheck'],
    },
  },
  {
    canonical: 'bill',
    category: 'finance',
    description: 'Recurring utility bills, rent, and public services',
    aliases: {
      id: ['tagihan', 'pln', 'listrik', 'pdam', 'air', 'bpjs', 'wifi', 'internet', 'indihome', 'sewa'],
      en: ['bill', 'utility', 'utilities', 'electricity', 'water', 'rent', 'insurance', 'telecom'],
    },
  },
  {
    canonical: 'subscription',
    category: 'finance',
    description: 'Recurring SaaS, memberships, digital services, and subscriptions',
    aliases: {
      id: ['langganan', 'subs', 'subscription', 'membership'],
      en: ['subscription', 'saas', 'membership', 'subs'],
    },
  },
  {
    canonical: 'food',
    category: 'finance',
    description: 'Food, dining, groceries, and meals',
    aliases: {
      id: ['makanan', 'cimin', 'rendang', 'cireng', 'batagor', 'seblak', 'nasgor', 'ayam', 'ciken', 'bakso', 'mie', 'sate', 'martabak', 'cilok', 'tahu-gejrot', 'tahu gejrot', 'siomay', 'pempek', 'soto', 'rawon', 'gorengan', 'makan', 'jajan', 'snack', 'lunch', 'dinner', 'sarapan', 'resto', 'cafe', 'warteg', 'padang'],
      en: ['food', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'groceries', 'snack', 'burger', 'pizza', 'snack-food'],
    },
  },
  {
    canonical: 'drink',
    category: 'finance',
    description: 'Beverages, coffee, tea, alcohol, and drinks',
    aliases: {
      id: ['minum', 'minuman', 'tequila', 'kopi', 'coffee', 'matcha', 'boba', 'jus', 'juice', 'teh', 'tea', 'latte', 'es-teh', 'susu', 'bir', 'beer', 'wine', 'alkohol', 'soju', 'vodka', 'cocktail', 'liquor'],
      en: ['drink', 'beverage', 'drinks', 'coffee', 'tea', 'matcha', 'boba', 'juice', 'beer', 'wine', 'liquor', 'cocktail', 'alcohol'],
    },
  },
  {
    canonical: 'transport',
    category: 'finance',
    description: 'Transit, commute, fuel, and travel costs',
    aliases: {
      id: ['bensin', 'pertalite', 'pertamax', 'bbm', 'parkir', 'gojek', 'grab', 'tol', 'kereta', 'krl', 'mrt', 'ojol', 'ongkir', 'pesawat'],
      en: ['transport', 'fuel', 'gas', 'gasoline', 'parking', 'uber', 'lyft', 'taxi', 'toll', 'train', 'flight', 'bus', 'fare'],
    },
  },
  {
    canonical: 'tech',
    category: 'finance',
    description: 'Servers, cloud, hosting, and tech infrastructure',
    aliases: {
      id: ['vps', 'server', 'hosting', 'domain', 'cloud', 'software', 'cursor'],
      en: ['tech', 'technology', 'vps', 'server', 'hosting', 'domain', 'cloud', 'software', 'saas', 'cursor'],
    },
  },
  {
    canonical: 'entertainment',
    category: 'finance',
    description: 'Cinemas, movies, concerts, shows, and streaming entertainment',
    aliases: {
      id: ['bioskop', 'cinema', 'nonton', 'xxi', 'cgv', 'cinepolis', 'konser', 'hiburan', 'film', 'movie'],
      en: ['entertainment', 'cinema', 'movie', 'concert', 'show', 'theater'],
    },
  },
  {
    canonical: 'laundry',
    category: 'finance',
    description: 'Clothes cleaning and laundry expenses',
    aliases: {
      id: ['londry', 'laundry', 'cuci', 'setrika'],
      en: ['laundry', 'drycleaning'],
    },
  },
  {
    canonical: 'hangout',
    category: 'finance',
    description: 'Social events, hanging out, and entertainment with friends',
    aliases: {
      id: ['nongkrong', 'hangout', 'ngopi', 'chill', 'nobar'],
      en: ['hangout', 'party', 'drinks', 'social', 'clubbing'],
    },
  },
  {
    canonical: 'shopping',
    category: 'finance',
    description: 'Retail shopping, electronics, clothing, and gear',
    aliases: {
      id: ['baju', 'sepatu', 'gadget', 'shopee', 'tokopedia', 'olshop', 'tas'],
      en: ['shopping', 'clothes', 'shoes', 'amazon', 'gadget', 'retail'],
    },
  },
  {
    canonical: 'investment',
    category: 'finance',
    description: 'Capital investments, stocks, and crypto',
    aliases: {
      id: ['investasi', 'saham', 'crypto', 'reksadana', 'nabung', 'deposito'],
      en: ['investment', 'stocks', 'crypto', 'bitcoin', 'savings', 'equity'],
    },
  },
  {
    canonical: 'gaming',
    category: 'finance',
    description: 'Video games, gaming top-ups, skins, and digital entertainment',
    aliases: {
      id: ['game', 'gaming', 'skin', 'vandal', 'steam', 'topup', 'diamond', 'mlbb', 'valorant', 'genshin', 'playstation'],
      en: ['game', 'gaming', 'skin', 'steam', 'topup', 'videogame'],
    },
  },
  {
    canonical: 'debt',
    category: 'finance',
    description: 'Loans, debts, and borrowed money',
    aliases: {
      id: ['pinjam', 'pinjaman'],
      en: ['debt', 'loan', 'owe', 'borrowed'],
    },
  },
  {
    canonical: 'piutang',
    category: 'finance',
    description: 'Money lent to others / receivables (uang kita dipinjam orang)',
    aliases: {
      id: ['piutang', 'pinjemin', 'talangin'],
      en: ['receivable', 'lent'],
    },
  },
  {
    canonical: 'utang',
    category: 'finance',
    description: 'Money borrowed from others / payable debts (kewajiban bayar kita)',
    aliases: {
      id: ['utang', 'hutang', 'ngutang'],
      en: ['payable', 'debt-owed'],
    },
  },
  {
    canonical: 'kopi',
    category: 'finance',
    description: 'Coffee drinks and specialty coffee shops',
    aliases: {
      id: ['kopi', 'kopi-kenangan', 'ngopi'],
      en: ['coffee'],
    },
  },
  {
    canonical: 'indihome',
    category: 'finance',
    description: 'Specific major Indonesian ISP service expense',
    aliases: {
      id: ['indihome', 'telkom'],
      en: ['indihome'],
    },
  },
];
