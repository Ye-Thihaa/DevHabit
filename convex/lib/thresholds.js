// Minimum sample sizes below which the app refuses to report an estimate.
//
// These are judgement calls, not laws — but they are enforced in one place so
// that every card in the UI applies the same standard, and so the numbers can
// be quoted in the write-up.

// Pearson r from fewer pairs than this is dominated by noise. At n = 8 an r of
// roughly 0.71 is needed to reach p < 0.05, which is a reasonable floor.
export const MIN_PAIRS_FOR_CORRELATION = 8;

// Regression additionally has to estimate a residual spread, so it needs more.
export const MIN_SAMPLE_FOR_REGRESSION = 10;

// Two-tailed significance level used throughout.
export const ALPHA = 0.05;

// Burnout risk compares a recent window to the window before it. Below this
// many logged days *in the recent window*, the trend is mostly noise — e.g.
// two bad nights out of three days would swing the score wildly.
export const MIN_DAYS_FOR_BURNOUT = 5;
