import 'dotenv/config';
import { generateNoteTags } from '../src/lib/ai';

async function test() {
  console.log('Testing generateNoteTags with Cosmoshub deepseek-v4.1-flash...');
  const sampleNote = 'meeting dengan rina jam 2';
  const start = performance.now();
  const res = await generateNoteTags(sampleNote);
  const dur = performance.now() - start;

  console.log(`Duration: ${Math.round(dur)}ms`);
  console.log('Result:', JSON.stringify(res, null, 2));

  if (res.category === 'schedule') {
    console.log('✅ AI SDK Integration with deepseek-v4.1-flash SUCCESSFUL!');
  } else {
    console.log('⚠️ Result was:', res);
  }
  process.exit(0);
}

test();
