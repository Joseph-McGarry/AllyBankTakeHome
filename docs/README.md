## Setup Instructions

1. Install dependencies
```bash 
npm install
```
2. Start the dev server 
```bash
npm run dev`
```
3. Open GraphiQL
- Navigate to: `http://localhost:4000/graphql`
4. View available queries
    - Click the filing cabinet icon (top-left).
    - Under 'Root Types', click 'query: Query'
    - You should see:
        1. nasaSearch
        2. mediaDetails
5. Run a query
- Paste a query into the left panel.
- Click the Play button (top-right).
- Results will appear in the right panel.
  - If you don’t see results, drag the center divider to resize the output panel.

NOTES
 - The server is started via nodemon --exec ts-node src/server.ts (see package.json → scripts.dev).
 - see 'docs/images/' for reference photos.

## API Endpoints

### 1. nasaSearch = 'https://images-api.nasa.gov/search'

**URL:** /graphql

**Method:** POST

**Description:** Searches NASA’s Image & Video Library and returns a normalized list of results. Supports pagination (page), media type filtering (mediaType), optional keyword filtering (keywords), and optional year range filtering (yearStart, yearEnd). Internally wraps NASA’s /search endpoint.

**Example Requests:**

- Variables: 
    1. "q" can be a nasaID, planet, star, space shuttle, etc. It will default to 'image'
    2. "mediaType" can be 'image' or 'audio'
```json 
{ "q": "mars", "mediaType": "image", "page": 1,"keywords": ["rover", "dust"],"yearStart": "2003", "yearEnd": "2006"
}
```

In the terminal:
``` bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -d '{
    "query": "query ($q: String!, $page: Int, $mediaType: String, $keywords: [String], $yearStart: String, $yearEnd: String) { nasaSearch(q: $q, page: $page, mediaType: $mediaType, keywords: $keywords, yearStart: $yearStart, yearEnd: $yearEnd) { nasaId title mediaType keywords yearStart yearEnd dateCreated } }",
    "variables": {
      "q": "mars",
      "page": 1,
      "mediaType": "image",
      "keywords": ["rover", "dust"],
      "yearStart": "2003",
      "yearEnd": "2006"
    }
  }'

```

In Yoga GraphiQL:

``` GraphQL
query {
  nasaSearch(q: "mars", mediaType: "image", page: 1) {
    nasaId
    title
    mediaType
    keywords
    yearStart
    yearEnd
    dateCreated
  }
}
```

Example Response:

``` json
{
  "data": {
    "nasaSearch": [
      {
        "nasaId": "PIA04591",
        "title": "Mars Rover Tests",
        "mediaType": "image",
        "keywords": ["mars", "rover", "jpl"],
        "yearStart": null,
        "yearEnd": null,
        "dateCreated": "2003-06-12T00:00:00Z"
      },
      {
        "nasaId": "PIA06074",
        "title": "Mars Dust Storm",
        "mediaType": "image",
        "keywords": ["mars", "dust", "atmosphere"],
        "yearStart": null,
        "yearEnd": null,
        "dateCreated": "2005-05-14T00:00:00Z"
      }
    ]
  }
}
```

2. mediaDetails = 'https://images-api.nasa.gov/metadata/', 'https://images-api.nasa.gov/asset/', 'https://images-api.nasa.gov/search'

**URL:** /graphql

**Method:** POST

**Description:** Returns a single enriched media object for a given nasaId. Internally aggregates NASA’s /asset/{nasa_id} (media file URLs) and /metadata/{nasa_id} (metadata link when available), and uses /search?q={nasa_id} to reliably populate human-readable fields such as title, description, date created, center, photographer, and related keywords.

**Example Requests:**

- Variable: 
    1. "nasaId" must be a valid NASA ID returned from nasaSearch (example: "PIA12235")

```json
{
  "nasaId": "PIA12235"
}
```

In the terminal:

```bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -d '{
    "query": "query ($nasaId: ID!) { mediaDetails(nasaId: $nasaId) { nasaId title description dateCreated center photographer keywords mediaUrls metadataUrl } }",
    "variables": {
      "nasaId": "PIA12235"
    }
  }'
```

In Yoga GraphiQL:

```GraphQL
query {
  mediaDetails(nasaId: "PIA12235") {
    nasaId
    title
    description
    dateCreated
    center
    photographer
    keywords
    mediaUrls
    metadataUrl
  }
}
```

Example Response:

```json
{
  "data": {
    "mediaDetails": {
      "nasaId": "PIA12235",
      "title": "Nearside of the Moon",
      "description": "Nearside of the Moon",
      "dateCreated": "2009-09-24T18:00:22Z",
      "center": "JPL",
      "photographer": null,
      "keywords": [
        "Moon",
        "Chandrayaan-1"
      ],
      "mediaUrls": [
        "http://images-assets.nasa.gov/image/PIA12235/PIA12235~orig.jpg",
        "http://images-assets.nasa.gov/image/PIA12235/PIA12235~medium.jpg",
        "http://images-assets.nasa.gov/image/PIA12235/PIA12235~small.jpg",
        "http://images-assets.nasa.gov/image/PIA12235/PIA12235~thumb.jpg",
        "http://images-assets.nasa.gov/image/PIA12235/metadata.json"
      ],
      "metadataUrl": "https://images-assets.nasa.gov/image/PIA12235/metadata.json"
    }
  }
}
```

## Design Decisions

### Why

I used GraphQL Yoga because it’s a lightweight way to stand up a GraphQL server quickly while still keeping the code easy to read and extend. Yoga also provides GraphiQL out of the box, which made it easy to test the API interactively and document example queries for reviewers. For a take-home, it let me focus on API design and data shaping rather than framework boilerplate.

### Structure

 - 'src/server.ts': boots the HTTP server and mounts the Yoga GraphQL endpoint (/graphql).
- 'src/schema/schema.ts': contains the GraphQL schema typeDefs and resolvers.
- 'docs/': contains documentation assets for ease of use

I kept the project small and centralized since there are only two public queries. If this grew, I would split schema and resolvers by domain (search, media details, analytics) and compose them in a single schema entrypoint.

### Performance or scaling considerations

- Parallel external calls: mediaDetails calls NASA endpoints using Promise.all so the combined response is not slowed down by sequential network requests.
- Input sanitization: query arguments like keywords, yearStart, and yearEnd are sanitized before being sent to NASA to avoid invalid requests and unnecessary retries.
- Normalized responses: the API returns a simplified shape so clients don’t need to parse NASA’s nested response format.
- Potential caching (not implemented): since NASA data is public and repeatable, caching responses would reduce latency and protect against rate limiting or upstream slowness.

### Trade-offs

- Kept schema/resolvers in one file: This keeps the take-home easy to review, but it wouldn’t scale well to many endpoints.
- Metadata enrichment approach: NASA’s /metadata/{nasa_id} commonly points to a metadata file rather than returning user-friendly fields directly, so mediaDetails uses /search?q={nasa_id} to populate title/description/keywords reliably while still integrating /metadata (exposing metadataUrl when available).
- Minimal data modeling: I returned only the fields needed for the take-home features rather than mirroring NASA’s entire response model.

### Improvements

- Add tests.
- Add caching for popular queries and avoid duplicate calls within a single request.
- Better pagination controls to include totalHits, limit, and hasNextPage in the response so clients can paginate more cleanly.
