import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Blocks,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  PackagePlus,
  PencilLine,
  Save,
  ShieldCheck,
  Store,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'
import { ProjectsManagementPanel } from '@/components/projects-management-panel'
import { PartidasPanelWithBoundary } from '@/components/partidas-panel'
import { MaestrosPanel } from '@/components/maestros-panel'
import { CierreObraPanel } from '@/components/cierre-obra-panel'
import { MemoriasDescriptivasPanel } from '@/components/memorias-descriptivas-panel'
import { ReportesConsolidadosPanel } from '@/components/reportes-consolidados-panel'
import { PresupuestosSinApuPanel } from '@/components/presupuestos-sin-apu-panel'
import { PresupuestosAumentosPanel } from '@/components/presupuestos-aumentos-panel'
import { PresupuestosDisminucionesPanel } from '@/components/presupuestos-disminuciones-panel'
import { ControlMedicionesPanel } from '@/components/control-mediciones-panel'
import { ComputosMetricosPanel } from '@/components/computos-metricos-panel'
import { ObrasExtrasPanel } from '@/components/obras-extras-panel'
import { ReconsideracionPreciosPanel } from '@/components/reconsideracion-precios-panel'
import { ValuacionesPanel } from '@/components/valuaciones-panel'

type ProviderDashboardProps = {
  user: AuthUser
  token: string
  onLogout: () => void
}

type DashboardSection =
  | 'overview'
  | 'projects'
  | 'partidas'
  | 'presupuestos-sin-apu'
  | 'presupuestos-aumentos'
  | 'presupuestos-disminuciones'
  | 'obras-extras'
  | 'memorias-descriptivas'
  | 'reportes-consolidados'
  | 'cierre-obra'
  | 'control-mediciones'
  | 'valuaciones'
  | 'reconsideracion-precios'
  | 'computos-metricos'
  | 'profile'
  | 'catalog'
  | 'master-materiales'
  | 'master-equipos'
  | 'master-mano-obra'
  | 'master-partidas'

type StoreResponse = {
  id: string
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
  x_verification_status?: string | null
  updated_at?: string
  attributes_json?: {
    promo_images?: string[]
  } | null
  profile?: {
    service_area_type?: string | null
    coverage_radius_km?: string | number | null
    license_number?: string | null
    insurance_verified?: number | boolean | null
    emergency_service?: number | boolean | null
  } | null
}

type ProductItem = {
  id: string
  name: string
  listing_type: string
  vertical_type: string
  list_price: string
  is_published: number
  created_at: string
  cover_image_url?: string | null
}

type ProductDetail = ProductItem & {
  description_sale?: string | null
  compare_price?: string | null
  x_attributes_json?: Record<string, unknown> | null
  extension?: {
    service_type?: string | null
    delivery_mode?: string | null
    estimated_duration_hours?: string | number | null
    materials_included?: number | boolean | null
    quote_required?: number | boolean | null
    site_visit_required?: number | boolean | null
  } | null
  images?: Array<{
    image_url: string
    is_cover?: number | boolean
  }>
}

type StoreFormState = {
  name: string
  legal_name: string
  email: string
  phone: string
  website: string
  logo_url: string
  description: string
  street: string
  city: string
  state: string
  country: string
  zip: string
  service_area_type: string
  coverage_radius_km: string
  license_number: string
  insurance_verified: boolean
  emergency_service: boolean
  promo_images: string[]
}

type ProductFormState = {
  name: string
  description_sale: string
  list_price: string
  compare_price: string
  cover_image_url: string
  service_type: string
  delivery_mode: string
  estimated_duration_hours: string
  materials_included: boolean
  quote_required: boolean
  site_visit_required: boolean
  sku: string
  stock: string
}

type MessageState = { tone: 'success' | 'error'; text: string } | null

const validSellerEntityTypes = new Set([
  'contractor',
  'education_provider',
  'hardware_store',
  'professional_firm',
  'seo_agency',
])

function resolveProductVerticalType(entityType: string) {
  return validSellerEntityTypes.has(entityType) ? entityType : 'contractor'
}

const defaultStoreForm: StoreFormState = {
  name: '',
  legal_name: '',
  email: '',
  phone: '',
  website: '',
  logo_url: '',
  description: '',
  street: '',
  city: '',
  state: '',
  country: '',
  zip: '',
  service_area_type: '',
  coverage_radius_km: '',
  license_number: '',
  insurance_verified: false,
  emergency_service: false,
  promo_images: [],
}

