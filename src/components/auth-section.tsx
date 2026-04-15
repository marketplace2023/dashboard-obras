import { useMemo, useState } from 'react'
import { ArrowRight, Building2, LoaderCircle, LogOut, Store } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { API_BASE_URL, type AuthSuccessPayload, type AuthUser } from '@/lib/auth'

const roleOptions = [
  {
    value: 'consumer',
    label: 'Comprador',
    description: 'Para equipos que quieren comprar, comparar y coordinar proveedores.',
    icon: Building2,
  },
  {
    value: 'store',
    label: 'Proveedor',
    description: 'Para empresas que quieren publicar servicios o vender materiales.',
    icon: Store,
  },
] as const

const entityTypeOptions = [
  { value: 'contractor', label: 'Contratista' },
  { value: 'hardware_store', label: 'Ferreteria o tienda' },
  { value: 'professional_firm', label: 'Firma profesional' },
  { value: 'education_provider', label: 'Proveedor educativo' },
  { value: 'seo_agency', label: 'Agencia SEO' },
] as const

type AuthTab = 'login' | 'register'

type AuthSectionProps = {
  activeTab: AuthTab
  onTabChange: (value: AuthTab) => void
  user: AuthUser | null
  authReady: boolean
  onAuthSuccess: (payload: AuthSuccessPayload) => void
  onLogout: () => void
}

type MessageState = {
  tone: 'error' | 'success'
  text: string
} | null

async function parseApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    if (typeof data === 'string' && data.trim()) {
      throw new Error(data)
    }

    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || 'No se pudo completar la solicitud')
  }

  return data
}

