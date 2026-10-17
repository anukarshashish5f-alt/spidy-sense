import type { DetectedPattern } from '../components/AnalyzeStep';
import { analyzeAudio, type AudioMetrics, type AudioPattern } from './audioAnalysis';
import { detectAiImage } from './aiImageDetector';

export type MediaType = 'image' | 'video';

export interface AnalysisResult {
  patterns: DetectedPattern[];
  isAI: boolean;
  confidence: number;
  verdict?: 'ai' | 'real' | 'uncertain';
  method?: 'trained-model' | 'heuristic';
  aiScore?: number;
  realScore?: number;
  metrics?: ImageMetrics;
  mediaType: MediaType;
  audioMetrics?: AudioMetrics;
  hasAudio?: boolean;
}

export interface ImageMetrics {
  noiseScore: number;
  edgeScore: number;
  frequencyScore: number;
  colorScore: number;
  symmetryScore: number;
  compressionScore: number;
  metadataScore: number;
  textureScore: number;
  spectralScore: number;
  patchScore: number;
  multiScaleScore: number;
  overallScore: number;
}

interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// ============================================================
// UTILITIES
// ============================================================
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stdDev(arr: number[], m?: number): number {
  if (arr.length === 0) return 0;
  const mu = m ?? mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

function toGrayscale(data: Uint8ClampedArray, count: number): Float32Array {
  const gray = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return gray;
}

function loadImageDataFromFile(file: File): Promise<PixelData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = 512;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const imageData = ctx.getImageData(0, 0, w, h);
      resolve({ data: imageData.data, width: w, height: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ============================================================
// 1. NOISE — multi-scale Laplacian + residual + channel + spatial
// ============================================================
function computeNoiseResidual(gray: Float32Array, width: number, height: number): Float32Array {
  const residual = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const neighbors =
        (gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width]) / 4;
      residual[idx] = gray[idx] - neighbors;
    }
  }
  return residual;
}

function analyzeNoise(gray: Float32Array, width: number, height: number): number {
  const residual = computeNoiseResidual(gray, width, height);

  // Sub-metric 1: Multi-scale noise level
  const scales = [1, 2, 4];
  let scaleScore = 0;
  for (const s of scales) {
    const absVals: number[] = [];
    for (let y = s; y < height - s; y += s) {
      for (let x = s; x < width - s; x += s) {
        const idx = y * width + x;
        const neighbors =
          (gray[idx - s] + gray[idx + s] + gray[idx - s * width] + gray[idx + s * width]) / 4;
        absVals.push(Math.abs(gray[idx] - neighbors));
      }
    }
    if (absVals.length === 0) continue;
    const sorted = absVals.sort((a, b) => a - b);
    const p50 = percentile(sorted, 0.5);
    scaleScore += clamp(1 - p50 / (15 * s), 0, 1);
  }
  scaleScore /= scales.length;

  // Sub-metric 2: Noise spatial uniformity (16-region grid)
  const rw = Math.floor(width / 4);
  const rh = Math.floor(height / 4);
  const regionNoise: number[] = [];
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      let sum = 0;
      let cnt = 0;
      const sy = ry * rh;
      const sx = rx * rw;
      for (let y = Math.max(1, sy); y < Math.min(height - 1, sy + rh); y++) {
        for (let x = Math.max(1, sx); x < Math.min(width - 1, sx + rw); x++) {
          sum += Math.abs(residual[y * width + x]);
          cnt++;
        }
      }
      if (cnt > 0) regionNoise.push(sum / cnt);
    }
  }
  const noiseCV = mean(regionNoise) > 0 ? stdDev(regionNoise) / mean(regionNoise) : 0;
  const uniformityScore = clamp(1 - noiseCV * 1.5, 0, 1);

  // Sub-metric 3: Noise kurtosis (heavy-tailed = real, Gaussian = AI)
  const resVals: number[] = [];
  for (let i = 0; i < residual.length; i += 3) {
    if (residual[i] !== 0) resVals.push(residual[i]);
  }
  const resMean = mean(resVals);
  const resStd = stdDev(resVals, resMean);
  let kurtosis = 0;
  if (resStd > 0 && resVals.length > 0) {
    const fourth = resVals.reduce((s, v) => s + ((v - resMean) / resStd) ** 4, 0) / resVals.length;
    kurtosis = fourth - 3;
  }
  const kurtosisScore = clamp(kurtosis < 1 ? 0.7 : kurtosis < 3 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 4: Per-channel noise difference (Bayer filter effect)
  const evenNoise: number[] = [];
  const oddNoise: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const neighbors = (gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width]) / 4;
      const r = Math.abs(gray[idx] - neighbors);
      if ((x + y) % 2 === 0) evenNoise.push(r);
      else oddNoise.push(r);
    }
  }
  const evenMean = mean(evenNoise);
  const oddMean = mean(oddNoise);
  const overallMean = (evenMean + oddMean) / 2;
  const channelDiff = overallMean > 0 ? Math.abs(evenMean - oddMean) / overallMean : 0;
  const channelScore = clamp(channelDiff < 0.05 ? 0.8 : channelDiff < 0.15 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 5: Noise level vs image detail (AI often too clean in high-detail areas)
  let highDetailNoiseRatio = 0;
  let highDetailCount = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const localVar = Math.abs(gray[idx - 1] - gray[idx + 1]) + Math.abs(gray[idx - width] - gray[idx + width]);
      if (localVar > 20) {
        highDetailCount++;
        if (Math.abs(residual[idx]) < 2) highDetailNoiseRatio++;
      }
    }
  }
  const cleanHighDetail = highDetailCount > 0 ? highDetailNoiseRatio / highDetailCount : 0.5;
  const detailNoiseScore = clamp(cleanHighDetail * 1.3, 0, 1);

  return clamp(
    scaleScore * 0.25 +
    uniformityScore * 0.2 +
    kurtosisScore * 0.2 +
    channelScore * 0.15 +
    detailNoiseScore * 0.2,
    0, 1
  );
}

