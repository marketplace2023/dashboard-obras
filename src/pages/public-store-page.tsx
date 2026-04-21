import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  ShieldCheck,
  Siren,
  Star,
  Store,
  Wrench,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPublicStore, fetchPublicStoreProducts, formatEntityTypeLabel, formatPrice, type PublicProduct, type PublicStore } from '@/lib/public-marketplace'

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function getCoverageLabel(storeData: PublicStore) {
  const profile = storeData.profile
  const area = profile?.service_area_type ? String(profile.service_area_type) : ''
  const radius = profile?.coverage_radius_km != null && profile.coverage_radius_km !== '' ? `${profile.coverage_radius_km} km` : ''

  if (area && radius) return `${area} · ${radius}`
  if (area) return area
  if (radius) return radius
  return 'Cobertura no especificada'
}

function getAddressLabel(storeData: PublicStore) {
  const parts = [storeData.street, storeData.city, storeData.state, storeData.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Ubicación no especificada'
}

function getLicensedRegionsLabel(profile: PublicStore['profile']) {
  const value = profile?.licensed_regions_json
  if (!value) return ''

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ')
  }

  if (typeof value === 'object') {
    return Object.values(value)
      .flatMap((item) => (typeof item === 'string' ? [item] : Array.isArray(item) ? item.map(String) : []))
      .filter(Boolean)
      .join(', ')
  }

  return ''
}

function getProfileHighlights(storeData: PublicStore) {
  const profile = storeData.profile
  const highlights = [] as Array<{ label: string; value: string }>

  if (profile?.service_area_type) {
    highlights.push({ label: 'Cobertura', value: String(profile.service_area_type) })
  }
  if (profile?.coverage_radius_km != null && profile.coverage_radius_km !== '') {
    highlights.push({ label: 'Radio operativo', value: `${profile.coverage_radius_km} km` })
  }
  if (profile?.license_number) {
    highlights.push({ label: 'Licencia', value: profile.license_number })
  }
  if (profile?.license_registry) {
    highlights.push({ label: 'Registro', value: profile.license_registry })
  }

  const regions = getLicensedRegionsLabel(profile)
  if (regions) {
    highlights.push({ label: 'Regiones', value: regions })
  }

  return highlights
}

