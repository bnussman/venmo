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