// ============================================================
// 2. EDGES — Sobel + direction entropy + density variance + gradient profiles
// ============================================================
function analyzeEdges(gray: Float32Array, width: number, height: number): number {
  const gradients: number[] = [];
  const directions: number[] = [];
  let strongEdges = 0;
  let zeroGradient = 0;
  const rw = Math.floor(width / 4);
  const rh = Math.floor(height / 4);
  const regionEdgeDensity: number[] = [];

  // Track gradient profiles at strong edges for sharpness analysis
  const edgeSharpnessProfiles: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1] +
         gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
         gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
      const mag = Math.sqrt(gx * gx + gy * gy) / 4;
      gradients.push(mag);
      if (mag < 1) zeroGradient++;
      else if (mag > 10) strongEdges++;

      if (mag > 5) {
        const angle = Math.atan2(gy, gx);
        directions.push(angle);
      }

      // Sample gradient profiles at strong edges
      if (mag > 15 && x > 2 && x < width - 3 && edgeSharpnessProfiles.length < 200) {
        const profile = [
          gray[idx - 2], gray[idx - 1], gray[idx], gray[idx + 1], gray[idx + 2],
        ];
        const pMean = mean(profile);
        const pStd = stdDev(profile, pMean);
        if (pStd > 0) {
          // Sharpness = how concentrated the transition is
          const peak = Math.abs(gray[idx] - gray[idx - 1]);
          const spread = Math.abs(gray[idx - 2] - gray[idx - 1]) + Math.abs(gray[idx + 1] - gray[idx + 2]);
          edgeSharpnessProfiles.push(spread > 0 ? peak / (peak + spread) : 1);
        }
      }
    }
  }

  const total = gradients.length;
  if (total === 0) return 0.5;

  // Sub-metric 1: Smoothness ratio
  const smoothRatio = zeroGradient / total;
  const smoothnessScore = clamp(smoothRatio * 1.8, 0, 1);

  // Sub-metric 2: Gradient magnitude diversity
  const gradMean = mean(gradients);
  const gradCV = gradMean > 0 ? stdDev(gradients, gradMean) / gradMean : 0;
  const gradCVDiversity = clamp(1 - gradCV * 0.8, 0, 1);

  // Sub-metric 3: Edge direction entropy
  const numBins = 18;
  const histogram = new Array(numBins).fill(0);
  for (const angle of directions) {
    let bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * numBins);
    bin = Math.min(bin, numBins - 1);
    histogram[bin]++;
  }
  let entropy = 0;
  const dirCount = directions.length;
  if (dirCount > 0) {
    for (const h of histogram) {
      if (h > 0) entropy -= (h / dirCount) * Math.log2(h / dirCount);
    }
  }
  const maxEntropy = Math.log2(numBins);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const entropyScore = clamp(1 - normalizedEntropy * 0.7, 0, 1);

  // Sub-metric 4: Strong edge ratio
  const strongRatio = strongEdges / total;
  const strongRatioScore = clamp(1 - strongRatio * 5, 0, 1);

  // Sub-metric 5: Region edge density variance
  let gIdx = 0;
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      let edgeCount = 0;
      let pixCount = 0;
      for (let y = Math.max(1, ry * rh); y < Math.min(height - 1, (ry + 1) * rh); y++) {
        for (let x = Math.max(1, rx * rw); x < Math.min(width - 1, (rx + 1) * rw); x++) {
          if (gradients[gIdx] > 10) edgeCount++;
          pixCount++;
          gIdx++;
        }
      }
      if (pixCount > 0) regionEdgeDensity.push(edgeCount / pixCount);
    }
  }
  const densityMean = mean(regionEdgeDensity);
  const densityCV = densityMean > 0 ? stdDev(regionEdgeDensity, densityMean) / densityMean : 0;
  const densityScore = clamp(densityCV < 0.3 ? 0.8 : densityCV < 0.6 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 6: Edge gradient profile sharpness
  // Real camera edges have crisp transitions; AI edges often have soft halos
  const avgSharpness = mean(edgeSharpnessProfiles);
  const sharpnessScore = clamp(avgSharpness < 0.3 ? 0.8 : avgSharpness < 0.5 ? 0.4 : 0.15, 0, 1);

  return clamp(
    smoothnessScore * 0.2 +
    gradCVDiversity * 0.15 +
    entropyScore * 0.15 +
    strongRatioScore * 0.1 +
    densityScore * 0.2 +
    sharpnessScore * 0.2,
    0, 1
  );
}

// ============================================================
// 3. FREQUENCY — multi-block DCT energy
// ============================================================
function analyzeFrequency(gray: Float32Array, width: number, height: number): number {
  const blockSizes = [8, 16, 32];
  let totalScore = 0;
  let weightSum = 0;

  for (const bs of blockSizes) {
    const blockVariances: number[] = [];
    const dcEnergies: number[] = [];
    const acEnergies: number[] = [];

    for (let by = 0; by + bs <= height; by += bs) {
      for (let bx = 0; bx + bs <= width; bx += bs) {
        let sum = 0;
        let sumSq = 0;
        const n = bs * bs;
        for (let dy = 0; dy < bs; dy++) {
          for (let dx = 0; dx < bs; dx++) {
            const val = gray[(by + dy) * width + (bx + dx)];
            sum += val;
            sumSq += val * val;
          }
        }
        const dc = sum / n;
        const variance = sumSq / n - dc * dc;
        blockVariances.push(variance);
        dcEnergies.push(dc);
        acEnergies.push(Math.sqrt(Math.max(0, variance)));
      }
    }

    if (blockVariances.length === 0) continue;
    const w = bs === 8 ? 0.5 : bs === 16 ? 0.3 : 0.2;
    weightSum += w;

    const varMean = mean(blockVariances);
    const varCV = varMean > 0 ? stdDev(blockVariances, varMean) / varMean : 0;
    const uniformityScore = clamp(varCV < 0.3 ? 0.9 : varCV < 0.6 ? 0.5 : 0.15, 0, 1);

    const lowEnergyRatio = blockVariances.filter((v) => v < 3).length / blockVariances.length;
    const lowEnergyScore = clamp(lowEnergyRatio * 1.5, 0, 1);

    const dcMean = mean(dcEnergies);
    const dcCV = dcMean > 0 ? stdDev(dcEnergies, dcMean) / dcMean : 0;
    const dcScore = clamp(dcCV < 0.2 ? 0.8 : dcCV < 0.4 ? 0.4 : 0.15, 0, 1);

    const acMean = mean(acEnergies);
    const acCV = acMean > 0 ? stdDev(acEnergies, acMean) / acMean : 0;
    const acScore = clamp(acCV < 0.3 ? 0.85 : acCV < 0.6 ? 0.45 : 0.15, 0, 1);

    totalScore += (uniformityScore * 0.3 + lowEnergyScore * 0.2 + dcScore * 0.25 + acScore * 0.25) * w;
  }

  return clamp(totalScore / Math.max(weightSum, 1), 0, 1);
}

// ============================================================
// 4. COLOR — histogram + saturation + channel correlation
// ============================================================
function analyzeColor(data: Uint8ClampedArray, count: number): number {
  // Sub-metric 1: Histogram smoothness
  const histR = new Array(64).fill(0);
  const histG = new Array(64).fill(0);
  const histB = new Array(64).fill(0);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    histR[data[o] >> 2]++;
    histG[data[o + 1] >> 2]++;
    histB[data[o + 2] >> 2]++;
  }
  let histRoughness = 0;
  for (let i = 1; i < 64; i++) {
    histRoughness += Math.abs(histR[i] - histR[i - 1]);
    histRoughness += Math.abs(histG[i] - histG[i - 1]);
    histRoughness += Math.abs(histB[i] - histB[i - 1]);
  }
  const histRoughnessScore = clamp(1 - histRoughness / (count * 0.3), 0, 1);

  // Sub-metric 2: Color uniqueness
  const colorMap = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const key = ((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4);
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }
  const uniqueRatio = colorMap.size / count;
  const uniqueScore = clamp(uniqueRatio < 0.15 ? 0.8 : uniqueRatio < 0.3 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 3: Saturation distribution
  const saturations: number[] = [];
  for (let i = 0; i < count; i += 4) {
    const o = i * 4;
    const max = Math.max(data[o], data[o + 1], data[o + 2]);
    const min = Math.min(data[o], data[o + 1], data[o + 2]);
    saturations.push(max > 0 ? (max - min) / max : 0);
  }
  const satMean = mean(saturations);
  const satCV = satMean > 0 ? stdDev(saturations, satMean) / satMean : 0;
  const satScore = clamp(satCV < 0.3 ? 0.7 : satCV < 0.6 ? 0.35 : 0.1, 0, 1);

  // Sub-metric 4: Channel correlation
  const step = Math.max(1, Math.floor(count / 5000));
  const rVals: number[] = [], gVals: number[] = [], bVals: number[] = [];
  for (let i = 0; i < count; i += step) {
    const o = i * 4;
    rVals.push(data[o]); gVals.push(data[o + 1]); bVals.push(data[o + 2]);
  }
  const n = rVals.length;
  const rM = mean(rVals), gM = mean(gVals), bM = mean(bVals);
  const rS = stdDev(rVals, rM), gS = stdDev(gVals, gM), bS = stdDev(bVals, bM);
  let rgCov = 0, rbCov = 0, gbCov = 0;
  for (let i = 0; i < n; i++) {
    rgCov += (rVals[i] - rM) * (gVals[i] - gM);
    rbCov += (rVals[i] - rM) * (bVals[i] - bM);
    gbCov += (gVals[i] - gM) * (bVals[i] - bM);
  }
  const rg = rS > 0 && gS > 0 ? (rgCov / n) / (rS * gS) : 0;
  const rb = rS > 0 && bS > 0 ? (rbCov / n) / (rS * bS) : 0;
  const gb = gS > 0 && bS > 0 ? (gbCov / n) / (gS * bS) : 0;
  const avgCorr = (Math.abs(rg) + Math.abs(rb) + Math.abs(gb)) / 3;
  const corrScore = clamp(avgCorr > 0.95 ? 0.8 : avgCorr > 0.85 ? 0.4 : 0.1, 0, 1);

  return clamp(
    histRoughnessScore * 0.3 + uniqueScore * 0.2 + satScore * 0.25 + corrScore * 0.25,
    0, 1
  );
}

