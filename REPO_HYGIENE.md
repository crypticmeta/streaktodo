# Repo Hygiene SOP

This repo is public-facing. Keep it free of local secrets, debug traces, and private tooling artifacts.

## Never commit

- `.env`, `.env.*`, API keys, OAuth secrets, tokens, cookies
- local device logs, Metro logs, crash dumps, temp files
- private transcripts, prompt logs, generated chat exports, agent scratch output
- release keystores, signing keys, provisioning profiles
- editor state folders such as `.vscode/`, `.idea/`, `.cursor/`
- build output such as `.expo/`, `android/app/build/`, `dist/`, `test-results/`

## Allowed in git

- `.env.example` with placeholders only
- generated app assets that are intentional product assets
- `android/` source needed for local device development

## Before every push

1. Review `git status` and remove anything unexpected.
2. Check staged files for secrets or local artifacts.
3. Confirm no `.env` file is staged.
4. Confirm no logs, screenshots, transcripts, or prompt dumps are staged.
5. If native config changed, make sure only intended source files are included, not build outputs.

## Naming / product hygiene

- Use `Streak Todo` and `streaktodo` consistently in docs, config, and store assets.
- Do not mention abandoned product names or internal project codenames in public docs.
- Do not describe internal build assistants, private tooling, or drafting workflows in repo docs or commit messages unless explicitly required.

## Signing / auth hygiene

- Treat release signing material as secret and keep it out of git.
- Debug signing files are for local development only and must never be reused for production release signing.
- Google OAuth client secrets belong on the backend only, never in the mobile bundle.
