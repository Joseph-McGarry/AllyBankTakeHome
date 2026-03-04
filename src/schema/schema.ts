import { createSchema } from 'graphql-yoga'
 
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      nasaSearch(
        q: String!
        mediaType: String = "image"
        page: Int = 1 
        keywords: [String] 
        yearStart: String 
        yearEnd: String 
      ): [NasaSearchResult!]!
      
      mediaDetails(nasaId: ID!): MediaDetails!
    }

    type NasaSearchResult {
      nasaId: ID!
      title: String
      mediaType: String
      keywords: [String!]!
      yearStart: String
      yearEnd: String
      dateCreated: String
    }

    type MediaDetails {
      nasaId: ID!
      title: String
      description: String
      dateCreated: String
      center: String
      photographer: String
      keywords: [String!]!
      mediaUrls: [String!]!
      metadataUrl: String
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
              keywords: (d?.keywords ?? []).filter((k: any) => typeof k === 'string' && k.length > 0),
              yearStart: d?.year_start ?? null,
              yearEnd: d?.year_end ?? null,
              mediaType: d?.media_type ?? null,
              dateCreated: d?.date_created ?? null,
            }
          })
          .filter(Boolean)
      },


      // resolver for media detail aggregating using the /asset, /metadata and /search
      // endpoints to get all details and media URLs for a given NASA ID
      
      mediaDetails: async (_: unknown, args: { nasaId: string }) => {
        const metadataUrl = new URL('https://images-api.nasa.gov/metadata/' + args.nasaId)
        const assetUrl = new URL('https://images-api.nasa.gov/asset/' + args.nasaId)
        const searchUrl = new URL('https://images-api.nasa.gov/search')

        searchUrl.searchParams.set('q', args.nasaId)

        // fetch all endpoints in parallel
        const [metadataRes, assetRes, searchRes] = await Promise.all([
          fetch(metadataUrl.toString(), { headers: { accept: 'application/json' } }),
          fetch(assetUrl.toString(), { headers: { accept: 'application/json' } }),
          fetch(searchUrl.toString(), { headers: { accept: 'application/json' } })
        ])

        // asset is required
        if (!assetRes.ok) {
          throw new Error(`NASA /asset failed: ${assetRes.status} ${assetRes.statusText}`)
        }

        // search is required for the enriched fields
        if (!searchRes.ok) {
          throw new Error(`NASA /search failed: ${searchRes.status} ${searchRes.statusText}`)
        }

        const assetJson = await assetRes.json()
        const searchJson = await searchRes.json()

        // metadata is optional since it may not exist for all items
        const metadataJson = metadataRes.ok ? await metadataRes.json() : null

        // extract media URLs from the asset endpoint response
        const assetItems = assetJson?.collection?.items ?? []
        const mediaUrls = assetItems
          .map((i: any) => i?.href)
          .filter((href: any) => typeof href === 'string' && href.length > 0)

        // find the matching item from the search results using the NASA ID,
        // falling back to the first item if not found
        const searchItems = searchJson?.collection?.items ?? []
        const match =
          searchItems.find((it: any) => it?.data?.[0]?.nasa_id === args.nasaId) ?? searchItems[0]
        const d = match?.data?.[0] ?? null

        // try to find a metadata URL from the metadata endpoint response
        const metaUrl =
          metadataJson?.location ??
          metadataJson?.collection?.items?.[0]?.href ??
          metadataJson?.collection?.items?.[0]?.location ??
          null

        return {
          nasaId: args.nasaId,
          title: d?.title ?? null,
          description: d?.description ?? null,
          dateCreated: d?.date_created ?? null,
          center: d?.center ?? null,
          photographer: d?.photographer ?? null,
          keywords: (d?.keywords ?? []).filter((k: any) => typeof k === 'string' && k.length > 0),
          mediaUrls,
          metadataUrl: metaUrl,
        }
      },
    },
  },
})

