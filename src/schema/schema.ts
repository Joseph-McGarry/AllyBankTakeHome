import { createSchema } from 'graphql-yoga'
 
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      nasaSearch(q: String!, mediaType: String = "image", page: Int = 1): [NasaSearchResult!]!
      searchAsset(nasaId: ID!): NasaAssetResult
    }

    type NasaSearchResult {
      nasaId: ID!
      title: String
      description: String
      dateCreated: String
      center: String
      thumbnail: String
    }

    type NasaAssetResult {
      nasaId: ID!
      items: [NasaAssetItem!]!
    }
      
    type NasaAssetItem {
      href: String!
    }
  `,
  resolvers: {
    Query: {

      // resolver for searching NASA's media library using the /search endpoint
      nasaSearch: async (_: unknown, args: { q: string; mediaType?: string; page?: number }) => {
      const url = new URL('https://images-api.nasa.gov/search')
        url.searchParams.set('q', args.q)
        url.searchParams.set('media_type', args.mediaType ?? 'image')
        url.searchParams.set('page', String(args.page ?? 1))

        // calls the NASA API and transforms the results into our NasaSearchResult type 
        const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
        if (!res.ok) {
          throw new Error(`NASA /search failed: ${res.status} ${res.statusText}`)
        }

        const json = await res.json()

        const items = json?.collection?.items ?? []
        return items
          .map((item: any) => {
            const d = item?.data?.[0]
            const nasaId = d?.nasa_id
            if (!nasaId) return null

            const thumbnail =
              item?.links?.find((l: any) => l?.rel === 'preview')?.href ??
              item?.links?.[0]?.href ??
              null

            return {
              nasaId,
              title: d?.title ?? null,
              description: d?.description ?? null,
              dateCreated: d?.date_created ?? null,
              center: d?.center ?? null,
              thumbnail,
            }
          })
          .filter(Boolean)
      },

      // resolver for retrieving asset manifest for a given NASA ID using the /asset endpoint
      searchAsset: async (_: unknown, args: { nasaId: string }) => {
      const url = new URL('https://images-api.nasa.gov/asset/' + args.nasaId)

      const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
        if (!res.ok) {
          throw new Error(`NASA /asset failed: ${res.status} ${res.statusText}`)
        }

        const json = await res.json()
        const rawItems = json?.collection?.items ?? [];
        const items = rawItems.map((item: any) => ({
          href: item?.href ?? null
        }));
        return { nasaId: args.nasaId, items };
      },
    },
  },
})

