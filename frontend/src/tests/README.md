# Frontend Tests

Organized test area for React/UI behavior.

Suggested layout:
- `pages/` page-level integration tests (RTL + mocked fetch/router/auth)
- `components/` component tests
- `utils/` pure helper tests

Run all frontend tests:

```bash
CI=true npm --prefix frontend test -- --watchAll=false --watchman=false
```

Run the market page suite:

```bash
CI=true npm --prefix frontend test -- --watchAll=false --watchman=false --runTestsByPath src/tests/pages/market/Market.test.jsx
```
