# Venmo 💳

![npm](https://img.shields.io/npm/dt/@banksnussman/venmo)
![npm](https://img.shields.io/npm/v/@banksnussman/venmo)

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

const funding = await v.getFundingInstruments();

const debitCard = funding.profile.wallet.find(walletItem => walletItem.instrumentType === 'debitCard');

if (!debitCard) {
  throw new Error("Could not find debit card");
}

const balance = v.pay({
  username: "ian-murphy-35",
  amount: 0.01,
  note: "if venmo is going to be lame, we can just use playwright",
});

console.log("New Balance", balance);

/*
This does not work :(
Somone please help
const payment = await v.brokenPay({
  targetUserDetails: { userId: ian.id },
  amountInCents: 1,
  audience: 'private',
  note: "venmo sucks for making this so hard",
  type: "pay",
  fundingSourceID: debitCard.id,
});

console.log("Payment", payment)
*/
```