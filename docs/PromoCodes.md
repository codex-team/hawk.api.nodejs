# Promo code domain and factories

`context.factories` exposes:

- `promoCodesFactory.calculatePromoQuote(input: PromoCodeInput): Promise<PromoCodeQuote>`
- `promoCodesFactory.ensurePaymentAvailable(payment: PromoPayment): Promise<void>`
- `promoCodeRedemptionsFactory.redeem(payment: PromoPayment): Promise<void>`

Construct with `new PromoCodeRedemptionsFactory(db)` and
`new PromoCodesFactory(db, promoCodeRedemptionsFactory)`. Both use the accounts DB.
Types and pure `validatePromoPayment(payment)` / `ensurePromoCodeAvailable(...)`
are exported from `src/billing/promoCodes/redemptions.ts`.
`applyDiscount(discount, originalAmount)`, `ensureActivePromoCode(...)`,
`normalizePromoCode(...)`, `getMaxUses(...)`, `PromoCode`, and `PromoCodeDiscount`
are exported from `src/billing/promoCodes/index.ts`.

```ts
interface PromoCodeInput {
  promoCode: string;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  originalAmount: number;
}

interface PromoCodeQuote {
  promoCodeId: ObjectId;
  originalAmount: number;
  finalAmount: number;
}

interface PromoPayment {
  promoCodeId: string;
  originalAmount: number;
  finalAmount: number;
  userId: string;
  workspaceId: string;
  tariffPlanId: string;
  transactionId: string;
  paidAmount: number;
  currency: string;
}
```

Only call payment methods with authenticated provider callbacks and verified signed
identity / quote fields. Pure validation does not verify the checksum or authorize
the payer. It validates IDs, a nonempty transaction ID, RUB currency, valid price
bounds, and exact equality of `finalAmount` and `paidAmount`. It never recalculates
a discount. There is no promo attempt ID or coupling to a business-operation ID.

`ensurePaymentAvailable` reads the promo code once and checks its active flag,
plan restrictions, and successful usage. Call `redeem` only after success, not at
quote/check/failure time. It does not recheck current availability: a code may have
changed or another payment may have succeeded since the provider's check.
Duplicate usage is tolerated so the caller can still fulfill an actual successful
payment. Fulfillment and business-operation idempotency remain the caller's job.

The shared `/check` creates operations through `businessOperationsFactory.create`,
using a new operation ID for each provider transaction. A declined attempt can be
retried in the same widget without regenerating the checksum. `/pay` validates the
checked operation, records usage and reuses ordinary fulfillment, notifications
and receipts (with the actual promo amount). `/fail` does not consume the code.
A redemption storage failure returns HTTP 500 with `PayCodes.RETRY`; ordinary
payments retain the master's acknowledgment and subscription-cancellation behavior.
No lease or exactly-once guarantee for fulfillment side effects is introduced.

## Discount configuration and existing data

New documents use `discount: { type: 'percent' | 'fixed', value: number }`.
Percentages must be integers from 1 to 99; fractional percentages are rejected to
avoid percentage subtraction precision errors. Fixed discounts are positive finite
amounts in RUB. Both round the final price up to whole rubles, with a 1 RUB floor.

The existing `20261013000000-create-promo-code-collections.js` migration creates
indexes only. A minimal read fallback accepts legacy `discountPercent` when
`discount` is absent, without changing stored data. An explicitly present new
configuration takes precedence, even if invalid; it does not fall back silently.
Legacy fractional percentages must be corrected before making new quotes.

No migration is required for rollout with this fallback. To remove it later,
backfill legacy documents with `discount: { type: 'percent', value: discountPercent }`,
validate the values, then remove `discountPercent`. Existing successful redemptions
remain usable; historical `discountPercent` fields are ignored.

Checksums now contain `promo: { promoCodeId, originalAmount, finalAmount }`;
`composePayment.paymentAmount` remains unchanged for Garage. Existing master
purchase and card-link checksums remain compatible. Earlier feature-branch promo
checksums with top-level fields are not supported. If that build has already
processed payments on a deployed environment, coordinate in-flight and delayed
callbacks before replacing it; refresh open payment widgets. Stage verification
with real CloudPayments callbacks has not been performed.

## Unresolved product decision: usage limits

`maxUses` is a **soft limit** counting successful redemption records, not a
reservation. Concurrent payments can pass the check and then exceed it. Existing
unique indexes permit only one redemption per `(promoCodeId, userId)` and per
`(promoCodeId, workspaceId)`: parallel successful payments sharing either identity
retain one usage record, but both payments must still be fulfilled.

No atomic reservations or hard-cap semantics are introduced. A hard limit needs
an explicit product decision about in-flight payments and paid-but-over-limit
behavior before implementation. The focused tests document the current race.
