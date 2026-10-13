# Adaptive Fitness App

Adaptive Fitness is an intelligent, deterministic training and nutrition application built with React Native (Expo Web), TypeScript, and Playwright.

It delivers personalized, scientifically anchored training programs and nutrition targets that adapt dynamically based on actual performance, recovery constraints, and dietary logging.

---

## Key Capabilities

- **Deterministic Training Strategy Engine (T1–T10)**: Generates split structures (PPL, Upper/Lower, Full Body), volume benchmarks, progression models, and conditioning prescriptions without arbitrary randomness.
- **Workout Player & Runtime Execution (W4.1–W4.2, W6.1)**: Interactive workout tracker with set-level logging (load, reps, RIR/RPE), exercise substitutions, and offline-first persistence.
- **Adaptive Performance & Recovery Feedback (W6.2)**: Adapts volume and progression using fatigue indicators, soreness, and historical workout execution traces.
- **Quantitative & Qualitative Nutrition Engine (W7.1–W7.5)**:
  - Mifflin-St Jeor BMR & TDEE calculation with goal-based caloric pacing and macro partitioning.
  - Strict population boundary protection (adults eligible; youth and ineligible profiles safely guarded without fabricated metrics).
  - Authoritative food catalog and deterministic meal composition supporting diverse dietary choices (vegan, vegetarian, allergens).
- **Nutrition Tracking & Adaptive Feedback (W7.6–W7.7)**:
  - Tracks factual intake vs. targets without mutating authoritative reference benchmarks.
  - Day completeness evaluation and structural adaptation recommendations (e.g., simplifying meal frequency for busy lifestyles).
- **Unified Today Dashboard (W8.1–W8.3)**:
  - Daily overview uniting training schedules, workout status, and meal checklists.
  - Full support for canonical meal execution states (`not_started`, `completed`, `partial`, `skipped`).
  - Safe meal resets and intake editing with audit history preservation (`supersededHistory`) and zero double-counting.

---

## Tech Stack

- **Framework**: [Expo](https://expo.dev/) (React Native / React Native Web)
- **Language**: TypeScript (Strict typing, 0 errors)
- **Routing**: `expo-router`
- **State & Storage**: AsyncStorage with Web LocalStorage fallback and mutex queue serialization
- **Testing**:
  - `node:test` + `tsx` for high-speed unit & domain test suites
  - Playwright for multi-tier end-to-end browser automation

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/DefinitelyNotAnshu/adaptive-fitness-app.git

# Navigate to project directory
cd adaptive-fitness-app

# Install dependencies
npm install
```

### Running Locally

```bash
# Start Expo web development server
npm run web
```

Open [http://localhost:8081](http://localhost:8081) in your browser and toggle mobile view (iPhone 14 / 390x844) in DevTools.

---

## Verification & Testing

```bash
# Run all unit and domain test suites (827 tests across 226 suites)
npm test

# Type checking
npx tsc --noEmit

# Production web bundle export
npx expo export --platform web

# Run full Playwright E2E suite (46 tests)
npm run test:e2e
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
