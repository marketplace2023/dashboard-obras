import { API_BASE_URL } from '@/lib/auth'

type PublicListResponse<T> = {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

type PublicStore = {
  id: string
  tenant_id: string
  name: string
  legal_name?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  logo_url?: string | null
  description?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zip?: string | null
  entity_type: string
  rating_avg?: string
  review_count?: number
  attributes_json?: {
    promo_images?: string[]
  } | null
  profile?: {
    service_area_type?: string | null
    coverage_radius_km?: string | number | null
    license_number?: string | null
    insurance_verified?: number | boolean | null
    emergency_service?: number | boolean | null
    license_registry?: string | null
    licensed_regions_json?: string[] | Record<string, unknown> | null
  } | null
}

type PublicProduct = {
  id: string
  tenant_id: string
  partner_id: string
  name: string
  description_sale?: string | null
  list_price: string
  currency_code?: string | null
  cover_image_url?: string | null
  vertical_type: string
  listing_type: string
  images?: Array<{
    image_url: string
    is_cover?: number | boolean
  }>
  x_attributes_json?: {
    gallery_images?: string[]
    sku?: string
    stock?: string | number
  } | null
  extension?: {
    service_type?: string | null
    delivery_mode?: string | null
    estimated_duration_hours?: string | number | null
    materials_included?: number | boolean | null
    quote_required?: number | boolean | null
    site_visit_required?: number | boolean | null
  } | null
}

type MarketplaceListing = PublicProduct & {
  storeId: string
  storeName: string
  storeCity?: string | null
  storeEntityType: string
}

type MarketplaceFilters = {
  vertical?: string
  city?: string
  storeLimit?: number
  productsPerStore?: number
  listingLimit?: number
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message
    throw new Error(message || 'No se pudo cargar la informacion publica')
  }

  return payload as T
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function fetchPublicStores(filters: { vertical?: string; city?: string; limit?: number }) {
  const query = buildQuery({
    vertical: filters.vertical,
    city: filters.city,
    limit: filters.limit ?? 6,
  })

  return parseResponse<PublicListResponse<PublicStore>>(await fetch(`${API_BASE_URL}/stores/public${query}`))
}

async function fetchPublicStoreProducts(storeId: string, limit = 3) {
  const query = buildQuery({ limit })
  return parseResponse<PublicListResponse<PublicProduct>>(await fetch(`${API_BASE_URL}/stores/public/${storeId}/products${query}`))
}

async function fetchMarketplaceListings(filters: MarketplaceFilters) {
  const storesPayload = await fetchPublicStores({
    vertical: filters.vertical,
    city: filters.city,
    limit: filters.storeLimit ?? 6,
  })

  const stores = storesPayload.data ?? []

  if (stores.length === 0) {
    return { stores: [], listings: [] as MarketplaceListing[] }
  }

  const productResponses = await Promise.all(
    stores.map(async (store) => {
      const payload = await fetchPublicStoreProducts(store.id, filters.productsPerStore ?? 3)
      return { store, products: payload.data ?? [] }
    }),
  )

  return {
    stores,
    listings: productResponses
      .flatMap(({ store, products }) =>
        products.map((product) => ({
          ...product,
          storeId: store.id,
          storeName: store.name,
          storeCity: store.city,
          storeEntityType: store.entity_type,
        })),
      )
      .slice(0, filters.listingLimit ?? 12),
  }
}

async function fetchPublicStore(storeId: string) {
  return parseResponse<PublicStore>(await fetch(`${API_BASE_URL}/stores/public/${storeId}`))
}

async function fetchPublicProduct(productId: string) {
  return parseResponse<PublicProduct>(await fetch(`${API_BASE_URL}/products/public/${productId}`))
}

function formatEntityTypeLabel(entityType: string) {
  switch (entityType) {
    case 'contractor':
      return 'Contratista'
    case 'education_provider':
      return 'Proveedor educativo'
    case 'hardware_store':
      return 'Ferreteria o tienda'
    case 'professional_firm':
      return 'Firma profesional'
    case 'seo_agency':
      return 'Agencia SEO'
    default:
      return entityType
    }
}

function formatPrice(value: string | number | null | undefined, currency = 'USD') {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export {
  fetchMarketplaceListings,
  fetchPublicProduct,
  fetchPublicStore,
  fetchPublicStoreProducts,
  formatEntityTypeLabel,
  formatPrice,
}

export type { MarketplaceListing, PublicProduct, PublicStore }
