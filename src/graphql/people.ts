import { gql } from "graphql-request";

export interface Person {
  displayName: string;
  id: string;
  type: 'personal';
  avatar: { url: string };
  handle: string;
  firstName: string;
  lastName: string;
  isFriend: boolean;
}

export const PeopleQuery = gql`
  query People($input: SearchInput!) {
    search(input: $input) {
      people {
        edges {
          node {
            displayName
            id
            type
            avatar {
              url
            }
            handle
            firstName
            lastName
            isFriend
          }
        }
      }
    }
  }
`;
