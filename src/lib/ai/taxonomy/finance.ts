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
    description: 'Recurring utility bills, rent, and subscriptions',
    aliases: {
      id: ['tagihan', 'langganan', 'pln', 'listrik', 'pdam', 'air', 'bpjs', 'wifi', 'internet', 'indihome', 'sewa'],
      en: ['bill', 'subscription', 'utility', 'utilities', 'electricity', 'water', 'rent', 'insurance', 'telecom'],
    },
  },
  {
    canonical: 'food',
    category: 'finance',
    description: 'Food, dining, groceries, and beverages',
    aliases: {
      id: ['seblak', 'ciken', 'ayam', 'bakso', 'makan', 'kopi', 'coffee', 'jajan', 'snack', 'lunch', 'dinner', 'sarapan', 'resto', 'cafe', 'warteg', 'padang', 'minum'],
      en: ['food', 'meal', 'lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'restaurant', 'groceries', 'snack', 'burger', 'pizza', 'drink'],
    },
  },
  {
    canonical: 'transport',
    category: 'finance',
    description: 'Transit, commute, fuel, and travel costs',
    aliases: {
      id: ['bensin', 'pertalite', 'pertamax', 'bbm', 'parkir', 'gojek', 'grab', 'tol', 'tiket', 'kereta', 'ojol', 'ongkir'],
      en: ['transport', 'fuel', 'gas', 'gasoline', 'parking', 'uber', 'lyft', 'taxi', 'toll', 'train', 'flight', 'bus', 'fare'],
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
      id: ['utang', 'hutang', 'piutang', 'pinjam', 'pinjaman', 'talangan'],
      en: ['debt', 'loan', 'owe', 'borrowed'],
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
