# venmo
Venmo API for Typescript

## Implimentation

This project is a Typescript port of the implimentation in [venmo-auto-transfer](https://github.com/radian-software/venmo-auto-transfer)

## Example Usage
```typescript
import { Venmo } from "@banksnussman/venmo";

const v = new Venmo({
  username: "your-username",
  password: "your-password",
  bankAccountNumber: "you-bank-account-number"
});

const token = await login();

const identities = await getIdentities(token);

const me = identities.find(i => i.identityType === 'personal');

if (!me) {
  throw new Error("Unable to find my identity");
}

const stories = await getStories(token, 'me', me.externalId);

console.log("Access Token", token)
console.log("Identities", identities)
console.log("Stories", stories)
```