const defaultProductForm: ProductFormState = {
  name: '',
  description_sale: '',
  list_price: '',
  compare_price: '',
  cover_image_url: '',
  service_type: 'instalacion',
  delivery_mode: 'on_site',
  estimated_duration_hours: '',
  materials_included: false,
  quote_required: true,
  site_visit_required: false,
  sku: '',
  stock: '0',
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof data === 'string' ? data : Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || 'No se pudo completar la solicitud')
  }

  return data as T
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function ProviderDashboard({ user, token, onLogout }: ProviderDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [maestrosOpen, setMaestrosOpen] = useState(true)
  const [obrasOpen, setObrasOpen] = useState(false)
  const [selectedObraFromProjects, setSelectedObraFromProjects] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPromoImages, setUploadingPromoImages] = useState(false)
  const [uploadingProductImages, setUploadingProductImages] = useState(false)
  const [storeData, setStoreData] = useState<StoreResponse | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [storeForm, setStoreForm] = useState<StoreFormState>(defaultStoreForm)
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm)
  const [productImages, setProductImages] = useState<string[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [message, setMessage] = useState<MessageState>(null)

  const staticMenuItems = [
    { key: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
    { key: 'profile' as const, label: 'Perfil proveedor', icon: UserRound },
    { key: 'catalog' as const, label: 'Productos y servicios', icon: PackagePlus },
  ]

  const verificationLabel = useMemo(() => {
    if (!storeData?.x_verification_status) return 'draft'
    return storeData.x_verification_status
  }, [storeData])

  const validSections = useMemo<DashboardSection[]>(
    () => [
      'overview',
      'projects',
      'partidas',
      'presupuestos-sin-apu',
      'presupuestos-aumentos',
      'presupuestos-disminuciones',
      'obras-extras',
      'memorias-descriptivas',
      'reportes-consolidados',
      'cierre-obra',
      'control-mediciones',
      'valuaciones',
      'reconsideracion-precios',
      'computos-metricos',
      'profile',
      'catalog',
      'master-materiales',
      'master-equipos',
      'master-mano-obra',
      'master-partidas',
    ],
    [],
  )

  useEffect(() => {
    const requested = searchParams.get('section')
    if (!requested) return
    if (validSections.includes(requested as DashboardSection)) {
      setActiveSection(requested as DashboardSection)
    }
  }, [searchParams, validSections])

  useEffect(() => {
    const current = searchParams.get('section')
    if (current === activeSection) return
    const next = new URLSearchParams(searchParams)
    next.set('section', activeSection)
    setSearchParams(next, { replace: true })
  }, [activeSection, searchParams, setSearchParams])

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        }

        const [store, productList] = await Promise.all([
          parseApiResponse<StoreResponse>(await fetch(`${API_BASE_URL}/stores/${user.partner_id}`, { headers })),
          parseApiResponse<{ data: ProductItem[] }>(await fetch(`${API_BASE_URL}/stores/${user.partner_id}/products`, { headers })),
        ])

        if (!active) return

        setStoreData(store)
        setProducts(productList.data ?? [])
        setStoreForm({
          name: store.name ?? '',
          legal_name: store.legal_name ?? '',
          email: store.email ?? '',
          phone: store.phone ?? '',
          website: store.website ?? '',
          logo_url: store.logo_url ?? '',
          description: store.description ?? '',
          street: store.street ?? '',
          city: store.city ?? '',
          state: store.state ?? '',
          country: store.country ?? '',
          zip: store.zip ?? '',
          service_area_type: store.profile?.service_area_type ?? '',
          coverage_radius_km: store.profile?.coverage_radius_km != null ? String(store.profile.coverage_radius_km) : '',
          license_number: store.profile?.license_number ?? '',
          insurance_verified: toBoolean(store.profile?.insurance_verified),
          emergency_service: toBoolean(store.profile?.emergency_service),
          promo_images: Array.isArray(store.attributes_json?.promo_images) ? store.attributes_json?.promo_images.filter((item): item is string => typeof item === 'string' && item.length > 0) : [],
        })
      } catch (error) {
        if (!active) return
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el dashboard.' })
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [token, user.partner_id])

  async function refreshProducts() {
    const data = await parseApiResponse<{ data: ProductItem[] }>(
      await fetch(`${API_BASE_URL}/stores/${user.partner_id}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    setProducts(data.data ?? [])
  }

  function resetProductComposer() {
    setEditingProductId(null)
    setProductForm(defaultProductForm)
    setProductImages([])
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await parseApiResponse<{ data: { url: string } }>(
        await fetch(`${API_BASE_URL}/stores/upload-logo`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      )

      setStoreForm((current) => ({ ...current, logo_url: response.data.url }))
      setMessage({ tone: 'success', text: 'Logo cargado correctamente.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo subir el logo.' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleProductImagesUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploadingProductImages(true)
    setMessage(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('files', file))

      const response = await parseApiResponse<{ data: Array<{ url: string }> }>(
        await fetch(`${API_BASE_URL}/products/upload-images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      )

      const urls = response.data.map((item) => item.url)
      setProductImages((current) => {
        const next = [...current, ...urls].filter((url, index, list) => list.indexOf(url) === index)
        if (!productForm.cover_image_url && next[0]) {
          setProductForm((form) => ({ ...form, cover_image_url: next[0] }))
        }
        return next
      })
      setMessage({ tone: 'success', text: 'Imagenes cargadas correctamente.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron subir las imagenes.' })
    } finally {
      setUploadingProductImages(false)
    }
  }

  async function handlePromoImagesUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploadingPromoImages(true)
    setMessage(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('files', file))

      const response = await parseApiResponse<{ data: Array<{ url: string }> }>(
        await fetch(`${API_BASE_URL}/stores/upload-images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      )

      const urls = response.data.map((item) => item.url)
      setStoreForm((current) => ({
        ...current,
        promo_images: [...current.promo_images, ...urls].filter((url, index, list) => list.indexOf(url) === index),
      }))
      setMessage({ tone: 'success', text: 'Imagenes promocionales cargadas correctamente.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron subir las imagenes promocionales.' })
    } finally {
      setUploadingPromoImages(false)
    }
  }

  async function handleEditProduct(productId: string) {
    setMessage(null)

    try {
      const product = await parseApiResponse<ProductDetail>(
        await fetch(`${API_BASE_URL}/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      )

      const galleryImages = (product.images ?? []).map((image) => image.image_url)
      setEditingProductId(product.id)
      setProductImages(galleryImages)
      setProductForm({
        name: product.name ?? '',
        description_sale: product.description_sale ?? '',
        list_price: product.list_price ? String(product.list_price) : '',
        compare_price: product.compare_price ? String(product.compare_price) : '',
        cover_image_url: product.cover_image_url ?? galleryImages[0] ?? '',
        service_type: product.extension?.service_type ?? 'instalacion',
        delivery_mode: product.extension?.delivery_mode ?? 'on_site',
        estimated_duration_hours: product.extension?.estimated_duration_hours != null ? String(product.extension.estimated_duration_hours) : '',
        materials_included: toBoolean(product.extension?.materials_included),
        quote_required: toBoolean(product.extension?.quote_required),
        site_visit_required: toBoolean(product.extension?.site_visit_required),
        sku: typeof product.x_attributes_json?.sku === 'string' ? product.x_attributes_json.sku : '',
        stock: product.x_attributes_json?.stock != null ? String(product.x_attributes_json.stock) : '0',
      })
      navigateSection('catalog')
      setMessage({ tone: 'success', text: 'Producto cargado para edicion.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el producto.' })
    }
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    setMessage(null)

    try {
      const payload = {
        ...storeForm,
        coverage_radius_km: storeForm.coverage_radius_km ? Number(storeForm.coverage_radius_km) : undefined,
        attributes_json: {
          promo_images: storeForm.promo_images,
        },
      }

      const updated = await parseApiResponse<StoreResponse>(
        await fetch(`${API_BASE_URL}/stores/${user.partner_id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      )

      setStoreData(updated)
      setMessage({ tone: 'success', text: 'Perfil actualizado correctamente.' })
      navigateSection('overview')
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el perfil.' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreatingProduct(true)
    setMessage(null)

    try {
      const productVerticalType = resolveProductVerticalType(user.entity_type)
      const listingType = productVerticalType === 'hardware_store' ? 'product' : 'service'
      const payload = {
        name: productForm.name,
        description_sale: productForm.description_sale || undefined,
        list_price: Number(productForm.list_price),
        compare_price: productForm.compare_price ? Number(productForm.compare_price) : undefined,
        cover_image_url: productForm.cover_image_url || productImages[0] || undefined,
        service_type: productForm.service_type || undefined,
        delivery_mode: productForm.delivery_mode || undefined,
        estimated_duration_hours: productForm.estimated_duration_hours ? Number(productForm.estimated_duration_hours) : undefined,
        materials_included: productForm.materials_included,
        quote_required: productForm.quote_required,
        site_visit_required: productForm.site_visit_required,
        x_attributes_json: {
          sku: productForm.sku || undefined,
          stock: Number(productForm.stock || 0),
          gallery_images: productImages,
        },
      }

      await parseApiResponse(
        await fetch(`${API_BASE_URL}/products${editingProductId ? `/${editingProductId}` : ''}`, {
          method: editingProductId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            editingProductId
              ? payload
              : {
                  listing_type: listingType,
                  vertical_type: productVerticalType,
                  type: listingType === 'product' ? 'product' : 'service',
                  ...payload,
                }
          ),
        })
      )

      await refreshProducts()
      resetProductComposer()
      setMessage({ tone: 'success', text: editingProductId ? 'Producto o servicio actualizado correctamente.' : 'Producto o servicio creado correctamente.' })
      navigateSection('catalog')
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el producto o servicio.' })
    } finally {
      setCreatingProduct(false)
    }
  }

  async function handleTogglePublish(product: ProductItem) {
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/products/${product.id}/${product.is_published ? 'unpublish' : 'publish'}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      )

      await refreshProducts()
      setMessage({ tone: 'success', text: `Publicacion ${product.is_published ? 'desactivada' : 'activada'} correctamente.` })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar la publicacion.' })
    }
  }

  function handleOpenProjectBudget(project: { id: string; nombre: string }, target: 'partidas' | 'presupuestos-sin-apu' | 'presupuestos-aumentos' | 'presupuestos-disminuciones' | 'obras-extras' | 'memorias-descriptivas' | 'reportes-consolidados' | 'cierre-obra' | 'control-mediciones' | 'valuaciones' | 'computos-metricos' | 'reconsideracion-precios' = 'partidas') {
    setSelectedObraFromProjects(project.id)
    setObrasOpen(true)
    setActiveSection(target)
    setMessage({
      tone: 'success',
      text:
        target === 'partidas'
          ? `Proyecto ${project.nombre} listo para cargar presupuesto con APU.`
          : target === 'presupuestos-sin-apu'
            ? `Proyecto ${project.nombre} listo para cargar presupuesto sin A.P.U.`
            : target === 'presupuestos-aumentos'
              ? `Proyecto ${project.nombre} listo para cargar presupuesto de aumentos.`
              : target === 'presupuestos-disminuciones'
                ? `Proyecto ${project.nombre} listo para cargar presupuesto de disminuciones.`
                : target === 'obras-extras'
                  ? `Proyecto ${project.nombre} listo para cargar obras extras.`
                : target === 'memorias-descriptivas'
                  ? `Proyecto ${project.nombre} listo para cargar memorias descriptivas.`
                : target === 'reportes-consolidados'
                  ? `Proyecto ${project.nombre} listo para consultar reportes consolidados.`
                : target === 'cierre-obra'
                  ? `Proyecto ${project.nombre} listo para revisar cierre de obra.`
                : target === 'control-mediciones'
                  ? `Proyecto ${project.nombre} listo para cargar control de mediciones.`
                  : target === 'valuaciones'
                    ? `Proyecto ${project.nombre} listo para cargar valuaciones.`
                    : target === 'reconsideracion-precios'
                      ? `Proyecto ${project.nombre} listo para cargar reconsideración de precios.`
                   : `Proyecto ${project.nombre} listo para cargar cómputos métricos.`,
    })
  }

  function navigateSection(section: DashboardSection) {
    setActiveSection(section)
  }

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
                <p className="font-semibold tracking-tight">Panel proveedor</p>
                <p className="text-sm text-muted-foreground">{storeData?.name || user.username}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
            <SidebarMenu>
                {/* Gestión de obras — con submenu */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={
                      activeSection === 'master-materiales' ||
                      activeSection === 'master-equipos' ||
                      activeSection === 'master-mano-obra' ||
                      activeSection === 'master-partidas'
                    }
                    onClick={() => setMaestrosOpen((open) => !open)}
                  >
                    <Blocks className="size-4" />
                    <span className="flex-1">Maestros</span>
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${maestrosOpen ? 'rotate-180' : ''}`}
                    />
                  </SidebarMenuButton>

                  {maestrosOpen ? (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'master-materiales'}
                          onClick={() => navigateSection('master-materiales')}
                        >
                          Materiales
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'master-equipos'}
                          onClick={() => navigateSection('master-equipos')}
                        >
                          Equipos
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'master-mano-obra'}
                          onClick={() => navigateSection('master-mano-obra')}
                        >
                          Mano de Obra
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'master-partidas'}
                          onClick={() => navigateSection('master-partidas')}
                        >
                          Partidas
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeSection === 'projects' || activeSection === 'partidas' || activeSection === 'presupuestos-sin-apu' || activeSection === 'presupuestos-aumentos' || activeSection === 'presupuestos-disminuciones' || activeSection === 'obras-extras' || activeSection === 'memorias-descriptivas' || activeSection === 'reportes-consolidados' || activeSection === 'cierre-obra' || activeSection === 'control-mediciones' || activeSection === 'valuaciones' || activeSection === 'reconsideracion-precios' || activeSection === 'computos-metricos'}
                    onClick={() => setObrasOpen((open) => !open)}
                  >
                    <Building2 className="size-4" />
                    <span className="flex-1">Gestión de obras</span>
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${obrasOpen ? 'rotate-180' : ''}`}
                    />
                  </SidebarMenuButton>

                  {obrasOpen ? (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'projects'}
                          onClick={() => navigateSection('projects')}
                        >
                          <FolderOpen className="size-3.5" />
                          Mis proyectos
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'partidas'}
                          onClick={() => navigateSection('partidas')}
                        >
                          <ListChecks className="size-3.5" />
                          Presupuestos con A.P.U.
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'presupuestos-sin-apu'}
                          onClick={() => navigateSection('presupuestos-sin-apu')}
                        >
                          <ListChecks className="size-3.5" />
                          Presupuestos sin A.P.U.
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'presupuestos-aumentos'}
                          onClick={() => navigateSection('presupuestos-aumentos')}
                        >
                          <ClipboardList className="size-3.5" />
                          Presupuestos de Aumentos
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'presupuestos-disminuciones'}
                          onClick={() => navigateSection('presupuestos-disminuciones')}
                        >
                          <ClipboardList className="size-3.5" />
                          Presupuestos de Disminuciones
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'obras-extras'}
                          onClick={() => navigateSection('obras-extras')}
                        >
                          <ClipboardList className="size-3.5" />
                          Obras Extras
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'memorias-descriptivas'}
                          onClick={() => navigateSection('memorias-descriptivas')}
                        >
                          <FileText className="size-3.5" />
                          Memorias Descriptivas
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'reportes-consolidados'}
                          onClick={() => navigateSection('reportes-consolidados')}
                        >
                          <FileText className="size-3.5" />
                          Reportes Consolidados
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'cierre-obra'}
                          onClick={() => navigateSection('cierre-obra')}
                        >
                          <FileText className="size-3.5" />
                          Cierre de Obra
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'control-mediciones'}
                          onClick={() => navigateSection('control-mediciones')}
                        >
                          <ClipboardList className="size-3.5" />
                          Control de Mediciones
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'valuaciones'}
                          onClick={() => navigateSection('valuaciones')}
                        >
                          <ClipboardList className="size-3.5" />
                          Valuaciones
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'reconsideracion-precios'}
                          onClick={() => navigateSection('reconsideracion-precios')}
                        >
                          <ClipboardList className="size-3.5" />
                          Reconsideración de Precios
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeSection === 'computos-metricos'}
                          onClick={() => navigateSection('computos-metricos')}
                        >
                          <Calculator className="size-3.5" />
                          Cómputos Métricos
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>

                {/* Resto del menú estático */}
                {staticMenuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={activeSection === item.key}
                        onClick={() => navigateSection(item.key)}
                      >
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
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Estado de cuenta</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {verificationLabel}
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
                  <p className="text-sm text-muted-foreground">Proveedor autenticado</p>
                  <h1 className="text-2xl font-semibold tracking-tight">{storeData?.name || user.username}</h1>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {user.entity_type}
                </Badge>
                <Badge className="rounded-full px-3 py-1">{user.role}</Badge>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            {message ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-foreground'}`}>
                {message.text}
              </div>
            ) : null}

            {loading ? (
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardContent className="flex min-h-[320px] items-center justify-center gap-3 p-6 text-muted-foreground">
                  <LoaderCircle className="size-5 animate-spin" />
                  Cargando panel del proveedor...
                </CardContent>
              </Card>
            ) : null}

            {!loading && activeSection === 'projects' ? (
              <ProjectsManagementPanel user={user} token={token} onMessage={setMessage} onOpenBudget={handleOpenProjectBudget} />
            ) : null}

            {!loading && activeSection === 'partidas' ? (
              <PartidasPanelWithBoundary user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'presupuestos-sin-apu' ? (
              <PresupuestosSinApuPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'presupuestos-aumentos' ? (
              <PresupuestosAumentosPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'presupuestos-disminuciones' ? (
              <PresupuestosDisminucionesPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'obras-extras' ? (
              <ObrasExtrasPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'memorias-descriptivas' ? (
              <MemoriasDescriptivasPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'reportes-consolidados' ? (
              <ReportesConsolidadosPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'cierre-obra' ? (
              <CierreObraPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'control-mediciones' ? (
              <ControlMedicionesPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'valuaciones' ? (
              <ValuacionesPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'reconsideracion-precios' ? (
              <ReconsideracionPreciosPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && activeSection === 'computos-metricos' ? (
              <ComputosMetricosPanel user={user} token={token} onMessage={setMessage} initialObraId={selectedObraFromProjects ?? undefined} />
            ) : null}

            {!loading && (
              activeSection === 'master-materiales' ||
              activeSection === 'master-equipos' ||
              activeSection === 'master-mano-obra' ||
              activeSection === 'master-partidas'
            ) ? (
              <MaestrosPanel
                user={user}
                token={token}
                onMessage={setMessage}
                initialSection={
                  activeSection === 'master-materiales'
                    ? 'materiales'
                    : activeSection === 'master-equipos'
                      ? 'equipos'
                      : activeSection === 'master-mano-obra'
                        ? 'mano_obra'
                        : 'partidas'
                }
              />
            ) : null}

            {!loading && activeSection === 'overview' ? (
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Estado del perfil', value: verificationLabel, icon: ShieldCheck },
                    { label: 'Servicios creados', value: String(products.length), icon: ClipboardList },
                    { label: 'Publicados', value: String(products.filter((product) => product.is_published === 1).length), icon: BadgeCheck },
                    { label: 'Tipo de cuenta', value: user.entity_type, icon: Store },
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

                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Acciones recomendadas</CardTitle>
                    <CardDescription>Completa el perfil y carga tu primera oferta para empezar a operar.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <button className="rounded-2xl border border-border/70 bg-muted/25 p-5 text-left transition-colors hover:bg-muted/40" onClick={() => navigateSection('profile')} type="button">
                      <p className="font-medium">Completar perfil de proveedor</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Actualiza datos comerciales, cobertura, licencia y servicio de emergencia.</p>
                    </button>
                    <button className="rounded-2xl border border-border/70 bg-muted/25 p-5 text-left transition-colors hover:bg-muted/40" onClick={() => navigateSection('catalog')} type="button">
                      <p className="font-medium">Crear producto o servicio</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Publica una oferta con precio, descripcion, modalidad y cobertura.</p>
                    </button>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {!loading && activeSection === 'profile' ? (
              <Card className="border-border/60 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Perfil del proveedor</CardTitle>
                  <CardDescription>Estos datos se guardan en `stores/:id` y en el perfil vertical del proveedor.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-6" onSubmit={handleSaveProfile}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="store-name">Nombre comercial</Label>
                        <Input id="store-name" value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-legal-name">Razon social</Label>
                        <Input id="store-legal-name" value={storeForm.legal_name} onChange={(event) => setStoreForm((current) => ({ ...current, legal_name: event.target.value }))} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="store-email">Correo</Label>
                        <Input id="store-email" type="email" value={storeForm.email} onChange={(event) => setStoreForm((current) => ({ ...current, email: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-phone">Telefono</Label>
                        <Input id="store-phone" value={storeForm.phone} onChange={(event) => setStoreForm((current) => ({ ...current, phone: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-website">Sitio web</Label>
                        <Input id="store-website" value={storeForm.website} onChange={(event) => setStoreForm((current) => ({ ...current, website: event.target.value }))} />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="store-logo">Logo</Label>
                      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <Input id="store-logo" value={storeForm.logo_url} onChange={(event) => setStoreForm((current) => ({ ...current, logo_url: event.target.value }))} placeholder="https://..." />
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <label
                            htmlFor="store-logo-upload"
                            className="flex min-h-20 cursor-pointer items-center rounded-2xl border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            <input
                              id="store-logo-upload"
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void handleLogoUpload(file)
                                event.currentTarget.value = ''
                              }}
                            />
                            <span>Selecciona un archivo de imagen para usarlo como logo del proveedor.</span>
                          </label>
                          <Button type="button" variant="outline" className="rounded-full lg:self-center" disabled={uploadingLogo}>
                            {uploadingLogo ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                            Subir logo
                          </Button>
                        </div>
                        {storeForm.logo_url ? (
                          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background p-2">
                            <img src={storeForm.logo_url} alt="Logo proveedor" className="h-24 w-auto rounded-xl object-contain" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="store-promo-images">Banners promocionales</Label>
                      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <label
                            htmlFor="store-promo-upload"
                            className="flex min-h-20 cursor-pointer items-center rounded-2xl border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            <input
                              id="store-promo-upload"
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              onChange={(event) => {
                                void handlePromoImagesUpload(event.target.files)
                                event.currentTarget.value = ''
                              }}
                            />
                            <span>Sube imagenes horizontales para usarlas como carrusel promocional en la pagina publica.</span>
                          </label>
                          <Button type="button" variant="outline" className="rounded-full lg:self-center" disabled={uploadingPromoImages}>
                            {uploadingPromoImages ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                            Subir banners
                          </Button>
                        </div>

                        {storeForm.promo_images.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {storeForm.promo_images.map((imageUrl) => (
                              <div key={imageUrl} className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                                <img src={imageUrl} alt="Banner promocional" className="h-32 w-full object-cover" />
                                <div className="flex justify-end p-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => setStoreForm((current) => ({
                                      ...current,
                                      promo_images: current.promo_images.filter((item) => item !== imageUrl),
                                    }))}
                                  >
                                    <X className="size-4" />
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-6 text-sm text-muted-foreground">
                            No has cargado banners promocionales todavia.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="store-description">Descripcion</Label>
                      <Textarea id="store-description" value={storeForm.description} onChange={(event) => setStoreForm((current) => ({ ...current, description: event.target.value }))} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="grid gap-2">
                        <Label htmlFor="store-street">Direccion</Label>
                        <Input id="store-street" value={storeForm.street} onChange={(event) => setStoreForm((current) => ({ ...current, street: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-city">Ciudad</Label>
                        <Input id="store-city" value={storeForm.city} onChange={(event) => setStoreForm((current) => ({ ...current, city: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-state">Estado</Label>
                        <Input id="store-state" value={storeForm.state} onChange={(event) => setStoreForm((current) => ({ ...current, state: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-country">Pais</Label>
                        <Input id="store-country" value={storeForm.country} onChange={(event) => setStoreForm((current) => ({ ...current, country: event.target.value }))} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="store-zip">Codigo postal</Label>
                        <Input id="store-zip" value={storeForm.zip} onChange={(event) => setStoreForm((current) => ({ ...current, zip: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-service-area">Tipo de cobertura</Label>
                        <Input id="store-service-area" value={storeForm.service_area_type} onChange={(event) => setStoreForm((current) => ({ ...current, service_area_type: event.target.value }))} placeholder="regional, local, nacional" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="store-coverage">Radio de cobertura (km)</Label>
                        <Input id="store-coverage" type="number" value={storeForm.coverage_radius_km} onChange={(event) => setStoreForm((current) => ({ ...current, coverage_radius_km: event.target.value }))} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="store-license">Numero de licencia</Label>
                        <Input id="store-license" value={storeForm.license_number} onChange={(event) => setStoreForm((current) => ({ ...current, license_number: event.target.value }))} />
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium">
                        <input type="checkbox" checked={storeForm.insurance_verified} onChange={(event) => setStoreForm((current) => ({ ...current, insurance_verified: event.target.checked }))} />
                        Seguro verificado
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium">
                        <input type="checkbox" checked={storeForm.emergency_service} onChange={(event) => setStoreForm((current) => ({ ...current, emergency_service: event.target.checked }))} />
                        Servicio de emergencia
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" className="h-11 rounded-full px-6" disabled={savingProfile}>
                        {savingProfile ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Guardar perfil
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            {!loading && activeSection === 'catalog' ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>{editingProductId ? 'Editar producto o servicio' : 'Crear producto o servicio'}</CardTitle>
                    <CardDescription>La oferta se guarda en `products` y se asocia a tu proveedor autenticado.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-4" onSubmit={handleCreateProduct}>
                      <div className="grid gap-2">
                        <Label htmlFor="product-name">Nombre</Label>
                        <Input id="product-name" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} required />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="product-description">Descripcion comercial</Label>
                        <Textarea id="product-description" value={productForm.description_sale} onChange={(event) => setProductForm((current) => ({ ...current, description_sale: event.target.value }))} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="product-price">Precio</Label>
                          <Input id="product-price" type="number" step="0.01" value={productForm.list_price} onChange={(event) => setProductForm((current) => ({ ...current, list_price: event.target.value }))} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="product-compare-price">Precio comparativo</Label>
                          <Input id="product-compare-price" type="number" step="0.01" value={productForm.compare_price} onChange={(event) => setProductForm((current) => ({ ...current, compare_price: event.target.value }))} />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="product-cover">Imagen portada</Label>
                          <Input id="product-cover" value={productForm.cover_image_url} onChange={(event) => setProductForm((current) => ({ ...current, cover_image_url: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="product-service-type">Tipo de servicio</Label>
                          <Input id="product-service-type" value={productForm.service_type} onChange={(event) => setProductForm((current) => ({ ...current, service_type: event.target.value }))} placeholder="instalacion, mantenimiento, consultoria" />
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-medium">Galeria de imagenes</p>
                            <p className="text-sm text-muted-foreground">Usa `upload-images` para guardar imagenes reales del producto.</p>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <label
                              htmlFor="product-gallery-upload"
                              className="flex min-h-24 cursor-pointer items-center rounded-2xl border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                            >
                              <input
                                id="product-gallery-upload"
                                type="file"
                                multiple
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) => {
                                  void handleProductImagesUpload(event.target.files)
                                  event.currentTarget.value = ''
                                }}
                              />
                              <span className="leading-6">
                                Selecciona una o varias imagenes para cargarlas a la galeria del producto.
                              </span>
                            </label>

                            <Button type="button" variant="outline" className="rounded-full lg:self-center" disabled={uploadingProductImages}>
                              {uploadingProductImages ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                              Subir imagenes
                            </Button>
                          </div>
                        </div>

                        {productImages.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {productImages.map((imageUrl) => (
                              <div key={imageUrl} className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                                <img src={imageUrl} alt="Imagen del producto" className="h-36 w-full object-cover" />
                                <div className="flex items-center justify-between gap-2 p-3">
                                  <Button
                                    type="button"
                                    variant={productForm.cover_image_url === imageUrl ? 'default' : 'outline'}
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => setProductForm((current) => ({ ...current, cover_image_url: imageUrl }))}
                                  >
                                    Portada
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-full"
                                    onClick={() => {
                                      setProductImages((current) => current.filter((url) => url !== imageUrl))
                                      if (productForm.cover_image_url === imageUrl) {
                                        setProductForm((current) => ({ ...current, cover_image_url: '' }))
                                      }
                                    }}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="product-delivery-mode">Modalidad</Label>
                          <Input id="product-delivery-mode" value={productForm.delivery_mode} onChange={(event) => setProductForm((current) => ({ ...current, delivery_mode: event.target.value }))} placeholder="on_site o remote" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="product-duration">Duracion estimada (h)</Label>
                          <Input id="product-duration" type="number" value={productForm.estimated_duration_hours} onChange={(event) => setProductForm((current) => ({ ...current, estimated_duration_hours: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="product-sku">SKU interno</Label>
                          <Input id="product-sku" value={productForm.sku} onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))} />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <div className="grid gap-2">
                          <Label htmlFor="product-stock">Stock inicial</Label>
                          <Input id="product-stock" type="number" value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} />
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium">
                          <input type="checkbox" checked={productForm.materials_included} onChange={(event) => setProductForm((current) => ({ ...current, materials_included: event.target.checked }))} />
                          Material incluido
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium">
                          <input type="checkbox" checked={productForm.quote_required} onChange={(event) => setProductForm((current) => ({ ...current, quote_required: event.target.checked }))} />
                          Requiere cotizacion
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium">
                          <input type="checkbox" checked={productForm.site_visit_required} onChange={(event) => setProductForm((current) => ({ ...current, site_visit_required: event.target.checked }))} />
                          Requiere visita
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          {editingProductId ? (
                            <Button type="button" variant="outline" className="h-11 rounded-full px-6" onClick={resetProductComposer}>
                              Cancelar edicion
                            </Button>
                          ) : null}
                          <Button type="submit" className="h-11 rounded-full px-6" disabled={creatingProduct}>
                            {creatingProduct ? <LoaderCircle className="size-4 animate-spin" /> : editingProductId ? <Save className="size-4" /> : <PackagePlus className="size-4" />}
                            {editingProductId ? 'Guardar cambios' : 'Crear oferta'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Listado creado</CardTitle>
                    <CardDescription>Publica o despublica tus productos y servicios desde este panel.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {products.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        Aun no has creado productos o servicios.
                      </div>
                    ) : (
                      products.map((product) => (
                        <div key={product.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold tracking-tight">{product.name}</p>
                                <Badge variant={product.is_published === 1 ? 'default' : 'secondary'} className="rounded-full px-3 py-1">
                                  {product.is_published === 1 ? 'Publicado' : 'Borrador'}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                <span>Tipo: {product.listing_type}</span>
                                <span>Vertical: {product.vertical_type}</span>
                                <span>Precio: {product.list_price}</span>
                              </div>
                            </div>

                            <Button variant="outline" className="rounded-full" onClick={() => handleTogglePublish(product)}>
                              {product.is_published === 1 ? 'Despublicar' : 'Publicar'}
                            </Button>
                            <Button variant="ghost" className="rounded-full" onClick={() => void handleEditProduct(product.id)}>
                              <PencilLine className="size-4" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export { ProviderDashboard }
