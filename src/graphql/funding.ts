import { gql } from "graphql-request";

export interface FundingInstrumentsGraphQLResponse {
  profile: Profile
}

interface Profile {
  identity: Identity
  wallet: Wallet[]
  __typename: string
}

interface Identity {
  capabilities: string[]
  __typename: string
}

interface Wallet {
  id: string // this id is what you pass as fundingSourceID to make a payment 
  assets?: Assets
  instrumentType: 'balance' | 'debitCard' | 'bank' | 'creditCard';
  name: string
  fees: any[]
  metadata: Metadata
  roles: Roles
  __typename: string
}

interface Assets {
  logoThumbnail: string
  __typename: string
}

interface Metadata {
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

interface AvailableBalance {
  value: number
  transactionType: any
  displayString: string
  __typename: string
}

interface Roles {
  merchantPayments: string
  peerPayments: string
  __typename: string
}

export const FundingInstrumentsQuery = gql`
  query getUserFundingInstruments {
    profile {
      ... on Profile {
        identity {
          ... on Identity {
            capabilities
            __typename
          }
          __typename
        }
        wallet {
          id
          assets {
            logoThumbnail
            __typename
          }
          instrumentType
          name
          fees {
            feeType
            fixedAmount
            variablePercentage
            __typename
          }
          metadata {
            ...BalanceMetadata
            ... on BankFundingInstrumentMetadata {
              bankName
              isVerified
              lastFourDigits
              uniqueIdentifier
              __typename
            }
            ... on CardFundingInstrumentMetadata {
              issuerName
              lastFourDigits
              networkName
              isVenmoCard
              expirationDate
              expirationStatus
              quasiCash
              __typename
            }
            __typename
          }
          roles {
            merchantPayments
            peerPayments
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }

  fragment BalanceMetadata on BalanceFundingInstrumentMetadata {
    availableBalance {
      value
      transactionType
      displayString
      __typename
    }
    __typename
  }
`;