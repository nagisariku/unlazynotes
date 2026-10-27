import { extractScheduleEntries } from '../src/lib/ai/modules/schedule';

async function main() {
  console.log('=== TESTING PURE AI SCHEDULE EXTRACTION ===');
  // Base date: Thursday, 22 Oct 2026
  const baseDate = new Date('2026-10-22T08:00:00Z');
  const scheduleText = 'Gym sabtu, meeting client senin';
  const result = await extractScheduleEntries(scheduleText, baseDate);
  console.log('Schedule Dates Extracted by AI:', result.scheduleDates);

  if (
    result.scheduleDates.length === 2 &&
    result.scheduleDates[0] === '2026-10-24' &&
    result.scheduleDates[1] === '2026-10-26'
  ) {
    console.log('✅ SCHEDULE MODULE PASS');
  } else {
    console.error('❌ SCHEDULE MODULE FAIL', result.scheduleDates);
    process.exit(1);
  }

  console.log('\n🎉 ALL ENHANCEMENT TESTS PASSED PERFECTLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
