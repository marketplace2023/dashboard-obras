import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  ChartColumn,
  Clock3,
  HardHat,
  LayoutGrid,
  Mail,
  MapPin,
  Menu,
  PackageSearch,
  Phone,
  Store,
  Truck,
  WalletCards,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'

import './App.css'
import { AuthSection, type AuthTab } from '@/components/auth-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { API_BASE_URL, AUTH_STORAGE_KEY, type AuthSuccessPayload, type AuthUser } from '@/lib/auth'
import { routeForUser } from '@/lib/session'

type LinkItem = {
  label: string
  href: string
}

type Category = {
  title: string
  description: string
  icon: LucideIcon
}

type Benefit = {
  title: string
  description: string
  icon: LucideIcon
}

type Product = {
  title: string
  description: string
  className: string
}

type HeroSlide = {
  eyebrow: string
  title: string
  description: string
  metricLabel: string
  metricValue: string
  supportLabel: string
  supportValue: string
  tags: string[]
  icon: LucideIcon
  className: string
  accentClassName: string
}

const navItems: LinkItem[] = [
  { label: 'Soluciones', href: '#soluciones' },
  { label: 'Categorias', href: '#categorias' },
  { label: 'Marketplace', href: '#marketplace' },
  { label: 'Contacto', href: '#contacto' },
]

const brands = ['LATAM', 'Aceromex', 'TGJA', 'VECA', 'LUNDINGOLD']

const categories: Category[] = [
  {
    title: 'Obra gris',
    description: 'Concreto, acero, cimbra y suministro estructural.',
    icon: Building2,
  },
  {
    title: 'Instalaciones',
    description: 'Electrico, hidraulico, HVAC y sistemas especiales.',
    icon: Wrench,
  },
  {
    title: 'Acabados',
    description: 'Pisos, muros, carpinteria, pintura e interiorismo.',
    icon: LayoutGrid,
  },
  {
    title: 'Logistica de obra',
    description: 'Entrega coordinada por frente, etapa y ubicacion.',
    icon: Truck,
  },
]

const benefits: Benefit[] = [
  {
    title: 'Proveedores verificados',
    description: 'Homologacion por especialidad, capacidad y cobertura.',
    icon: BadgeCheck,
  },
  {
    title: 'Comparativos utiles',
    description: 'Visualiza costo, plazo y condiciones en un solo flujo.',
    icon: ChartColumn,
  },
  {
    title: 'Credito y pagos',
    description: 'Alternativas para no comprometer el avance del proyecto.',
    icon: WalletCards,
  },
  {
    title: 'Seguimiento operativo',
    description: 'Cada solicitud queda trazada desde la requisicion hasta la entrega.',
    icon: Clock3,
  },
]

const productTags = [
  'Concreto',
  'Acero',
  'Impermeabilizacion',
  'Tablaroca',
  'Iluminacion',
  'Banos y griferia',
  'Seguridad industrial',
  'Pisos y muros',
]

const products: Product[] = [
  {
    title: 'Luminarias tecnicas',
    description: 'Soluciones para interiores comerciales y corporativos.',
    className: 'md:col-span-3 md:row-span-2 bg-[linear-gradient(135deg,#6d4c1d_0%,#d6a04a_100%)]',
  },
  {
    title: 'Banos y acabados',
    description: 'Materiales para residencial, hoteleria y usos mixtos.',
    className: 'md:col-span-3 md:row-span-3 bg-[linear-gradient(135deg,#94806b_0%,#e6d2bb_100%)]',
  },
  {
    title: 'Mobiliario operativo',
    description: 'Sillas, estaciones de trabajo y equipamiento flexible.',
    className: 'md:col-span-3 md:row-span-2 bg-[linear-gradient(135deg,#55606c_0%,#97a4b1_100%)]',
  },
  {
    title: 'Cubiertas y fachadas',
    description: 'Sistemas de envolvente para ritmos acelerados de obra.',
    className: 'md:col-span-3 md:row-span-4 bg-[linear-gradient(135deg,#1f2a38_0%,#53657a_100%)]',
  },
  {
    title: 'Exterior y paisaje',
    description: 'Decks, pergolas y acabados para espacios exteriores.',
    className: 'md:col-span-3 md:row-span-2 bg-[linear-gradient(135deg,#536a4f_0%,#8ea987_100%)]',
  },
  {
    title: 'Agregados y concretos',
    description: 'Abasto continuo con control de entregas por etapa.',
    className: 'md:col-span-3 md:row-span-3 bg-[linear-gradient(135deg,#85725b_0%,#d3bea5_100%)]',
  },
]