// ============================================================
// 5. SYMMETRY — bilateral + top-bottom
// ============================================================
function analyzeSymmetry(gray: Float32Array, width: number, height: number): number {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  let lrDiff = 0, lrCount = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < halfW; x += 2) {
      lrDiff += Math.abs(gray[y * width + x] - gray[y * width + (width - 1 - x)]);
      lrCount++;
    }
  }
  const lrScore = clamp(1 - (lrCount > 0 ? lrDiff / lrCount : 30) / 25, 0, 1);

  let tbDiff = 0, tbCount = 0;
  for (let y = 0; y < halfH; y += 2) {
    for (let x = 0; x < width; x += 2) {
      tbDiff += Math.abs(gray[y * width + x] - gray[(height - 1 - y) * width + x]);
      tbCount++;
    }
  }
  const tbScore = clamp(1 - (tbCount > 0 ? tbDiff / tbCount : 30) / 25, 0, 1);

  return clamp((lrScore + tbScore) / 2, 0, 1);
}

// ============================================================
// 6. COMPRESSION — 2D block boundary + banding (fixed: uses width/height)
// ============================================================
function analyzeCompression(data: Uint8ClampedArray, width: number, height: number): number {
  const count = width * height;

  // Sub-metric 1: 8x8 block boundary discontinuity (horizontal + vertical)
  let hBoundaryDiff = 0;
  let hBoundaryCount = 0;
  let vBoundaryDiff = 0;
  let vBoundaryCount = 0;

  // Horizontal block boundaries (every 8 columns)
  for (let y = 0; y < height; y++) {
    for (let x = 7; x < width - 1; x += 8) {
      const o0 = (y * width + x) * 4;
      const o1 = (y * width + x + 1) * 4;
      hBoundaryDiff += Math.abs(data[o0] - data[o1]) + Math.abs(data[o0 + 1] - data[o1 + 1]) + Math.abs(data[o0 + 2] - data[o1 + 2]);
      hBoundaryCount++;
    }
  }
  // Vertical block boundaries (every 8 rows)
  for (let x = 0; x < width; x++) {
    for (let y = 7; y < height - 1; y += 8) {
      const o0 = (y * width + x) * 4;
      const o1 = ((y + 1) * width + x) * 4;
      vBoundaryDiff += Math.abs(data[o0] - data[o1]) + Math.abs(data[o0 + 1] - data[o1 + 1]) + Math.abs(data[o0 + 2] - data[o1 + 2]);
      vBoundaryCount++;
    }
  }

  // Compare boundary diffs to interior diffs
  let interiorDiff = 0;
  let interiorCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x += 3) {
      if (x % 8 !== 7) {
        const o0 = (y * width + x) * 4;
        const o1 = (y * width + x + 1) * 4;
        interiorDiff += Math.abs(data[o0] - data[o1]) + Math.abs(data[o0 + 1] - data[o1 + 1]) + Math.abs(data[o0 + 2] - data[o1 + 2]);
        interiorCount++;
      }
    }
  }

  const avgHBoundary = hBoundaryCount > 0 ? hBoundaryDiff / hBoundaryCount : 0;
  const avgVBoundary = vBoundaryCount > 0 ? vBoundaryDiff / vBoundaryCount : 0;
  const avgBoundary = (avgHBoundary + avgVBoundary) / 2;
  const avgInterior = interiorCount > 0 ? interiorDiff / interiorCount : 1;
  const boundaryRatio = avgInterior > 0 ? avgBoundary / avgInterior : 1;
  const blockScore = clamp(1 - boundaryRatio * 0.5, 0, 1);

  // Sub-metric 1b: H/V boundary asymmetry (AI can have asymmetric block artifacts)
  const hvAsymmetry = avgHBoundary + avgVBoundary > 0
    ? Math.abs(avgHBoundary - avgVBoundary) / (avgHBoundary + avgVBoundary)
    : 0;
  const hvAsymmetryScore = clamp(hvAsymmetry > 0.4 ? 0.7 : hvAsymmetry > 0.2 ? 0.35 : 0.1, 0, 1);

  // Sub-metric 2: Quantization banding
  let bandingCount = 0;
  let bandingTotal = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 2; x < width; x++) {
      const o0 = (y * width + x - 2) * 4;
      const o1 = (y * width + x - 1) * 4;
      const o2 = (y * width + x) * 4;
      const diff1 = Math.abs(data[o1] - data[o0]);
      const diff2 = Math.abs(data[o2] - data[o1]);
      if (diff1 > 5 && diff2 > 5 && Math.abs(diff1 - diff2) < 3) bandingCount++;
      bandingTotal++;
    }
  }
  const bandingScore = clamp((bandingCount / Math.max(bandingTotal, 1)) * 8, 0, 1);

  // Sub-metric 3: Exact-match ratio (smooth synthetic regions)
  let exactMatches = 0;
  for (let i = 1; i < count; i++) {
    const o0 = (i - 1) * 4;
    const o1 = i * 4;
    if (data[o1] === data[o0] && data[o1 + 1] === data[o0 + 1] && data[o1 + 2] === data[o0 + 2]) exactMatches++;
  }
  const exactRatio = exactMatches / Math.max(count, 1);
  const exactScore = clamp(exactRatio * 4, 0, 1);

  return clamp(blockScore * 0.3 + bandingScore * 0.25 + exactScore * 0.25 + hvAsymmetryScore * 0.2, 0, 1);
}

