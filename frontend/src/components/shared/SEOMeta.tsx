import { Helmet } from 'react-helmet-async'

interface SEOMetaProps {
  title?: string
  description?: string
  canonical?: string
  image?: string
  schema?: object
}

export function SEOMeta({ title, description, canonical, image, schema }: SEOMetaProps) {
  const siteName = 'MyArea24'
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — Local Intelligence for India`
  const desc = description ?? 'Real-time weather, traffic, air quality, local businesses, deals and community events for your neighbourhood in India.'
  const img = image ?? '/icons/icon-512.png'

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
    </Helmet>
  )
}
