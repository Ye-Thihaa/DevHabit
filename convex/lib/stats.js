// Statistics helpers shared by analytics.js and predictions.js.
//
// Everything here reports the sample size alongside the estimate, and tests of
// significance rather than just effect size. With 30–90 daily observations an
// r of 0.5 is easy to hit by chance, so a correlation without its n and p is
// not a finding.

// --- distributions -------------------------------------------------------

// Lanczos approximation, good to ~15 significant figures for x > 0.
function logGamma(x) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued-fraction expansion for the incomplete beta function
// (Numerical Recipes, betacf).
function betacf(a, b, x) {
  const MAX_ITER = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularised incomplete beta I_x(a, b).
function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// Two-tailed p-value for a Student-t statistic with df degrees of freedom.
export function tDistTwoTailedP(t, df) {
  if (!Number.isFinite(t) || df <= 0) return null;
  return incompleteBeta(df / 2, 0.5, df / (df + t * t));
}

// Critical t for a two-tailed test at the given alpha. Found by bisection on
// the p-value, which is monotonic in t — no closed form needed and the cost is
// ~60 evaluations.
export function tCritical(alpha, df) {
  if (df <= 0) return null;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tDistTwoTailedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- descriptive ---------------------------------------------------------

export function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Sample standard deviation (n-1). Returns null below 2 observations, where
// spread is undefined rather than zero.
export function stdDev(values) {
  const n = values.length;
  if (n < 2) return null;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

export function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function describe(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return { n: 0, mean: null, sd: null, min: null, q1: null, median: null, q3: null, max: null };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  return {
    n: clean.length,
    mean: mean(clean),
    sd: stdDev(clean),
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

// --- association ---------------------------------------------------------

// Pearson r with its sample size and two-tailed p-value.
//
// Pairs are dropped when either side is missing (pairwise-complete), so n here
// is the number of usable pairs, not the number of days in the range. Callers
// display that n — an r computed from 4 overlapping days should not look the
// same as one from 60.
export function pearson(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  const n = pairs.length;
  if (n < 3) return { r: null, n, p: null };

  const xv = pairs.map((pair) => pair[0]);
  const yv = pairs.map((pair) => pair[1]);
  const mx = mean(xv);
  const my = mean(yv);

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xv[i] - mx;
    const dy = yv[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  // Zero variance on either side — e.g. a field that never changed. The
  // correlation is undefined, not zero.
  if (sxx === 0 || syy === 0) return { r: null, n, p: null };

  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  const denom = Math.max(1 - r * r, 1e-15); // guard |r| == 1
  const t = r * Math.sqrt(df / denom);
  return { r, n, p: tDistTwoTailedP(t, df) };
}

// Ordinary least squares with inference on the slope.
//
// Returns the standard error and p-value for the slope, plus what is needed to
// build a prediction interval — a point estimate on its own invites reading far
// more precision into the result than the data supports.
export function linearRegression(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  const n = pairs.length;
  if (n < 3) return null;

  const xv = pairs.map((pair) => pair[0]);
  const yv = pairs.map((pair) => pair[1]);
  const mx = mean(xv);
  const my = mean(yv);

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xv[i] - mx;
    const dy = yv[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return null; // predictor never varied

  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  const sse = Math.max(syy - slope * sxy, 0);
  const df = n - 2;
  const residualSe = df > 0 ? Math.sqrt(sse / df) : null;
  const slopeSe = residualSe === null ? null : residualSe / Math.sqrt(sxx);
  const t = slopeSe && slopeSe > 0 ? slope / slopeSe : null;

  return {
    n,
    slope,
    intercept,
    rSquared: syy === 0 ? null : 1 - sse / syy,
    residualSe,
    slopeSe,
    slopeP: t === null ? null : tDistTwoTailedP(t, df),
    meanX: mx,
    sxx,
    df,
  };
}

// 95% prediction interval half-width for a new observation at x0.
export function predictionMargin(fit, x0) {
  if (!fit || fit.residualSe === null || fit.df <= 0) return null;
  const tc = tCritical(0.05, fit.df);
  if (tc === null) return null;
  return tc * fit.residualSe * Math.sqrt(1 + 1 / fit.n + (x0 - fit.meanX) ** 2 / fit.sxx);
}

// --- dates ---------------------------------------------------------------

export function shiftDateString(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDate) {
  const a = new Date(startDate + "T00:00:00Z").getTime();
  const b = new Date(endDate + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

// Every ISO date from start to end inclusive.
export function dateRange(startDate, endDate) {
  const out = [];
  const total = daysBetween(startDate, endDate);
  for (let i = 0; i <= total; i++) out.push(shiftDateString(startDate, i));
  return out;
}