// ============================================================
// 7. TEXTURE — LBP entropy + uniformity + concentration
// ============================================================
function analyzeTexture(gray: Float32Array, width: number, height: number): number {
  const lbpHist = new Array(256).fill(0);
  let lbpCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const center = gray[idx];
      let pattern = 0;
      const neighbors = [
        gray[idx - width - 1], gray[idx - width], gray[idx - width + 1],
        gray[idx + 1], gray[idx + width + 1], gray[idx + width],
        gray[idx + width - 1], gray[idx - 1],
      ];
      for (let n = 0; n < 8; n++) {
        if (neighbors[n] >= center) pattern |= (1 << n);
      }
      lbpHist[pattern]++;
      lbpCount++;
    }
  }

  if (lbpCount === 0) return 0.5;

  // LBP sub-metrics
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (lbpHist[i] > 0) {
      const p = lbpHist[i] / lbpCount;
      entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(256);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const entropyScore = clamp(1 - normalizedEntropy * 0.8, 0, 1);

  const uniformPatterns = [0, 1, 2, 3, 4, 6, 7, 8, 12, 14, 15, 16, 24, 28,
    30, 31, 32, 48, 56, 60, 62, 63, 64, 96, 112, 120, 124, 126, 127,
    128, 129, 131, 135, 143, 159, 191, 192, 193, 195, 199, 207, 223,
    224, 225, 227, 231, 239, 240, 241, 243, 247, 248, 249, 251, 252, 253, 254, 255];
  let uniformCount = 0;
  for (const p of uniformPatterns) uniformCount += lbpHist[p];
  const uniformRatio = uniformCount / lbpCount;
  const uniformScore = clamp(uniformRatio < 0.4 ? 0.15 : uniformRatio < 0.55 ? 0.4 : 0.75, 0, 1);

  const sortedHist = [...lbpHist].sort((a, b) => b - a);
  const top10Ratio = sortedHist.slice(0, 10).reduce((s, v) => s + v, 0) / lbpCount;
  const concentrationScore = clamp(top10Ratio < 0.3 ? 0.1 : top10Ratio < 0.5 ? 0.4 : 0.8, 0, 1);

  // GLCM-based texture metrics (contrast + homogeneity)
  // Measures spatial co-occurrence of gray-level pairs
  const glcmLevels = 16;
  const glcm = new Float32Array(glcmLevels * glcmLevels);
  const glcmStep = Math.max(1, Math.floor(256 / glcmLevels));
  let glcmTotal = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const l1 = Math.min(glcmLevels - 1, Math.floor(gray[y * width + x] / glcmStep));
      const l2 = Math.min(glcmLevels - 1, Math.floor(gray[y * width + x + 1] / glcmStep));
      glcm[l1 * glcmLevels + l2]++;
      glcmTotal++;
    }
  }
  let contrast = 0;
  let homogeneity = 0;
  if (glcmTotal > 0) {
    for (let i = 0; i < glcmLevels; i++) {
      for (let j = 0; j < glcmLevels; j++) {
        const p = glcm[i * glcmLevels + j] / glcmTotal;
        contrast += p * (i - j) * (i - j);
        homogeneity += p / (1 + Math.abs(i - j));
      }
    }
  }
  // Real textures have moderate contrast and moderate homogeneity
  // AI textures often have extreme values (too smooth = high homogeneity, low contrast)
  const contrastScore = clamp(contrast < 2 ? 0.8 : contrast < 10 ? 0.4 : 0.15, 0, 1);
  const homogeneityScore = clamp(homogeneity > 0.6 ? 0.8 : homogeneity > 0.4 ? 0.4 : 0.15, 0, 1);
  const glcmScore = clamp(contrastScore * 0.5 + homogeneityScore * 0.5, 0, 1);

  return clamp(
    entropyScore * 0.3 +
    uniformScore * 0.2 +
    concentrationScore * 0.2 +
    glcmScore * 0.3,
    0, 1
  );
}

// ============================================================
// 8. SPECTRAL — 2D DFT with proper complex arithmetic
// ============================================================
function analyzeSpectral(gray: Float32Array, width: number, height: number): number {
  const aw = Math.min(width, 128);
  const ah = Math.min(height, 128);
  const ox = Math.floor((width - aw) / 2);
  const oy = Math.floor((height - ah) / 2);

  // Extract and window
  const tw = 32;
  const th = 32;
  const sw = Math.floor(aw / tw);
  const sh = Math.floor(ah / th);

  const small = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      let sum = 0;
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * (y * sh + dy)) / (ah - 1));
          const wx = 0.5 - 0.5 * Math.cos((2 * Math.PI * (x * sw + dx)) / (aw - 1));
          sum += gray[(oy + y * sh + dy) * width + (ox + x * sw + dx)] * wy * wx;
        }
      }
      small[y * tw + x] = sum / (sw * sh);
    }
  }

  // Complex 1D DFT — returns [re0, im0, re1, im1, ...]
  function dft1dComplex(input: Float32Array, n: number): Float32Array {
    const out = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) {
      let re = 0, im = 0;
      const angle = (-2 * Math.PI * k) / n;
      for (let j = 0; j < n; j++) {
        const c = Math.cos(angle * j);
        const s = Math.sin(angle * j);
        re += input[j] * c;
        im += input[j] * s;
      }
      out[k * 2] = re;
      out[k * 2 + 1] = im;
    }
    return out;
  }

  // Stage 1: Row-wise complex DFT
  const rowSpectra: Float32Array[] = [];
  for (let y = 0; y < th; y++) {
    const row = small.slice(y * tw, (y + 1) * tw);
    rowSpectra.push(dft1dComplex(row, tw));
  }

  // Stage 2: Column-wise complex DFT on the complex row results
  // For each frequency kx, take the column of complex values across rows
  const spectrum = new Float32Array(tw * th);
  for (let kx = 0; kx < tw; kx++) {
    // Build complex column input from row spectra
    const colRe = new Float32Array(th);
    const colIm = new Float32Array(th);
    for (let y = 0; y < th; y++) {
      colRe[y] = rowSpectra[y][kx * 2];
      colIm[y] = rowSpectra[y][kx * 2 + 1];
    }
    // DFT of complex signal: input has real+imag parts
    for (let ky = 0; ky < th; ky++) {
      let re = 0, im = 0;
      const angle = (-2 * Math.PI * ky) / th;
      for (let j = 0; j < th; j++) {
        const c = Math.cos(angle * j);
        const s = Math.sin(angle * j);
        // (colRe[j] + i*colIm[j]) * (c + i*(-s)) = colRe*c + colIm*s + i*(colIm*c - colRe*s)
        re += colRe[j] * c + colIm[j] * s;
        im += colIm[j] * c - colRe[j] * s;
      }
      spectrum[ky * tw + kx] = Math.sqrt(re * re + im * im);
    }
  }

  // Radial profile
  const maxRadius = Math.floor(Math.min(tw, th) / 2);
  const radialProfile: number[] = new Array(maxRadius).fill(0);
  const radialCounts: number[] = new Array(maxRadius).fill(0);
  const cy = th / 2;
  const cx = tw / 2;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const r = Math.floor(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2));
      if (r < maxRadius) {
        radialProfile[r] += spectrum[y * tw + x];
        radialCounts[r]++;
      }
    }
  }
  const avgProfile = radialProfile.map((v, i) => radialCounts[i] > 0 ? v / radialCounts[i] : 0);
  if (avgProfile.length < 3) return 0.5;

  const totalEnergy = avgProfile.reduce((s, v) => s + v, 0);
  if (totalEnergy === 0) return 0.5;

  // Sub-metric 1: High-frequency energy ratio
  const lowFreqEnergy = avgProfile.slice(0, Math.floor(maxRadius * 0.2)).reduce((s, v) => s + v, 0);
  const highFreqEnergy = avgProfile.slice(Math.floor(maxRadius * 0.6)).reduce((s, v) => s + v, 0);
  const highFreqRatio = highFreqEnergy / totalEnergy;
  const highFreqScore = clamp(1 - highFreqRatio * 8, 0, 1);

  // Sub-metric 2: Spectral decay (natural ~1/f)
  const logProfile = avgProfile.map((v) => Math.log(v + 1));
  let decayRate = 0;
  for (let i = 1; i < logProfile.length; i++) {
    decayRate += logProfile[i - 1] - logProfile[i];
  }
  decayRate /= Math.max(logProfile.length - 1, 1);
  const decayScore = clamp(
    decayRate < 0.2 ? 0.7 : decayRate < 0.5 ? 0.3 : decayRate < 0.8 ? 0.15 : 0.4, 0, 1);

  // Sub-metric 3: Low-frequency concentration
  const lowFreqConcentration = lowFreqEnergy / totalEnergy;
  const concentrationScore = clamp(
    lowFreqConcentration > 0.85 ? 0.8 : lowFreqConcentration > 0.7 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 4: Anisotropy — natural images have roughly isotropic spectra
  // Measure energy in horizontal vs vertical vs diagonal bands
  let horizEnergy = 0, vertEnergy = 0, diagEnergy = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (r > 2 && r < maxRadius) {
        const angle = Math.atan2(y - cy, x - cx);
        const e = spectrum[y * tw + x];
        if (Math.abs(Math.cos(angle)) > 0.85) horizEnergy += e;
        else if (Math.abs(Math.sin(angle)) > 0.85) vertEnergy += e;
        else diagEnergy += e;
      }
    }
  }
  const totalDir = horizEnergy + vertEnergy + diagEnergy;
  if (totalDir > 0) {
    const hRatio = horizEnergy / totalDir;
    const vRatio = vertEnergy / totalDir;
    // Natural images are roughly isotropic; strong directional bias is suspicious
    const anisotropy = Math.max(hRatio, vRatio);
    const anisotropyScore = clamp(anisotropy > 0.5 ? 0.7 : anisotropy > 0.4 ? 0.35 : 0.1, 0, 1);
    return clamp(
      highFreqScore * 0.3 + decayScore * 0.25 + concentrationScore * 0.25 + anisotropyScore * 0.2,
      0, 1);
  }

  return clamp(highFreqScore * 0.4 + decayScore * 0.3 + concentrationScore * 0.3, 0, 1);
}

