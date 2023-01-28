import { webkit } from 'playwright';
import { VenmoCredentials, PaymentOptions } from './types';

export async function payment(options: PaymentOptions, credentials: VenmoCredentials) {
  const browser = await webkit.launch();
  const page = await browser.newPage();

  await page.goto('https://account.venmo.com/');
  await page.waitForLoadState("networkidle");
  const pageTitle = await page.title();

  if (pageTitle.includes("Sign in")) {
    const isUsernameRemebered = await page.isVisible(`text='${credentials.username}'`);
    if (!isUsernameRemebered) {
      await page.getByLabel('Enter email, mobile, or username').click();
      await page.getByLabel('Enter email, mobile, or username').fill(credentials.username);
      await page.getByLabel('Enter email, mobile, or username').press('Enter');
    }
    await page.getByLabel('Password', { exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await page.getByRole('link', { name: 'Confirm another way' }).click();
    await page.getByLabel('Bank account number').click();
    await page.getByLabel('Bank account number').fill(credentials.bankAccountNumber);
    await page.getByRole('button', { name: 'Confirm it' }).click();
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.context().storageState({ path: 'storage.json' });
  }

  await page.getByRole('link', { name: 'Pay or Request' }).click();
  await page.getByPlaceholder('0').click();
  await page.getByPlaceholder('0').fill(String(options.amount));
  await page.getByPlaceholder('Name, @username, phone, or email').click();
  await page.getByPlaceholder('Name, @username, phone, or email').fill(options.username);
  await page.waitForResponse(resp => resp.url().includes('/graphql')),
  await page.getByRole('option').first().click();
  await page.getByTestId('payment-note-input').click();
  await page.getByTestId('payment-note-input').fill(options.note);
  await page.getByRole('button', { name: 'Pay' }).click();


  const balanceData: string = await page.getByTestId('money').innerText();
  const balance = Number(balanceData.split("$")[1]);
  console.log("Your Balance", balance)

  await page.getByRole('button', { name: 'Pay' }).click();
  await page.context().storageState({ path: 'storage.json' });
  await browser.close();

  return balance - options.amount;
}

