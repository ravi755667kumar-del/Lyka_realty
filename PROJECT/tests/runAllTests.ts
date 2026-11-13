import { testAiUsageTracker } from './aiUsageTracker.test';
import { testFirebaseSyncService } from './firebaseSyncService.test';
import { testPropertiesCatalog } from './propertiesCatalog.test';
import { testTwilioAndConfig } from './twilioAndConfig.test';
import { testLeadQualification } from './leadQualification.test';
import { testCapacitorMobile } from './capacitorMobile.test';
import { testLanguageSwitching } from './languageSwitching.test';
import { testLanguageUsage } from './languageUsage.test';
import { testSecurity } from './security.test';

async function main() {
  console.log('\n======================================================');
  console.log('   LYKA REALTY AI CALLING AGENT - TEST SUITE RUNNER   ');
  console.log('======================================================\n');

  const startTime = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const suites: { name: string; runner: () => Promise<{ name: string; passed: boolean; error?: string }[]> }[] = [
    { name: '1. AI Usage Tracker & Token Metrics (aiUsageTracker.ts)', runner: testAiUsageTracker },
    { name: '2. Firebase CRM Real-time Sync & Report Dispatch (firebaseSyncService.ts)', runner: testFirebaseSyncService },
    { name: '3. Properties Catalogue & Dubai Market Compatibility (properties)', runner: testPropertiesCatalog },
    { name: '4. Twilio Telephony & Phone Normalization (serverConfig.ts & twilio)', runner: testTwilioAndConfig },
    { name: '5. Lead Qualification, Sales Manager Alerts & DNC Rules', runner: testLeadQualification },
    { name: '6. Capacitor Mobile Runtime, Native Helpers & API Resolution (capacitor.ts)', runner: testCapacitorMobile },
    { name: '7. Dynamic Language Detection, Switching & Pure English Speech (speech.ts)', runner: testLanguageSwitching },
    { name: '8. User Language Usage Aggregation by Mobile Number (languageUsage.ts)', runner: testLanguageUsage },
    { name: '9. Security Hardening: CORS, Auth Gate, Rate Limit & Secret Masking (serverAuth.ts)', runner: testSecurity },
  ];

  for (const suite of suites) {
    console.log(`\n--- Running Suite: ${suite.name} ---`);
    const results = await suite.runner();

    for (const r of results) {
      totalTests++;
      if (r.passed) {
        passedTests++;
        console.log(`  [PASS] ${r.name}`);
      } else {
        failedTests++;
        console.error(`  [FAIL] ${r.name}`);
        if (r.error) console.error(`         Error: ${r.error}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;

  console.log('\n======================================================');
  console.log('                   TEST SUITE SUMMARY                 ');
  console.log('======================================================');
  console.log(` Total Tests Executed: ${totalTests}`);
  console.log(` Tests Passed:         ${passedTests}`);
  console.log(` Tests Failed:         ${failedTests}`);
  console.log(` Elapsed Time:         ${durationMs}ms`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    console.error(`FAILURE: ${failedTests} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`SUCCESS: All ${passedTests} tests passed cleanly with 0 errors!\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
