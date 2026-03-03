import { createSchema } from 'graphql-yoga'
 
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String
      number: Int

    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world',
      number: () => 42,
    }
  }
})