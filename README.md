# Daily Journal

This repository contains a client-only Daily Journal web app that runs entirely in the browser and can be hosted from GitHub Pages.

What it does
- Daily logging of water, morning/night routines, meals with calorie fields, workout tracking, energy and notes.
- Local storage of all journal and profile data using IndexedDB (no data is stored in the repository).
- PWA-ready: manifest + service worker for offline use and installation.
- Export/Backup and Import/Restore JSON backup of all profiles and entries.

How to run locally
1. Clone the repo: git clone https://github.com/AllAboutYogi/Daily-Journal
2. Open daily-journal.html in a browser (or serve it via a local static server such as "npx http-server" or "python -m http.server 8000").

Enable GitHub Pages
- The repository is configured to deploy from the main branch using a GitHub Actions workflow. No additional build steps are required for this static site.

How deployment works
- On every push to main, the workflow in .github/workflows/deploy.yml packages the repository contents and deploys to GitHub Pages using the official actions.

Data storage
- All personal journal data is stored in your browser's IndexedDB and never committed to this repository.
- The backup JSON contains full profiles and entries which you can download and keep locally.

Backup / Restore
- Use "Backup my data" to download a JSON file with all profiles and entries.
- Use "Restore backup" to import a previously exported JSON file.

Installing on iPhone / iPad
- Open the site in Safari, tap the Share button, then "Add to Home Screen". On iOS, the site will be saved as a web app. Some iOS versions may require the site to be served over HTTPS (GitHub Pages provides HTTPS).

Privacy / Limitations
- Your journal data remains on your device unless you explicitly export it. The repository only hosts the application code.
- Do not upload your exported backup to public places unless you want to share your private data.
- No cloud sync is currently implemented; this can be added later via a storage adapter.

Future cloud sync
- The code is organized around a storage abstraction (storage.getEntry, storage.saveEntry, storage.getProfile, storage.saveProfile, storage.exportData, storage.importData) so a remote adapter (e.g., using an API) can be added without changing UI logic.

Credits
- Built for personal journaling and quick deployment on GitHub Pages.