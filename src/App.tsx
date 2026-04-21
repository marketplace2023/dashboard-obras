import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Blocks,
  Building2,
  ChevronLeft,
  ChevronRight,
  HardHat,
  LayoutGrid,
  Mail,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Store,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Autoplay, Navigation, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'

import './App.css'
import bannerElectricidad from '@/assets/home-banner-electricidad.svg'
import bannerObraGris from '@/assets/home-banner-obra-gris.svg'
import bannerRemodelacion from '@/assets/home-banner-remodelacion.svg'
import { AuthSection, type AuthTab } from '@/components/auth-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { API_BASE_URL, AUTH_STORAGE_KEY, type AuthSuccessPayload, type AuthUser } from '@/lib/auth'
import { fetchMarketplaceListings, formatEntityTypeLabel, formatPrice, type MarketplaceListing, type PublicStore } from '@/lib/public-marketplace'
import { routeForUser } from '@/lib/session'

type LinkItem = {
  label: string
  href: string
}

type CategoryItem = {
  title: string
  description: string
  icon: LucideIcon
}

type HeroPromoSlide = {
  id: string
  eyebrow: string
  title: string
  description: string
  badge?: string
  imageUrl?: string | null
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
  fallbackClassName: string
}

type HeroShortcutItem = {
  title: string
  description: string
  cta: string
  href: string
  icon: LucideIcon
}

type FeaturedStoreCard = {
  id: string
  name: string
  entityType: string
  city: string
  description: string
  logoUrl?: string | null
  isFallback?: boolean
}

type FeaturedProductCard = {
  id: string
  name: string
  description: string
  price: string
  storeName: string
  storeId: string
  imageUrl?: string | null
  city?: string | null
  isFallback?: boolean
}

