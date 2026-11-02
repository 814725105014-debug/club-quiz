/**
 * Geometric planning for certificate generation.
 *
 * The college's Slides template marks its signature area with three text tokens
 * ({{COORDINATOR_SIGNATURE}}, {{HOD_SIGNATURE}}, {{PRINCIPAL_SIGNATURE}}). The platform
 * must remove that **entire band** from each generated copy — tokens, the labels beside
 * them and the rules under them — without touching the certificate ID, the QR code or the
 * participant's name, which can sit close by.
 *
 * This module is deliberately pure and free of Google types so the geometry can be tested
 * without credentials. `google.ts` maps the Slides API response into these shapes.
 */

/** Elements that mark the signature area (removed in full). */
export const SIGNATURE_TOKENS = ['{{COORDINATOR_SIGNATURE}}', '{{HOD_SIGNATURE}}', '{{PRINCIPAL_SIGNATURE}}'];

/** Placeholders that must survive the sweep, whatever their position. */
export const PROTECTED_TOKENS = ['{{NAME}}', '{{COURSE_NAME}}', '{{ISSUE_DATE}}', '{{QR_CODE}}', '{{CERTIFICATE_ID}}'];

/** Vertical slack when deciding which neighbouring shapes belong to the signature band. */
export const SIGNATURE_BAND_PAD_EMU = 400_000;

export interface LayoutElement {
  objectId: string;
  /** Concatenated text runs of the shape ('' for pictures, lines, rules). */
  text: string;
  /** Top edge in EMU (Slides `transform.translateY`). */
  top: number;
  /** Height in EMU (Slides `size.height.magnitude`). */
  height: number;
  /** Horizontal placement, forwarded to the QR image so it lands exactly on the token. */
  left?: number;
  width?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface SlideLayout {
  objectId?: string;
  elements: LayoutElement[];
}

export interface SignaturePlan {
  /** Object ids to delete, in document order. Never contains the QR placeholder. */
  deleteIds: string[];
  /** How many signature tokens were found (0 means the template changed). */
  signatureCount: number;
  /** The computed band, or null when no tokens exist. */
  band: { top: number; bottom: number } | null;
  /** The QR placeholder to replace with an image, if the template has one. */
  qr: { slideId?: string; element: LayoutElement } | null;
  /** Human-readable notes for the job log (surfaced in the certificate error trail). */
  warnings: string[];
}

const bottom = (element: LayoutElement) => element.top + element.height;

function hasAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

/**
 * Works out which page elements belong to the signature block.
 *
 * Rules, in order:
 * 1. Any element containing a signature token is in.
 * 2. The band spans from the highest such element's top to the lowest such element's bottom.
 * 3. A neighbouring element joins the band only if it sits fully inside the band ± padding.
 * 4. Protected placeholders, and any other unresolved `{{TOKEN}}`, are never removed — a
 *    template edit must fail loudly in the log rather than silently delete a name.
 */
export function planSignatureRemoval(
  slides: SlideLayout[],
  options: { padEmu?: number } = {},
): SignaturePlan {
  const pad = options.padEmu ?? SIGNATURE_BAND_PAD_EMU;
  const warnings: string[] = [];

  const all = slides.flatMap((slide) => slide.elements);
  const signatureElements = all.filter((element) => hasAnyToken(element.text, SIGNATURE_TOKENS));
  const qrElement = all.find((element) => element.text.includes('{{QR_CODE}}'));
  const qrSlide = qrElement ? slides.find((slide) => slide.elements.includes(qrElement)) : undefined;

  const qr: SignaturePlan['qr'] = qrElement
    ? { slideId: qrSlide?.objectId, element: qrElement }
    : null;

  if (signatureElements.length === 0) {
    return {
      deleteIds: [],
      signatureCount: 0,
      band: null,
      qr,
      warnings: ['No signature placeholders found; the template may have changed shape.'],
    };
  }

  const band = {
    top: Math.min(...signatureElements.map((element) => element.top)),
    bottom: Math.max(...signatureElements.map((element) => bottom(element))),
  };

  const deleteIds: string[] = [];
  for (const element of all) {
    if (element === qrElement) continue;

    const isSignature = hasAnyToken(element.text, SIGNATURE_TOKENS);
    if (isSignature) {
      deleteIds.push(element.objectId);
      continue;
    }

    if (hasAnyToken(element.text, PROTECTED_TOKENS)) continue;
    // Any other unresolved placeholder is a template edit we should not swallow.
    if (element.text.includes('{{')) {
      warnings.push(`Left "${element.text.trim().slice(0, 60)}" in place: unresolved placeholder inside the band.`);
      continue;
    }

    const insideBand = element.top >= band.top - pad && bottom(element) <= band.bottom + pad;
    if (insideBand) deleteIds.push(element.objectId);
  }

  if (signatureElements.length < SIGNATURE_TOKENS.length) {
    warnings.push(
      `Found ${signatureElements.length} of ${SIGNATURE_TOKENS.length} signature placeholders; the others may already be gone.`,
    );
  }

  return { deleteIds, signatureCount: signatureElements.length, band, qr, warnings };
}
