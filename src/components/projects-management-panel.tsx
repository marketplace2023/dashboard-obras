import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, PencilLine, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type ProjectsManagementPanelProps = {
  user: AuthUser
  token: string
  onMessage: (message: { tone: 'success' | 'error'; text: string } | null) => void
}

type ProjectItem = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  ubicacion?: string | null
  fecha_inicio: string
  fecha_fin_estimada: string
  fecha_fin_real?: string | null
  estado: 'planificacion' | 'ejecucion' | 'finalizada' | 'suspendida'
  moneda: string
  presupuesto_base: string
  descripcion?: string | null
  meta_json?: ProjectMeta | null
  responsable_id: string
  created_at?: string
}

type ProjectMeta = {
  contrato?: string | null
  fecha_presupuesto?: string | null
  primera_partida_extra?: number | string | null
  calculado_por?: string | null
  revisado_por?: string | null
  horas_dia?: number | string | null
  costos_salario?: {
    aplicar_doble_factor?: boolean
    factor_labor_directa?: number | string | null
  }
  iva?: {
    modo?: string | null
    porcentaje?: number | string | null
  }
  otros_factores?: {
    usar_gastos_medicos?: boolean
  }
  costos_indirectos?: {
    administracion_pct?: number | string | null
    utilidad_pct?: number | string | null
    financiamiento_pct?: number | string | null
    financiamiento_incluye_utilidad?: boolean
  }
  retenciones?: {
    anticipo_pct?: number | string | null
    retencion_laboral_pct?: number | string | null
    retencion_fiel_pct?: number | string | null
  }
}

type ProjectFormState = {
  codigo: string
  nombre: string
  cliente: string
  ubicacion: string
  fecha_inicio: string
  fecha_fin_estimada: string
  fecha_fin_real: string
  estado: ProjectItem['estado']
  moneda: string
  presupuesto_base: string
  descripcion: string
  contrato: string
  fecha_presupuesto: string
  primera_partida_extra: string
  calculado_por: string
  revisado_por: string
  horas_dia: string
  aplicar_doble_factor: boolean
  factor_labor_directa: string
  iva_modo: string
  iva_pct: string
  usar_gastos_medicos: boolean
  administracion_pct: string
  utilidad_pct: string
  financiamiento_pct: string
  financiamiento_incluye_utilidad: boolean
  anticipo_pct: string
  retencion_laboral_pct: string
  retencion_fiel_pct: string
}

