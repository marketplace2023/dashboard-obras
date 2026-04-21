import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Clock3, ExternalLink, ImageIcon, MapPin, PackageSearch, ShieldCheck, Store, Truck, Wrench, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPublicProduct, fetchPublicStore, formatEntityTypeLabel, formatPrice, type PublicProduct, type PublicStore } from '@/lib/public-marketplace'

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function toText(value: unknown, fallback = 'No especificado') {
  if (value == null || value === '') return fallback
  return String(value)
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

function PublicProductPage() {
  const { id = '' } = useParams()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [storeData, setStoreData] = useState<PublicStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadProduct() {
      try {
        setLoading(true)
        setError(null)

        const publicProduct = await fetchPublicProduct(id)
        const publicStore = await fetchPublicStore(publicProduct.partner_id)

        if (!active) return

        setProduct(publicProduct)
        setStoreData(publicStore)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el producto')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadProduct()

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-background px-4 py-10 text-center text-muted-foreground">Cargando producto...</div>
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-sm text-destructive">{error || 'Producto no encontrado'}</p>
              <Button asChild variant="outline">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const galleryImages = Array.from(
    new Set(
      [
        product.cover_image_url,
        ...(product.images ?? []).map((image) => image.image_url),
        ...((Array.isArray(product.x_attributes_json?.gallery_images) ? product.x_attributes_json?.gallery_images : []) ?? []),
      ].filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  )

  const serviceType = toText(product.extension?.service_type)
  const deliveryMode = toText(product.extension?.delivery_mode)
  const estimatedDuration = product.extension?.estimated_duration_hours != null && product.extension?.estimated_duration_hours !== ''
    ? `${product.extension.estimated_duration_hours} horas`
    : 'No especificado'
  const materialsIncluded = toBoolean(product.extension?.materials_included)
  const quoteRequired = toBoolean(product.extension?.quote_required)
  const siteVisitRequired = toBoolean(product.extension?.site_visit_required)

  const summaryBadges = [
    formatEntityTypeLabel(product.vertical_type),
    product.listing_type === 'product' ? 'Producto' : 'Servicio',
    materialsIncluded ? 'Incluye materiales' : 'Materiales por definir',
  ]

  const selectedGalleryImage = selectedImageIndex != null ? galleryImages[selectedImageIndex] : null

  function openGalleryImage(index: number) {
    setSelectedImageIndex(index)
  }

  function closeGalleryImage() {
    setSelectedImageIndex(null)
  }

  function showPreviousImage() {
    if (galleryImages.length <= 1 || selectedImageIndex == null) return
    setSelectedImageIndex((selectedImageIndex - 1 + galleryImages.length) % galleryImages.length)
  }

  function showNextImage() {
    if (galleryImages.length <= 1 || selectedImageIndex == null) return
    setSelectedImageIndex((selectedImageIndex + 1) % galleryImages.length)
  }

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
          {storeData ? (
            <Button asChild variant="ghost" className="rounded-full">
              <Link to={`/proveedores/${storeData.id}`}>Ver proveedor</Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6">
          <Card className="overflow-hidden border-border/60 bg-card/90 shadow-sm">
            <CardContent className="p-0">
              {galleryImages.length > 0 ? (
                <Swiper
                  modules={[Autoplay, Pagination]}
                  pagination={{ clickable: true }}
                  autoplay={{ delay: 4200, disableOnInteraction: false }}
                  loop={galleryImages.length > 1}
                  className="hero-banner-swiper"
                >
                  {galleryImages.map((imageUrl, index) => (
                    <SwiperSlide key={`${imageUrl}-${index}`}>
                      <button
                        type="button"
                        className="relative block h-[280px] w-full overflow-hidden text-left sm:h-[360px] lg:h-[460px]"
                        onClick={() => openGalleryImage(index)}
                      >
                        <img src={imageUrl} alt={`${product.name} imagen ${index + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,18,0.68)_0%,rgba(8,12,18,0.32)_50%,rgba(8,12,18,0.1)_100%)]" />
                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
                          <div className="max-w-3xl rounded-[1.75rem] border border-white/15 bg-black/25 p-5 text-white backdrop-blur-md sm:p-6">
                            <div className="flex flex-wrap gap-2">
                              {summaryBadges.map((badge) => (
                                <Badge key={badge} variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{product.name}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82 sm:text-base">
                              {product.description_sale || 'Este producto o servicio no tiene una descripción pública detallada todavía.'}
                            </p>
                          </div>
                        </div>
                      </button>
                    </SwiperSlide>
                  ))}
                </Swiper>
              ) : (
                <div className="flex h-[280px] items-center justify-center bg-muted/20 text-muted-foreground sm:h-[360px] lg:h-[460px]">
                  <ImageIcon className="mr-2 size-5" />
                  Sin imagen disponible
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]">
            <div className="grid gap-6">
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Descripción comercial</CardTitle>
                  <CardDescription>Resumen público del servicio o producto publicado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {summaryBadges.map((badge) => (
                      <Badge key={badge} variant="outline" className="rounded-full px-3 py-1">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    {product.description_sale || 'Este producto o servicio no tiene una descripción pública detallada todavía.'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Detalle de la publicación</CardTitle>
                  <CardDescription>Información útil para evaluar esta oferta antes de contactar al proveedor.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoMetric label="Tipo de servicio" value={serviceType} icon={<Wrench className="size-4" />} />
                  <InfoMetric label="Entrega" value={deliveryMode} icon={<Truck className="size-4" />} />
                  <InfoMetric label="Duración estimada" value={estimatedDuration} icon={<Clock3 className="size-4" />} />
                  <InfoMetric label="Materiales incluidos" value={materialsIncluded ? 'Sí' : 'No especificado'} icon={<PackageSearch className="size-4" />} />
                  <InfoMetric label="Requiere cotización" value={quoteRequired ? 'Sí' : 'No'} icon={<BadgeCheck className="size-4" />} />
                  <InfoMetric label="Visita técnica" value={siteVisitRequired ? 'Requerida' : 'No requerida'} icon={<MapPin className="size-4" />} />
                </CardContent>
              </Card>

              {galleryImages.length > 1 ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Galería</CardTitle>
                    <CardDescription>Imágenes disponibles de esta publicación.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {galleryImages.map((imageUrl, index) => (
                        <button
                          key={`${imageUrl}-${index}-thumb`}
                          type="button"
                          onClick={() => openGalleryImage(index)}
                          className="group overflow-hidden rounded-2xl border border-border/60 bg-background text-left transition-transform hover:-translate-y-0.5"
                        >
                          <img src={imageUrl} alt={`${product.name} miniatura ${index + 1}`} className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="grid gap-6 content-start">
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Resumen comercial</CardTitle>
                  <CardDescription>Información disponible para consulta pública.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Precio</p>
                    <p className="mt-1 text-3xl font-semibold">{formatPrice(product.list_price, product.currency_code ?? 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="mt-1 font-medium">{formatEntityTypeLabel(product.vertical_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modalidad</p>
                    <p className="mt-1 font-medium">{deliveryMode}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {product.listing_type === 'product' ? 'Producto' : 'Servicio'}
                    </Badge>
                    {materialsIncluded ? (
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        Incluye materiales
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {storeData ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Proveedor</CardTitle>
                    <CardDescription>Empresa o contratista que ofrece esta publicación.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      {storeData.logo_url ? (
                        <img src={storeData.logo_url} alt={storeData.name} className="size-14 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Store className="size-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold tracking-tight">{storeData.name}</p>
                        <p className="text-sm text-muted-foreground">{formatEntityTypeLabel(storeData.entity_type)}</p>
                      </div>
                    </div>

                    {storeData.city || storeData.country ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>{[storeData.city, storeData.country].filter(Boolean).join(', ')}</span>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <TrustRow icon={<ShieldCheck className="size-4" />} label="Cobertura" value={toText(storeData.profile?.service_area_type, 'No especificada')} />
                      <TrustRow icon={<BadgeCheck className="size-4" />} label="Seguro verificado" value={toBoolean(storeData.profile?.insurance_verified) ? 'Sí' : 'No especificado'} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild className="rounded-full">
                        <Link to={`/proveedores/${storeData.id}`}>Ver perfil público</Link>
                      </Button>
                      {storeData.website ? (
                        <Button asChild variant="outline" className="rounded-full">
                          <a href={storeData.website} target="_blank" rel="noreferrer">
                            Sitio web
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <Dialog.Root open={selectedImageIndex != null} onOpenChange={(open) => (!open ? closeGalleryImage() : undefined)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <Dialog.Title className="sr-only">Galería de imágenes</Dialog.Title>
            <Dialog.Description className="sr-only">Vista ampliada de la imagen seleccionada</Dialog.Description>

            <div className="relative flex max-h-[92vh] w-full max-w-6xl items-center justify-center">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="absolute right-2 top-2 z-20 flex size-11 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition-colors hover:bg-white/22 sm:right-4 sm:top-4"
                >
                  <X className="size-5" />
                  <span className="sr-only">Cerrar</span>
                </button>
              </Dialog.Close>

              {galleryImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPreviousImage}
                    className="absolute left-2 z-20 flex size-11 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition-colors hover:bg-white/22 sm:left-4"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute right-2 z-20 flex size-11 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition-colors hover:bg-white/22 sm:right-4"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}

              {selectedGalleryImage ? (
                <div className="w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 shadow-2xl">
                  <img src={selectedGalleryImage} alt={`${product.name} vista ampliada`} className="max-h-[92vh] w-full object-contain" />
                </div>
              ) : null}

              {selectedImageIndex != null && galleryImages.length > 1 ? (
                <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                  {selectedImageIndex + 1} / {galleryImages.length}
                </div>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export { PublicProductPage }