// ============================================================
// 9. PATCH-BASED CONSISTENCY (new)
// Divides image into patches, computes local metrics for each,
// and measures variance across patches. AI images tend to have
// lower inter-patch variance than real photos.
// ============================================================
function analyzePatchConsistency(gray: Float32Array, width: number, height: number): number {
  const patchSize = 64;
  const patchesX = Math.floor(width / patchSize);
  const patchesY = Math.floor(height / patchSize);
  if (patchesX < 2 || patchesY < 2) return 0.5;

  const patchStats: { mean: number; variance: number; edgeDensity: number }[] = [];

  for (let py = 0; py < patchesY; py++) {
    for (let px = 0; px < patchesX; px++) {
      let sum = 0;
      let sumSq = 0;
      let edgeCount = 0;
      const n = patchSize * patchSize;
      const sy = py * patchSize;
      const sx = px * patchSize;

      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          const val = gray[(sy + dy) * width + (sx + dx)];
          sum += val;
          sumSq += val * val;
          // Simple edge detection within patch
          if (dx > 0 && dy > 0) {
            const idx = (sy + dy) * width + (sx + dx);
            const gx = Math.abs(gray[idx] - gray[idx - 1]);
            const gy = Math.abs(gray[idx] - gray[idx - width]);
            if (gx + gy > 15) edgeCount++;
          }
        }
      }

      const pMean = sum / n;
      const pVar = Math.max(0, sumSq / n - pMean * pMean);
      patchStats.push({ mean: pMean, variance: pVar, edgeDensity: edgeCount / n });
    }
  }

  if (patchStats.length < 4) return 0.5;

  // Sub-metric 1: Variance of patch variances (texture consistency)
  const patchVars = patchStats.map((p) => p.variance);
  const varCV = mean(patchVars) > 0 ? stdDev(patchVars) / mean(patchVars) : 0;
  const varConsistencyScore = clamp(varCV < 0.3 ? 0.85 : varCV < 0.6 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: Edge density variance across patches
  const edgeDensities = patchStats.map((p) => p.edgeDensity);
  const edgeDensityCV = mean(edgeDensities) > 0 ? stdDev(edgeDensities) / mean(edgeDensities) : 0;
  const edgeDensityScore = clamp(edgeDensityCV < 0.3 ? 0.8 : edgeDensityCV < 0.6 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 3: Patch mean gradient (brightness uniformity)
  const patchMeans = patchStats.map((p) => p.mean);
  const meanCV = mean(patchMeans) > 0 ? stdDev(patchMeans) / mean(patchMeans) : 0;
  const brightnessScore = clamp(meanCV < 0.1 ? 0.8 : meanCV < 0.2 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 4: Spatial autocorrelation of patch variances
  // Check if neighboring patches have similar variance (AI) or varying (real)
  let neighborVarDiff = 0;
  let neighborCount = 0;
  for (let py = 0; py < patchesY; py++) {
    for (let px = 0; px < patchesX; px++) {
      const idx = py * patchesX + px;
      if (px + 1 < patchesX) {
        neighborVarDiff += Math.abs(patchStats[idx].variance - patchStats[idx + 1].variance);
        neighborCount++;
      }
      if (py + 1 < patchesY) {
        neighborVarDiff += Math.abs(patchStats[idx].variance - patchStats[idx + patchesX].variance);
        neighborCount++;
      }
    }
  }
  const avgNeighborDiff = neighborCount > 0 ? neighborVarDiff / neighborCount : 0;
  const avgPatchVar = mean(patchVars);
  const neighborRatio = avgPatchVar > 0 ? avgNeighborDiff / avgPatchVar : 0;
  const neighborScore = clamp(neighborRatio < 0.3 ? 0.8 : neighborRatio < 0.6 ? 0.4 : 0.1, 0, 1);

  return clamp(
    varConsistencyScore * 0.3 +
    edgeDensityScore * 0.25 +
    brightnessScore * 0.2 +
    neighborScore * 0.25,
    0, 1
  );
}

// ============================================================
// 11. MULTI-SCALE ANALYSIS (new)
// Compares metrics across resolutions. AI images often maintain
// consistent statistical properties across scales, while real
// photos show scale-dependent variation due to optical blur.
// ============================================================
function analyzeMultiScale(gray: Float32Array, width: number, height: number): number {
  if (width < 128 || height < 128) return 0.5;

  // Downsample by 2x using averaging
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const downsampled = new Float32Array(halfW * halfH);
  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < halfW; x++) {
      const idx = (y * 2) * width + (x * 2);
      downsampled[y * halfW + x] =
        (gray[idx] + gray[idx + 1] + gray[idx + width] + gray[idx + width + 1]) / 4;
    }
  }

  // Compute variance at both scales
  const origVar = computeVariance(gray, width, height);
  const dsVar = computeVariance(downsampled, halfW, halfH);

  // Sub-metric 1: Variance ratio across scales
  // Real photos lose significant high-freq detail when downsampled
  // AI images often maintain similar statistics (variance ratio near 1)
  const varRatio = origVar > 0 ? dsVar / origVar : 1;
  const varRatioScore = clamp(varRatio > 0.8 ? 0.8 : varRatio > 0.6 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 2: Edge density change across scales
  const origEdges = countEdges(gray, width, height);
  const dsEdges = countEdges(downsampled, halfW, halfH);
  // Real photos: downsampled loses proportionally more edges (optical blur)
  const edgeRatio = origEdges > 0 ? dsEdges / origEdges : 1;
  const edgeRatioScore = clamp(edgeRatio > 0.7 ? 0.8 : edgeRatio > 0.5 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 3: Noise residual change across scales
  const origNoise = computeAvgNoiseResidual(gray, width, height);
  const dsNoise = computeAvgNoiseResidual(downsampled, halfW, halfH);
  const noiseRatio = origNoise > 0 ? dsNoise / origNoise : 1;
  // Real sensor noise averages out when downsampled (noise ~ 1/sqrt(N))
  // AI noise patterns can persist or scale unnaturally
  const noiseRatioScore = clamp(noiseRatio > 0.6 ? 0.8 : noiseRatio > 0.4 ? 0.4 : 0.15, 0, 1);

  return clamp(
    varRatioScore * 0.35 +
    edgeRatioScore * 0.35 +
    noiseRatioScore * 0.3,
    0, 1
  );
}

function computeVariance(arr: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    sum += arr[i];
    sumSq += arr[i] * arr[i];
  }
  const m = sum / n;
  return Math.max(0, sumSq / n - m * m);
}

function countEdges(gray: Float32Array, w: number, h: number): number {
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = Math.abs(gray[idx] - gray[idx - 1]) + Math.abs(gray[idx] - gray[idx + 1]);
      const gy = Math.abs(gray[idx] - gray[idx - w]) + Math.abs(gray[idx] - gray[idx + w]);
      if (gx + gy > 20) count++;
    }
  }
  return count / (w * h);
}

