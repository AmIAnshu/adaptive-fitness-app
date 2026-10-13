# Adaptive Fitness QA Report

Run date/time: 2026-10-10T12:38:02.070Z
Total duration: 102.31s
Browser/environment: Chromium (Expo Web Mobile Viewport 390x844)

## Summary

PASS: 46
FAIL: 0
BLOCKED: 0
NOT TESTED: 0

## Test Matrix

| Suite | Test | Result | Duration | Details |
|-------|------|--------|----------|---------|
| LEVEL A — Fast Regression Suite | Fast Regression: Bootstrap -> Plan Gen -> Overview -> Player -> Set -> Complete -> Persist -> Reload | PASS | 7661ms | Clean execution |
| LEVEL B — Core Product Flow Suite | Core Product Flow: Bootstrap -> Real Plan -> Overview -> Start -> Detailed Sets -> Complete -> Persist -> Reload -> Session 2 | PASS | 8034ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 1: Clean performance preserves unconstrained recovery and standard volume | PASS | 1949ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 2: Missed targets halts progression with maintain decision | PASS | 1688ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 3: Repeated degraded performance activates T7 regression behavior | PASS | 1959ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 4: High fatigue and soreness elevates T9 recovery constraint level | PASS | 1865ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 5: Repeated under-recovery elevates to strongly_constrained | PASS | 1663ms | Clean execution |
| LEVEL C — Adaptive Behavior Suite (Stage W6.2) | Scenario 6: Recovery improvement respects hysteresis dampening | PASS | 1754ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Strategy: Bootstrap Baseline Persona -> Verify Nutrition Strategy & Invariants | PASS | 1225ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Strategy: Bootstrap Vegan Persona F -> Strict Exclusions & Structure Invariants | PASS | 1206ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Targeting: Bootstrap Quantitative-Ready Persona G -> Verify Complete Targets & Invariants | PASS | 1211ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Targeting: Unstated Biological Sex Persona A -> Explicit Pending Notice & Zero Fabricated Metrics | PASS | 1158ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Targeting: Bootstrap Female Persona H -> Complete Female Targets & Invariants | PASS | 1324ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Targeting: Bootstrap Prefer-Not-To-Say Persona I -> Clean Pending UX & Zero Targets | PASS | 1226ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Plan Generator: Bootstrap Quantitative-Ready Persona G -> Verify Meal Framework & Slots E2E | PASS | 1215ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Plan Generator: Bootstrap Pending Persona A -> Qualitative Framework with Zero Fabricated Slot Targets | PASS | 1135ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Food Composition: Bootstrap Ready Persona G -> Real Composed Food Candidates & Non-Empty Portions | PASS | 1207ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Food Composition: Bootstrap Vegan Persona F -> Strict Vegan Composition & Zero Animal Foods | PASS | 1260ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Tracking: Bootstrap Quantitative Persona G -> Log Meal -> Verify Real-time Summary Update | PASS | 1453ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Persistence: Logged Meal Survives Page Reload | PASS | 1868ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Adaptation: Initial render displays Building Tracking Evidence when history is empty | PASS | 1182ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Adaptation: Repeated meal skipping triggers structure simplification recommendation | PASS | 1776ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Adaptation: Preview, Accept, and Persist Simpler Plan Revision | PASS | 2738ms | Clean execution |
| LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1) | Nutrition Adaptation: Reject Proposed Revision Keeps Original Plan | PASS | 1892ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 1: Opening Today Dashboard after bootstrap renders Training & Nutrition sections | PASS | 1663ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 2: Starting a workout from Today transitions status to In Progress with Continue Workout CTA | PASS | 2703ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 3: Completing a workout updates Today Dashboard to Completed Today status | PASS | 4119ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 3b: Trainee with off-day schedule renders Scheduled Rest Day and next session preview | PASS | 1990ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 4: Logging a meal on Today updates intake, targets, and difference in real time | PASS | 1815ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 5: Nutrition revision appears, can be previewed, accepted, or rejected | PASS | 2571ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 6: Logged meal state persists across browser page reload | PASS | 2664ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 7: Population guards & qualitative-only states are respected on Today | PASS | 1702ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 8: Completely uninitialized state renders No Active Plan Found with clean CTAs | PASS | 867ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 9: Layout renders cleanly on 390x844 and 375x812 mobile viewports without clipping | PASS | 2413ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 10: Record custom intake with different food and adjusted portion updates nutrients deterministically | PASS | 2401ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 11: Recording partial intake marks status Partial and counts only actual consumed portion | PASS | 2693ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 12: Marking meal skipped records skipped status and contributes 0 kcal to logged intake | PASS | 2048ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 13: Resetting a meal slot reverts status to Not Started and removes logged intake | PASS | 1924ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 14: Resetting meal slot reverts effective nutrients to 0 while preserving supersededHistory in repository | PASS | 2622ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 15: Editing completed intake supersedes previous intake and counts only newly entered foods | PASS | 2855ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 16: Skipped meal transitioned to custom intake archives skipped state and computes effective intake | PASS | 2538ms | Clean execution |
| LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1) | Scenario 17: Multi-cycle correction flow updates effective totals strictly with zero double-counting | PASS | 4152ms | Clean execution |
| Onboarding Domain Suite (Stage QA-1) | Screen Navigation, Validation & Back/Forward Persistence | PASS | 1771ms | Clean execution |
| Onboarding Domain Suite (Stage QA-1) | Screen 2: Biological Sex Optionality, Selection & Reload Persistence | PASS | 1549ms | Clean execution |
| Onboarding Domain Suite (Stage QA-1) | Screen 6: Structure Preference Selection & Persistence | PASS | 1302ms | Clean execution |
| Onboarding Domain Suite (Stage QA-1) | Screen 10 Completion -> Plan Generation Entry | PASS | 2130ms | Clean execution |

## Critical Failures

None. All automated E2E tests executed cleanly without regressions.

## Regression Status

- onboarding: PASS
- plan generation: PASS
- workout runtime: PASS
- persistence: PASS
- history: PASS
- T7 adaptation: PASS
- T9 adaptation: PASS
- plan regeneration: PASS
- nutrition strategy: PASS
- quantitative nutrition targeting: PASS

## Final Verdict

QA PASS