function AuthSection({ activeTab, onTabChange, user, authReady, onAuthSuccess, onLogout }: AuthSectionProps) {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    country: 'Mexico',
    role: 'consumer',
    entity_type: 'contractor',
  })
  const [submittingTab, setSubmittingTab] = useState<AuthTab | null>(null)
  const [message, setMessage] = useState<MessageState>(null)

  const sessionRoleLabel = useMemo(() => {
    if (!user) return ''
    return user.role === 'store' ? 'Proveedor' : user.role === 'admin' ? 'Administrador' : 'Comprador'
  }, [user])

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittingTab('login')
    setMessage(null)

    try {
      const payload = await parseApiResponse(
        await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm),
        })
      )

      onAuthSuccess(payload as AuthSuccessPayload)
      setMessage({ tone: 'success', text: 'Sesion iniciada correctamente.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo iniciar sesion.' })
    } finally {
      setSubmittingTab(null)
    }
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (registerForm.password.length < 8) {
      setMessage({ tone: 'error', text: 'La contrasena debe tener al menos 8 caracteres.' })
      return
    }

    setSubmittingTab('register')
    setMessage(null)

    try {
      const payload = await parseApiResponse(
        await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...registerForm,
            entity_type: registerForm.role === 'store' ? registerForm.entity_type : undefined,
            phone: registerForm.phone || undefined,
            city: registerForm.city || undefined,
            country: registerForm.country || undefined,
          }),
        })
      )

      onAuthSuccess(payload as AuthSuccessPayload)
      setMessage({ tone: 'success', text: 'Cuenta creada correctamente. Ya puedes continuar.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' })
    } finally {
      setSubmittingTab(null)
    }
  }

  return (
    <section id="auth" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <Card className="border-border/60 bg-[linear-gradient(145deg,hsl(220_24%_17%)_0%,hsl(215_22%_11%)_100%)] text-white shadow-xl">
          <CardContent className="flex h-full flex-col justify-between gap-8 p-6 sm:p-8 lg:p-10">
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit rounded-full bg-white/10 px-4 py-1.5 text-white hover:bg-white/10">
                Acceso a la plataforma
              </Badge>
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                  Login y registro conectados al backend real.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                  Crea tu cuenta para operar como comprador o proveedor, y accede a la plataforma con tu
                  correo y contrasena.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['JWT activo', 'Autenticacion contra /api/auth'],
                  ['Sesion persistente', 'Se recupera automaticamente al recargar'],
                  ['Roles soportados', 'Comprador y proveedor'],
                  ['Registro guiado', 'Campos alineados con el backend'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur">
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/65">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              <span>API {API_BASE_URL}</span>
              <span>Login</span>
              <span>Register</span>
              <span>Perfil /me</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/90 shadow-xl">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Accede a GestorObras</CardTitle>
                <CardDescription>
                  {user ? 'Tu sesion esta activa y ya tienes acceso autenticado.' : 'Inicia sesion o crea una cuenta nueva.'}
                </CardDescription>
              </div>
              {user ? (
                <Badge className="rounded-full px-3 py-1">{sessionRoleLabel}</Badge>
              ) : null}
            </div>

            {message ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-foreground'}`}
              >
                {message.text}
              </div>
            ) : null}
          </CardHeader>

          <CardContent>
            {!authReady ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted/25 text-sm text-muted-foreground">
                Validando sesion guardada...
              </div>
            ) : user ? (
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Usuario</p>
                    <p className="mt-1 font-medium">{user.username}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Correo</p>
                    <p className="mt-1 font-medium break-all">{user.email}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Rol principal</p>
                    <p className="mt-1 font-medium">{sessionRoleLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Entidad</p>
                    <p className="mt-1 font-medium">{user.entity_type || 'customer'}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Sesion autenticada</p>
                    <p className="text-sm text-muted-foreground">
                      Ya puedes seguir conectando esta interfaz con el resto de flujos protegidos.
                    </p>
                  </div>
                  <Button variant="outline" className="h-11 rounded-full px-5" onClick={onLogout}>
                    <LogOut className="size-4" />
                    Cerrar sesion
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as AuthTab)}>
                <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                  <TabsTrigger value="login" className="rounded-xl">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-xl">
                    Registro
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form className="grid gap-4" onSubmit={handleLoginSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="login-email">Correo</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="correo@empresa.com"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="login-password">Contrasena</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="********"
                        value={loginForm.password}
                        onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                        required
                      />
                    </div>

                    <Button type="submit" className="mt-2 h-11 rounded-full" disabled={submittingTab === 'login'}>
                      {submittingTab === 'login' ? <LoaderCircle className="size-4 animate-spin" /> : null}
                      Iniciar sesion
                    </Button>

                    <p className="text-sm text-muted-foreground">
                      Si aun no tienes cuenta, cambia a la pestana de registro y crea tu acceso.
                    </p>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form className="grid gap-4" onSubmit={handleRegisterSubmit}>
                    <div className="grid gap-2">
                      <Label>Tipo de cuenta</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {roleOptions.map((option) => {
                          const Icon = option.icon
                          const selected = registerForm.role === option.value

                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-primary bg-primary/8' : 'border-border bg-background hover:bg-muted/40'}`}
                              onClick={() =>
                                setRegisterForm((current) => ({
                                  ...current,
                                  role: option.value,
                                  entity_type: option.value === 'store' ? current.entity_type : 'contractor',
                                }))
                              }
                            >
                              <div className="flex items-center gap-3">
                                <div className={`flex size-10 items-center justify-center rounded-xl ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                                  <Icon className="size-4" />
                                </div>
                                <div>
                                  <p className="font-medium">{option.label}</p>
                                  <p className="text-sm text-muted-foreground">{option.description}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="register-name">Nombre o empresa</Label>
                        <Input
                          id="register-name"
                          placeholder="Constructora Atlas"
                          value={registerForm.name}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="register-username">Usuario</Label>
                        <Input
                          id="register-username"
                          placeholder="atlas-compras"
                          value={registerForm.username}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="register-email">Correo</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="correo@empresa.com"
                          value={registerForm.email}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="register-password">Contrasena</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Minimo 8 caracteres"
                          value={registerForm.password}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="register-phone">Telefono</Label>
                        <Input
                          id="register-phone"
                          placeholder="+52 55 0000 0000"
                          value={registerForm.phone}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="register-city">Ciudad</Label>
                        <Input
                          id="register-city"
                          placeholder="Ciudad de Mexico"
                          value={registerForm.city}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, city: event.target.value }))}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="register-country">Pais</Label>
                        <Input
                          id="register-country"
                          placeholder="Mexico"
                          value={registerForm.country}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, country: event.target.value }))}
                        />
                      </div>
                    </div>

                    {registerForm.role === 'store' ? (
                      <div className="grid gap-2">
                        <Label htmlFor="register-entity-type">Tipo de proveedor</Label>
                        <select
                          id="register-entity-type"
                          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-3"
                          value={registerForm.entity_type}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, entity_type: event.target.value }))}
                        >
                          {entityTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <Button type="submit" className="mt-2 h-11 rounded-full" disabled={submittingTab === 'register'}>
                      {submittingTab === 'register' ? <LoaderCircle className="size-4 animate-spin" /> : null}
                      Crear cuenta
                      <ArrowRight className="size-4" />
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export { AuthSection }
export type { AuthTab }