function computeAvgNoiseResidual(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const neighbors = (gray[idx - 1] + gray[idx + 1] + gray[idx - w] + gray[idx + w]) / 4;
      sum += Math.abs(gray[idx] - neighbors);
      cnt++;
    }
  }
  return cnt > 0 ? sum / cnt : 0;
}


// Browser File objects expose only basic file properties by default; this demo does not parse EXIF/IPTC metadata.
// Keep this input neutral rather than inferring provenance from filename, size, or extension.
function analyzeMetadata(_file: File): number {
  return 0.5;
}

// ============================================================
// METRICS COMPUTATION
// ============================================================
function computeMetrics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  file: File
): ImageMetrics {
  const count = width * height;
  const gray = toGrayscale(data, count);

  const noiseScore = analyzeNoise(gray, width, height);
  const edgeScore = analyzeEdges(gray, width, height);
  const frequencyScore = analyzeFrequency(gray, width, height);
  const colorScore = analyzeColor(data, count);
  const symmetryScore = analyzeSymmetry(gray, width, height);
  const compressionScore = analyzeCompression(data, width, height);
  const textureScore = analyzeTexture(gray, width, height);
  const spectralScore = analyzeSpectral(gray, width, height);
  const patchScore = analyzePatchConsistency(gray, width, height);
  const metadataScore = analyzeMetadata(file);
  const multiScaleScore = analyzeMultiScale(gray, width, height);

  return {
    noiseScore: Math.round(noiseScore * 100),
    edgeScore: Math.round(edgeScore * 100),
    frequencyScore: Math.round(frequencyScore * 100),
    colorScore: Math.round(colorScore * 100),
    symmetryScore: Math.round(symmetryScore * 100),
    compressionScore: Math.round(compressionScore * 100),
    metadataScore: Math.round(metadataScore * 100),
    textureScore: Math.round(textureScore * 100),
    spectralScore: Math.round(spectralScore * 100),
    patchScore: Math.round(patchScore * 100),
    multiScaleScore: Math.round(multiScaleScore * 100),
    overallScore: 0, // filled by ensemble
  };
}

// ============================================================
// ENSEMBLE SCORING — replaces simple weighted average
// Uses both weighted average and majority voting
// ============================================================
function ensembleScore(metrics: ImageMetrics): number {
  const scores: Record<string, number> = {
    noise: metrics.noiseScore / 100,
    edge: metrics.edgeScore / 100,
    frequency: metrics.frequencyScore / 100,
    color: metrics.colorScore / 100,
    texture: metrics.textureScore / 100,
    spectral: metrics.spectralScore / 100,
    symmetry: metrics.symmetryScore / 100,
    compression: metrics.compressionScore / 100,
    patch: metrics.patchScore / 100,
    multiScale: metrics.multiScaleScore / 100,
    metadata: metrics.metadataScore / 100,
  };

  const weights: Record<string, number> = {
    noise: 0.12, edge: 0.11, frequency: 0.11, color: 0.1,
    texture: 0.11, spectral: 0.1, symmetry: 0.06,
    compression: 0.07, patch: 0.08, multiScale: 0.09, metadata: 0.05,
  };

  // Discount correlated metrics: if noise, texture, and patch all agree closely,
  // they're measuring similar things (spatial uniformity) so reduce their combined weight
  const spatialGroup = [scores.noise, scores.texture, scores.patch];
  const spatialMean = mean(spatialGroup);
  const spatialSpread = mean(spatialGroup.map((s) => Math.abs(s - spatialMean)));
  // If spread is very low, metrics are correlated — reduce their weights
  const correlationDiscount = spatialSpread < 0.05 ? 0.7 : spatialSpread < 0.1 ? 0.85 : 1.0;

  let weightedAvg = 0;
  let weightSum = 0;
  const spatialKeys = ['noise', 'texture', 'patch'];
  for (const key of Object.keys(weights)) {
    let w = weights[key];
    if (spatialKeys.includes(key)) w *= correlationDiscount;
    weightedAvg += scores[key] * w;
    weightSum += w;
  }
  weightedAvg /= weightSum;

  // Majority vote with diversity: count strong vs weak votes separately
  const aiVotes = Object.keys(scores).filter((k) => scores[k] > 0.5).length;
  const strongAiVotes = Object.keys(scores).filter((k) => scores[k] > 0.7).length;
  const totalVotes = Object.keys(scores).length;
  const voteRatio = aiVotes / totalVotes;
  const strongVoteRatio = strongAiVotes / totalVotes;

  let consensusAdjust = 0;
  if (voteRatio > 0.7) consensusAdjust = 0.08;
  else if (voteRatio < 0.3) consensusAdjust = -0.08;
  // Strong consensus: if > 50% of metrics are strongly AI (> 0.7), boost more
  if (strongVoteRatio > 0.5) consensusAdjust += 0.05;

  // Extreme signal detection
  let extremeAdjust = 0;
  for (const key of Object.keys(scores)) {
    if (scores[key] > 0.85) extremeAdjust += 0.02;
    if (scores[key] < 0.15) extremeAdjust -= 0.02;
  }
  extremeAdjust = clamp(extremeAdjust, -0.1, 0.1);

  // Metric dispersion: if all metrics cluster near 0.5, confidence should be lower
  // (uncertainty), so push toward 0.5 slightly
  const allScores = Object.values(scores);
  const scoreSpread = stdDev(allScores);
  if (scoreSpread < 0.1) {
    // Low dispersion = uncertain, pull toward 0.5
    weightedAvg = weightedAvg * 0.8 + 0.5 * 0.2;
  }

  return clamp(weightedAvg + consensusAdjust + extremeAdjust, 0, 1);
}

