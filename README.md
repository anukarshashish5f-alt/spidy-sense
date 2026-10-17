# Spidy Sense

Spidy Sense is a browser-based media pattern exploration demo built with React, TypeScript, Vite and Tailwind CSS.

## Important accuracy note

The current image and video pipeline uses handcrafted statistical heuristics. It is **not** a trained AI detector, does not establish media provenance, and does not provide calibrated probability estimates. Compression, editing, resizing, screenshots, image content and recording conditions can change the output. Treat results as exploratory signals only.

## Requirements

- Node.js 20 or newer
- npm

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run dev
```

The project entry point is `src/main.tsx`. No detector API keys are required. Uploaded media is processed in the browser; the current detector code does not upload the selected media to a server.

## Hosting with GitHub Pages

This project is configured to deploy directly from GitHub Actions. No Bolt account or Bolt deployment is required.

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push changes to the `main` branch, or manually run **Deploy Spidy Sense to GitHub Pages** from the Actions tab.
4. When the workflow succeeds, the public site will be available at:

   https://anukarshashish5f-alt.github.io/spidy-sense/

The deployment workflow installs dependencies, type-checks the project, builds the static site, and publishes the `dist/` directory.

## Current limitations

This is a frontend demo. The heuristic scores are not validated AI-generation probabilities. There is no connected trained detector, account system, payment checkout, or public inference API.
