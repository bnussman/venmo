export interface Options {
  username: string;
  password: string;
  bankAccountNumber: string | number;
}

export interface VenmoError {
  code: number;
  links: null | string[];
  title: 'Error';
  message: string;
}

export interface Identity {
  username: string;
  pictureUrl: string;
  displayName: string;
  callToAction: unknown[];
  identityType: 'personal' | 'business';
  balance: number; // Should be divided by 100 to get actual USD value
  numberOfNotifications: number;
  externalId: string;
  initials: string;
  identitySubType?: 'registered_business' | string;
  profileBackgroundPictureUrl?: string;
}

export type LoginResponse = { error: VenmoError }

export interface StoriesResponse {
  nextId:  string;
  stories: Story[];
}

export interface Story {
  amount:             string;
  avatar:             string;
  initials:           string;
  audience:           Audience;
  date:               Date;
  id:                 string;
  note:               Note;
  type:               Type;
  attachments:        any[];
  title:              Title;
  mentions:           Mentions;
  externWalletStatus: null;
  paymentId:          string;
  likes:              Comments;
  comments:           Comments;
  subType:            StorySubType;
}

export enum Audience {
  Friends = "friends",
  Public = "public",
}

export interface Comments {
  count:                number;
  userCommentedOrLiked: boolean;
}

export interface Mentions {
  data:  any[];
  count: number;
}

export interface Note {
  type?:     string;
  date?:     string;
  name?:     string;
  lastFour?: string;
  content?:  string;
}

export enum StorySubType {
  None = "none",
  Standard = "standard",
}

export interface Title {
  titleType: TitleType;
  payload:   Payload;
  receiver:  Receiver;
  sender:    Receiver;
}

export interface Payload {
  action:  Action;
  subType: PayloadSubType;
}

export enum Action {
  Charge = "charge",
  Pay = "pay",
}

export enum PayloadSubType {
  P2P = "p2p",
}

export interface Receiver {
  id:          string;
  displayName: string;
  username:    string;
}

export enum TitleType {
  Story = "story",
}

export enum Type {
  Payment = "payment",
}

export interface EligibilityOptions {
  targetType: "user_id";
  targetId: string;
  amountInCents: number;
  action: "pay" | "request"
  note: string;
}

export interface Fee {
  productUri: string;
  appliedTo: string;
  feePercentage: number;
  baseFeeAmount: number;
  calculatedFeeAmountInCents: number;
  feeToken: string;
}

export interface EligibilityResponse {
  eligible: boolean;
  eligibilityToken: string;
  fees: Fee[];
}

export interface FundingInstrumentsGraphQLResponse {
  data: Data
}

export interface Data {
  profile: Profile
}

export interface Profile {
  identity: Identity
  wallet: Wallet[]
  __typename: string
}

export interface Identity {
  capabilities: string[]
  __typename: string
}

export interface Wallet {
  id: string // this id is what you pass as fundingSourceID to make a payment 
  assets?: Assets
  instrumentType: string
  name: string
  fees: any[]
  metadata: Metadata
  roles: Roles
  __typename: string
}

export interface Assets {
  logoThumbnail: string
  __typename: string
}

export interface Metadata {
  availableBalance?: AvailableBalance
  __typename: string
  bankName?: string
  isVerified?: boolean
  lastFourDigits?: string
  uniqueIdentifier?: string
  issuerName?: string
  networkName?: string
  isVenmoCard?: boolean
  expirationDate?: string
  expirationStatus?: string
  quasiCash?: boolean
}

export interface AvailableBalance {
  value: number
  transactionType: any
  displayString: string
  __typename: string
}

export interface Roles {
  merchantPayments: string
  peerPayments: string
  __typename: string
}

export interface PaymentOptions {
  targetUserDetails: TargetUserDetails; // we need to get user ids from the Suggest or People graphql call
  amountInCents: number;
  audience: 'public' | 'private';
  note: string;
  type: "pay" | "request";
  fundingSourceID: string; // comes from getUserFundingInstruments graphql call
  eligibilityToken: string; // comes from eligibility endpoint
}

export interface TargetUserDetails {
  userId: string
}