const defaultProjectForm: ProjectFormState = {
  codigo: '',
  nombre: '',
  cliente: '',
  ubicacion: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin_estimada: new Date().toISOString().slice(0, 10),
  fecha_fin_real: '',
  estado: 'planificacion',
  moneda: 'USD',
  presupuesto_base: '0',
  descripcion: '',
  contrato: '',
  fecha_presupuesto: new Date().toISOString().slice(0, 10),
  primera_partida_extra: '0',
  calculado_por: '',
  revisado_por: '',
  horas_dia: '8',
  aplicar_doble_factor: false,
  factor_labor_directa: '0',
  iva_modo: 'presupuesto_y_valuacion',
  iva_pct: '12',
  usar_gastos_medicos: false,
  administracion_pct: '15',
  utilidad_pct: '10',
  financiamiento_pct: '0',
  financiamiento_incluye_utilidad: false,
  anticipo_pct: '0',
  retencion_laboral_pct: '0',
  retencion_fiel_pct: '0',
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

function mapProjectToForm(project: ProjectItem): ProjectFormState {
  const meta = project.meta_json ?? {}

  return {
    codigo: project.codigo ?? '',
    nombre: project.nombre ?? '',
    cliente: project.cliente ?? '',
    ubicacion: project.ubicacion ?? '',
    fecha_inicio: project.fecha_inicio?.slice(0, 10) ?? '',
    fecha_fin_estimada: project.fecha_fin_estimada?.slice(0, 10) ?? '',
    fecha_fin_real: project.fecha_fin_real?.slice(0, 10) ?? '',
    estado: project.estado,
    moneda: project.moneda ?? 'USD',
    presupuesto_base: project.presupuesto_base ? String(project.presupuesto_base) : '0',
    descripcion: project.descripcion ?? '',
    contrato: meta.contrato ?? '',
    fecha_presupuesto: meta.fecha_presupuesto ?? '',
    primera_partida_extra: meta.primera_partida_extra != null ? String(meta.primera_partida_extra) : '0',
    calculado_por: meta.calculado_por ?? '',
    revisado_por: meta.revisado_por ?? '',
    horas_dia: meta.horas_dia != null ? String(meta.horas_dia) : '8',
    aplicar_doble_factor: Boolean(meta.costos_salario?.aplicar_doble_factor),
    factor_labor_directa: meta.costos_salario?.factor_labor_directa != null ? String(meta.costos_salario.factor_labor_directa) : '0',
    iva_modo: meta.iva?.modo ?? 'presupuesto_y_valuacion',
    iva_pct: meta.iva?.porcentaje != null ? String(meta.iva.porcentaje) : '12',
    usar_gastos_medicos: Boolean(meta.otros_factores?.usar_gastos_medicos),
    administracion_pct: meta.costos_indirectos?.administracion_pct != null ? String(meta.costos_indirectos.administracion_pct) : '15',
    utilidad_pct: meta.costos_indirectos?.utilidad_pct != null ? String(meta.costos_indirectos.utilidad_pct) : '10',
    financiamiento_pct: meta.costos_indirectos?.financiamiento_pct != null ? String(meta.costos_indirectos.financiamiento_pct) : '0',
    financiamiento_incluye_utilidad: Boolean(meta.costos_indirectos?.financiamiento_incluye_utilidad),
    anticipo_pct: meta.retenciones?.anticipo_pct != null ? String(meta.retenciones.anticipo_pct) : '0',
    retencion_laboral_pct: meta.retenciones?.retencion_laboral_pct != null ? String(meta.retenciones.retencion_laboral_pct) : '0',
    retencion_fiel_pct: meta.retenciones?.retencion_fiel_pct != null ? String(meta.retenciones.retencion_fiel_pct) : '0',
  }
}

function ProjectsManagementPanel({ user, token, onMessage }: ProjectsManagementPanelProps) {
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)

  const projectStats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((project) => project.estado === 'ejecucion').length,
      planning: projects.filter((project) => project.estado === 'planificacion').length,
      totalBudget: projects.reduce((sum, project) => sum + Number(project.presupuesto_base || 0), 0),
    }),
    [projects]
  )

  useEffect(() => {
    let active = true

    async function loadProjects() {
      try {
        const obrasData = await parseApiResponse<ProjectItem[]>(
          await fetch(`${API_BASE_URL}/obras`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )

        if (!active) return
        setProjects(obrasData ?? [])
      } catch (error) {
        if (!active) return
        onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron cargar las obras.' })
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadProjects()

    return () => {
      active = false
    }
  }, [onMessage, token])

  async function refreshProjects() {
    const data = await parseApiResponse<ProjectItem[]>(
      await fetch(`${API_BASE_URL}/obras`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    setProjects(data ?? [])
  }

  function resetProjectForm() {
    setEditingProjectId(null)
    setProjectForm(defaultProjectForm)
  }

  async function handleSaveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProject(true)
    onMessage(null)

    try {
      const payload = {
        codigo: projectForm.codigo || undefined,
        nombre: projectForm.nombre,
        cliente: projectForm.cliente,
        ubicacion: projectForm.ubicacion || undefined,
        fecha_inicio: projectForm.fecha_inicio,
        fecha_fin_estimada: projectForm.fecha_fin_estimada,
        fecha_fin_real: projectForm.fecha_fin_real || undefined,
        estado: projectForm.estado,
        moneda: projectForm.moneda,
        presupuesto_base: String(projectForm.presupuesto_base || '0'),
        descripcion: projectForm.descripcion || undefined,
        responsable_id: user.id,
        meta_json: {
          contrato: projectForm.contrato || null,
          fecha_presupuesto: projectForm.fecha_presupuesto || null,
          primera_partida_extra: Number(projectForm.primera_partida_extra || 0),
          calculado_por: projectForm.calculado_por || null,
          revisado_por: projectForm.revisado_por || null,
          horas_dia: Number(projectForm.horas_dia || 8),
          costos_salario: {
            aplicar_doble_factor: projectForm.aplicar_doble_factor,
            factor_labor_directa: Number(projectForm.factor_labor_directa || 0),
          },
          iva: {
            modo: projectForm.iva_modo,
            porcentaje: Number(projectForm.iva_pct || 0),
          },
          otros_factores: {
            usar_gastos_medicos: projectForm.usar_gastos_medicos,
          },
          costos_indirectos: {
            administracion_pct: Number(projectForm.administracion_pct || 0),
            utilidad_pct: Number(projectForm.utilidad_pct || 0),
            financiamiento_pct: Number(projectForm.financiamiento_pct || 0),
            financiamiento_incluye_utilidad: projectForm.financiamiento_incluye_utilidad,
          },
          retenciones: {
            anticipo_pct: Number(projectForm.anticipo_pct || 0),
            retencion_laboral_pct: Number(projectForm.retencion_laboral_pct || 0),
            retencion_fiel_pct: Number(projectForm.retencion_fiel_pct || 0),
          },
        },
      }

      await parseApiResponse(
        await fetch(`${API_BASE_URL}/obras${editingProjectId ? `/${editingProjectId}` : ''}`, {
          method: editingProjectId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      )

      await refreshProjects()
      resetProjectForm()
      onMessage({ tone: 'success', text: editingProjectId ? 'Proyecto actualizado correctamente.' : 'Proyecto creado correctamente.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el proyecto.' })
    } finally {
      setSavingProject(false)
    }
  }

  function handleEditProject(project: ProjectItem) {
    setEditingProjectId(project.id)
    setProjectForm(mapProjectToForm(project))
    onMessage({ tone: 'success', text: 'Proyecto cargado para edicion.' })
  }

  async function handleDeleteProject(projectId: string) {
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/obras/${projectId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      )

      await refreshProjects()
      if (editingProjectId === projectId) {
        resetProjectForm()
      }
      onMessage({ tone: 'success', text: 'Proyecto eliminado correctamente.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar el proyecto.' })
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total de obras', value: String(projectStats.total), caption: 'Portafolio registrado' },
          { label: 'En planificacion', value: String(projectStats.planning), caption: 'Frentes por arrancar' },
          { label: 'En ejecucion', value: String(projectStats.active), caption: 'Obras activas' },
          {
            label: 'Presupuesto acumulado',
            value: projectStats.totalBudget.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            caption: 'Base economica actual',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60 bg-card/95 shadow-sm">
            <CardContent className="space-y-2 p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">{stat.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/60 pb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Gestion de obras
                </Badge>
                {editingProjectId ? (
                  <Badge className="rounded-full px-3 py-1">Editando proyecto</Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Nuevo registro
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{editingProjectId ? 'Actualizar proyecto u obra' : 'Crear proyecto u obra'}</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Reorganicé esta vista para que la captura principal quede primero y la configuracion avanzada viva
                  en bloques separados. Los datos tecnicos siguen guardandose en `meta_json`.
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-2 rounded-3xl border border-border/70 bg-muted/20 p-4 sm:min-w-72">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estado del formulario</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {editingProjectId
                  ? 'Estas corrigiendo una obra existente. Si prefieres arrancar limpio, cancela la edicion.'
                  : 'Empieza por la informacion general y luego ajusta los parametros financieros en las pestañas.'}
              </p>
              {editingProjectId ? (
                <Button type="button" variant="outline" className="mt-2 rounded-full" onClick={resetProjectForm}>
                  Cancelar edicion
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form className="grid gap-8" onSubmit={handleSaveProject}>
            <section className="grid gap-6 rounded-3xl border border-border/70 bg-muted/15 p-6">
              <div className="space-y-1">
                <h3 className="font-semibold tracking-tight">Datos generales</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Primero captura la identidad de la obra y el marco comercial para no mezclar esto con los ajustes avanzados.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_220px]">
                <div className="grid gap-2">
                  <Label htmlFor="obra-codigo">Codigo</Label>
                  <Input id="obra-codigo" value={projectForm.codigo} onChange={(event) => setProjectForm((current) => ({ ...current, codigo: event.target.value }))} placeholder="OBR-00001" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-contrato">Contrato</Label>
                  <Input id="obra-contrato" value={projectForm.contrato} onChange={(event) => setProjectForm((current) => ({ ...current, contrato: event.target.value }))} placeholder="Contrato principal o referencia interna" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-fecha-presupuesto">Fecha presupuesto</Label>
                  <Input id="obra-fecha-presupuesto" type="date" value={projectForm.fecha_presupuesto} onChange={(event) => setProjectForm((current) => ({ ...current, fecha_presupuesto: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="obra-nombre">Nombre del proyecto</Label>
                <Input id="obra-nombre" value={projectForm.nombre} onChange={(event) => setProjectForm((current) => ({ ...current, nombre: event.target.value }))} required />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="obra-cliente">Propietario / cliente</Label>
                  <Input id="obra-cliente" value={projectForm.cliente} onChange={(event) => setProjectForm((current) => ({ ...current, cliente: event.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-ubicacion">Ubicacion</Label>
                  <Input id="obra-ubicacion" value={projectForm.ubicacion} onChange={(event) => setProjectForm((current) => ({ ...current, ubicacion: event.target.value }))} placeholder="Ciudad, obra o frente operativo" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="grid gap-2 xl:col-span-1">
                  <Label htmlFor="obra-fecha-inicio">Fecha inicio</Label>
                  <Input id="obra-fecha-inicio" type="date" value={projectForm.fecha_inicio} onChange={(event) => setProjectForm((current) => ({ ...current, fecha_inicio: event.target.value }))} required />
                </div>
                <div className="grid gap-2 xl:col-span-1">
                  <Label htmlFor="obra-fecha-fin">Fecha fin estimada</Label>
                  <Input id="obra-fecha-fin" type="date" value={projectForm.fecha_fin_estimada} onChange={(event) => setProjectForm((current) => ({ ...current, fecha_fin_estimada: event.target.value }))} required />
                </div>
                <div className="grid gap-2 xl:col-span-1">
                  <Label htmlFor="obra-fecha-fin-real">Fecha fin real</Label>
                  <Input id="obra-fecha-fin-real" type="date" value={projectForm.fecha_fin_real} onChange={(event) => setProjectForm((current) => ({ ...current, fecha_fin_real: event.target.value }))} />
                </div>
                <div className="grid gap-2 xl:col-span-1">
                  <Label htmlFor="obra-estado">Estado</Label>
                  <select
                    id="obra-estado"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-3"
                    value={projectForm.estado}
                    onChange={(event) => setProjectForm((current) => ({ ...current, estado: event.target.value as ProjectItem['estado'] }))}
                  >
                    <option value="planificacion">Planificacion</option>
                    <option value="ejecucion">Ejecucion</option>
                    <option value="finalizada">Finalizada</option>
                    <option value="suspendida">Suspendida</option>
                  </select>
                </div>
                <div className="grid gap-2 xl:col-span-1">
                  <Label htmlFor="obra-moneda">Moneda</Label>
                  <Input id="obra-moneda" value={projectForm.moneda} onChange={(event) => setProjectForm((current) => ({ ...current, moneda: event.target.value }))} />
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-border/70 bg-muted/15 p-6">
              <div className="space-y-1">
                <h3 className="font-semibold tracking-tight">Presupuesto base y responsables</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Este bloque concentra solo la informacion operativa que necesitas ver seguido durante la captura.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="obra-presupuesto-base">Presupuesto base</Label>
                  <Input id="obra-presupuesto-base" type="number" step="0.01" value={projectForm.presupuesto_base} onChange={(event) => setProjectForm((current) => ({ ...current, presupuesto_base: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-horas-dia">Nro horas/dia</Label>
                  <Input id="obra-horas-dia" type="number" step="0.01" value={projectForm.horas_dia} onChange={(event) => setProjectForm((current) => ({ ...current, horas_dia: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-calculado">Calculado por</Label>
                  <Input id="obra-calculado" value={projectForm.calculado_por} onChange={(event) => setProjectForm((current) => ({ ...current, calculado_por: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obra-revisado">Revisado por</Label>
                  <Input id="obra-revisado" value={projectForm.revisado_por} onChange={(event) => setProjectForm((current) => ({ ...current, revisado_por: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="obra-descripcion">Descripcion</Label>
                <Textarea id="obra-descripcion" value={projectForm.descripcion} onChange={(event) => setProjectForm((current) => ({ ...current, descripcion: event.target.value }))} className="min-h-32" />
              </div>
            </section>

            <section className="rounded-3xl border border-border/70 bg-muted/15 p-6">
              <Tabs defaultValue="costs" className="gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold tracking-tight">Configuracion financiera</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Los campos menos frecuentes quedan separados en pestañas para evitar que el formulario principal se vea comprimido.
                    </p>
                  </div>
                  <TabsList className="h-auto w-full justify-start rounded-2xl p-1 sm:w-auto">
                    <TabsTrigger value="costs" className="flex-1 sm:flex-none">
                      Costos e IVA
                    </TabsTrigger>
                    <TabsTrigger value="indirects" className="flex-1 sm:flex-none">
                      Indirectos y retenciones
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="costs" className="grid gap-6 lg:grid-cols-2">
                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
                    <div className="space-y-1">
                      <p className="font-medium">Costos asociados</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Ajustes de factor y partida adicional para el calculo base del proyecto.
                      </p>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium leading-6">
                      <input className="mt-1" type="checkbox" checked={projectForm.aplicar_doble_factor} onChange={(event) => setProjectForm((current) => ({ ...current, aplicar_doble_factor: event.target.checked }))} />
                      <span>Aplicar doble factor de costo asociado</span>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="obra-primera-partida">Primera partida extra</Label>
                        <Input id="obra-primera-partida" type="number" step="0.01" value={projectForm.primera_partida_extra} onChange={(event) => setProjectForm((current) => ({ ...current, primera_partida_extra: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="obra-factor-labor">Factor labor directa</Label>
                        <Input id="obra-factor-labor" type="number" step="0.01" value={projectForm.factor_labor_directa} onChange={(event) => setProjectForm((current) => ({ ...current, factor_labor_directa: event.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
                    <div className="space-y-1">
                      <p className="font-medium">IVA y cargos adicionales</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Mantengo juntos los parametros fiscales para que no se mezclen con los indirectos del proyecto.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                      <div className="grid gap-2">
                        <Label htmlFor="obra-iva-modo">Aplicacion IVA</Label>
                        <select
                          id="obra-iva-modo"
                          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-3"
                          value={projectForm.iva_modo}
                          onChange={(event) => setProjectForm((current) => ({ ...current, iva_modo: event.target.value }))}
                        >
                          <option value="sin_iva">Sin IVA</option>
                          <option value="presupuesto_y_valuacion">En presupuesto y valuacion</option>
                          <option value="solo_valuacion">Solo en valuacion</option>
                          <option value="total_apu">En total del APU</option>
                          <option value="materiales">En materiales</option>
                          <option value="materiales_equipos">En materiales y equipos</option>
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="obra-iva-pct">IVA %</Label>
                        <Input id="obra-iva-pct" type="number" step="0.01" value={projectForm.iva_pct} onChange={(event) => setProjectForm((current) => ({ ...current, iva_pct: event.target.value }))} />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium leading-6">
                      <input className="mt-1" type="checkbox" checked={projectForm.usar_gastos_medicos} onChange={(event) => setProjectForm((current) => ({ ...current, usar_gastos_medicos: event.target.checked }))} />
                      <span>Usar gastos medicos e implementos de seguridad</span>
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="indirects" className="grid gap-6 lg:grid-cols-2">
                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
                    <div className="space-y-1">
                      <p className="font-medium">Indirectos</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Parametros de administracion, utilidad y financiamiento en un bloque mas legible.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="obra-admin-pct">Administracion %</Label>
                        <Input id="obra-admin-pct" type="number" step="0.01" value={projectForm.administracion_pct} onChange={(event) => setProjectForm((current) => ({ ...current, administracion_pct: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="obra-utilidad-pct">Utilidad %</Label>
                        <Input id="obra-utilidad-pct" type="number" step="0.01" value={projectForm.utilidad_pct} onChange={(event) => setProjectForm((current) => ({ ...current, utilidad_pct: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="obra-financiamiento-pct">Financiamiento %</Label>
                        <Input id="obra-financiamiento-pct" type="number" step="0.01" value={projectForm.financiamiento_pct} onChange={(event) => setProjectForm((current) => ({ ...current, financiamiento_pct: event.target.value }))} />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium leading-6">
                      <input className="mt-1" type="checkbox" checked={projectForm.financiamiento_incluye_utilidad} onChange={(event) => setProjectForm((current) => ({ ...current, financiamiento_incluye_utilidad: event.target.checked }))} />
                      <span>El financiamiento incluye la utilidad</span>
                    </label>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
                    <div className="space-y-1">
                      <p className="font-medium">Retenciones</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Los descuentos comerciales quedan agrupados y separados del resto del formulario.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="obra-anticipo">Anticipo %</Label>
                        <Input id="obra-anticipo" type="number" step="0.01" value={projectForm.anticipo_pct} onChange={(event) => setProjectForm((current) => ({ ...current, anticipo_pct: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="obra-retencion-laboral">Retencion laboral %</Label>
                        <Input id="obra-retencion-laboral" type="number" step="0.01" value={projectForm.retencion_laboral_pct} onChange={(event) => setProjectForm((current) => ({ ...current, retencion_laboral_pct: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="obra-retencion-fiel">Retencion fiel %</Label>
                        <Input id="obra-retencion-fiel" type="number" step="0.01" value={projectForm.retencion_fiel_pct} onChange={(event) => setProjectForm((current) => ({ ...current, retencion_fiel_pct: event.target.value }))} />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            <div className="flex flex-col gap-4 border-t border-border/60 pt-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                La captura principal queda arriba; lo excepcional queda en configuracion financiera. Esa separacion es la que faltaba para que la pantalla respire.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {editingProjectId ? (
                  <Button type="button" variant="outline" className="rounded-full" onClick={resetProjectForm}>
                    Cancelar edicion
                  </Button>
                ) : null}
                <Button type="submit" className="rounded-full px-6" disabled={savingProject}>
                  {savingProject ? <LoaderCircle className="size-4 animate-spin" /> : editingProjectId ? <PencilLine className="size-4" /> : <Plus className="size-4" />}
                  {editingProjectId ? 'Guardar cambios' : 'Crear proyecto'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/60 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Portafolio de obras
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {projects.length} registradas
                </Badge>
              </div>
              <CardTitle className="text-2xl">Listado de proyectos u obras</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                Reemplacé la tabla apretada por tarjetas operativas con mas aire, mejor lectura y acciones mas claras.
              </CardDescription>
            </div>

            <Button type="button" variant="outline" className="rounded-full" onClick={resetProjectForm}>
              Nuevo proyecto
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 pt-6">
          {loading ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Cargando proyectos...
            </div>
          ) : null}

          {!loading && projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
              No hay proyectos registrados todavia.
            </div>
          ) : null}

          {!loading && projects.length > 0 ? (
            <div className="grid gap-4 2xl:grid-cols-2">
              {projects.map((project) => (
                <div key={project.id} className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {project.estado}
                          </Badge>
                          <span className="rounded-full border border-border/70 bg-muted/25 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            {project.codigo || 'Sin codigo'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-semibold tracking-tight">{project.nombre}</p>
                          <p className="text-sm text-muted-foreground">{project.cliente}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => handleEditProject(project)}>
                          <PencilLine className="size-4" />
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" className="rounded-full" onClick={() => void handleDeleteProject(project.id)}>
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ubicacion</p>
                        <p className="mt-2 text-sm font-medium leading-6">{project.ubicacion || 'Sin ubicacion registrada'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contrato</p>
                        <p className="mt-2 text-sm font-medium leading-6">{project.meta_json?.contrato || 'Sin contrato'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fecha presupuesto</p>
                        <p className="mt-2 text-sm font-medium leading-6">{project.meta_json?.fecha_presupuesto || 'Sin fecha'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Presupuesto base</p>
                        <p className="mt-2 text-sm font-medium leading-6">
                          {Number(project.presupuesto_base || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Inicio</p>
                        <p className="mt-2 text-sm font-medium">{project.fecha_inicio?.slice(0, 10) || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fin estimada</p>
                        <p className="mt-2 text-sm font-medium">{project.fecha_fin_estimada?.slice(0, 10) || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fin real</p>
                        <p className="mt-2 text-sm font-medium">{project.fecha_fin_real?.slice(0, 10) || 'Pendiente'}</p>
                      </div>
                    </div>

                    {project.descripcion ? (
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Descripcion</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{project.descripcion}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export { ProjectsManagementPanel }
