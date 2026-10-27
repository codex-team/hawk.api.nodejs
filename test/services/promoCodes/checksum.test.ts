import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import checksumService from '../../../src/utils/checksumService';

describe('Promo payment checksums', () => {
  const secret = 'promo-checksum-tests-only';
  const previousSecret = process.env.JWT_SECRET_BILLING_CHECKSUM;
  const purchase = {
    workspaceId: new ObjectId().toString(),
    userId: new ObjectId().toString(),
    tariffPlanId: new ObjectId().toString(),
    shouldSaveCard: false,
    nextPaymentDate: '2026-11-13T12:00:00.000Z',
  };
  const promoPurchase = {
    ...purchase,
    promo: {
      promoCodeId: new ObjectId().toString(),
      originalAmount: 100,
      finalAmount: 80,
    },
  };
  const cardLink = {
    workspaceId: purchase.workspaceId,
    userId: purchase.userId,
    isCardLinkOperation: true,
    nextPaymentDate: purchase.nextPaymentDate,
  };

  beforeAll(() => {
    process.env.JWT_SECRET_BILLING_CHECKSUM = secret;
  });

  afterAll(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET_BILLING_CHECKSUM;
    } else {
      process.env.JWT_SECRET_BILLING_CHECKSUM = previousSecret;
    }
  });

  test.each([purchase, promoPurchase, cardLink])('round-trips signed payment data without JWT metadata', async data => {
    const checksum = await checksumService.generateChecksum(data);
    const payload = jwt.verify(checksum, secret) as jwt.JwtPayload;

    expect(payload.exp! - payload.iat!).toBe(30 * 60);
    expect(checksumService.parseAndVerifyChecksum(checksum)).toEqual(data);
  });

  test('expired promo is rejected for /check by default and allowed only for completion', () => {
    const checksum = jwt.sign(promoPurchase, secret, { expiresIn: -1 });

    expect(() => checksumService.parseAndVerifyChecksum(checksum)).toThrow(jwt.TokenExpiredError);
    expect(() => checksumService.parseAndVerifyChecksum(checksum, false)).toThrow(jwt.TokenExpiredError);
    expect(checksumService.parseAndVerifyChecksum(checksum, true)).toEqual(promoPurchase);
  });

  test.each([purchase, cardLink, {
    ...purchase,
    promo: null,
  } ])('completion does not accept an expired non-promo checksum', data => {
    const checksum = jwt.sign(data, secret, { expiresIn: -1 });

    expect(() => checksumService.parseAndVerifyChecksum(checksum)).toThrow(jwt.TokenExpiredError);
    expect(() => checksumService.parseAndVerifyChecksum(checksum, true)).toThrow(jwt.TokenExpiredError);
  });

  test.each([false, true])('nested price tampering fails signature verification (completion: %s)', async completion => {
    const checksum = await checksumService.generateChecksum(promoPurchase);
    const [header, encoded, signature] = checksum.split('.');
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());

    payload.promo.finalAmount = 1;
    const tampered = [header, Buffer.from(JSON.stringify(payload)).toString('base64url'), signature].join('.');

    expect(() => checksumService.parseAndVerifyChecksum(tampered, completion)).toThrow('invalid signature');
  });

  test('completion still verifies the signature of an expired promo', () => {
    const checksum = jwt.sign(promoPurchase, 'wrong-secret', { expiresIn: -1 });

    expect(() => checksumService.parseAndVerifyChecksum(checksum, true)).toThrow('invalid signature');
  });

  test('legacy top-level promo fields are not returned as signed payment data', () => {
    const checksum = jwt.sign({
      ...purchase,
      promoPaymentId: new ObjectId().toString(),
      promoCodeId: new ObjectId().toString(),
      originalAmount: 100,
      paymentAmount: 80,
      discountPercent: 20,
    }, secret);

    expect(checksumService.parseAndVerifyChecksum(checksum)).toEqual(purchase);
  });
});
