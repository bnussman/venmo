import "dotenv/config";
import { request } from 'graphql-request';
import { v4 } from 'uuid';
import { DEVICE_ID, GRAPHQL_ENDPOINT, USER_AGENT } from './constants';
import { FundingInstrumentsGraphQLResponse, FundingInstrumentsQuery } from './graphql/funding';
import { PeopleQuery, Person } from './graphql/people';
import { payment } from './pay';
import {
  EligibilityOptions,
  EligibilityResponse,
  Identity,
  LoginResponse,
  VenmoCredentials,
  PaymentOptions,
  StoriesResponse,
  BrokenPaymentOptions,
  OldPaymentOptions
} from './types';

export class Venmo {
  private credentials: VenmoCredentials;
  public accessToken: string | undefined;
  public csrfToken: string | undefined;
  public csrfCookie: string | undefined;
  public w_fc: string;

  constructor(credentials: VenmoCredentials) {
    this.credentials = credentials;
    this.w_fc = v4();
  }

  /**
   * Login gets you a Venmo API autentication token, keeps it in
   * memory, and returns it. This function does more than just make
   * one call to the login endpoint. It has to make a few api calls
   * to get an authentication token.
   *
   * @returns {Promise<string>} venmo auth token
   */
  public async login(): Promise<string> {
    const loginResult = await fetch(
      "https://venmo.com/login", {
      headers: {
        'user-agent': USER_AGENT,
        'Cookie': `v_id=${DEVICE_ID}`,
        'Content-Type': 'application/json',
      },
      method: "POST",
      body: JSON.stringify({
        phoneEmailUsername: this.credentials.username,
        password: this.credentials.password,
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

    this.csrfCookie = csrfCookie;

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

    this.csrfToken = csrfToken;

    const mfaHeaders = {
      'user-agent': USER_AGENT,
      'Cookie': `v_id=${DEVICE_ID}; _csrf=${csrfCookie}; login_email=${this.credentials.username};`,
      "csrf-token": csrfToken,
      "xsrf-token": csrfToken,
      "venmo-otp-secret": otpSecret,
      'Content-Type': 'application/json',
    };

    const finalSignInResult = await fetch(
      "https://account.venmo.com/api/account/mfa/sign-in",
      {
        method: "POST",
        headers: mfaHeaders,
        body: JSON.stringify({
          accountNumber: this.credentials.bankAccountNumber,
          isGroup: false
        })
      }
    );

    if (![200, 201].includes(finalSignInResult.status)) {
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

    this.accessToken = accessToken;

    const deviceResponse = await fetch("https://account.venmo.com/api/device-data", {
      method: "POST",
      headers: {
        Cookie: `v_id=${DEVICE_ID}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken};`,
        "user-agent": USER_AGENT,
        "csrf-token": this.csrfToken,
        "xsrf-token": this.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correlationId: this.w_fc,
      }),
    });

    console.log("Device Data Cookie Response", deviceResponse.headers.get("set-cookie"))

    if (deviceResponse.status !== 200) {
      throw new Error(`Error while sending device data. Expected 200 but got ${deviceResponse.status}`);
    }

    return accessToken;
  }

  /**
   * Get all of the identities for a venmo account. This exists because
   * one Venmo account can have many identities. For example venmo accounts
   * can have a business venmo as one of the identities.
   * 
   * @returns {Promise<Identity[]>} account identities
   */
  public async getIdentities(): Promise<Identity[]> {
    if (!this.accessToken) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const result = await fetch(
      "https://account.venmo.com/api/user/identities",
      {
        headers: {
          Cookie: `v_id=${DEVICE_ID}; w_fc=${this.w_fc}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
        }
      },
    );

    const data = await result.json() as Identity[];

    return data;
  }

  /**
   * This is one way to get a list of venmo transactions
   *
   * @param feedType the type of stories you want to see
   * @param externalId the identity if that comes from `getIdentities`
   * @returns venmo transactions
   */
  public async getStories(feedType: 'me' | 'friend', externalId: string): Promise<StoriesResponse> {
    if (!this.accessToken) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const result = await fetch(
      `https://account.venmo.com/api/stories?feedType=${feedType}&externalId=${externalId}`,
      {
        headers: {
          Cookie: `v_id=${DEVICE_ID}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
        }
      },
    );

    const data = await result.json() as StoriesResponse;

    return data;
  }

  /**
   * This is needed to make a Venmo payment because you need the `eligibilityToken`
   * when you call the `pay` function. Venmo checks all of the csrf bullshit, so
   * that is all sent here.
   * 
   * @param eligibilityOptions just look at the typescript type to see what you need to pass
   * @returns {Promise<EligibilityResponse>} eligibility of possible payment
   */
  public async getEligibility(eligibilityOptions: EligibilityOptions): Promise<EligibilityResponse> {
    if (!this.accessToken || !this.csrfToken || !this.csrfCookie || !this.w_fc) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const result = await fetch(
      `https://account.venmo.com/api/eligibility`,
      {
        method: "POST",
        headers: {
          Cookie: `v_id=${DEVICE_ID}; w_fc=${this.w_fc}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
          "csrf-token": this.csrfToken,
          "xsrf-token": this.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eligibilityOptions),
        credentials: "include"
      },
    );

    const data = await result.json() as EligibilityResponse;

    return data;
  }

  /**
   * Use the function to see the payment methods on your account. You will need to
   * specify the `id` of one of these payment methods when you want to make a payment
   * with the `pay` function. This uses Venmo's GraphQL api so sorry if the Typescript
   * types are bad.
   * 
   * @returns {Promise<FundingInstrumentsGraphQLResponse>} 
   */
  public async getFundingInstruments(): Promise<FundingInstrumentsGraphQLResponse> {
    const data = await request(
      GRAPHQL_ENDPOINT,
      FundingInstrumentsQuery,
      {},
      {
        Authorization: `Bearer ${this.accessToken}`,
        "user-agent": USER_AGENT,
        "Venmo-Client-Id": "10",
        "Venmo-Device-Id": DEVICE_ID,
      }
    );

    return data as FundingInstrumentsGraphQLResponse;
  }

  /**
   * Wrapper over the Venmo GraphQL API to get the first user that comes up
   * in a search query. This function to useful to get the user id of a
   * venmo user from their venmo username so that you can later make
   * a payment to them with the `pay` function.
   * 
   * @param name search query (can be name or username)
   * @returns the first person that matches the search query
   */
  public async getPerson(name: string): Promise<Person | undefined> {
    const data = await request(
      GRAPHQL_ENDPOINT,
      PeopleQuery,
      { input: { name } },
      {
          Authorization: `Bearer ${this.accessToken}`,
          "user-agent": USER_AGENT,
      }
    )
  
    return data.search.people.edges[0]?.node;
  }

  /**
   * Used to initiate a payment or payment request.
   * 
   * @param paymentOptions just look at the typescript type
   * @returns the actual request because this endpoint returns an empty response?
   */
  public async brokenPay(paymentOptions: Omit<BrokenPaymentOptions, 'eligibilityToken'>) {
    if (!this.accessToken || !this.csrfToken || !this.csrfCookie || !this.w_fc) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    console.log("csrfToken First", this.csrfToken);

    const paymentPageResult = await fetch("https://account.venmo.com/pay", {
      credentials: 'include',
      headers: {
        cookie: `v_id=${DEVICE_ID}; api_access_token=${this.accessToken}; _csrf=${this.csrfCookie}; w_fc=${this.w_fc};`,
        "user-agent": USER_AGENT,
      },
    });

    console.log("Payment Page Status", paymentPageResult.status, paymentPageResult.statusText)

    const verifyBankText = await paymentPageResult.text();

    const csrfData = verifyBankText.match(/<script id="__NEXT_DATA__" type="application\/json">([^<>]+)<\/script>/)?.[1];

    if (!csrfData) {
      throw new Error("Unable to find next data that should contain our csrf token");
    }

    const parsedNextData = JSON.parse(csrfData);

    const csrfToken = parsedNextData?.["props"]?.["pageProps"]?.["csrfToken"] as string | undefined;

    if (!csrfToken) {
      throw new Error("Unable to find csrfToken within the nextjs data")
    }

    this.csrfToken = csrfToken;

    const eligibilityData: EligibilityOptions = {
      targetType: "user_id",
      targetId: paymentOptions.targetUserDetails.userId,
      amountInCents: paymentOptions.amountInCents,
      action: paymentOptions.type,
      note: paymentOptions.note,
    };

    const eligibilityResponse = await fetch(
      `https://account.venmo.com/api/eligibility`,
      {
        method: "POST",
        headers: {
          cookie: `v_id=${DEVICE_ID}; w_fc=${this.w_fc}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
          "csrf-token": this.csrfToken,
          "xsrf-token": this.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eligibilityData),
      },
    );

    const eligibility = await eligibilityResponse.json() as EligibilityResponse;
   
    const paymentData: BrokenPaymentOptions = {
      ...paymentOptions,
      eligibilityToken: eligibility.eligibilityToken,
    };

    const headers = {
      cookie: `v_id=${DEVICE_ID}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken}; w_fc=${this.w_fc};`,
      "user-agent": USER_AGENT,
      "csrf-token": this.csrfToken,
      "xsrf-token": this.csrfToken,
      'Content-Type': 'application/json',
    }

    console.log("POST /api/payments - Data", paymentData);
    console.log("POST /api/payments - Headers", headers);
    console.log("csrfToken Second", this.csrfToken);

    return await fetch("https://account.venmo.com/api/payments", {
      method: "POST",
      headers,
      body: JSON.stringify(paymentData)
    });
  }

  public async oldPay(paymentOptions: OldPaymentOptions) {
    if (!this.accessToken || !this.csrfToken || !this.csrfCookie || !this.w_fc) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const headers = {
      "user-agent": USER_AGENT,
      'Content-Type': 'application/json',
      "Authorization": `Bearer ${this.accessToken}`
    };

    return await fetch("https://api.venmo.com/v1/payments", {
      method: "POST",
      headers,
      credentials: 'include',
      body: JSON.stringify(paymentOptions)
    });
  }

  public async pay(options: PaymentOptions) {
    return await payment(options, this.credentials);
  }
}