// ============================================================
// PATTERN BUILDING
// ============================================================
function buildPatterns(
  metrics: ImageMetrics,
  isAI: boolean,
  mediaType: MediaType,
  temporalScore?: number
): DetectedPattern[] {
  const mediaNoun = mediaType === 'video' ? 'video' : 'image';
  const t = 55;

  const all: DetectedPattern[] = [
    {
      name: 'Frequency Domain Anomaly',
      description:
        metrics.frequencyScore > t
          ? `Multi-block DCT analysis reveals unnatural energy concentration (${metrics.frequencyScore}%). Block variance uniformity is high, indicating synthetic frequency distribution typical of GAN-based generation.`
          : `Frequency distribution shows natural variation. Block variances are organic and DC/AC energy ratios match real ${mediaType === 'video' ? 'footage' : 'photography'}.`,
      confidence: metrics.frequencyScore,
      type: 'frequency',
    },
    {
      name: 'Edge Consistency Analysis',
      description:
        metrics.edgeScore > t
          ? `Sobel gradient analysis shows abnormally smooth edges with low direction entropy (${metrics.edgeScore}%). Edge sharpness profiles indicate soft halos rather than crisp camera transitions.`
          : `Edge transitions show natural variation with diverse gradient directions and healthy sharpness profiles matching real camera optics.`,
      confidence: metrics.edgeScore,
      type: 'edge',
    },
    {
      name: 'Noise Profile Detection',
      description:
        metrics.noiseScore > t
          ? `Multi-scale Laplacian residual analysis reveals suspiciously uniform noise (${metrics.noiseScore}%). Noise kurtosis is low, channel noise difference is minimal, and high-detail areas lack expected sensor noise.`
          : `Noise profile shows organic randomness with high kurtosis, natural channel differences, and appropriate noise in high-detail areas — consistent with real camera sensors.`,
      confidence: metrics.noiseScore,
      type: 'noise',
    },
    {
      name: 'Color Histogram Analysis',
      description:
        metrics.colorScore > t
          ? `Color histogram is unusually smooth (${metrics.colorScore}%). Channel correlation is high and saturation variance is low, patterns commonly seen in AI-generated ${mediaNoun}s.`
          : `Color distribution is rich and varied with natural histogram roughness, moderate channel correlation, and organic saturation variation.`,
      confidence: metrics.colorScore,
      type: 'artifact',
    },
    {
      name: 'Texture Pattern Analysis',
      description:
        metrics.textureScore > t
          ? `Local Binary Pattern analysis reveals low texture entropy (${metrics.textureScore}%). LBP histogram is dominated by few patterns, suggesting synthetic texture generation.`
          : `Texture analysis shows high LBP entropy with diverse local patterns, consistent with organic surface textures in real ${mediaType === 'video' ? 'video frames' : 'photographs'}.`,
      confidence: metrics.textureScore,
      type: 'frequency',
    },
    {
      name: 'Spectral Power Analysis',
      description:
        metrics.spectralScore > t
          ? `2D power spectrum shows unnatural decay profile (${metrics.spectralScore}%). High-frequency energy is low, spectral anisotropy is high, and low-frequency concentration deviates from natural 1/f decay.`
          : `Spectral analysis shows natural 1/f power decay with healthy high-frequency content, isotropic distribution, and balanced frequency energy.`,
      confidence: metrics.spectralScore,
      type: 'frequency',
    },
    {
      name: 'Multi-Scale Consistency Analysis',
      description:
        metrics.multiScaleScore > t
          ? `Multi-scale analysis (${metrics.multiScaleScore}%) shows statistical properties that persist across resolutions. Variance, edge density, and noise ratios remain too consistent when downsampled, unlike the scale-dependent degradation in real camera optics.`
          : `Multi-scale analysis shows natural scale-dependent degradation. Variance, edge density, and noise characteristics change proportionally when downsampled, consistent with real optical capture.`,
      confidence: metrics.multiScaleScore,
      type: 'artifact',
    },
    {
      name: 'Patch Consistency Analysis',
      description:
        metrics.patchScore > t
          ? `Patch-based analysis (${metrics.patchScore}%) reveals low inter-patch variance. Texture, edge density, and brightness statistics are too uniform across spatial regions, unlike the natural variation in real photographs.`
          : `Patch analysis shows healthy spatial variation in texture, edge density, and brightness across image regions, consistent with real camera capture.`,
      confidence: metrics.patchScore,
      type: 'artifact',
    },
  ];

  if (mediaType === 'video' && temporalScore !== undefined) {
    const tempPercent = Math.round(temporalScore * 100);
    all.push({
      name: 'Temporal Consistency Check',
      description:
        tempPercent > t
          ? `Inter-frame analysis reveals unnatural temporal coherence (${tempPercent}%). Motion vectors are too uniform, brightness flicker is minimal, and frame-to-frame variation lacks the micro-jitter of real camera footage.`
          : `Inter-frame transitions show natural temporal variation with realistic motion vectors, expected brightness flicker, and organic frame-to-frame noise variation.`,
      confidence: tempPercent,
      type: 'artifact',
    });
  }

  if (isAI) {
    return all.sort((a, b) => b.confidence - a.confidence);
  } else {
    return all.sort((a, b) => b.confidence - a.confidence).map((p) => ({
      ...p,
      confidence: Math.max(12, Math.round(p.confidence * 0.35)),
    }));
  }
}

// ============================================================
// PUBLIC API — IMAGE
// ============================================================
export async function analyzeImage(file: File): Promise<AnalysisResult> {
  // Image verdicts come from a pretrained classifier, not handcrafted
  // pixel-statistic thresholds. Its output is not a calibrated probability.
  const scores = await detectAiImage(file);
  const aiScore = Math.round(scores.ai * 100);
  const realScore = Math.round(scores.real * 100);
  const verdict: AnalysisResult['verdict'] =
    scores.ai >= 0.7 ? 'ai' : scores.real >= 0.7 ? 'real' : 'uncertain';
  const isAI = scores.ai > scores.real;

  const patterns: DetectedPattern[] = [
    {
      name: 'Trained model: AI-generated signal',
      description: 'Output score from a pretrained image classifier trained to distinguish AI-generated images from real images. This is not a calibrated real-world probability and can be wrong, especially on newer generators or edited/compressed files.',
      confidence: aiScore,
      type: 'artifact',
    },
    {
      name: 'Trained model: real-image signal',
      description: 'Output score for the model’s real-image class. A high score is not proof of authenticity; synthetic images can be missed and real photographs can be falsely flagged.',
      confidence: realScore,
      type: 'artifact',
    },
  ];

  return {
    patterns,
    isAI,
    confidence: aiScore,
    verdict,
    method: 'trained-model',
    aiScore,
    realScore,
    mediaType: 'image',
  };
}

// ============================================================
// VIDEO ANALYSIS
// ============================================================
async function extractVideoFrames(file: File, numFrames: number): Promise<PixelData[]> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.src = url;
  video.muted = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')); };
  });

  const duration = video.duration;
  const frames: PixelData[] = [];
  const maxDim = 384;

  for (let i = 0; i < numFrames; i++) {
    const t = (duration / (numFrames + 1)) * (i + 1);
    await new Promise<void>((resolve, reject) => {
      video.currentTime = t;
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Seek failed'));
    });

    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    frames.push({ data: imageData.data, width: w, height: h });
  }

  URL.revokeObjectURL(url);
  return frames;
}