const navItems: LinkItem[] = [
  { label: 'Categorias', href: '#categorias' },
  { label: 'Tiendas', href: '#tiendas' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Acceso', href: '#acceso' },
]

const categories: CategoryItem[] = [
  {
    title: 'Construcción',
    description: 'Contratistas, cuadrillas, obra gris y ejecución por frentes.',
    icon: HardHat,
  },
  {
    title: 'Instalaciones',
    description: 'Eléctrico, hidráulico, climatización y sistemas especiales.',
    icon: Wrench,
  },
  {
    title: 'Remodelación',
    description: 'Adecuaciones, mejoras, rehabilitación y mantenimiento mayor.',
    icon: Building2,
  },
  {
    title: 'Acabados',
    description: 'Pisos, pintura, carpintería, baños, cocinas y detalles finales.',
    icon: LayoutGrid,
  },
]

const heroShortcutItems: HeroShortcutItem[] = [
  {
    title: 'Remodelaciones',
    description: 'Cocinas, banos y mejoras por etapas.',
    cta: 'Ver opciones',
    href: '#servicios',
    icon: Building2,
  },
  {
    title: 'Instalaciones',
    description: 'Electricidad, agua, clima y soporte tecnico.',
    cta: 'Explorar servicios',
    href: '#categorias',
    icon: Wrench,
  },
  {
    title: 'Acabados',
    description: 'Pisos, pintura, carpinteria y detalles finales.',
    cta: 'Ver categoria',
    href: '#categorias',
    icon: LayoutGrid,
  },
  {
    title: 'Obra gris',
    description: 'Cuadrillas, estructura y ejecucion de frentes.',
    cta: 'Buscar proveedores',
    href: '#tiendas',
    icon: HardHat,
  },
  {
    title: 'Materiales',
    description: 'Suministros y publicaciones activas del marketplace.',
    cta: 'Ver publicaciones',
    href: '#servicios',
    icon: Store,
  },
]

const fallbackHeroSlides: HeroPromoSlide[] = [
  {
    id: 'hero-remodelacion',
    eyebrow: 'Campana de servicios',
    title: 'Remodelacion integral para cocinas, banos y espacios comerciales.',
    description: 'Promociona servicios de reforma, rediseno de interiores y ejecucion por etapas con un banner realmente comercial.',
    badge: 'Agenda visita tecnica',
    imageUrl: bannerRemodelacion,
    primaryHref: '#servicios',
    primaryLabel: 'Ver servicios',
    secondaryHref: '#tiendas',
    secondaryLabel: 'Encontrar proveedores',
    fallbackClassName: 'bg-[linear-gradient(120deg,#b4946f_0%,#e6d0b5_45%,#8b6a4c_100%)]',
  },
  {
    id: 'hero-electrico',
    eyebrow: 'Ofertas para instalaciones',
    title: 'Electrificacion, mantenimiento preventivo y soporte tecnico para obra y comercio.',
    description: 'Un banner de servicio debe vender rapidez, cobertura y confianza, no un producto individual.',
    badge: 'Cobertura empresarial',
    imageUrl: bannerElectricidad,
    primaryHref: '#categorias',
    primaryLabel: 'Ver categorias',
    secondaryHref: '#servicios',
    secondaryLabel: 'Explorar soluciones',
    fallbackClassName: 'bg-[linear-gradient(120deg,#30445b_0%,#69829f_48%,#1a2431_100%)]',
  },
  {
    id: 'hero-acabados',
    eyebrow: 'Campana para obra gris',
    title: 'Cuadrillas, estructura y apoyo en frentes para proyectos de obra gris.',
    description: 'Ideal para vender servicios de ejecucion, avance de obra y disponibilidad por zona.',
    badge: 'Equipos listos para arrancar',
    imageUrl: bannerObraGris,
    primaryHref: '#tiendas',
    primaryLabel: 'Buscar cuadrillas',
    secondaryHref: '#tiendas',
    secondaryLabel: 'Ver proveedores',
    fallbackClassName: 'bg-[linear-gradient(120deg,#715447_0%,#caa48c_45%,#3f2b22_100%)]',
  },
]

const fallbackStores: FeaturedStoreCard[] = [
  {
    id: 'fallback-1',
    name: 'Construservicios Norte',
    entityType: 'contractor',
    city: 'Ciudad de México',
    description: 'Servicios de construcción, remodelación y coordinación de obra.',
    isFallback: true,
  },
  {
    id: 'fallback-2',
    name: 'Red Técnica Integral',
    entityType: 'professional_firm',
    city: 'Monterrey',
    description: 'Especialistas en instalaciones, supervisión y soporte técnico.',
    isFallback: true,
  },
  {
    id: 'fallback-3',
    name: 'Materiales del Centro',
    entityType: 'hardware_store',
    city: 'Guadalajara',
    description: 'Catálogo de materiales, acabados y suministros para proyectos.',
    isFallback: true,
  },
]

const fallbackProducts: FeaturedProductCard[] = [
  {
    id: 'fallback-product-1',
    name: 'Servicio de remodelación integral',
    description: 'Adecuaciones, acabados y coordinación por etapas.',
    price: formatPrice(1250),
    storeName: 'Construservicios Norte',
    storeId: 'fallback-1',
    city: 'Ciudad de México',
    isFallback: true,
  },
  {
    id: 'fallback-product-2',
    name: 'Instalación eléctrica comercial',
    description: 'Tableros, canalización y puesta en marcha.',
    price: formatPrice(980),
    storeName: 'Red Técnica Integral',
    storeId: 'fallback-2',
    city: 'Monterrey',
    isFallback: true,
  },
  {
    id: 'fallback-product-3',
    name: 'Suministro de acabados interiores',
    description: 'Pisos, pintura, grifería y accesorios para entrega final.',
    price: formatPrice(540),
    storeName: 'Materiales del Centro',
    storeId: 'fallback-3',
    city: 'Guadalajara',
    isFallback: true,
  },
]

const footerGroups = [
  {
    title: 'Marketplace',
    links: ['Categorias', 'Tiendas', 'Servicios publicados'],
  },
  {
    title: 'Cuenta',
    links: ['Ingresar', 'Registrarme', 'Panel del proveedor'],
  },
]

function mapStoreToCard(store: PublicStore): FeaturedStoreCard {
  return {
    id: store.id,
    name: store.name,
    entityType: store.entity_type,
    city: store.city ?? 'Cobertura nacional',
    description: store.description?.trim() || 'Proveedor publicado en el marketplace de servicios y materiales.',
    logoUrl: store.logo_url,
  }
}

function mapListingToCard(listing: MarketplaceListing): FeaturedProductCard {
  return {
    id: listing.id,
    name: listing.name,
    description: listing.description_sale?.trim() || 'Servicio publicado en el marketplace.',
    price: formatPrice(listing.list_price, listing.currency_code || 'USD'),
    storeName: listing.storeName,
    storeId: listing.storeId,
    imageUrl: listing.cover_image_url,
    city: listing.storeCity,
  }
}

function App() {
  const navigate = useNavigate()
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [publicStores, setPublicStores] = useState<PublicStore[]>([])
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([])
  const [marketplaceQuery, setMarketplaceQuery] = useState('')

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (!storedToken) {
      setAuthReady(true)
      return
    }

    let active = true

    async function hydrateSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        })

        if (!response.ok) {
          throw new Error('Sesion no valida')
        }

        const data = (await response.json()) as AuthUser

        if (!active) return
        setAuthUser(data)
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } finally {
        if (active) setAuthReady(true)
      }
    }

    void hydrateSession()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadMarketplace() {
      try {
        const { stores, listings } = await fetchMarketplaceListings({
          storeLimit: 10,
          productsPerStore: 5,
          listingLimit: 18,
        })

        if (!active) return
        setPublicStores(stores)
        setMarketplaceListings(listings)
      } catch {
        if (!active) return
        setPublicStores([])
        setMarketplaceListings([])
      }
    }

    void loadMarketplace()

    return () => {
      active = false
    }
  }, [])

  const normalizedQuery = marketplaceQuery.trim().toLowerCase()

  const filteredStores = useMemo(() => {
    if (!normalizedQuery) return publicStores
    return publicStores.filter((store) =>
      [store.name, store.description, store.city, formatEntityTypeLabel(store.entity_type)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [normalizedQuery, publicStores])

  const filteredListings = useMemo(() => {
    if (!normalizedQuery) return marketplaceListings
    return marketplaceListings.filter((listing) =>
      [listing.name, listing.description_sale, listing.storeName, listing.storeCity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [normalizedQuery, marketplaceListings])

  const visibleStores = useMemo(() => {
    if (normalizedQuery) return filteredStores.map(mapStoreToCard)
    return publicStores.length > 0 ? publicStores.map(mapStoreToCard) : fallbackStores
  }, [filteredStores, normalizedQuery, publicStores])

  const visibleProducts = useMemo(() => {
    if (normalizedQuery) return filteredListings.map(mapListingToCard)
    return marketplaceListings.length > 0 ? marketplaceListings.map(mapListingToCard) : fallbackProducts
  }, [filteredListings, marketplaceListings, normalizedQuery])

  const marketplaceStats = useMemo(
    () => [
      {
        label: 'Tiendas activas',
        value: publicStores.length > 0 ? String(publicStores.length) : String(fallbackStores.length),
      },
      {
        label: 'Publicaciones',
        value: marketplaceListings.length > 0 ? String(marketplaceListings.length) : String(fallbackProducts.length),
      },
      {
        label: 'Especialidades',
        value: String(categories.length),
      },
    ],
    [marketplaceListings.length, publicStores.length],
  )

  const heroSlides = fallbackHeroSlides
  const showStoresAsGrid = visibleStores.length > 0 && visibleStores.length <= 3
  const showProductsAsGrid = visibleProducts.length > 0 && visibleProducts.length <= 3

  function openAuth(tab: AuthTab) {
    setAuthTab(tab)
    setShowAuth(true)
    window.setTimeout(() => {
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function handleAuthSuccess(payload: AuthSuccessPayload) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload.access_token)
    setAuthUser(payload.user)
    setAuthReady(true)
    setShowAuth(false)
    navigate(routeForUser(payload.user))
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthUser(null)
    setAuthTab('login')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href="#inicio">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Blocks className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">GestorObras</p>
              <p className="text-xs text-muted-foreground">Marketplace de servicios</p>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            {navItems.map((item) => (
              <a key={item.label} className="transition-colors hover:text-foreground" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <Badge variant="secondary" className="hidden rounded-full px-3 py-1 sm:inline-flex">
                  {authUser.role}
                </Badge>
                <Button asChild variant="ghost" className="hidden lg:inline-flex">
                  <a href={routeForUser(authUser)}>Ir a mi panel</a>
                </Button>
                <Button variant="outline" className="hidden h-10 rounded-full px-5 sm:inline-flex" onClick={handleLogout}>
                  Salir
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="hidden lg:inline-flex" onClick={() => openAuth('login')}>
                  Ingresar
                </Button>
                <Button className="hidden h-10 rounded-full px-5 sm:inline-flex" onClick={() => openAuth('register')}>
                  Registrarme
                </Button>
              </>
            )}

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="size-10 rounded-xl lg:hidden" aria-label="Abrir menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-[380px] sm:w-[380px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3 text-left">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <Blocks className="size-4" />
                    </span>
                    <span>GestorObras</span>
                  </SheetTitle>
                  <SheetDescription className="text-left">
                    Explora categorías, tiendas, servicios destacados y acceso a la plataforma.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-8 grid gap-6">
                  <nav className="grid gap-2">
                    {navItems.map((item) => (
                      <SheetClose asChild key={item.label}>
                        <a className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted" href={item.href}>
                          <span>{item.label}</span>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </a>
                      </SheetClose>
                    ))}
                  </nav>

                  <div className="grid gap-3">
                    {authUser ? (
                      <>
                        <SheetClose asChild>
                          <Button asChild variant="ghost" className="h-11 justify-start rounded-xl px-4">
                            <a href={routeForUser(authUser)}>Ir a mi panel</a>
                          </Button>
                        </SheetClose>
                        <SheetClose asChild>
                          <Button className="h-11 rounded-xl px-4" onClick={handleLogout}>
                            Salir
                          </Button>
                        </SheetClose>
                      </>
                    ) : (
                      <>
                        <SheetClose asChild>
                          <Button variant="ghost" className="h-11 justify-start rounded-xl px-4" onClick={() => openAuth('login')}>
                            Ingresar
                          </Button>
                        </SheetClose>
                        <SheetClose asChild>
                          <Button className="h-11 rounded-xl px-4" onClick={() => openAuth('register')}>
                            Registrarme
                          </Button>
                        </SheetClose>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="inicio" className="pb-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="home-hero-shell overflow-hidden rounded-[2rem] shadow-xl">
            <div className="relative">
              <Swiper
                modules={[Autoplay, Navigation, Pagination]}
                pagination={{ clickable: true }}
                navigation={{
                  prevEl: '.home-hero-prev',
                  nextEl: '.home-hero-next',
                }}
                autoplay={{ delay: 5200, disableOnInteraction: false }}
                loop
                className="home-hero-swiper"
              >
                {heroSlides.map((slide) => (
                  <SwiperSlide key={slide.id}>
                    <div className={`relative min-h-[360px] overflow-hidden sm:min-h-[420px] lg:min-h-[480px] ${slide.fallbackClassName}`}>
                      {slide.imageUrl ? <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 h-full w-full object-cover" /> : null}
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,18,22,0.76)_0%,rgba(16,18,22,0.46)_44%,rgba(16,18,22,0.1)_100%)]" />

                      <div className="relative z-10 flex min-h-[360px] max-w-3xl flex-col justify-center gap-5 px-6 py-8 text-white sm:min-h-[420px] sm:px-10 lg:min-h-[480px] lg:px-14">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="secondary" className="rounded-full bg-white/18 px-4 py-1.5 text-white hover:bg-white/18">
                            {slide.eyebrow}
                          </Badge>
                          {slide.badge ? (
                            <div className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-foreground shadow-sm">
                              {slide.badge}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                            {slide.title}
                          </h1>
                          <p className="max-w-2xl text-base leading-7 text-white/84 sm:text-lg">{slide.description}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild className="h-11 rounded-full px-6">
                            <Link to={slide.primaryHref}>
                              {slide.primaryLabel}
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="h-11 rounded-full border-white/30 bg-white/12 px-6 text-white hover:bg-white/18 hover:text-white">
                            <Link to={slide.secondaryHref}>{slide.secondaryLabel}</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>

              <button type="button" className="home-hero-nav home-hero-prev" aria-label="Slide anterior">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" className="home-hero-nav home-hero-next" aria-label="Slide siguiente">
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="home-shortcuts-strip px-4 pb-4 sm:px-5 lg:px-6 lg:pb-6">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {heroShortcutItems.map(({ title, description, cta, href, icon: Icon }) => (
                  <a
                    key={title}
                    href={href}
                    className="home-shortcut-card group rounded-[1.75rem] bg-card/95 p-5 shadow-lg transition-transform hover:-translate-y-1"
                  >
                    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-7" />
                    </div>
                    <p className="text-xl font-semibold tracking-tight">{title}</p>
                    <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">{description}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                      {cta}
                      <ArrowRight className="size-4" />
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4 sm:px-5 lg:px-6 lg:pb-6">
              <div className="grid gap-3 rounded-[1.6rem] border border-border/70 bg-background/95 p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Busca por proveedor, servicio o ciudad</p>
                  <div className="mt-3 flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-3 shadow-sm">
                    <Search className="size-4 text-muted-foreground" />
                    <Input
                      value={marketplaceQuery}
                      onChange={(event) => setMarketplaceQuery(event.target.value)}
                      placeholder="Ej. remodelación, eléctrico, Monterrey"
                      className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Button asChild className="h-11 rounded-full px-5">
                  <a href="#servicios">Ver publicaciones</a>
                </Button>

                <div className="grid grid-cols-3 gap-2 lg:min-w-[260px]">
                  {marketplaceStats.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-center">
                      <p className="text-lg font-semibold tracking-tight">{item.value}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="categorias" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Categorías
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Explora por especialidad</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Menos bloques decorativos y más acceso directo a las áreas de servicio más buscadas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categories.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-border/60 bg-card/90 shadow-sm transition-transform hover:-translate-y-0.5">
                <CardContent className="space-y-4 p-5">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold tracking-tight">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="tiendas" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Tiendas y proveedores
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tiendas destacadas</h2>
          </div>

          {normalizedQuery && visibleStores.length === 0 ? (
            <Card className="border-border/60 bg-card/90 shadow-sm">
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                No se encontraron tiendas con esa búsqueda.
              </CardContent>
            </Card>
          ) : showStoresAsGrid ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleStores.map((store) => (
                <Card key={store.id} className="h-full border-border/60 bg-card/90 shadow-sm">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      {store.logoUrl ? (
                        <img src={store.logoUrl} alt={store.name} className="size-14 rounded-2xl border border-border/60 object-cover" />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Store className="size-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold tracking-tight">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{formatEntityTypeLabel(store.entityType)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      <span>{store.city}</span>
                    </div>

                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{store.description}</p>

                    {!store.isFallback ? (
                      <Button asChild variant="outline" className="mt-auto rounded-full">
                        <Link to={`/proveedores/${store.id}`}>Ver tienda</Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Swiper
              spaceBetween={16}
              slidesPerView={1.1}
              autoplay={{ delay: 4200, disableOnInteraction: false }}
              modules={[Autoplay]}
              breakpoints={{
                640: { slidesPerView: 1.5 },
                900: { slidesPerView: 2.2 },
                1200: { slidesPerView: 3.1 },
              }}
            >
              {visibleStores.map((store) => (
                <SwiperSlide key={store.id}>
                  <Card className="h-full border-border/60 bg-card/90 shadow-sm">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start gap-3">
                        {store.logoUrl ? (
                          <img src={store.logoUrl} alt={store.name} className="size-14 rounded-2xl border border-border/60 object-cover" />
                        ) : (
                          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Store className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold tracking-tight">{store.name}</p>
                          <p className="text-sm text-muted-foreground">{formatEntityTypeLabel(store.entityType)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>{store.city}</span>
                      </div>

                      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{store.description}</p>

                      {!store.isFallback ? (
                        <Button asChild variant="outline" className="mt-auto rounded-full">
                          <Link to={`/proveedores/${store.id}`}>Ver tienda</Link>
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </section>

        <section id="servicios" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Servicios y productos
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Publicaciones destacadas</h2>
          </div>

          {normalizedQuery && visibleProducts.length === 0 ? (
            <Card className="border-border/60 bg-card/90 shadow-sm">
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                No se encontraron servicios o productos con esa búsqueda.
              </CardContent>
            </Card>
          ) : showProductsAsGrid ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <Card key={product.id} className="h-full overflow-hidden border-border/60 bg-card/90 shadow-sm">
                  <div className="relative h-48 bg-[linear-gradient(135deg,#2d3d53_0%,#627792_100%)]">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,20,0.08)_0%,rgba(10,14,20,0.68)_100%)]" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <Badge variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                        {product.storeName}
                      </Badge>
                      <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-foreground shadow-sm">
                        {product.price}
                      </div>
                    </div>
                  </div>

                  <CardContent className="flex h-[calc(100%-12rem)] flex-col gap-4 p-5">
                    <div className="space-y-2">
                      <p className="line-clamp-2 text-lg font-semibold tracking-tight">{product.name}</p>
                      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{product.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="size-4" />
                      <span>{product.city || 'Cobertura publicada'}</span>
                    </div>

                    {!product.isFallback ? (
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button asChild className="rounded-full">
                          <Link to={`/productos/${product.id}`}>Ver publicación</Link>
                        </Button>
                        <Button asChild variant="outline" className="rounded-full">
                          <Link to={`/proveedores/${product.storeId}`}>Ver tienda</Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Swiper
              spaceBetween={16}
              slidesPerView={1.05}
              autoplay={{ delay: 4500, disableOnInteraction: false }}
              modules={[Autoplay]}
              breakpoints={{
                640: { slidesPerView: 1.4 },
                900: { slidesPerView: 2.2 },
                1200: { slidesPerView: 3.2 },
              }}
            >
              {visibleProducts.map((product) => (
                <SwiperSlide key={product.id}>
                  <Card className="h-full overflow-hidden border-border/60 bg-card/90 shadow-sm">
                    <div className="relative h-48 bg-[linear-gradient(135deg,#2d3d53_0%,#627792_100%)]">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,20,0.08)_0%,rgba(10,14,20,0.68)_100%)]" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                        <Badge variant="secondary" className="rounded-full bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                          {product.storeName}
                        </Badge>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-foreground shadow-sm">
                          {product.price}
                        </div>
                      </div>
                    </div>

                    <CardContent className="flex h-[calc(100%-12rem)] flex-col gap-4 p-5">
                      <div className="space-y-2">
                        <p className="line-clamp-2 text-lg font-semibold tracking-tight">{product.name}</p>
                        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{product.description}</p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="size-4" />
                        <span>{product.city || 'Cobertura publicada'}</span>
                      </div>

                      {!product.isFallback ? (
                        <div className="mt-auto flex flex-wrap gap-2">
                          <Button asChild className="rounded-full">
                            <Link to={`/productos/${product.id}`}>Ver publicación</Link>
                          </Button>
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to={`/proveedores/${product.storeId}`}>Ver tienda</Link>
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </section>

        <section id="acceso" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Acceso</p>
                <h3 className="text-2xl font-semibold tracking-tight">
                  {authUser ? 'Tu sesión está activa' : 'Ingresa o crea tu cuenta para publicar y operar'}
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {authUser
                    ? 'Puedes ir directo a tu panel y continuar con tus flujos de proveedor o comprador.'
                    : 'La portada quedó más limpia, pero el acceso a la plataforma sigue disponible cuando lo necesites.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {authUser ? (
                  <>
                    <Button asChild className="rounded-full px-5">
                      <a href={routeForUser(authUser)}>Ir a mi panel</a>
                    </Button>
                    <Button variant="outline" className="rounded-full px-5" onClick={handleLogout}>
                      Salir
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="rounded-full px-5" onClick={() => openAuth('login')}>
                      Ingresar
                    </Button>
                    <Button className="rounded-full px-5" onClick={() => openAuth('register')}>
                      Registrarme
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {showAuth || authUser ? (
          <AuthSection
            activeTab={authTab}
            onTabChange={setAuthTab}
            user={authUser}
            authReady={authReady}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
          />
        ) : null}
      </main>

      <footer id="contacto" className="border-t border-border/70 bg-background/95">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_300px] lg:px-8">
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Blocks className="size-5" />
                </div>
                <div>
                  <p className="font-semibold tracking-tight">GestorObras</p>
                  <p className="text-sm text-muted-foreground">Marketplace de servicios para construcción</p>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Portada simplificada para descubrir categorías, tiendas y publicaciones activas sin sobrecargar la experiencia inicial.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Servicios publicados
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Tiendas destacadas
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
              {footerGroups.map((group) => (
                <div key={group.title} className="space-y-4">
                  <p className="text-sm font-semibold tracking-tight">{group.title}</p>
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    {group.links.map((link) => (
                      <a key={link} className="transition-colors hover:text-foreground" href="#inicio">
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contacto</CardTitle>
              <CardDescription>Canales básicos del marketplace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-muted-foreground">Correo</p>
                  <a className="font-medium transition-colors hover:text-primary" href="mailto:contacto@gestorobras.com">
                    contacto@gestorobras.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-muted-foreground">Ubicación</p>
                  <p className="font-medium">Latam</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-border/70 px-4 py-5 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 GestorObras. Todos los derechos reservados.</span>
          <div className="flex flex-wrap gap-4">
            <a className="transition-colors hover:text-foreground" href="#contacto">
              Privacidad
            </a>
            <a className="transition-colors hover:text-foreground" href="#contacto">
              Términos
            </a>
            <a className="transition-colors hover:text-foreground" href="#contacto">
              Soporte
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
