# Payroll Readiness (rehearsal)

Practice build to verify the environment. Synthetic data only; state lives in localStorage.

    npm install && npm run build && npm start
    # E2E (server on :3000):
    PW_EXEC=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1) node tests/e2e/readiness.mjs

Screenshots from the last run are in ../artifacts/qa/.