function PublicStorePage() {
  const { id = '' } = useParams()
  const [storeData, setStoreData] = useState<PublicStore | null>(null)
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadStore() {
      try {
        setLoading(true)
        setError(null)

        const [publicStore, publicProducts] = await Promise.all([
          fetchPublicStore(id),
          fetchPublicStoreProducts(id, 12),
        ])

        if (!active) return

        setStoreData(publicStore)
        setProducts(publicProducts.data ?? [])
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el proveedor')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadStore()

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-background px-4 py-10 text-center text-muted-foreground">Cargando proveedor...</div>
  }

  if (error || !storeData) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-sm text-destructive">{error || 'Proveedor no encontrado'}</p>
              <Button asChild variant="outline">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const coverageLabel = getCoverageLabel(storeData)
  const addressLabel = getAddressLabel(storeData)
  const insuranceVerified = toBoolean(storeData.profile?.insurance_verified)
  const emergencyService = toBoolean(storeData.profile?.emergency_service)
  const profileHighlights = getProfileHighlights(storeData)
  const serviceCount = products.filter((item) => item.listing_type === 'service').length
  const productCount = products.filter((item) => item.listing_type !== 'service').length
  const promoImages = Array.isArray(storeData.attributes_json?.promo_images)
    ? storeData.attributes_json?.promo_images.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>

        <div className="grid gap-6">
          {promoImages.length > 0 ? (
            <Card className="overflow-hidden border-border/60 bg-card/90 shadow-sm">
              <CardContent className="p-0">
                <Swiper
                  modules={[Autoplay, Pagination]}
                  pagination={{ clickable: true }}
                  autoplay={{ delay: 4500, disableOnInteraction: false }}
                  loop={promoImages.length > 1}
                  className="hero-banner-swiper"
                >
                  {promoImages.map((imageUrl, index) => (
                    <SwiperSlide key={`${imageUrl}-${index}`}>
                      <div className="relative h-[260px] overflow-hidden sm:h-[340px] lg:h-[420px]">
                        <img src={imageUrl} alt={`${storeData.name} banner ${index + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,18,0.62)_0%,rgba(8,12,18,0.2)_55%,rgba(8,12,18,0.08)_100%)]" />
                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
                          <div className="max-w-2xl rounded-[1.75rem] border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md sm:p-5">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Galeria promocional</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{storeData.name}</h2>
                            <p className="mt-2 text-sm leading-6 text-white/80">
                              Presentacion visual del proveedor, pensada para destacar servicios, proyectos o promociones clave.
                            </p>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden border-border/60 bg-card/90 shadow-sm">
            <CardContent className="p-0">
              <div className="bg-[linear-gradient(135deg,#1f3559_0%,#e16a00_100%)] px-6 py-8 text-white sm:px-8 lg:px-10">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
                  <div className="space-y-5">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      {storeData.logo_url ? (
                        <img src={storeData.logo_url} alt={storeData.name} className="size-24 rounded-3xl border border-white/20 object-cover shadow-sm" />
                      ) : (
                        <div className="flex size-24 items-center justify-center rounded-3xl bg-white/12 text-white">
                          <Store className="size-8" />
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                            {formatEntityTypeLabel(storeData.entity_type)}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                            {products.length} publicaciones
                          </Badge>
                          {Number(storeData.rating_avg || 0) > 0 ? (
                            <Badge variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                              <Star className="size-3.5 fill-current" />
                              {Number(storeData.rating_avg).toFixed(1)} {storeData.review_count ? `· ${storeData.review_count} reseñas` : ''}
                            </Badge>
                          ) : null}
                        </div>

                        <div>
                          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{storeData.name}</h1>
                          {storeData.legal_name && storeData.legal_name !== storeData.name ? (
                            <p className="mt-2 text-sm text-white/78">Razón social: {storeData.legal_name}</p>
                          ) : null}
                          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">
                            {storeData.description || 'Este proveedor todavía no ha publicado una descripción comercial detallada.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm text-white/82">
                      <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5">{coverageLabel}</span>
                      <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5">{addressLabel}</span>
                      {insuranceVerified ? <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5">Seguro verificado</span> : null}
                      {emergencyService ? <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5">Servicio de emergencia</span> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[1.75rem] border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Resumen comercial</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                      <div>
                        <p className="text-sm text-white/65">Servicios</p>
                        <p className="mt-1 text-2xl font-semibold">{serviceCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/65">Productos</p>
                        <p className="mt-1 text-2xl font-semibold">{productCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/65">Ubicación</p>
                        <p className="mt-1 text-sm font-medium text-white">{[storeData.city, storeData.country].filter(Boolean).join(', ') || 'Sin ciudad visible'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="grid gap-6">
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Perfil del proveedor</CardTitle>
                  <CardDescription>Datos públicos comerciales y operativos que ayudan a evaluar la tienda.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoMetric label="Tipo de proveedor" value={formatEntityTypeLabel(storeData.entity_type)} icon={<Store className="size-4" />} />
                  <InfoMetric label="Cobertura" value={coverageLabel} icon={<MapPin className="size-4" />} />
                  <InfoMetric label="Publicaciones" value={String(products.length)} icon={<PackageSearch className="size-4" />} />
                  <InfoMetric label="Seguro" value={insuranceVerified ? 'Verificado' : 'No especificado'} icon={<ShieldCheck className="size-4" />} />
                  <InfoMetric label="Emergencia" value={emergencyService ? 'Disponible' : 'No especificado'} icon={<Siren className="size-4" />} />
                  <InfoMetric label="Sitio web" value={storeData.website ? 'Disponible' : 'No publicado'} icon={<Globe className="size-4" />} />
                </CardContent>
              </Card>

              {profileHighlights.length > 0 ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Detalle operativo</CardTitle>
                    <CardDescription>Información adicional publicada por el proveedor según su tipo de cuenta.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {profileHighlights.map((item) => (
                      <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-border/50 bg-background/80 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                        <p className="mt-2 break-words text-sm font-medium leading-6 text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Publicaciones de la tienda</CardTitle>
                  <CardDescription>Servicios y productos visibles actualmente en el marketplace.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {products.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                        Este proveedor aún no tiene productos publicados.
                      </div>
                    ) : (
                      products.map((product) => (
                        <Card key={product.id} className="overflow-hidden border-border/60 bg-background/80 shadow-none">
                          <CardContent className="space-y-4 p-5">
                            {product.cover_image_url ? (
                              <img src={product.cover_image_url} alt={product.name} className="h-40 w-full rounded-2xl object-cover" />
                            ) : (
                              <div className="flex h-40 items-center justify-center rounded-2xl bg-muted/25 text-muted-foreground">
                                <PackageSearch className="size-5" />
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5">{product.listing_type}</Badge>
                                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">{formatEntityTypeLabel(product.vertical_type)}</Badge>
                              </div>
                              <p className="font-semibold tracking-tight">{product.name}</p>
                              <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {product.description_sale || 'Producto o servicio publicado en el marketplace.'}
                              </p>
                              <p className="font-medium">{formatPrice(product.list_price, product.currency_code ?? 'USD')}</p>
                            </div>

                            <Button asChild variant="outline" className="w-full rounded-full">
                              <Link to={`/productos/${product.id}`}>Ver producto</Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 content-start">
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Contacto público</CardTitle>
                  <CardDescription>Canales disponibles del proveedor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {storeData.email ? (
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 size-4 text-primary" />
                      <div>
                        <p className="text-muted-foreground">Correo</p>
                        <a href={`mailto:${storeData.email}`} className="font-medium hover:text-primary">{storeData.email}</a>
                      </div>
                    </div>
                  ) : null}
                  {storeData.phone ? (
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 size-4 text-primary" />
                      <div>
                        <p className="text-muted-foreground">Teléfono</p>
                        <a href={`tel:${storeData.phone}`} className="font-medium hover:text-primary">{storeData.phone}</a>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 text-primary" />
                    <div>
                      <p className="text-muted-foreground">Dirección</p>
                      <p className="font-medium">{addressLabel}</p>
                    </div>
                  </div>
                  {storeData.website ? (
                    <Button asChild variant="outline" className="w-full rounded-full">
                      <a href={storeData.website} target="_blank" rel="noreferrer">
                        Sitio web
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Señales de confianza</CardTitle>
                  <CardDescription>Indicadores visibles del perfil actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <TrustRow icon={<BadgeCheck className="size-4" />} label="Proveedor publicado" value="Sí" />
                  <TrustRow icon={<ShieldCheck className="size-4" />} label="Seguro verificado" value={insuranceVerified ? 'Sí' : 'No especificado'} />
                  <TrustRow icon={<Siren className="size-4" />} label="Atención de emergencia" value={emergencyService ? 'Sí' : 'No especificado'} />
                  <TrustRow icon={<Wrench className="size-4" />} label="Cobertura declarada" value={coverageLabel} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function InfoMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/80 px-4 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 break-words text-sm font-medium leading-6 text-foreground">{value}</p>
    </div>
  )
}

function TrustRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-sm">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="mt-1 font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export { PublicStorePage }
