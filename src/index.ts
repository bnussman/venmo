import { v4 } from 'uuid';

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36"
const DEVICE_ID = `fp01-${v4()}`

interface VenmoError {
  code: number;
  links: null | string[];
  title: 'Error';
  message: string;
}

type LoginResponse = { error: VenmoError }

async function login(username: string, password: string, bankAccountNumber: string | number) {
  const loginResult = await fetch(
    "https://venmo.com/login", {
      headers: {
        'user-agent': USER_AGENT,
        'Cookie': `v_id=${DEVICE_ID}`,
        'Content-Type': 'application/json',
      },
      method: "POST",
      body: JSON.stringify({
        phoneEmailUsername: username,
        password,
        return_json: "true"
      }),
    }
  );

  if (loginResult.status !== 401) {
    throw new Error(`Recieved unexpected status code ${loginResult.status} on initial POST to login`);
  }
  
  const data = await loginResult.json() as LoginResponse;

  if (data.error.message !== "Additional authentication is required") {
    throw new Error(`Got unexpcted initial login error. Expcted mfa error.`)
  }

  const otpSecret = loginResult.headers.get("venmo-otp-secret");

  if (!otpSecret) {
    throw new Error("Unable to get opt secret from inital login headers");
  }

  const verifyBankResult = await fetch(
    `https://account.venmo.com/account/mfa/verify-bank?k=${otpSecret}`,
    {
      credentials: 'include',
      headers: {
        'user-agent': USER_AGENT,
        'Cookie': `v_id=${DEVICE_ID}`,
        'Content-Type': 'application/json',
      }, 
    }
  );
  
  const rawResponseCookies = verifyBankResult.headers.get('set-cookie');

  if (!rawResponseCookies) {
    throw new Error("Did not recieve neeeded cookies in the verify bank response.")
  }

  const csrfCookie = rawResponseCookies.split("_csrf=")?.[1]?.split(";")?.[0];

  if (!csrfCookie) {
    throw new Error("Unable to parse _csrf cookie");
  }

  const verifyBankText = await verifyBankResult.text();

  const csrfData = verifyBankText.match(/<script id="__NEXT_DATA__" type="application\/json">([^<>]+)<\/script>/)?.[1];

  if (!csrfData) {
    throw new Error("Unable to find next data that should contain our csrf token");
  }

  const parsedNextData = JSON.parse(csrfData);

  const csrfToken = parsedNextData?.["props"]?.["pageProps"]?.["csrfToken"] as string | undefined;

  if (!csrfToken) {
    throw new Error("Unable to find csrfToken within the nextjs data")
  }

  const finalSignInResult = await fetch(
    "https://account.venmo.com/api/account/mfa/sign-in",
    {
      method: "POST",
      headers: {
        'user-agent': USER_AGENT,
        'Cookie': `v_id=${DEVICE_ID}; _csrf=${csrfCookie};`,
        "csrf-token": csrfToken,
        "xsrf-token": csrfToken,
        "venmo-otp-secret": otpSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "accountNumber": String(bankAccountNumber),
      })
    }
  );

  if (![200, 201].includes(finalSignInResult.status))  {
    throw new Error(`MFA Login was unsuccessful. Expected 200 status code but got ${finalSignInResult.status}`);
  }

  const rawCookies = finalSignInResult.headers.get('set-cookie');

  if (!rawCookies) {
    throw new Error("Unable to read set-cookie from mfa login.");
  }

  const accessToken = rawCookies.split("api_access_token=")?.[1]?.split(";")?.[0];
  
  if (!accessToken) {
    throw new Error("Cookie api_access_token not found");
  }

  return accessToken;
}

async function run() {
  const token = await login("", "", "");

  console.log("Access Token", token)
}

run();