// ============================================================
// AUDIO/VOICE ANALYSIS
// Extracts audio from a video file and analyzes voice characteristics
// to detect AI-generated or synthetic speech.
// Uses Web Audio API for decoding + OfflineAudioContext for processing.
// ============================================================

export interface AudioMetrics {
  spectralScore: number;       // Spectral characteristics of voice
  prosodyScore: number;         // Speech rhythm, intonation, pacing
  pitchScore: number;           // Pitch contour naturalness
  formantScore: number;         // Formant frequency consistency
  noiseFloorScore: number;      // Background noise / recording artifacts
  harmonicScore: number;        // Harmonic structure of voice
  overallScore: number;
}

export interface AudioAnalysisResult {
  metrics: AudioMetrics;
  patterns: AudioPattern[];
  hasAudio: boolean;
}

export interface AudioPattern {
  name: string;
  description: string;
  confidence: number;
}

// ============================================================
// AUDIO EXTRACTION
// ============================================================
async function extractAudioFromFile(file: File): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Use a temporary OnlineAudioContext to decode
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AC();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();
    return audioBuffer;
  } catch {
    return null;
  }
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

// ============================================================
// FRAME-BASED FEATURE EXTRACTION
// Processes audio in overlapping frames and extracts per-frame
// spectral and prosodic features.
// ============================================================
interface AudioFrame {
  rms: number;
  spectralCentroid: number;
  spectralFlatness: number;
  zeroCrossingRate: number;
  spectralRolloff: number;
  pitch: number;
}

function extractFrames(audioBuffer: AudioBuffer, frameSize: number, hopSize: number): AudioFrame[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const frames: AudioFrame[] = [];

  // Hann window
  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
  }

  for (let start = 0; start + frameSize <= channelData.length; start += hopSize) {
    // Apply window
    const frame = new Float32Array(frameSize);
    let rms = 0;
    for (let i = 0; i < frameSize; i++) {
      frame[i] = channelData[start + i] * window[i];
      rms += frame[i] * frame[i];
    }
    rms = Math.sqrt(rms / frameSize);

    // Skip near-silent frames
    if (rms < 0.001) continue;

    // Zero-crossing rate
    let zc = 0;
    for (let i = 1; i < frameSize; i++) {
      if ((frame[i - 1] >= 0) !== (frame[i] >= 0)) zc++;
    }
    const zcr = zc / (frameSize - 1);

    // FFT via autocorrelation-based magnitude spectrum (simplified DFT)
    // Use a smaller FFT for performance
    const fftSize = 512;
    const fftInput = new Float32Array(fftSize);
    for (let i = 0; i < fftSize && i < frameSize; i++) fftInput[i] = frame[i];

    const magnitude = computeMagnitudeSpectrum(fftInput, fftSize);

    // Spectral centroid
    let weightedSum = 0;
    let totalMag = 0;
    for (let k = 0; k < magnitude.length; k++) {
      const freq = (k * sampleRate) / fftSize;
      weightedSum += freq * magnitude[k];
      totalMag += magnitude[k];
    }
    const centroid = totalMag > 0 ? weightedSum / totalMag : 0;

    // Spectral flatness (geometric mean / arithmetic mean)
    let logSum = 0;
    let arithSum = 0;
    let nonZeroCount = 0;
    for (let k = 1; k < magnitude.length; k++) {
      if (magnitude[k] > 1e-10) {
        logSum += Math.log(magnitude[k]);
        arithSum += magnitude[k];
        nonZeroCount++;
      }
    }
    const flatness = nonZeroCount > 0
      ? Math.exp(logSum / nonZeroCount) / (arithSum / nonZeroCount)
      : 0;

    // Spectral rolloff (85th percentile)
    let energySum = 0;
    for (const m of magnitude) energySum += m;
    let rolloffEnergy = 0;
    let rolloffBin = 0;
    for (let k = 0; k < magnitude.length; k++) {
      rolloffEnergy += magnitude[k];
      if (rolloffEnergy >= 0.85 * energySum) {
        rolloffBin = k;
        break;
      }
    }
    const rolloff = (rolloffBin * sampleRate) / fftSize;

    // Pitch estimation via autocorrelation
    const pitch = estimatePitch(frame, sampleRate);

    frames.push({
      rms,
      spectralCentroid: centroid,
      spectralFlatness: flatness,
      zeroCrossingRate: zcr,
      spectralRolloff: rolloff,
      pitch,
    });
  }

  return frames;
}

