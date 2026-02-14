# Project Preferences

## Git Workflow
- Always merge feature branches into `main` and push after completing changes
- Always pull latest `main` before starting new work
- Do not leave changes sitting on unmerged branches — the user expects production deployments from `main`

## Stack
- Vanilla JS + Vercel serverless functions (no framework, no build step)
- Data provider: Databento Historical API (`DBEQ.BASIC` dataset)
- Single env var: `DATABENTO_API_KEY`
