/**
 * Geometry tests for certificate signature-block removal.
 *
 * These run against the real template's layout, as read from the Slides API:
 * a single slide `g3f943d42bc4_0_2` where the three signature tokens sit near the bottom
 * (`g3f57cdc292b_0_6/_0_7/_0_8`) alongside a footer holding the certificate ID.
 *
 * The point is to prove the sweep removes the whole band and nothing else — a mistake here
 * only shows up as a wrong PDF after a real certificate is issued.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planSignatureRemoval,
  SIGNATURE_BAND_PAD_EMU,
  type LayoutElement,
  type SlideLayout,
} from '../src/services/certificateLayout.js';

const EMU = 914_400; // 1 inch

function el(objectId: string, text: string, topInches: number, heightInches = 0.4): LayoutElement {
  return {
    objectId,
    text,
    top: Math.round(topInches * EMU),
    height: Math.round(heightInches * EMU),
    left: 0,
    width: Math.round(2 * EMU),
    scaleX: 1,
    scaleY: 1,
  };
}

/** Mirrors the live template: tokens at ~4.6", labels above, footer with the ID at ~6.3". */
function template(): SlideLayout[] {
  return [
    {
      objectId: 'g3f943d42bc4_0_2',
      elements: [
        el('g3f943d42bc4_0_12', '{{NAME}}', 2.2),
        el('g3f943d42bc4_0_14', '{{COURSE_NAME}}', 3.0),
        el('g3f943d42bc4_0_20', '{{ISSUE_DATE}}', 3.6),
        el('label_coordinator', 'Course Coordinator', 4.2, 0.3),
        el('g3f57cdc292b_0_6', '{{COORDINATOR_SIGNATURE}}', 4.6),
        el('g3f57cdc292b_0_7', '{{HOD_SIGNATURE}}', 4.6),
        el('g3f57cdc292b_0_8', '{{PRINCIPAL_SIGNATURE}}', 4.6),
        el('rule_under_signatures', '', 5.0, 0.05),
        el('footer_id', '{{CERTIFICATE_ID}}', 6.3),
        el('g3f943d42bc4_0_24', '{{QR_CODE}}', 5.6, 1.1),
      ],
    },
  ];
}

test('the signature band is removed, protected placeholders survive', () => {
  const plan = planSignatureRemoval(template());

  assert.equal(plan.signatureCount, 3);
  assert.ok(plan.band, 'band should be computed');
  assert.deepEqual(plan.deleteIds.sort(), [
    'g3f57cdc292b_0_6',
    'g3f57cdc292b_0_7',
    'g3f57cdc292b_0_8',
    'label_coordinator',
    'rule_under_signatures',
  ]);
  // Nothing protected may be deleted: name, course, date, QR, certificate ID.
  for (const protectedId of [
    'g3f943d42bc4_0_12',
    'g3f943d42bc4_0_14',
    'g3f943d42bc4_0_20',
    'g3f943d42bc4_0_24',
    'footer_id',
  ]) {
    assert.equal(plan.deleteIds.includes(protectedId), false, `${protectedId} must survive`);
  }
});

test('the QR placeholder is reported for replacement and never deleted', () => {
  const plan = planSignatureRemoval(template());
  assert.ok(plan.qr, 'QR target should be found');
  assert.equal(plan.qr?.element.objectId, 'g3f943d42bc4_0_24');
  assert.equal(plan.qr?.slideId, 'g3f943d42bc4_0_2');
  assert.equal(plan.deleteIds.includes('g3f943d42bc4_0_24'), false);
});

test('a footer placed inside the padded band is still removed, but a distant one is not', () => {
  // Band is 4.6"-5.0"; padding reaches 5.4374". 5.0"+0.3" bottoms out at 5.3" — inside.
  const nearFooter = el('footer_near', '', 5.0, 0.3);
  const farFooter = el('footer_far', '', 8.0, 0.3); // far below
  const slides: SlideLayout[] = [{ objectId: 's1', elements: [...template()[0].elements, nearFooter, farFooter] }];

  const plan = planSignatureRemoval(slides);
  assert.equal(plan.deleteIds.includes('footer_near'), true);
  assert.equal(plan.deleteIds.includes('footer_far'), false);
});

test('padding is configurable so a tighter template can opt out of the sweep', () => {
  const slides: SlideLayout[] = [
    {
      objectId: 's1',
      elements: [
        el('tok', '{{HOD_SIGNATURE}}', 4.6),
        // 0.3" above the token: inside the default pad (reaches 4.1626"), outside zero pad.
        el('label', 'Head of the Department', 4.3, 0.2),
      ],
    },
  ];
  assert.equal(planSignatureRemoval(slides).deleteIds.includes('label'), true, 'default pad includes it');
  assert.equal(
    planSignatureRemoval(slides, { padEmu: 0 }).deleteIds.includes('label'),
    false,
    'no padding excludes it',
  );
  assert.equal(SIGNATURE_BAND_PAD_EMU, 400_000);
});

test('an unresolved placeholder inside the band is reported, not deleted', () => {
  const slides: SlideLayout[] = [
    {
      objectId: 's1',
      elements: [
        el('tok', '{{COORDINATOR_SIGNATURE}}', 4.6),
        el('stray', '{{SOMETHING_NEW}}', 4.7, 0.3),
      ],
    },
  ];
  const plan = planSignatureRemoval(slides);
  assert.equal(plan.deleteIds.includes('stray'), false);
  assert.ok(plan.warnings.some((w) => w.includes('{{SOMETHING_NEW}}')));
});

test('a template with no signature tokens yields an empty plan and a warning', () => {
  const slides: SlideLayout[] = [
    { objectId: 's1', elements: [el('name', '{{NAME}}', 2.2), el('qr', '{{QR_CODE}}', 5.6, 1.1)] },
  ];
  const plan = planSignatureRemoval(slides);
  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.signatureCount, 0);
  assert.equal(plan.band, null);
  assert.ok(plan.warnings.length > 0);
  // The QR target is still resolved so certificates can still carry a verification code.
  assert.equal(plan.qr?.element.objectId, 'qr');
});

test('a partially retemplated certificate warns about the missing tokens', () => {
  const slides: SlideLayout[] = [
    {
      objectId: 's1',
      elements: [
        el('only_one', '{{HOD_SIGNATURE}}', 4.6),
        el('name', '{{NAME}}', 2.2),
      ],
    },
  ];
  const plan = planSignatureRemoval(slides);
  assert.equal(plan.signatureCount, 1);
  assert.ok(plan.warnings.some((w) => w.includes('1 of 3')));
});

test('tokens spread across two slides produce one band spanning both', () => {
  const slides: SlideLayout[] = [
    { objectId: 's1', elements: [el('a', '{{COORDINATOR_SIGNATURE}}', 6.0)] },
    { objectId: 's2', elements: [el('b', '{{PRINCIPAL_SIGNATURE}}', 1.0), el('m', '', 3.0, 0.2)] },
  ];
  const plan = planSignatureRemoval(slides);
  assert.equal(plan.signatureCount, 2);
  assert.equal(plan.band?.top, Math.round(1.0 * EMU));
  // A shape sitting between the two far-apart tokens falls in the band.
  assert.equal(plan.deleteIds.includes('m'), true);
});
