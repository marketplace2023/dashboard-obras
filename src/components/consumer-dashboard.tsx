import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Blocks, ClipboardList, LoaderCircle, LogOut, MessageSquareQuote, PackageCheck, ShoppingCart, Star, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'
import { formatEntityTypeLabel, formatPrice } from '@/lib/public-marketplace'

type ConsumerDashboardProps = {
  user: AuthUser
  token: string
  onLogout: () => void
}

type DashboardSection = 'overview' | 'intents' | 'orders' | 'reviews'

type IntentItem = {
  id: string
  status?: string
  intent_type?: string
  vertical_type?: string
  created_at?: string
  payment_status?: string
  buyer_partner?: {
    id: string
    name?: string | null
  } | null
  store_partner?: {
    id: string
    name?: string | null
  } | null
  converted_order?: {
    id: string
  } | null
  items?: Array<{
    id: string
    product_name?: string | null
    qty?: string | number | null
    subtotal?: string | number | null
  }>
}

type OrderItem = {
  id: string
  status?: string
  payment_status?: string
  created_at?: string
  total_amount?: string
  currency_code?: string | null
  lines?: Array<{
    id: string
    name?: string | null
    qty?: string | number | null
    subtotal?: string | number | null
  }>
}

type ReviewItem = {
  id: string
  rating: string
  title?: string | null
  comment?: string | null
  created_at: string
  reply_comment?: string | null
  reply_created_at?: string | null
  partner_name?: string | null
  product_name?: string | null
  product_vertical_type?: string | null
}

type MessageState = { tone: 'success' | 'error'; text: string } | null

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof data === 'string' ? data : Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || 'No se pudo completar la solicitud')
  }

  return data as T
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}

