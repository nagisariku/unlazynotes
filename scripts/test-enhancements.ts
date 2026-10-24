import { extractUrlPathEntities, processBookmarkNote } from '../src/lib/ai/modules/bookmark';
import { parseScheduleDates, processScheduleNote } from '../src/lib/ai/modules/schedule';
import { heuristicExtractFinance } from '../src/lib/ai/modules/finance';

async function main() {
  console.log('=== 1. TESTING BOOKMARK MULTI-URL & ENTITIES ===');
  const bookmarkText =
    'Referensi UI keren https://github.com/shadcn-ui/ui tutorial https://youtube.com/watch?v=123 serta https://twitter.com/shadcn';
  const bookmarkRes = await processBookmarkNote(bookmarkText);
  console.log('Bookmark Category:', bookmarkRes.category);
  console.log('Bookmark Source:', bookmarkRes.source);
  console.log('Bookmark Specific Tags:', bookmarkRes.specific_tags);

  const hasGithub = bookmarkRes.specific_tags.includes('github');
  const hasShadcn = bookmarkRes.specific_tags.includes('shadcn');
  const hasYoutube = bookmarkRes.specific_tags.includes('youtube');
  const hasTwitter = bookmarkRes.specific_tags.includes('twitter');

  if (bookmarkRes.source === 'github' && hasGithub && hasShadcn && hasYoutube && hasTwitter) {
    console.log('✅ BOOKMARK MODULE PASS');
  } else {
    console.error('❌ BOOKMARK MODULE FAIL', bookmarkRes);
    process.exit(1);
  }

  console.log('\n=== 2. TESTING SCHEDULE RELATIVE DAY MAPPER ===');
  // Base date: Thursday, 22 Oct 2026
  const baseDate = new Date('2026-10-22T08:00:00Z');
  const scheduleText = 'Gym sabtu, meeting client senin';
  const scheduleDates = parseScheduleDates(scheduleText, baseDate);
  console.log('Schedule Dates Extracted:', scheduleDates);

  if (
    scheduleDates.length === 2 &&
    scheduleDates[0] === '2026-10-24' &&
    scheduleDates[1] === '2026-10-26'
  ) {
    console.log('✅ SCHEDULE MODULE PASS');
  } else {
    console.error('❌ SCHEDULE MODULE FAIL', scheduleDates);
    process.exit(1);
  }

  console.log('\n=== 3. TESTING FINANCE HEURISTIC EXTRACTOR ===');
  const financeText = 'makan siang 35k, bensin 25k, dapet transferan dari klien 500k';
  const financeRes = heuristicExtractFinance(financeText);
  console.log('Expenses:', financeRes.expenses);
  console.log('Income:', financeRes.income);

  const hasMakan = financeRes.expenses.some((e) => e.item.includes('makan') && e.amount === 35000);
  const hasBensin = financeRes.expenses.some((e) => e.item.includes('bensin') && e.amount === 25000);
  const hasIncome = financeRes.income.some((i) => i.amount === 500000);

  if (hasMakan && hasBensin && hasIncome) {
    console.log('✅ FINANCE MODULE PASS');
  } else {
    console.error('❌ FINANCE MODULE FAIL', financeRes);
    process.exit(1);
  }

  console.log('\n🎉 ALL ENHANCEMENT TESTS PASSED PERFECTLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
