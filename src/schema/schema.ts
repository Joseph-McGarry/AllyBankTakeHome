import { createSchema } from 'graphql-yoga'
 
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      nasaSearch(q: String!, mediaType: String = "image", page: Int = 1, keywords: [String], yearStart: String, yearEnd: String, dateCreated: String): [NasaSearchResult!]!
      searchAsset(nasaId: ID!): NasaAssetResult
    }

    type NasaSearchResult {
      nasaId: ID!
      title: String
      mediaType: String
      keywords: [String]
      yearStart: String
      yearEnd: String
      dateCreated: String
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

      // resolver for searching NASA's media library using the /search endpoint with
      // support for pagination, media type, keywords, and year range filters
      nasaSearch: async (
        _: unknown, args: {
          q: string;
          mediaType?: string;
          page?:number;
          keywords?: string[];
          yearStart?: string;
          yearEnd?: string;
        }
      ) => {
      
      const url = new URL('https://images-api.nasa.gov/search')
      
        url.searchParams.set('q', args.q)
        url.searchParams.set('media_type', args.mediaType ?? 'image')
        url.searchParams.set('page', String(args.page ?? 1))

        // sanitize and add keywords filter if provided
        const keywords = (args.keywords ?? []).map(k => k.trim()).filter(Boolean)
        if (keywords.length > 0) {
          url.searchParams.set('keywords', keywords.join(','))
        }

        // sanitize and add year range filters if provided, only allowing 4-digit years
        const ys = args.yearStart?.trim()
        if (ys && /^\d{4}$/.test(ys)) {
          url.searchParams.set('year_start', ys)
        }
        // sanitize and add year end filter if provided, only allowing 4-digit years
        const ye = args.yearEnd?.trim()
        if (ye && /^\d{4}$/.test(ye)) {
          url.searchParams.set('year_end', ye)
        }

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

            return {
              nasaId,
              title: d?.title ?? null,
              keywords: d?.keywords ?? [],
              yearStart: d?.year_start ?? null,
              yearEnd: d?.year_end ?? null,
              mediaType: d?.media_type ?? null,
              dateCreated: d?.date_created ?? null,
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

