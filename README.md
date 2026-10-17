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

## Deploy

Build with `npm run build` and publish the generated `dist/` directory using a static host. If using a different host, follow that platform's Vite deployment instructions.
