import { useEffect, useState } from 'react'
import { Blocks, ClipboardList, LoaderCircle, LogOut, PackageCheck, ShoppingCart, UserRound } from 'lucide-react'

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

type ConsumerDashboardProps = {
  user: AuthUser
  token: string
  onLogout: () => void
}

type DashboardSection = 'overview' | 'intents' | 'orders'

type IntentItem = {
  id: string
  status?: string
  intent_type?: string
  vertical_type?: string
  created_at?: string
}

type OrderItem = {
  id: string
  status?: string
  payment_status?: string
  created_at?: string
  total_amount?: string
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

function ConsumerDashboard({ user, token, onLogout }: ConsumerDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<MessageState>(null)
  const [intents, setIntents] = useState<IntentItem[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])

  const menuItems = [
    { key: 'overview' as const, label: 'Resumen', icon: ClipboardList },
    { key: 'intents' as const, label: 'Mis solicitudes', icon: ShoppingCart },
    { key: 'orders' as const, label: 'Mis ordenes', icon: PackageCheck },
  ]

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const headers = { Authorization: `Bearer ${token}` }

        const [intentData, orderData] = await Promise.all([
          parseApiResponse<{ data?: IntentItem[] } | IntentItem[]>(await fetch(`${API_BASE_URL}/intents/mine`, { headers })),
          parseApiResponse<{ data?: OrderItem[] } | OrderItem[]>(await fetch(`${API_BASE_URL}/orders`, { headers })),
        ])

        if (!active) return
        setIntents(Array.isArray(intentData) ? intentData : intentData.data ?? [])
        setOrders(Array.isArray(orderData) ? orderData : orderData.data ?? [])
      } catch (error) {
        if (!active) return
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el panel consumidor.' })
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [token])

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Blocks className="size-5" />
              </div>
              <div>
                <p className="font-semibold tracking-tight">Panel consumidor</p>
                <p className="text-sm text-muted-foreground">{user.username}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
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
            <Button variant="outline" className="rounded-full" onClick={onLogout}>
              <LogOut className="size-4" />
              Salir
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <div className="border-b border-border/70 bg-background/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <p className="text-sm text-muted-foreground">Comprador autenticado</p>
                  <h1 className="text-2xl font-semibold tracking-tight">{user.username}</h1>
                </div>
              </div>
              <Badge className="rounded-full px-3 py-1">consumer</Badge>
            </div>
          </div>

          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {message ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-foreground'}`}>
                {message.text}
              </div>
            ) : null}

            {loading ? (
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardContent className="flex min-h-[260px] items-center justify-center gap-3 p-6 text-muted-foreground">
                  <LoaderCircle className="size-5 animate-spin" />
                  Cargando panel consumidor...
                </CardContent>
              </Card>
            ) : null}

            {!loading && activeSection === 'overview' ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Solicitudes activas', value: String(intents.length), icon: ShoppingCart },
                  { label: 'Ordenes registradas', value: String(orders.length), icon: PackageCheck },
                  { label: 'Tipo de cuenta', value: 'consumer', icon: UserRound },
                ].map((item) => {
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
            ) : null}

            {!loading && activeSection === 'intents' ? (
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Mis solicitudes</CardTitle>
                  <CardDescription>Listado obtenido desde `GET /api/intents/mine`.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {intents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      No hay solicitudes creadas todavia.
                    </div>
                  ) : (
                    intents.map((intent) => (
                      <div key={intent.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="font-medium">Intent #{intent.id}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span>Estado: {intent.status || 'draft'}</span>
                          <span>Tipo: {intent.intent_type || 'quote'}</span>
                          <span>Vertical: {intent.vertical_type || 'general'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {!loading && activeSection === 'orders' ? (
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Mis ordenes</CardTitle>
                  <CardDescription>Listado obtenido desde `GET /api/orders`.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {orders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      No hay ordenes registradas todavia.
                    </div>
                  ) : (
                    orders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="font-medium">Orden #{order.id}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span>Estado: {order.status || 'draft'}</span>
                          <span>Pago: {order.payment_status || 'pending'}</span>
                          <span>Total: {order.total_amount || 'N/A'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export { ConsumerDashboard }