const heroSlides: HeroSlide[] = [
  {
    eyebrow: 'Control de compras y ejecucion',
    title: 'Compras coordinadas para multiples frentes de obra',
    description: 'Consolida requisiciones, agrupa cotizaciones y prioriza entregas sin perder control operativo.',
    metricLabel: 'Proveedores activos',
    metricValue: '1,240+',
    supportLabel: 'Cotizaciones resueltas',
    supportValue: '48 h promedio',
    tags: ['Abasto por etapa', 'Comparativos utiles'],
    icon: HardHat,
    className: 'bg-[linear-gradient(160deg,hsl(215_23%_34%)_0%,hsl(217_28%_15%)_78%)]',
    accentClassName: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(163,174,188,0.92)_100%)]',
  },
  {
    eyebrow: 'Marketplace tecnico',
    title: 'Marketplace tecnico para materiales y servicios',
    description: 'Filtra por categoria, region o capacidad de respuesta y transforma exploracion en oportunidades reales.',
    metricLabel: 'Partidas disponibles',
    metricValue: '18,500+',
    supportLabel: 'Categorias activas',
    supportValue: '64 especialidades',
    tags: ['Busqueda por partida', 'Cobertura regional'],
    icon: Store,
    className: 'bg-[linear-gradient(160deg,hsl(206_32%_30%)_0%,hsl(220_31%_13%)_84%)]',
    accentClassName: 'bg-[linear-gradient(180deg,rgba(255,225,188,0.98)_0%,rgba(214,154,88,0.88)_100%)]',
  },
  {
    eyebrow: 'Seguimiento comercial',
    title: 'Seguimiento comercial y ahorro en tiempo real',
    description: 'Monitorea solicitudes, avances y oportunidades de ahorro desde una misma vista ejecutiva.',
    metricLabel: 'Ahorro detectado',
    metricValue: '-12%',
    supportLabel: 'Solicitudes activas',
    supportValue: '126 en proceso',
    tags: ['Alertas operativas', 'Visibilidad ejecutiva'],
    icon: ChartColumn,
    className: 'bg-[linear-gradient(160deg,hsl(220_18%_29%)_0%,hsl(226_24%_12%)_82%)]',
    accentClassName: 'bg-[linear-gradient(180deg,rgba(221,229,238,0.98)_0%,rgba(120,148,176,0.9)_100%)]',
  },
]

const footerGroups = [
  {
    title: 'Servicios',
    links: ['Marketplace de materiales', 'Gestion de compras', 'Homologacion de proveedores'],
  },
  {
    title: 'Compania',
    links: ['Sobre GestorObras', 'Casos de exito', 'Politica de servicio'],
  },
]

