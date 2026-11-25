# CoCode — Automated Testing Guide

## 1. Test Architecture

CoCode implements a comprehensive multi-layered automated test suite:
- **Server-V2**: Uses the Node.js native test runner (`node --test`), testing modules with in-memory SQLite/mock Prisma structures without requiring external database or compiler network dependencies in CI.
- **Client**: Uses Node.js native test runner (`node --test`) for utility and business logic testing, alongside Oxlint for static analysis and Vite for production build verification.

---

## 2. Running Tests Locally

### Running Server-V2 Tests
```bash
# From workspace root
cd server-v2

# Run complete test suite (223 tests)
npm test

# Run syntax verification check
npm run check
```

Expected result:
- **220 passing tests**
- **0 failing tests**
- **3 skipped tests** (Live TiDB Cloud integration tests and live Judge0 smoke test skip safely when external cloud database or compiler network dependencies are unreachable; skipped tests are not counted as passed).

### Running Client Tests & Linting
```bash
# From workspace root
cd client

# Run automated tests
npm test

# Run linter
npm run lint

# Verify production build
npm run build
```

Expected result:
- **10 passing tests**
- **0 errors** in linting
- Production bundle builds successfully into `client/dist`.

> [!NOTE]
> These verified test counts reflect the Phase 10 release baseline and are not a hardcoded guarantee of future test runs across differing local or network environments.

---

## 3. GitHub Actions CI/CD Pipeline

The automated workflow located at `.github/workflows/ci.yml` runs on every pull request and push to the `main` branch.

### Workflow Stages
1. **Node.js 20 Setup**: Caches package lockfiles.
2. **Client CI**:
   - `npm ci`
   - `npm run lint`
   - `npm test`
   - `npm run build`
3. **Server-V2 CI**:
   - `npm ci`
   - `npx prisma generate --schema=prisma/schema.prisma`
   - `npm run check` (verifies syntax across 34 core files)
   - `npm test` (executes the 218-test suite)
