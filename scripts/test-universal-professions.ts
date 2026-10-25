import assert from 'node:assert';
import { processGeneralNote, normalizeCategory } from '../src/lib/ai/modules/general';

async function run() {
  console.log('=== Testing Universal Modal Mapping Across Professions ===');

  // Test 1: normalizeCategory unit tests for cross-profession synonyms
  assert(normalizeCategory('todo') === 'todo', 'Direct todo');
  assert(normalizeCategory('prep') === 'todo', 'Chef prep -> todo');
  assert(normalizeCategory('preparation') === 'todo', 'Preparation -> todo');
  assert(normalizeCategory('assignment') === 'todo', 'Student assignment -> todo');
  assert(normalizeCategory('proyek') === 'todo', 'Project -> todo');
  assert(normalizeCategory('recipe') === 'reference', 'Recipe -> reference');
  assert(normalizeCategory('resep') === 'reference', 'Resep -> reference');
  assert(normalizeCategory('dosage') === 'reference', 'Dosage -> reference');
  assert(normalizeCategory('dosis') === 'reference', 'Dosis -> reference');
  assert(normalizeCategory('pasal') === 'reference', 'Pasal -> reference');
  assert(normalizeCategory('somasi') === 'draft', 'Somasi -> draft');
  assert(normalizeCategory('rujukan') === 'draft', 'Rujukan -> draft');
  assert(normalizeCategory('sidang') === 'schedule', 'Sidang -> schedule');
  assert(normalizeCategory('shift') === 'schedule', 'Shift jaga -> schedule');
  assert(normalizeCategory('symptom') === 'random-yap', 'Symptom -> random-yap');
  assert(normalizeCategory('otp') === 'others', 'OTP -> others');
  assert(normalizeCategory('others') === 'others', 'Direct others -> others');
  // Unknown industry string should default to todo, NEVER others
  assert(normalizeCategory('culinary-action') === 'todo', 'Unknown industry action defaults to todo');
  assert(normalizeCategory('medical-plan') === 'todo', 'Unknown industry plan defaults to todo');
  console.log('✅ Unit normalizer assertions passed!');

  // Test 2: Live AI test on software caching note
  console.log('Testing Software Developer Note with Live LLM...');
  const softwareNote = `unlazynotes
- sistem caching pintar untuk meningkatkan performa, kecepatan, dan mengurangi beban server.
fetch kalau emang ada perubahan aja di datanya + fetchingnya nge update bagian perubahannya aja.`;
  const resSoft = await processGeneralNote(softwareNote);
  console.log('Software Note Category:', resSoft.category, 'Tags:', resSoft.specific_tags);
  assert(resSoft.category === 'todo' || resSoft.category === 'draft' || resSoft.category === 'reference', `Expected software note to be valid pillar, got ${resSoft.category}`);

  // Test 3: Live AI test on Chef Mise en place note
  console.log('Testing Chef Preparation Note with Live LLM...');
  const chefNote = `Dapur Resto:
- Potong dadu daging sapi 5kg buat rendang besok siang
- Marinasi ayam dengan bawang putih dan jahe 2 jam`;
  const resChef = await processGeneralNote(chefNote);
  console.log('Chef Note Category:', resChef.category, 'Tags:', resChef.specific_tags);
  assert(resChef.category === 'todo', `Expected chef prep note to be todo, got ${resChef.category}`);

  // Test 4: Live AI test on Medical Dosage Fact
  console.log('Testing Medical Dosage Fact with Live LLM...');
  const medNote = `Paracetamol sirup anak: 10-15 mg/kgBB per kali minum, maksimal 4 kali sehari.`;
  const resMed = await processGeneralNote(medNote);
  console.log('Medical Note Category:', resMed.category, 'Tags:', resMed.specific_tags);
  assert(resMed.category === 'reference', `Expected medical dosage note to be reference, got ${resMed.category}`);

  console.log('🎉 ALL UNIVERSAL PROFESSION TESTS PASSED 100%!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Universal profession test failed:', err);
  process.exit(1);
});
