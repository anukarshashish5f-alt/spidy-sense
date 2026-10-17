# Spidy Sense: initial code audit

## What the current app does
- React + TypeScript + Vite frontend.
- Image/video selection and in-browser heuristic analysis.
- `src/utils/imageAnalysis.ts` computes visual signal metrics; `src/utils/audioAnalysis.ts` contains audio signal heuristics.
- The reviewed app source does not show a call to a remote detector API or a trained model inference endpoint.

## Issues found and addressed in this working copy
- `src/utils/imageAnalysis.ts` contained a malformed orphaned file-score code block that caused TypeScript parsing to fail. Removed it. The removed heuristic depended on filename, file type and file size, which are not reliable indicators of AI generation.
- Upload handler now enforces the displayed 10 MB image / 50 MB video limits and requires the chosen media type to match the active tab.
- Clear-media action revokes the preview object URL to reduce browser resource leaks.
- Removed unsupported `99.2% accuracy` marketing claim and revised UI language to describe heuristic analysis, not neural inference.
- Verdict labels now communicate uncertainty and avoid treating a heuristic score as a calibrated probability.

## Important limitations
- These changes do not turn the heuristic detector into a validated AI detector.
- Scores need to be tested against a labeled dataset containing diverse authentic, AI-generated, edited, recompressed and resized media before making accuracy claims.
- Browser-only image statistics can be affected by resizing, compression, screenshots, filters and image content. A trained detector or provenance verification system would be a separate engineering phase.

## Validation status
- Initial `npm run typecheck` exposed a TypeScript parse error at `src/utils/imageAnalysis.ts:1022`; that malformed block was removed.
- A subsequent typecheck could not complete because the ZIP's `node_modules` installation was incomplete (missing type definition packages). Reinstall dependencies with `npm ci`, then run `npm run typecheck`, `npm run lint`, and `npm run build`.