function computeMagnitudeSpectrum(input: Float32Array, n: number): Float32Array {
  // Only compute first N/2 bins (real signal symmetry)
  const half = Math.floor(n / 2);
  const out = new Float32Array(half);
  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    const angle = (-2 * Math.PI * k) / n;
    for (let j = 0; j < n; j++) {
      const c = Math.cos(angle * j);
      const s = Math.sin(angle * j);
      re += input[j] * c;
      im += input[j] * s;
    }
    out[k] = Math.sqrt(re * re + im * im);
  }
  return out;
}

function estimatePitch(frame: Float32Array, sampleRate: number): number {
  // Autocorrelation-based pitch detection
  // Limit lag range to human voice fundamental (80-400 Hz)
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 80);
  const corrLength = Math.min(frame.length, 1024);

  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag && lag < corrLength; lag++) {
    let corr = 0;
    let energy = 0;
    for (let i = 0; i < corrLength - lag; i++) {
      corr += frame[i] * frame[i + lag];
      energy += frame[i] * frame[i];
    }
    // Normalized autocorrelation
    const normalized = energy > 0 ? corr / energy : 0;
    if (normalized > bestCorr) {
      bestCorr = normalized;
      bestLag = lag;
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : 0;
}

// ============================================================
// ANALYZER 1: SPECTRAL CHARACTERISTICS
// AI-generated speech often has unnatural spectral envelope.
// Real speech has formant peaks with specific bandwidths.
// ============================================================
function analyzeSpectralFeatures(frames: AudioFrame[]): number {
  // Sub-metric 1: Spectral centroid stability
  // Real voice has natural variation in centroid; AI is often too stable
  const centroids = frames.map((f) => f.spectralCentroid).filter((c) => c > 0);
  const centMean = mean(centroids);
  const centCV = centMean > 0 ? stdDev(centroids, centMean) / centMean : 0;
  const centStabilityScore = clamp(centCV < 0.15 ? 0.85 : centCV < 0.3 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: Spectral flatness (voiced vs unvoiced)
  // Real speech alternates between voiced (low flatness) and unvoiced (high flatness)
  const flatnesses = frames.map((f) => f.spectralFlatness);
  const flatMean = mean(flatnesses);
  const flatCV = flatMean > 0 ? stdDev(flatnesses, flatMean) / flatMean : 0;
  // AI speech often lacks this alternation (too uniform flatness)
  const flatnessVariationScore = clamp(flatCV < 0.2 ? 0.8 : flatCV < 0.4 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 3: Spectral rolloff variation
  const rolloffs = frames.map((f) => f.spectralRolloff).filter((r) => r > 0);
  const rolloffMean = mean(rolloffs);
  const rolloffCV = rolloffMean > 0 ? stdDev(rolloffs, rolloffMean) / rolloffMean : 0;
  const rolloffScore = clamp(rolloffCV < 0.15 ? 0.8 : rolloffCV < 0.3 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 4: Voiced frame ratio (real speech has ~60% voiced)
  const voicedFrames = frames.filter((f) => f.spectralFlatness < 0.3 && f.rms > 0.005).length;
  const voicedRatio = frames.length > 0 ? voicedFrames / frames.length : 0;
  // AI speech sometimes has too high voiced ratio (no natural pauses)
  const voicedRatioScore = clamp(
    voicedRatio > 0.85 ? 0.75 : voicedRatio > 0.7 ? 0.5 : voicedRatio > 0.4 ? 0.2 : 0.5, 0, 1);

  return clamp(
    centStabilityScore * 0.3 +
    flatnessVariationScore * 0.25 +
    rolloffScore * 0.25 +
    voicedRatioScore * 0.2,
    0, 1
  );
}

// ============================================================
// ANALYZER 2: PROSODY (speech rhythm, intonation, pacing)
// AI-generated speech often has unnatural prosody — too regular
// rhythm, flat intonation, or unrealistic pacing.
// ============================================================
function analyzeProsody(frames: AudioFrame[], sampleRate: number, hopSize: number): number {
  // Identify voiced segments and measure rhythm
  const voiced: boolean[] = frames.map((f) => f.spectralFlatness < 0.3 && f.rms > 0.005);
  const frameDurationMs = (hopSize / sampleRate) * 1000;

  // Sub-metric 1: Voiced/unvoiced segment pattern
  const segments: { type: 'voiced' | 'silence'; length: number }[] = [];
  let currentType: 'voiced' | 'silence' = voiced[0] ? 'voiced' : 'silence';
  let currentLen = 1;
  for (let i = 1; i < voiced.length; i++) {
    const t = voiced[i] ? 'voiced' : 'silence';
    if (t === currentType) {
      currentLen++;
    } else {
      segments.push({ type: currentType, length: currentLen * frameDurationMs });
      currentType = t;
      currentLen = 1;
    }
  }
  segments.push({ type: currentType, length: currentLen * frameDurationMs });

  // Real speech has varied segment lengths; AI is often too uniform
  const voicedSegs = segments.filter((s) => s.type === 'voiced').map((s) => s.length);
  const silenceSegs = segments.filter((s) => s.type === 'silence').map((s) => s.length);

  const voicedCV = voicedSegs.length > 1
    ? (mean(voicedSegs) > 0 ? stdDev(voicedSegs, mean(voicedSegs)) / mean(voicedSegs) : 0)
    : 0.5;
  const silenceCV = silenceSegs.length > 1
    ? (mean(silenceSegs) > 0 ? stdDev(silenceSegs, mean(silenceSegs)) / mean(silenceSegs) : 0)
    : 0.5;

  const rhythmScore = clamp(
    voicedCV < 0.2 ? 0.85 : voicedCV < 0.4 ? 0.45 : 0.15, 0, 1);
  const pauseScore = clamp(
    silenceCV < 0.25 ? 0.8 : silenceCV < 0.5 ? 0.4 : 0.1, 0, 1);

  // Sub-metric 2: Speech rate consistency
  // Real speech varies in rate; AI is often metronomic
  const rmsValues = frames.map((f) => f.rms);
  const rmsCV = mean(rmsValues) > 0 ? stdDev(rmsValues, mean(rmsValues)) / mean(rmsValues) : 0;
  // Low RMS variation = too consistent energy = suspicious
  const energyScore = clamp(rmsCV < 0.15 ? 0.85 : rmsCV < 0.3 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 3: Pause frequency
  // Real speech has natural pauses every few seconds
  const totalDurationMs = frames.length * frameDurationMs;
  const pauseCount = silenceSegs.filter((l) => l > 100).length; // pauses > 100ms
  const pausesPerSecond = totalDurationMs > 0 ? (pauseCount / totalDurationMs) * 1000 : 0;
  // Too few pauses = suspicious (AI often doesn't pause naturally)
  const pauseFreqScore = clamp(
    pausesPerSecond < 0.1 ? 0.8 : pausesPerSecond < 0.3 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 4: Segment length distribution
  // Real speech has occasional long segments (sustained vowels) and short ones
  const allVoiced = voicedSegs.sort((a, b) => a - b);
  let longSegRatio = 0;
  if (allVoiced.length > 0) {
    const maxSeg = allVoiced[allVoiced.length - 1];
    const medSeg = allVoiced[Math.floor(allVoiced.length / 2)];
    longSegRatio = medSeg > 0 ? maxSeg / medSeg : 1;
  }
  const segDistScore = clamp(longSegRatio < 2 ? 0.8 : longSegRatio < 4 ? 0.4 : 0.15, 0, 1);

  return clamp(
    rhythmScore * 0.3 +
    pauseScore * 0.2 +
    energyScore * 0.2 +
    pauseFreqScore * 0.15 +
    segDistScore * 0.15,
    0, 1
  );
}

// ============================================================
// ANALYZER 3: PITCH CONTOUR NATURALNESS
// Real voice has micro-variations in pitch (jitter) and
// natural intonation curves. AI speech is often too smooth.
// ============================================================
function analyzePitchContour(frames: AudioFrame[]): number {
  const pitches = frames
    .filter((f) => f.pitch > 60 && f.pitch < 500)
    .map((f) => f.pitch);

  if (pitches.length < 10) return 0.5;

  // Sub-metric 1: Pitch jitter (cycle-to-cycle variation)
  // Real voice has 0.5-2% jitter; AI often < 0.3%
  const diffs: number[] = [];
  for (let i = 1; i < pitches.length; i++) {
    diffs.push(Math.abs(pitches[i] - pitches[i - 1]) / pitches[i - 1]);
  }
  const jitter = mean(diffs);
  const jitterScore = clamp(jitter < 0.003 ? 0.85 : jitter < 0.01 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: Pitch range (real speech varies in pitch)
  const pitchMin = Math.min(...pitches);
  const pitchMax = Math.max(...pitches);
  const pitchRange = pitchMax - pitchMin;
  const pitchMean = mean(pitches);
  const rangeRatio = pitchMean > 0 ? pitchRange / pitchMean : 0;
  const rangeScore = clamp(rangeRatio < 0.1 ? 0.8 : rangeRatio < 0.25 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 3: Pitch contour smoothness (intonation curve)
  // Real speech has gradual intonation curves; AI can have step-like changes
  const pitchDiffs: number[] = [];
  for (let i = 1; i < pitches.length; i++) {
    pitchDiffs.push(pitches[i] - pitches[i - 1]);
  }
  const pitchDiffMean = mean(pitchDiffs);
  const pitchDiffStd = stdDev(pitchDiffs, pitchDiffMean);
  // Count sudden jumps (> 3 standard deviations)
  let suddenJumps = 0;
  for (const d of pitchDiffs) {
    if (pitchDiffStd > 0 && Math.abs(d - pitchDiffMean) > 3 * pitchDiffStd) suddenJumps++;
  }
  const jumpRatio = suddenJumps / Math.max(pitchDiffs.length, 1);
  const smoothnessScore = clamp(jumpRatio > 0.05 ? 0.7 : jumpRatio > 0.02 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 4: Pitch stability (too stable = suspicious)
  const pitchCV = pitchMean > 0 ? stdDev(pitches, pitchMean) / pitchMean : 0;
  const stabilityScore = clamp(pitchCV < 0.05 ? 0.8 : pitchCV < 0.12 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 5: Vibrato (natural singers/speakers have slight vibrato)
  // Check for periodic pitch oscillation
  let vibratoFreq = 0;
  if (pitches.length > 20) {
    // Autocorrelate the pitch contour (detrended)
    const detrended = pitches.map((p) => p - pitchMean);
    let bestCorr = 0;
    let bestLag = 0;
    for (let lag = 5; lag < Math.min(30, pitches.length / 2); lag++) {
      let corr = 0;
      for (let i = 0; i < pitches.length - lag; i++) {
        corr += detrended[i] * detrended[i + lag];
      }
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    vibratoFreq = bestLag;
  }
  // Presence of vibrato-like oscillation is natural
  const vibratoScore = vibratoFreq > 0 ? 0.2 : 0.6; // no vibrato found = slightly suspicious

  return clamp(
    jitterScore * 0.3 +
    rangeScore * 0.2 +
    smoothnessScore * 0.2 +
    stabilityScore * 0.2 +
    vibratoScore * 0.1,
    0, 1
  );
}

// ============================================================
// ANALYZER 4: FORMANT ANALYSIS
// Formants are resonant frequencies of the vocal tract.
// AI speech synthesizers often produce unnatural formant patterns.
// ============================================================
function analyzeFormants(frames: AudioFrame[], audioBuffer: AudioBuffer): number {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const frameSize = 1024;
  const hopSize = 512;

  // Sub-metric 1: Formant frequency ratio consistency
  // F1/F2 ratio should vary naturally across different phonemes
  const formantRatios: number[] = [];
  const f1Values: number[] = [];
  const f2Values: number[] = [];

  for (let start = 0; start + frameSize <= channelData.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    let rms = 0;
    for (let i = 0; i < frameSize; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
      frame[i] = channelData[start + i] * w;
      rms += frame[i] * frame[i];
    }
    rms = Math.sqrt(rms / frameSize);
    if (rms < 0.005) continue;

    const magnitude = computeMagnitudeSpectrum(frame, frameSize);

    // Find first two formant peaks (rough estimate via peak picking)
    // F1: 300-1000 Hz, F2: 800-2500 Hz
    const f1Range = [Math.floor(300 * frameSize / sampleRate), Math.floor(1000 * frameSize / sampleRate)];
    const f2Range = [Math.floor(800 * frameSize / sampleRate), Math.floor(2500 * frameSize / sampleRate)];

    let f1Peak = 0, f1Max = 0;
    for (let k = f1Range[0]; k < f1Range[1] && k < magnitude.length; k++) {
      if (magnitude[k] > f1Max) { f1Max = magnitude[k]; f1Peak = k; }
    }
    let f2Peak = 0, f2Max = 0;
    for (let k = f2Range[0]; k < f2Range[1] && k < magnitude.length; k++) {
      if (magnitude[k] > f2Max) { f2Max = magnitude[k]; f2Peak = k; }
    }

    if (f1Peak > 0) {
      const f1Freq = (f1Peak * sampleRate) / frameSize;
      f1Values.push(f1Freq);
    }
    if (f2Peak > 0) {
      const f2Freq = (f2Peak * sampleRate) / frameSize;
      f2Values.push(f2Freq);
    }
    if (f1Peak > 0 && f2Peak > 0) {
      const f1Freq = (f1Peak * sampleRate) / frameSize;
      const f2Freq = (f2Peak * sampleRate) / frameSize;
      if (f1Freq > 0) formantRatios.push(f2Freq / f1Freq);
    }
  }

  if (formantRatios.length < 5) return 0.5;

  // Sub-metric 1: F2/F1 ratio variation
  const ratioMean = mean(formantRatios);
  const ratioCV = ratioMean > 0 ? stdDev(formantRatios, ratioMean) / ratioMean : 0;
  // Real speech has high F2/F1 variation (different vowels); AI is often too stable
  const ratioScore = clamp(ratioCV < 0.1 ? 0.85 : ratioCV < 0.25 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: F1 range
  const f1Min = Math.min(...f1Values);
  const f1Max = Math.max(...f1Values);
  const f1Range = f1Max - f1Min;
  const f1RangeScore = clamp(f1Range < 100 ? 0.8 : f1Range < 250 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 3: F2 range
  const f2Min = Math.min(...f2Values);
  const f2Max = Math.max(...f2Values);
  const f2Range = f2Max - f2Min;
  const f2RangeScore = clamp(f2Range < 300 ? 0.8 : f2Range < 700 ? 0.4 : 0.15, 0, 1);

  return clamp(
    ratioScore * 0.4 +
    f1RangeScore * 0.3 +
    f2RangeScore * 0.3,
    0, 1
  );
}

// ============================================================
// ANALYZER 5: NOISE FLOOR & RECORDING ARTIFACTS
// Real recordings have background noise, room acoustics,
// microphone characteristics. AI speech is often too clean.
// ============================================================
function analyzeNoiseFloor(frames: AudioFrame[], audioBuffer: AudioBuffer): number {
  // Sub-metric 1: Background noise level
  const channelData = audioBuffer.getChannelData(0);
  // Find quietest 10% of frames as noise estimate
  const rmsValues = frames.map((f) => f.rms).sort((a, b) => a - b);
  const noiseEstimate = mean(rmsValues.slice(0, Math.max(1, Math.floor(rmsValues.length * 0.1))));

  // Real recordings have a noise floor; AI is often dead silent between speech
  const noiseScore = clamp(noiseEstimate < 0.0005 ? 0.85 : noiseEstimate < 0.002 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: Spectral flatness of silent segments
  // Real background noise is broadband (high flatness); AI silence is often truly silent
  const silentFrames = frames.filter((f) => f.rms < 0.003);
  const silentFlatness = silentFrames.length > 0 ? mean(silentFrames.map((f) => f.spectralFlatness)) : 0;
  const silentFlatScore = clamp(
    silentFrames.length > 0 && silentFlatness < 0.1 ? 0.8 : silentFlatness < 0.3 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 3: Dynamic range
  const maxRms = Math.max(...frames.map((f) => f.rms));
  const minRms = Math.min(...frames.map((f) => f.rms));
  const dynamicRange = maxRms - minRms;
  const dynamicScore = clamp(dynamicRange < 0.05 ? 0.8 : dynamicRange < 0.15 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 4: DC offset / clipping
  let dcOffset = 0;
  const checkSamples = Math.min(channelData.length, 44100 * 2);
  for (let i = 0; i < checkSamples; i++) {
    dcOffset += channelData[i];
  }
  dcOffset /= checkSamples;
  // Real recordings have near-zero DC; AI can have slight DC bias
  const dcScore = clamp(Math.abs(dcOffset) > 0.01 ? 0.7 : Math.abs(dcOffset) > 0.005 ? 0.4 : 0.15, 0, 1);

  // Sub-metric 5: Clipping detection
  let clipCount = 0;
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) > 0.99) clipCount++;
  }
  const clipRatio = clipCount / channelData.length;
  // No clipping at all is slightly suspicious (real recordings often have minor clipping)
  const clipScore = clamp(clipRatio === 0 ? 0.6 : clipRatio < 0.001 ? 0.3 : 0.1, 0, 1);

  return clamp(
    noiseScore * 0.3 +
    silentFlatScore * 0.25 +
    dynamicScore * 0.2 +
    dcScore * 0.15 +
    clipScore * 0.1,
    0, 1
  );
}

// ============================================================
// ANALYZER 6: HARMONIC STRUCTURE
// Real voice has rich harmonic structure that varies naturally.
// AI speech harmonics can be too perfect or unnatural.
// ============================================================
function analyzeHarmonics(frames: AudioFrame[], audioBuffer: AudioBuffer): number {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const frameSize = 1024;
  const hopSize = 512;

  const h2h1Ratios: number[] = []; // 2nd harmonic / 1st harmonic
  const h3h2Ratios: number[] = [];

  for (let start = 0; start + frameSize <= channelData.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    let rms = 0;
    for (let i = 0; i < frameSize; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
      frame[i] = channelData[start + i] * w;
      rms += frame[i] * frame[i];
    }
    rms = Math.sqrt(rms / frameSize);
    if (rms < 0.01) continue;

    // Estimate fundamental
    const pitch = estimatePitch(frame, sampleRate);
    if (pitch < 80 || pitch > 400) continue;

    const magnitude = computeMagnitudeSpectrum(frame, frameSize);

    // Sample harmonics
    const h1Bin = Math.round((pitch * frameSize) / sampleRate);
    const h2Bin = Math.round((2 * pitch * frameSize) / sampleRate);
    const h3Bin = Math.round((3 * pitch * frameSize) / sampleRate);

    if (h1Bin < magnitude.length && h2Bin < magnitude.length) {
      const h1 = magnitude[h1Bin];
      const h2 = magnitude[h2Bin];
      if (h1 > 0) h2h1Ratios.push(h2 / h1);
    }
    if (h2Bin < magnitude.length && h3Bin < magnitude.length) {
      const h2 = magnitude[h2Bin];
      const h3 = magnitude[h3Bin];
      if (h2 > 0) h3h2Ratios.push(h3 / h2);
    }
  }

  if (h2h1Ratios.length < 5) return 0.5;

  // Sub-metric 1: H2/H1 ratio variation
  // Real voice varies this ratio significantly; AI is often too stable
  const h2h1Mean = mean(h2h1Ratios);
  const h2h1CV = h2h1Mean > 0 ? stdDev(h2h1Ratios, h2h1Mean) / h2h1Mean : 0;
  const h2h1Score = clamp(h2h1CV < 0.15 ? 0.85 : h2h1CV < 0.35 ? 0.45 : 0.15, 0, 1);

  // Sub-metric 2: Harmonic decay slope
  // Real voice: harmonics decay roughly exponentially
  // Check if H2/H1 and H3/H2 follow a consistent decay
  const h3h2Mean = h3h2Ratios.length > 0 ? mean(h3h2Ratios) : 0;
  const decayConsistency = h2h1Mean > 0 && h3h2Mean > 0
    ? Math.abs(h2h1Mean - h3h2Mean) / Math.max(h2h1Mean, h3h2Mean)
    : 1;
  // Too consistent decay = suspicious; too irregular = also suspicious
  const decayScore = clamp(
    decayConsistency < 0.1 ? 0.8 : decayConsistency < 0.3 ? 0.4 : 0.2, 0, 1);

  // Sub-metric 3: Inharmonicity (harmonics should be at exact integer multiples)
  // AI synthesizers can produce slightly inharmonic tones
  // We check if pitch estimate is stable across voiced frames
  const pitches = frames.filter((f) => f.pitch > 80 && f.pitch < 400).map((f) => f.pitch);
  const pitchStability = pitches.length > 0
    ? (mean(pitches) > 0 ? stdDev(pitches, mean(pitches)) / mean(pitches) : 0)
    : 0;
  const inharmonicityScore = clamp(pitchStability < 0.03 ? 0.8 : pitchStability < 0.08 ? 0.4 : 0.15, 0, 1);

  return clamp(
    h2h1Score * 0.4 +
    decayScore * 0.35 +
    inharmonicityScore * 0.25,
    0, 1
  );
}

// ============================================================
// MAIN AUDIO ANALYSIS
// ============================================================
export async function analyzeAudio(file: File): Promise<AudioAnalysisResult> {
  const audioBuffer = await extractAudioFromFile(file);

  if (!audioBuffer || audioBuffer.length < audioBuffer.sampleRate * 0.1) {
    // No audio or audio too short to analyze
    return {
      metrics: {
        spectralScore: 50,
        prosodyScore: 50,
        pitchScore: 50,
        formantScore: 50,
        noiseFloorScore: 50,
        harmonicScore: 50,
        overallScore: 50,
      },
      patterns: [],
      hasAudio: false,
    };
  }

  const sampleRate = audioBuffer.sampleRate;
  const frameSize = 1024;
  const hopSize = 512;
  const frames = extractFrames(audioBuffer, frameSize, hopSize);

  if (frames.length < 10) {
    return {
      metrics: {
        spectralScore: 50,
        prosodyScore: 50,
        pitchScore: 50,
        formantScore: 50,
        noiseFloorScore: 50,
        harmonicScore: 50,
        overallScore: 50,
      },
      patterns: [],
      hasAudio: false,
    };
  }

  const spectralScore = analyzeSpectralFeatures(frames);
  const prosodyScore = analyzeProsody(frames, sampleRate, hopSize);
  const pitchScore = analyzePitchContour(frames);
  const formantScore = analyzeFormants(frames, audioBuffer);
  const noiseFloorScore = analyzeNoiseFloor(frames, audioBuffer);
  const harmonicScore = analyzeHarmonics(frames, audioBuffer);

  // Weighted overall score
  const overall = clamp(
    spectralScore * 0.18 +
    prosodyScore * 0.22 +
    pitchScore * 0.2 +
    formantScore * 0.15 +
    noiseFloorScore * 0.13 +
    harmonicScore * 0.12,
    0, 1
  );

  const metrics: AudioMetrics = {
    spectralScore: Math.round(spectralScore * 100),
    prosodyScore: Math.round(prosodyScore * 100),
    pitchScore: Math.round(pitchScore * 100),
    formantScore: Math.round(formantScore * 100),
    noiseFloorScore: Math.round(noiseFloorScore * 100),
    harmonicScore: Math.round(harmonicScore * 100),
    overallScore: Math.round(overall * 100),
  };

  const patterns = buildAudioPatterns(metrics);
  return { metrics, patterns, hasAudio: true };
}

// ============================================================
// BUILD AUDIO PATTERNS
// ============================================================
function buildAudioPatterns(metrics: AudioMetrics): AudioPattern[] {
  const t = 55;
  const patterns: AudioPattern[] = [];

  // Spectral
  patterns.push({
    name: 'Voice Spectral Analysis',
    description:
      metrics.spectralScore > t
        ? `Spectral envelope shows unnatural stability (${metrics.spectralScore}%). Spectral centroid variation is too low, and voiced/unvoiced alternation lacks the natural transitions found in real speech.`
        : `Spectral envelope shows natural variation in centroid and flatness, with realistic voiced/unvoiced transitions consistent with genuine speech.`,
    confidence: metrics.spectralScore,
  });

  // Prosody
  patterns.push({
    name: 'Speech Rhythm & Prosody',
    description:
      metrics.prosodyScore > t
        ? `Prosodic analysis reveals unnatural speech rhythm (${metrics.prosodyScore}%). Voiced segment lengths are too uniform, pauses are infrequent or evenly spaced, and energy variation lacks the organic pacing of real speech.`
        : `Speech rhythm shows natural variation in segment lengths, organic pause patterns, and realistic energy fluctuation consistent with genuine human speech.`,
    confidence: metrics.prosodyScore,
  });

  // Pitch
  patterns.push({
    name: 'Pitch Contour Analysis',
    description:
      metrics.pitchScore > t
        ? `Pitch contour analysis (${metrics.pitchScore}%) reveals abnormally low jitter and micro-variations. Intonation curve is too smooth, lacking the natural pitch instability present in real vocal cords.`
        : `Pitch contour shows natural jitter, organic intonation curves, and appropriate micro-variations consistent with real vocal fold vibration.`,
    confidence: metrics.pitchScore,
  });

  // Formants
  patterns.push({
    name: 'Formant Frequency Analysis',
    description:
      metrics.formantScore > t
        ? `Formant analysis (${metrics.formantScore}%) shows insufficient F1/F2 variation across phonemes. Vocal tract resonance patterns are too consistent, unlike the natural formant shifts in real speech.`
        : `Formant frequencies show natural variation across phonemes with realistic F1/F2 ratio shifts, consistent with genuine vocal tract dynamics.`,
    confidence: metrics.formantScore,
  });

  // Noise floor
  patterns.push({
    name: 'Recording Environment Check',
    description:
      metrics.noiseFloorScore > t
        ? `Recording environment analysis (${metrics.noiseFloorScore}%) shows an unnaturally clean audio signal. Background noise floor is too low, dynamic range is narrow, and room acoustics are absent — typical of synthetic speech.`
        : `Audio shows natural background noise, realistic dynamic range, and room acoustic signatures consistent with genuine microphone recording.`,
    confidence: metrics.noiseFloorScore,
  });

  // Harmonics
  patterns.push({
    name: 'Harmonic Structure Analysis',
    description:
      metrics.harmonicScore > t
        ? `Harmonic analysis (${metrics.harmonicScore}%) reveals overly stable harmonic amplitude ratios. The decay pattern between harmonics is too consistent, unlike the natural variation in real vocal production.`
        : `Harmonic structure shows natural variation in amplitude ratios and decay patterns, consistent with genuine vocal fold vibration and resonance.`,
    confidence: metrics.harmonicScore,
  });

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
