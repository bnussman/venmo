import { v4 } from 'uuid';

export const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36"

export const DEVICE_ID = `fp01-${v4()}`

export const GRAPHQL_ENDPOINT = "https://api.venmo.com/graphql";