function ConsumerDashboard({ user, token, onLogout }: ConsumerDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<MessageState>(null)
  const [intents, setIntents] = useState<IntentItem[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])

  const menuItems = [
    { key: 'overview' as const, label: 'Resumen', icon: ClipboardList },
    { key: 'intents' as const, label: 'Solicitudes', icon: ShoppingCart },
    { key: 'orders' as const, label: 'Órdenes', icon: PackageCheck },
    { key: 'reviews' as const, label: 'Mis reseñas', icon: MessageSquareQuote },
  ]

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const headers = { Authorization: `Bearer ${token}` }

        const [intentData, orderData, reviewData] = await Promise.all([
          parseApiResponse<{ data?: IntentItem[] }>(await fetch(`${API_BASE_URL}/intents/mine`, { headers })),
          parseApiResponse<{ data?: OrderItem[] }>(await fetch(`${API_BASE_URL}/orders`, { headers })),
          parseApiResponse<{ data?: ReviewItem[] }>(await fetch(`${API_BASE_URL}/ratings?reviewer_user_id=${user.id}&limit=50`, { headers })),
        ])

        if (!active) return
        setIntents(intentData.data ?? [])
        setOrders(orderData.data ?? [])
        setReviews(reviewData.data ?? [])
      } catch (error) {
        if (!active) return
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el panel customer.' })
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [token])

  const overviewStats = useMemo(
    () => [
      { label: 'Solicitudes activas', value: String(intents.length), icon: ShoppingCart },
      { label: 'Órdenes registradas', value: String(orders.length), icon: PackageCheck },
      { label: 'Reseñas realizadas', value: String(reviews.length), icon: Star },
      { label: 'Tipo de cuenta', value: 'customer', icon: UserRound },
    ],
    [intents.length, orders.length, reviews.length],
  )

  const recentActivity = useMemo(() => {
    return [
      ...intents.map((item) => ({
        id: `intent-${item.id}`,
        title: item.store_partner?.name || 'Solicitud a proveedor',
        subtitle: item.intent_type || 'Solicitud',
        status: item.status || 'draft',
        date: item.created_at,
      })),
      ...orders.map((item) => ({
        id: `order-${item.id}`,
        title: `Orden #${item.id}`,
        subtitle: item.payment_status || 'Pago pendiente',
        status: item.status || 'draft',
        date: item.created_at,
      })),
      ...reviews.map((item) => ({
        id: `review-${item.id}`,
        title: item.product_name || 'Reseña enviada',
        subtitle: item.partner_name || 'Proveedor',
        status: `${item.rating}/5`,
        date: item.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 6)
  }, [intents, orders, reviews])

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Blocks className="size-5" />
              </div>
              <div>
                <p className="font-semibold tracking-tight">Panel customer</p>
                <p className="text-sm text-muted-foreground">{user.username}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegación</SidebarGroupLabel>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton isActive={activeSection === item.key} onClick={() => setActiveSection(item.key)}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cuenta activa</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  customer
                </Badge>
                <Button variant="outline" size="sm" className="rounded-full" onClick={onLogout}>
                  <LogOut className="size-4" />
                  Salir
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <div className="shrink-0 border-b border-border/70 bg-background/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <p className="text-sm text-muted-foreground">Customer autenticado</p>
                  <h1 className="text-2xl font-semibold tracking-tight">{user.username}</h1>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  customer
                </Badge>
                <Badge className="rounded-full px-3 py-1">consumer</Badge>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
              {message ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-foreground'}`}>
                  {message.text}
                </div>
              ) : null}

              {loading ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardContent className="flex min-h-[280px] items-center justify-center gap-3 p-6 text-muted-foreground">
                    <LoaderCircle className="size-5 animate-spin" />
                    Cargando panel customer...
                  </CardContent>
                </Card>
              ) : null}

              {!loading && activeSection === 'overview' ? (
                <div className="grid gap-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {overviewStats.map((item) => {
                      const Icon = item.icon

                      return (
                        <Card key={item.label} className="border-border/60 bg-card/90 shadow-sm">
                          <CardContent className="space-y-3 p-5">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <Icon className="size-5" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{item.label}</p>
                              <p className="mt-1 text-xl font-semibold tracking-tight">{item.value}</p>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                    <Card className="border-border/60 bg-card/90 shadow-sm">
                      <CardHeader>
                        <CardTitle>Actividad reciente</CardTitle>
                        <CardDescription>Tus últimas solicitudes, órdenes y reseñas dentro del marketplace.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4">
                        {recentActivity.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                            Aún no tienes actividad registrada.
                          </div>
                        ) : (
                          recentActivity.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{item.status}</p>
                                  <p className="mt-1">{formatDateLabel(item.date)}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/90 shadow-sm">
                      <CardHeader>
                        <CardTitle>Accesos rápidos</CardTitle>
                        <CardDescription>Atajos a las áreas más importantes de tu cuenta.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        {[
                          { label: 'Ver solicitudes', onClick: () => setActiveSection('intents') },
                          { label: 'Ver órdenes', onClick: () => setActiveSection('orders') },
                          { label: 'Ver reseñas', onClick: () => setActiveSection('reviews') },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-left transition-colors hover:bg-muted/40"
                            onClick={item.onClick}
                          >
                            <p className="font-medium">{item.label}</p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}

              {!loading && activeSection === 'intents' ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Mis solicitudes</CardTitle>
                    <CardDescription>Solicitudes creadas desde `GET /api/intents/mine`.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {intents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        No tienes solicitudes creadas todavía.
                      </div>
                    ) : (
                      intents.map((intent) => (
                        <div key={intent.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold tracking-tight">Solicitud #{intent.id}</p>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                  {intent.status || 'draft'}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full px-3 py-1">
                                  {intent.payment_status || 'unpaid'}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                <span>Tipo: {intent.intent_type || 'quote_request'}</span>
                                <span>Vertical: {formatEntityTypeLabel(intent.vertical_type || 'contractor')}</span>
                                <span>Proveedor: {intent.store_partner?.name || 'No disponible'}</span>
                                <span>Fecha: {formatDateLabel(intent.created_at)}</span>
                              </div>
                            </div>
                            {intent.converted_order?.id ? (
                              <Badge className="rounded-full px-3 py-1">Convertida en orden</Badge>
                            ) : null}
                          </div>

                          {intent.items?.length ? (
                            <div className="mt-4 grid gap-3">
                              {intent.items.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="font-medium text-foreground">{item.product_name || 'Ítem sin nombre'}</p>
                                    <div className="flex flex-wrap gap-3 text-muted-foreground">
                                      <span>Cantidad: {item.qty || 1}</span>
                                      <span>Subtotal: {formatPrice(item.subtotal ?? 0)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {!loading && activeSection === 'orders' ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Mis órdenes</CardTitle>
                    <CardDescription>Órdenes vinculadas a tu cuenta desde `GET /api/orders`.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {orders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        No tienes órdenes registradas todavía.
                      </div>
                    ) : (
                      orders.map((order) => (
                        <div key={order.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold tracking-tight">Orden #{order.id}</p>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                  {order.status || 'draft'}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full px-3 py-1">
                                  {order.payment_status || 'pending'}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                <span>Fecha: {formatDateLabel(order.created_at)}</span>
                                <span>Total: {formatPrice(order.total_amount ?? 0, order.currency_code ?? 'USD')}</span>
                              </div>
                            </div>
                          </div>

                          {order.lines?.length ? (
                            <div className="mt-4 grid gap-3">
                              {order.lines.map((line) => (
                                <div key={line.id} className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="font-medium text-foreground">{line.name || 'Línea sin nombre'}</p>
                                    <div className="flex flex-wrap gap-3 text-muted-foreground">
                                      <span>Cantidad: {line.qty || 1}</span>
                                      <span>Subtotal: {formatPrice(line.subtotal ?? 0, order.currency_code ?? 'USD')}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {!loading && activeSection === 'reviews' ? (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Mis reseñas</CardTitle>
                    <CardDescription>Reseñas que has dejado en productos y servicios del marketplace.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {reviews.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        Aún no has dejado reseñas.
                      </div>
                    ) : (
                      reviews.map((review) => (
                        <div key={review.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold tracking-tight">{review.title || review.product_name || 'Reseña enviada'}</p>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                  {review.rating} / 5
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                <span>Proveedor: {review.partner_name || 'No disponible'}</span>
                                <span>Producto: {review.product_name || 'No disponible'}</span>
                                <span>Vertical: {formatEntityTypeLabel(review.product_vertical_type || 'contractor')}</span>
                                <span>Fecha: {formatDateLabel(review.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-primary">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star key={`${review.id}-${index}`} className={`size-4 ${index < Number(review.rating) ? 'fill-current' : ''}`} />
                              ))}
                            </div>
                          </div>

                          <p className="mt-4 text-sm leading-7 text-muted-foreground">{review.comment || 'Sin comentario adicional.'}</p>

                          {review.reply_comment ? (
                            <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <BadgeCheck className="size-4 text-primary" />
                                Respuesta del proveedor
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{formatDateLabel(review.reply_created_at)}</p>
                              <p className="mt-3 text-sm leading-7 text-muted-foreground">{review.reply_comment}</p>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                              Esta reseña todavía no tiene respuesta del proveedor.
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export { ConsumerDashboard }
