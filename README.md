# Venmo 💳
Venmo API for Typescript

**The people making desisons at Venmo are a bunch of *cowards*** because they do not provide a way for developers to easily automate payments and transations with Venmo 🤬. This package exists because Venmo chose to be anti-developer. This package is intended to be used in Node.js backends, but will run in the browser if you want to it. 

## Implimentation ⌨️

This project is a Typescript port of the implimentation in [venmo-auto-transfer](https://github.com/radian-software/venmo-auto-transfer).

> **Warning**: This package is working as of *January 22, 2023*. It may not work in the future.

## Install 📦

```sh
# with npm
npm install @banksnussman/venmo
# with yarn
yarn add @banksnussman/venmo
# with pnpm
pnpm add @banksnussman/venmo
# with bun
bun add @banksnussman/venmo
```

## Example Usage 💻

This exmaple below shows an end-to-end flow of how you to authenticate, view transactions, find a user, and pay that user.

```typescript
import { Venmo } from "@banksnussman/venmo";

const v = new Venmo({
  username: "your-username",
  password: "your-password",
  bankAccountNumber: "you-bank-account-number"
});

const token = await v.login();

const identities = await v.getIdentities();

const me = identities.find(i => i.identityType === 'personal');

if (!me) {
  throw new Error("Unable to find my identity");
}

const stories = await v.getStories('me', me.externalId);

const ian = await v.getPerson("ian-murphy-35");

if (!ian) {
  throw new Error("Unable to find Ian");
}

const eligelity = await v.getEligibility({
  targetType: "user_id",
  targetId: ian.id,
  amountInCents: 31,
  action: "pay",
  note: "Dinner"
});

const funding = await v.getFundingInstruments();

const debitCard = funding.profile.wallet.find(walletItem => walletItem.instrumentType === 'debitCard');

if (!debitCard) {
  throw new Error("Could not find debit card");
}

const paymentDetails = {
  targetUserDetails: { userId: ian.id },
  amountInCents: 31,
  audience: 'private',
  note: "Dinner",
  type: "pay",
  fundingSourceID: debitCard.id,
  eligibilityToken: eligelity.eligibilityToken
} as const;

const payment = await v.pay(paymentDetails);

console.log("Payment", paymentDetails, payment)
```