function App() {
  const navigate = useNavigate()
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

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
        if (active) {
          setAuthReady(true)
        }
      }
    }

    void hydrateSession()

    return () => {
      active = false
    }
  }, [])

  function handleAuthSuccess(payload: AuthSuccessPayload) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload.access_token)
    setAuthUser(payload.user)
    setAuthReady(true)
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
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href="#inicio">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Blocks className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">GestorObras</p>
              <p className="text-xs text-muted-foreground">Compras y abastecimiento</p>
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
                  <a href={routeForUser(authUser)}>{authUser.username}</a>
                </Button>
                <Button variant="outline" className="hidden h-10 rounded-full px-5 sm:inline-flex" onClick={handleLogout}>
                  Salir
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden lg:inline-flex">
                  <a href="#auth" onClick={() => setAuthTab('login')}>
                    Ingresar
                  </a>
                </Button>
                <Button asChild className="hidden h-10 rounded-full px-5 sm:inline-flex">
                  <a href="#auth" onClick={() => setAuthTab('register')}>
                    Registrarme
                  </a>
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
                    Navega la home y accede rapido a soluciones, categorias y contacto.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-8 grid gap-6">
                  <nav className="grid gap-2">
                    {navItems.map((item) => (
                      <SheetClose asChild key={item.label}>
                        <a
                          className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                          href={item.href}
                        >
                          <span>{item.label}</span>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </a>
                      </SheetClose>
                    ))}
                  </nav>

                  <Separator />

                  <div className="grid gap-3">
                    {authUser ? (
                      <>
                        <SheetClose asChild>
                          <Button asChild variant="ghost" className="h-11 justify-start rounded-xl px-4">
                            <a href={routeForUser(authUser)}>{authUser.username}</a>
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
                          <Button asChild variant="ghost" className="h-11 justify-start rounded-xl px-4">
                            <a href="#auth" onClick={() => setAuthTab('login')}>
                              Ingresar
                            </a>
                          </Button>
                        </SheetClose>
                        <SheetClose asChild>
                          <Button asChild className="h-11 rounded-xl px-4">
                            <a href="#auth" onClick={() => setAuthTab('register')}>
                              Registrarme
                            </a>
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

      <main id="inicio">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="hero-banner-wrapper overflow-hidden rounded-[2rem] shadow-2xl">
            <Swiper
              modules={[Autoplay, Pagination]}
              pagination={{ clickable: true }}
              autoplay={{ delay: 4500, disableOnInteraction: false }}
              loop
              className="hero-banner-swiper"
            >
              {heroSlides.map((slide) => {
                const Icon = slide.icon

                return (
                  <SwiperSlide key={slide.title}>
                    <Card className={`overflow-hidden border-border/60 text-white shadow-none ${slide.className}`}>
                      <CardContent className="relative min-h-[540px] p-0 sm:min-h-[580px]">
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,19,0.82)_0%,rgba(12,18,28,0.74)_38%,rgba(13,18,28,0.32)_100%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_26%)]" />

                        <div className="absolute inset-y-0 right-0 hidden w-[48%] lg:block">
                          <div className="absolute right-[6%] top-[10%] h-52 w-52 rounded-full bg-white/8 blur-3xl" />
                          <div className="absolute bottom-14 right-12 flex h-64 w-[72%] items-end gap-4">
                            {[24, 42, 56, 50, 38].map((height, index) => (
                              <div
                                key={`${slide.title}-banner-${height}-${index}`}
                                className={`flex-1 rounded-t-[2rem] border border-white/10 ${slide.accentClassName}`}
                                style={{ height: `${height}%` }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="relative z-10 flex h-full flex-col p-6 sm:p-8 lg:p-12">
                          <div className="flex items-start justify-between gap-4">
                            <Badge variant="secondary" className="rounded-full bg-white/10 px-4 py-1.5 text-white hover:bg-white/10">
                              {slide.eyebrow}
                            </Badge>

                            <div className="hidden max-w-[250px] rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-4 backdrop-blur md:block">
                              <p className="text-xs uppercase tracking-[0.24em] text-white/55">{slide.metricLabel}</p>
                              <p className="mt-2 text-2xl font-semibold">{slide.metricValue}</p>
                            </div>
                          </div>

                          <div className="mt-auto grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                            <div className="max-w-3xl space-y-6">
                              <div className="space-y-4">
                                <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur">
                                  <Icon className="size-6" />
                                </div>
                                <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                                  {slide.title}
                                </h1>
                                <p className="max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                                  {slide.description}
                                </p>
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row">
                                <Button asChild size="lg" className="h-11 rounded-full px-6">
                                  <a href="#soluciones">
                                    Explorar soluciones
                                    <ArrowRight className="size-4" />
                                  </a>
                                </Button>
                                <Button
                                  asChild
                                  size="lg"
                                  variant="outline"
                                  className="h-11 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                                >
                                  <a href="#marketplace">Ver marketplace</a>
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {slide.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-3 lg:pb-12">
                              <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 backdrop-blur">
                                <p className="text-sm text-white/65">{slide.supportLabel}</p>
                                <p className="mt-1 text-2xl font-semibold">{slide.supportValue}</p>
                              </div>
                              <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
                                <p className="text-sm text-white/65">Red de proveedores</p>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                                  {brands.slice(0, 4).map((brand) => (
                                    <span key={brand}>{brand}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </SwiperSlide>
                )
              })}
            </Swiper>
          </div>
        </section>

        <AuthSection
          activeTab={authTab}
          onTabChange={setAuthTab}
          user={authUser}
          authReady={authReady}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
        />

        <section id="categorias" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Categorias clave
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Abastecimiento por especialidad</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              La home ahora esta compuesta sobre primitives de shadcn para que el sistema visual sea
              consistente y escalable con el resto del producto.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categories.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-border/60 bg-card/80 shadow-sm transition-transform hover:-translate-y-0.5">
                <CardHeader className="space-y-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription className="text-sm leading-6">{description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="soluciones" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden border-border/60 bg-[linear-gradient(145deg,hsl(220_20%_15%)_0%,hsl(214_22%_10%)_100%)] text-white shadow-xl">
              <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div className="space-y-5">
                  <Badge variant="secondary" className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10">
                    GestorObras Concierge
                  </Badge>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Soporte experto para compras tecnicas y proyectos complejos.
                    </h2>
                    <p className="text-sm leading-6 text-white/72 sm:text-base">
                      Te acompanamos a definir alcances, solicitar propuestas utiles y cerrar con
                      proveedores confiables para cada frente de obra.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full bg-white/8 px-3 py-1 text-white hover:bg-white/8">
                      Comparativos guiados
                    </Badge>
                    <Badge variant="secondary" className="rounded-full bg-white/8 px-3 py-1 text-white hover:bg-white/8">
                      Acompanamiento comercial
                    </Badge>
                  </div>
                  <Button asChild className="h-11 w-fit rounded-full px-5">
                    <a href="#contacto">
                      Solicitar soporte
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                </div>
                <Card className="border-white/10 bg-white/6 shadow-none">
                  <CardContent className="space-y-4 p-5 text-sm text-white/75">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10">
                        <HardHat className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Mesa operativa</p>
                        <p>Respuesta comercial coordinada</p>
                      </div>
                    </div>
                    <Separator className="bg-white/10" />
                    <p>Ideal para partidas con multiples proveedores, urgencia o alta complejidad tecnica.</p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <Card id="marketplace" className="overflow-hidden border-border/60 bg-card/80 shadow-xl">
              <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div className="space-y-5">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Marketplace
                  </Badge>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Un catalogo vivo para materiales, servicios y equipamiento.
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                      Filtra por especialidad, region o capacidad de entrega y convierte la exploracion en
                      solicitudes listas para cotizar.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      Catalogo por partida
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      Filtros por ubicacion
                    </Badge>
                  </div>
                  <Button asChild variant="outline" className="h-11 w-fit rounded-full px-5">
                    <a href="#productos">Explorar productos</a>
                  </Button>
                </div>
                <div className="grid gap-3">
                  {['Acabados', 'Mobiliario', 'Instalaciones'].map((item) => (
                    <Card key={item} className="border-border/60 bg-muted/40 shadow-none">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                          <Store className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium tracking-tight">{item}</p>
                          <p className="text-sm text-muted-foreground">Disponibilidad y comparacion</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div className="space-y-4">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Por que funciona
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Pensado para compradores tecnicos, operaciones y direccion.
                </h2>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  En vez de una landing decorativa, la home ahora refleja el lenguaje del sistema: cards,
                  badges, inputs y separadores reutilizables.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {benefits.map(({ title, description, icon: Icon }) => (
                  <Card key={title} className="border-border/60 bg-background/80 shadow-none">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-medium tracking-tight">{title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="productos" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Productos destacados
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Navega por los frentes mas buscados del marketplace
            </h2>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                {productTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1 text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>

              <Separator />

              <div className="grid auto-rows-[110px] gap-4 md:grid-cols-12">
                {products.map((product) => (
                  <Card
                    key={product.title}
                    className={`relative overflow-hidden border-0 text-white shadow-lg ${product.className}`}
                  >
                    <CardContent className="flex h-full items-end p-5 sm:p-6">
                      <div className="space-y-2">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                          <PackageSearch className="size-4" />
                        </div>
                        <p className="text-lg font-semibold tracking-tight">{product.title}</p>
                        <p className="max-w-sm text-sm leading-6 text-white/80">{product.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="border-border/60 bg-muted/30 shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground sm:px-8">
              {brands.map((brand) => (
                <span key={brand}>{brand}</span>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer id="contacto" className="border-t border-border/70 bg-background/95">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_320px] lg:px-8">
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HardHat className="size-5" />
                </div>
                <div>
                  <p className="font-semibold tracking-tight">GestorObras</p>
                  <p className="text-sm text-muted-foreground">Gestion de compras para construccion</p>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Plataforma para coordinar compras, proveedores y ejecucion operativa en proyectos de
                construccion y mantenimiento.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  1,000+ proveedores validados
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Comparativos por partida
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
              {footerGroups.map((group) => (
                <div key={group.title} className="space-y-4">
                  <p className="text-sm font-semibold tracking-tight">{group.title}</p>
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    {group.links.map((link) => (
                      <a key={link} className="transition-colors hover:text-foreground" href="#contacto">
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <Mail className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Correo</p>
                    <a className="font-medium transition-colors hover:text-primary" href="mailto:contacto@gestorobras.com">
                      contacto@gestorobras.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Telefono</p>
                    <a className="font-medium transition-colors hover:text-primary" href="tel:+525500000000">
                      +52 55 0000 0000
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Ubicacion</p>
                    <p className="font-medium">Ciudad de Mexico, MX</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                  Siguiente paso
                </Badge>
                <div className="space-y-2">
                  <p className="text-xl font-semibold tracking-tight">Listo para centralizar tus compras de obra</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Agenda una demo y revisa como ordenar requisiciones, comparativos y seguimiento de
                    proveedores en un solo flujo.
                  </p>
                </div>
                <Button asChild className="h-11 w-full rounded-full">
                  <a href="#inicio">Volver arriba</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-border/70 px-4 py-5 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 GestorObras. Todos los derechos reservados.</span>
          <div className="flex flex-wrap gap-4">
            <a className="transition-colors hover:text-foreground" href="#contacto">
              Privacidad
            </a>
            <a className="transition-colors hover:text-foreground" href="#contacto">
              Terminos
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
