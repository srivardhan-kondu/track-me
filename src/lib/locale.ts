/**
 * The one locale every date and number in the app is formatted in.
 *
 * Passing `undefined` instead lets each runtime pick its own: the server's
 * (wherever it is deployed) renders "25 Nov", a US browser re-renders
 * "Nov 25", React reports a hydration mismatch and the text visibly flips
 * as the page loads. Pinning it makes the server and every browser agree.
 *
 * Money is the exception: rupee amounts keep "en-IN" grouping (1,00,000),
 * which is how the currency is written.
 */
export const LOCALE = "en-US";