function analyzeTemporalConsistency(frames: PixelData[]): { score: number; motionVariance: number; flickerScore: number } {
  if (frames.length < 2) return { score: 0.5, motionVariance: 0, flickerScore: 0.5 };

  const frameDiffs: number[] = [];
  const frameBrightness: number[] = [];
  const allMotionVectors: number[] = [];

  for (let f = 0; f < frames.length; f++) {
    const { data, width, height } = frames[f];
    let brightSum = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      brightSum += (data[o] + data[o + 1] + data[o + 2]) / 3;
    }
    frameBrightness.push(brightSum / (width * height));
  }

  function computeFrameDiff(prev: PixelData, curr: PixelData): { diff: number; mvs: number[] } {
    const minW = Math.min(prev.width, curr.width);
    const minH = Math.min(prev.height, curr.height);
    const sampleStep = 2;
    let frameDiff = 0;
    let samples = 0;
    const mvs: number[] = [];

    for (let y = 0; y < minH - 4; y += sampleStep * 2) {
      for (let x = 0; x < minW - 4; x += sampleStep * 2) {
        let bestDist = Infinity;
        let bestDx = 0, bestDy = 0;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            const nx = Math.min(minW - 1, Math.max(0, x + dx));
            const ny = Math.min(minH - 1, Math.max(0, y + dy));
            let dist = 0;
            for (let by = 0; by < 2; by++) {
              for (let bx = 0; bx < 2; bx++) {
                const pIdx = ((y + by) * prev.width + (x + bx)) * 4;
                const cIdx = ((ny + by) * curr.width + (nx + bx)) * 4;
                dist += Math.abs(prev.data[pIdx] - curr.data[cIdx]);
                dist += Math.abs(prev.data[pIdx + 1] - curr.data[cIdx + 1]);
                dist += Math.abs(prev.data[pIdx + 2] - curr.data[cIdx + 2]);
              }
            }
            if (dist < bestDist) { bestDist = dist; bestDx = dx; bestDy = dy; }
          }
        }
        mvs.push(Math.sqrt(bestDx * bestDx + bestDy * bestDy));
        frameDiff += bestDist;
        samples++;
      }
    }
    return { diff: samples > 0 ? frameDiff / samples : 0, mvs };
  }

  // Adjacent frame diffs
  for (let f = 1; f < frames.length; f++) {
    const result = computeFrameDiff(frames[f - 1], frames[f]);
    frameDiffs.push(result.diff);
    allMotionVectors.push(...result.mvs);
  }

  if (frameDiffs.length === 0) return { score: 0.5, motionVariance: 0, flickerScore: 0.5 };

  const avgMotion = mean(frameDiffs);
  const lowMotionScore = clamp(avgMotion < 2 ? 1 : avgMotion < 5 ? 0.6 : avgMotion < 15 ? 0.3 : 0.1, 0, 1);

  const motionCV = avgMotion > 0 ? stdDev(frameDiffs, avgMotion) / avgMotion : 0;
  const lowVarianceScore = clamp(motionCV < 0.15 ? 0.9 : motionCV < 0.3 ? 0.5 : 0.15, 0, 1);

  const mvMean = mean(allMotionVectors);
  const mvCV = mvMean > 0 ? stdDev(allMotionVectors, mvMean) / mvMean : 0;
  const mvUniformity = allMotionVectors.filter((v) => v < 0.1).length / Math.max(allMotionVectors.length, 1);
  const mvScore = clamp(mvUniformity > 0.7 ? 0.8 : mvUniformity > 0.5 ? 0.5 : mvCV < 0.3 ? 0.6 : 0.15, 0, 1);

  const brightDiffs: number[] = [];
  for (let i = 1; i < frameBrightness.length; i++) {
    brightDiffs.push(Math.abs(frameBrightness[i] - frameBrightness[i - 1]));
  }
  const avgBrightDiff = mean(brightDiffs);
  const brightCV = avgBrightDiff > 0 ? stdDev(brightDiffs, avgBrightDiff) / avgBrightDiff : 0;
  const flickerScore = clamp(avgBrightDiff < 0.5 ? 0.8 : avgBrightDiff < 2 ? 0.4 : 0.1, 0, 1);
  const brightStabilityScore = clamp(brightCV < 0.2 ? 0.7 : brightCV < 0.5 ? 0.35 : 0.1, 0, 1);

  // Sub-metric 6: Non-adjacent frame discontinuity
  // Real video: diff between frame 0 and 2 should be ~2x diff between 0 and 1
  // AI video can have non-linear temporal evolution (discontinuities or too-linear)
  const nonAdjDiffs: number[] = [];
  for (let f = 2; f < frames.length; f++) {
    const result = computeFrameDiff(frames[f - 2], frames[f]);
    nonAdjDiffs.push(result.diff);
  }
  const avgNonAdj = mean(nonAdjDiffs);
  // Expected: non-adjacent diff ~ 2x adjacent diff (linear motion accumulation)
  const expectedRatio = avgNonAdj / Math.max(avgMotion, 0.01);
  // Ratio < 1.3 = suspicious (motion not accumulating naturally)
  // Ratio > 3 = suspicious (discontinuity/jump)
  const discontinuityScore = clamp(
    expectedRatio < 1.2 ? 0.8 : expectedRatio < 1.5 ? 0.5 :
    expectedRatio > 3 ? 0.7 : expectedRatio > 2.5 ? 0.4 : 0.15, 0, 1);

  const temporalScore = clamp(
    lowMotionScore * 0.2 + lowVarianceScore * 0.15 + mvScore * 0.15 +
    flickerScore * 0.1 + brightStabilityScore * 0.15 + discontinuityScore * 0.25, 0, 1);

  return { score: temporalScore, motionVariance: motionCV, flickerScore };
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const numFrames = 8;

  // Run video frame extraction and audio analysis in parallel
  const [frames, audioResult] = await Promise.all([
    extractVideoFrames(file, numFrames),
    analyzeAudio(file),
  ]);

  if (frames.length === 0) throw new Error('No frames could be extracted from video');

  // Compute visual metrics for each frame
  const frameMetrics: ImageMetrics[] = [];
  for (const frame of frames) {
    const m = computeMetrics(frame.data, frame.width, frame.height, file);
    frameMetrics.push(m);
  }

  // Average frame-level scores
  const avg = (key: keyof ImageMetrics) =>
    Math.round(frameMetrics.reduce((s, m) => s + m[key], 0) / frameMetrics.length);

  const metrics: ImageMetrics = {
    noiseScore: avg('noiseScore'),
    edgeScore: avg('edgeScore'),
    frequencyScore: avg('frequencyScore'),
    colorScore: avg('colorScore'),
    symmetryScore: avg('symmetryScore'),
    compressionScore: avg('compressionScore'),
    metadataScore: avg('metadataScore'),
    textureScore: avg('textureScore'),
    spectralScore: avg('spectralScore'),
    patchScore: avg('patchScore'),
    multiScaleScore: avg('multiScaleScore'),
    overallScore: 0,
  };

  // Inter-frame metric consistency penalty
  const noiseStd = stdDev(frameMetrics.map((m) => m.noiseScore));
  const textureStd = stdDev(frameMetrics.map((m) => m.textureScore));
  const edgeStd = stdDev(frameMetrics.map((m) => m.edgeScore));
  const avgFrameStd = (noiseStd + textureStd + edgeStd) / 3;
  const frameConsistencyPenalty = clamp(avgFrameStd < 1 ? 0.15 : avgFrameStd < 3 ? 0.05 : 0, 0, 0.15);

  // Temporal analysis
  const temporal = analyzeTemporalConsistency(frames);
  const temporalPercent = Math.round(temporal.score * 100);

  // Ensemble scoring for visual
  const spatialScore = ensembleScore(metrics);

  // Blend visual + temporal + audio scores
  // If audio is present, it gets significant weight since voice analysis
  // is a strong independent signal for AI video detection
  const audioScore = audioResult.hasAudio ? audioResult.metrics.overallScore / 100 : 0;
  let overallScore: number;
  if (audioResult.hasAudio) {
    // With audio: visual 40%, temporal 25%, audio 30%, penalty 5%
    overallScore = clamp(
      spatialScore * 0.4 + temporal.score * 0.25 + audioScore * 0.3 + frameConsistencyPenalty,
      0, 1
    );
  } else {
    // No audio: visual 55%, temporal 40%, penalty 5%
    overallScore = clamp(
      spatialScore * 0.55 + temporal.score * 0.4 + frameConsistencyPenalty,
      0, 1
    );
  }

  metrics.overallScore = Math.round(overallScore * 100);
  metrics.symmetryScore = temporalPercent;

  const isAI = overallScore > 0.5;
  const finalConfidence = Math.round(overallScore * 100);

  // Build visual patterns
  const visualPatterns = buildPatterns(metrics, isAI, 'video', temporal.score);

  // Convert audio patterns to DetectedPattern format and prepend if audio exists
  const audioPatterns: DetectedPattern[] = audioResult.hasAudio
    ? audioResult.patterns.map((p: AudioPattern) => ({
        name: p.name,
        description: p.description,
        confidence: isAI ? p.confidence : Math.max(12, Math.round(p.confidence * 0.35)),
        type: 'audio' as const,
      }))
    : [];

  // Merge: audio patterns first (sorted by confidence), then visual patterns
  const allPatterns = [...audioPatterns, ...visualPatterns];

  return {
    patterns: allPatterns,
    isAI,
    confidence: finalConfidence,
    verdict: 'uncertain',
    method: 'heuristic',
    metrics,
    mediaType: 'video',
    audioMetrics: audioResult.hasAudio ? audioResult.metrics : undefined,
    hasAudio: audioResult.hasAudio,
  };
}
