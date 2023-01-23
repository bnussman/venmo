import request, { gql } from 'graphql-request';
import { DEVICE_ID, GRAPHQL_ENDPOINT, USER_AGENT } from './constants';
import { FundingInstrumentsGraphQLResponse, FundingInstrumentsQuery } from './graphql/funding';
import { PeopleQuery, Person } from './graphql/people';
import { EligibilityOptions, EligibilityResponse, Identity, LoginResponse, Options, PaymentOptions, StoriesResponse } from './types';

export class Venmo {
  private options: Options;
  public accessToken: string | undefined;
  public csrfToken: string | undefined;
  public csrfCookie: string | undefined;

  constructor(options: Options) {
    this.options = options;
  }

  public async login() {
    const loginResult = await fetch(
      "https://venmo.com/login", {
      headers: {
        'user-agent': USER_AGENT,
        'Cookie': `v_id=${DEVICE_ID}`,
        'Content-Type': 'application/json',
      },
      method: "POST",
      body: JSON.stringify({
        phoneEmailUsername: this.options.username,
        password: this.options.password,
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
          "accountNumber": String(this.options.bankAccountNumber),
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

    return accessToken;
  }

  public async getIdentities(): Promise<Identity[]> {
    if (!this.accessToken) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const result = await fetch(
      "https://account.venmo.com/api/user/identities",
      {
        headers: {
          Cookie: `v_id=${DEVICE_ID}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
        }
      },
    );

    const data = await result.json() as Identity[];

    return data;
  }

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

  public async getEligibility(eligibilityOptions: EligibilityOptions): Promise<EligibilityResponse> {
    if (!this.accessToken || !this.csrfToken || !this.csrfCookie) {
      throw new Error("You are not authenticated. Maybe run login first.");
    }

    const result = await fetch(
      `https://account.venmo.com/api/eligibility`,
      {
        method: "POST",
        headers: {
          Cookie: `v_id=${DEVICE_ID}; _csrf=${this.csrfCookie}; api_access_token=${this.accessToken};`,
          "user-agent": USER_AGENT,
          "csrf-token": this.csrfToken,
          "xsrf-token": this.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eligibilityOptions) 
      },
    );

    const data = await result.json() as EligibilityResponse;

    return data;
  }

  public async getFundingInstruments(): Promise<FundingInstrumentsGraphQLResponse> {
    const data = await request(
      GRAPHQL_ENDPOINT,
      FundingInstrumentsQuery,
      {},
      {
        Authorization: `Bearer ${this.accessToken}`,
        "user-agent": USER_AGENT,
      }
    );

    return data as FundingInstrumentsGraphQLResponse;
  }

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

  public async pay(paymentOptions: PaymentOptions) {
    const result = await fetch("https://account.venmo.com/api/payments", {
      method: "POST",
      headers: {
        Cookie: `v_id=${DEVICE_ID}; api_access_token=${this.accessToken};`,
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify(paymentOptions)
    });

    return true;
  }
}
