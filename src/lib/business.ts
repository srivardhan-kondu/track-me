/**
 * The legally operative details, in one place.
 *
 * Terms, Privacy, Refunds and Contact all read from here, so correcting the
 * business address is one edit rather than five. Razorpay's activation review
 * checks these pages for exactly this information — an incomplete address is a
 * common reason for a merchant account to be rejected.
 *
 * ⚠️ ADDRESS and JURISDICTION are placeholders. Fill them in before submitting
 * for activation.
 */
export const BUSINESS = {
  /** Product name, as it appears to users. */
  product: "Track Me",

  /** Legal name of the operator, matching the Razorpay merchant account. */
  legalName: "Kondu Srivardhan Rao",

  /** Sole proprietorship, private limited, etc. */
  entityType: "Sole Proprietorship",

  email: "srivardhan.kondu@gmail.com",
  phone: "+91 63027 71540",

  /** ⚠️ Replace with the registered business address. */
  address: [
    "[Street address]",
    "[City], [State] [PIN]",
    "India",
  ],

  /** ⚠️ The city whose courts have jurisdiction. */
  jurisdiction: "[City], India",

  /** Shown on every policy page. Update when the wording changes. */
  lastUpdated: "31 August 2026",

  /** Business hours for support enquiries. */
  supportHours: "Monday to Friday, 10:00–18:00 IST",

  /** How quickly you commit to answering. Keep this one honest. */
  responseTime: "two working days",
} as const;

/** True while the placeholders above have not been filled in. */
export const businessDetailsIncomplete =
  BUSINESS.address.some((line) => line.includes("[")) ||
  BUSINESS.jurisdiction.includes("[");
