import type { Reporter, TestCase, TestResult, FullResult, Suite } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

interface RecordedResult {
  title: string;
  suite: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED';
  durationMs: number;
  error?: string;
}

export default class QAReporter implements Reporter {
  private results: RecordedResult[] = [];
  private startTime = Date.now();

  onBegin(_config: any, _suite: Suite) {
    this.startTime = Date.now();
    this.results = [];
  }

  onTestEnd(test: TestCase, result: TestResult) {
    let status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED';
    if (result.status === 'passed') {
      status = 'PASS';
    } else if (result.status === 'timedOut') {
      status = 'BLOCKED';
    } else if (result.status === 'skipped') {
      status = 'NOT_TESTED';
    } else {
      status = 'FAIL';
    }

    const suiteName = test.parent?.title || 'Root';
    const testTitle = test.title;
    const errorText = result.error?.message || result.error?.stack;

    this.results.push({
      title: testTitle,
      suite: suiteName,
      status,
      durationMs: result.duration,
      error: errorText,
    });
  }

  async onEnd(result: FullResult) {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const passCount = this.results.filter((r) => r.status === 'PASS').length;
    const failCount = this.results.filter((r) => r.status === 'FAIL').length;
    const blockedCount = this.results.filter((r) => r.status === 'BLOCKED').length;
    const notTestedCount = this.results.filter((r) => r.status === 'NOT_TESTED').length;

    let finalVerdict: 'QA PASS' | 'QA PASS WITH WARNINGS' | 'QA FAIL' | 'QA BLOCKED';
    if (failCount === 0 && blockedCount === 0) {
      finalVerdict = notTestedCount > 0 ? 'QA PASS WITH WARNINGS' : 'QA PASS';
    } else if (blockedCount > 0 && failCount === 0) {
      finalVerdict = 'QA BLOCKED';
    } else {
      finalVerdict = 'QA FAIL';
    }

    // Determine regression statuses by examining passing tests in specific domains (matching suite or title)
    const matchesDomain = (r: RecordedResult, keywords: string[]) => {
      const text = `${r.suite} ${r.title}`.toLowerCase();
      return keywords.some((k) => text.includes(k)) && r.status === 'PASS';
    };

    const hasOnboardingPass = this.results.some((r) => matchesDomain(r, ['onboarding', 'screen']));
    const hasPlanGenPass = this.results.some((r) => matchesDomain(r, ['plan gen', 'real plan', 'plan']));
    const hasRuntimePass = this.results.some((r) => matchesDomain(r, ['player', 'detailed sets', 'runtime', 'workout']));
    const hasPersistencePass = this.results.some((r) => matchesDomain(r, ['persist', 'reload']));
    const hasHistoryPass = this.results.some((r) => matchesDomain(r, ['history', 'session 2', 'historical', 'previous execution']));
    const hasT7Pass = this.results.some((r) => matchesDomain(r, ['t7', 'progression', 'missed targets', 'degraded']));
    const hasT9Pass = this.results.some((r) => matchesDomain(r, ['t9', 'recovery', 'fatigue', 'hysteresis']));
    const hasRegenPass = this.results.some((r) => matchesDomain(r, ['adaptive', 'adaptation', 'next generation']));
    const hasNutritionPass = this.results.some((r) => matchesDomain(r, ['nutrition', 'vegan', 'diet']));
    const hasQuantitativeNutritionPass = this.results.some((r) => matchesDomain(r, ['quantitative', 'targeting', 'bmr', 'energy']));

    const failures = this.results.filter((r) => r.status === 'FAIL' || r.status === 'BLOCKED');

    const reportContent = `# Adaptive Fitness QA Report

Run date/time: ${new Date().toISOString()}
Total duration: ${totalDuration.toFixed(2)}s
Browser/environment: Chromium (Expo Web Mobile Viewport 390x844)

## Summary

PASS: ${passCount}
FAIL: ${failCount}
BLOCKED: ${blockedCount}
NOT TESTED: ${notTestedCount}

## Test Matrix

| Suite | Test | Result | Duration | Details |
|-------|------|--------|----------|---------|
${this.results
  .map(
    (r) =>
      `| ${r.suite} | ${r.title} | ${r.status} | ${r.durationMs}ms | ${
        r.error ? r.error.replace(/\|/g, '/').slice(0, 80) : 'Clean execution'
      } |`
  )
  .join('\n')}

## Critical Failures

${
  failures.length === 0
    ? 'None. All automated E2E tests executed cleanly without regressions.'
    : failures
        .map(
          (f) => `### ${f.title} (${f.suite})
- Status: ${f.status}
- Details: ${f.error || 'Unknown error'}
- Expected: Step completed cleanly without error
- Actual: Failed assertion or timeout
`
        )
        .join('\n')
}

## Regression Status

- onboarding: ${hasOnboardingPass ? 'PASS' : 'NOT TESTED'}
- plan generation: ${hasPlanGenPass ? 'PASS' : 'NOT TESTED'}
- workout runtime: ${hasRuntimePass ? 'PASS' : 'NOT TESTED'}
- persistence: ${hasPersistencePass ? 'PASS' : 'NOT TESTED'}
- history: ${hasHistoryPass ? 'PASS' : 'NOT TESTED'}
- T7 adaptation: ${hasT7Pass ? 'PASS' : 'NOT TESTED'}
- T9 adaptation: ${hasT9Pass ? 'PASS' : 'NOT TESTED'}
- plan regeneration: ${hasRegenPass ? 'PASS' : 'NOT TESTED'}
- nutrition strategy: ${hasNutritionPass ? 'PASS' : 'NOT TESTED'}
- quantitative nutrition targeting: ${hasQuantitativeNutritionPass ? 'PASS' : 'NOT TESTED'}

## Final Verdict

${finalVerdict}
`;

    const reportPath = path.resolve(process.cwd(), 'QA_REPORT.md');
    fs.writeFileSync(reportPath, reportContent, 'utf-8');

    // Terminal summary
    console.log('\n========================================');
    console.log('       ADAPTIVE FITNESS QA SUMMARY      ');
    console.log('========================================');
    console.log(`PASS: ${passCount} | FAIL: ${failCount} | BLOCKED: ${blockedCount} | NOT TESTED: ${notTestedCount}`);
    console.log(`Report generated: ${reportPath}`);
    console.log(`FINAL VERDICT: ${finalVerdict}`);
    console.log('========================================\n');
  }
}
