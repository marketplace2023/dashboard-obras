import { useEffect, useMemo, useState } from 'react'
import { FileDown, Flag, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null
type BimObra = { id: string; codigo: string; nombre: string; estado: string; fecha_fin_real?: string | null }
type BimPresupuesto = { id: string; nombre: string; version: number; tipo: string; es_oficial?: boolean | null }
type Cierre = {
  obra: { id: string; codigo: string; nombre: string; estado: string; fecha_fin_real: string | null }
  presupuesto: { id: string; nombre: string; moneda: string }
  original_oficial?: BimPresupuesto | null
  trazabilidad_modificado?: Array<{
    documento_id: string
    tipo: string
    numero: number
    fecha: string
    titulo: string
    status: string
  }>
  resumen: {
    original: string
    modificado: string
    valuado: string
    valuado_reconsiderado: string
    reconsideracion_diferencial: string
    economico_ajustado: string
    saldo_economico: string
    cantidad_modificada: string
    medido: string
    saldo_fisico: string
    estado_cierre: 'listo_para_cerrar' | 'con_diferencias' | 'pendiente_formalizacion'
    formalizacion: {
      mediciones_borrador: number
      valuaciones_borrador: number
      reconsideraciones_borrador: number
    }
  }
  detalle: Array<{
    partida_id: string
    codigo: string
    descripcion: string
    presupuesto_modificado: string
    medido: string
    valuado: string
    reconsideracion_diferencial: string
    monto_modificado: string
    monto_valuado: string
    monto_valuado_reconsiderado: string
  }>
}

type Props = { user: AuthUser; token: string; onMessage: (msg: MsgState) => void; initialObraId?: string }

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) return (data as { data: T[] }).data
  return []
}

function fmtNum(value: string | number, decimals = 2) {
  return Number(value).toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function CierreObraPanel({ token, onMessage, initialObraId }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [data, setData] = useState<Cierre | null>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (initialObraId) setSelectedObraId(initialObraId)
  }, [initialObraId])

  useEffect(() => {
    fetch(`${API_BASE_URL}/obras`, { headers })
      .then((response) => response.json())
      .then((payload: unknown) => setObras(unwrapList<BimObra>(payload)))
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar los proyectos.' }))
  }, [headers, onMessage])

  useEffect(() => {
    if (!selectedObraId) {
      setPresupuestos([])
      setSelectedPresupuestoId('')
      setData(null)
      return
    }

    Promise.all([
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=obra`, { headers }),
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=sin_apu`, { headers }),
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=modificado`, { headers }),
    ])
      .then(async ([obraRes, sinApuRes, modificadoRes]) => {
        const obraData = await obraRes.json() as unknown
        const sinApuData = await sinApuRes.json() as unknown
        const modificadoData = await modificadoRes.json() as unknown
        const list = [...unwrapList<BimPresupuesto>(obraData), ...unwrapList<BimPresupuesto>(sinApuData), ...unwrapList<BimPresupuesto>(modificadoData)]
        const sorted = [...list].sort((a, b) => {
          const officialDiff = Number(b.es_oficial ? 1 : 0) - Number(a.es_oficial ? 1 : 0)
          if (officialDiff !== 0) return officialDiff
          return Number(b.version) - Number(a.version)
        })
        setPresupuestos(sorted)
        setSelectedPresupuestoId(sorted[0] ? String(sorted[0].id) : '')
      })
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar los presupuestos.' }))
  }, [selectedObraId, headers, onMessage])

  useEffect(() => {
    if (!selectedObraId || !selectedPresupuestoId) {
      setData(null)
      return
    }

    setLoading(true)
    fetch(`${API_BASE_URL}/reportes/cierre?obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers })
      .then((response) => response.json())
      .then((payload: Cierre) => setData(payload))
      .catch(() => onMessage({ tone: 'error', text: 'No se pudo cargar el cierre de obra.' }))
      .finally(() => setLoading(false))
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage])

  async function handlePrint() {
    if (!selectedObraId || !selectedPresupuestoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/pdf?type=cierre&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers })
      if (!response.ok) throw new Error('No se pudo generar el PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo imprimir.' })
    }
  }

  async function handleCloseProject() {
    if (!selectedObraId || !selectedPresupuestoId) return
    setClosing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/obras/${selectedObraId}/cerrar?presupuestoId=${selectedPresupuestoId}`, {
        method: 'PATCH',
        headers,
      })
      if (!response.ok) throw new Error('No se pudo cerrar la obra')
      onMessage({ tone: 'success', text: 'Obra cerrada correctamente.' })
      const payload = await fetch(`${API_BASE_URL}/reportes/cierre?obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers }).then((res) => res.json() as Promise<Cierre>)
      setData(payload)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cerrar la obra.' })
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cierre de obra</CardTitle>
          <CardDescription className="text-xs">Validación física y económica antes de marcar la obra como finalizada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(260px,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label className="text-xs">Obra</Label>
            <select value={selectedObraId} onChange={(event) => setSelectedObraId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona una obra</option>
              {obras.map((obra) => <option key={obra.id} value={obra.id}>{obra.codigo} · {obra.nombre}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Presupuesto</Label>
            <select value={selectedPresupuestoId} onChange={(event) => setSelectedPresupuestoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona un presupuesto</option>
                {presupuestos.map((presupuesto) => <option key={presupuesto.id} value={presupuesto.id}>{presupuesto.tipo === 'sin_apu' ? 'Sin A.P.U.' : presupuesto.tipo === 'modificado' ? 'Modificado' : 'Con A.P.U.'} · v{presupuesto.version} · {presupuesto.nombre}{presupuesto.es_oficial ? ' · oficial' : ''}</option>)}
              </select>
            </div>
          <div className="flex items-end gap-2 lg:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => void handlePrint()} disabled={!selectedPresupuestoId}><FileDown className="size-4" />PDF cierre</Button>
            <Button className="rounded-full" onClick={() => void handleCloseProject()} disabled={!data || data.resumen.estado_cierre !== 'listo_para_cerrar' || closing}>
              {closing ? <LoaderCircle className="size-4 animate-spin" /> : <Flag className="size-4" />}Cerrar obra
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen de cierre</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Original oficial</p>
              <p className="mt-1 font-medium text-foreground">{data?.original_oficial ? `v${data.original_oficial.version} · ${data.original_oficial.nombre}` : 'No formalizado'}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fuentes del modificado</p>
              <p className="mt-1 text-foreground">{data?.trazabilidad_modificado?.length ? data.trazabilidad_modificado.map((item) => `${item.tipo} #${item.numero}`).join(', ') : 'Sin documentos fuente formalizados'}</p>
            </div>
          </div>
        </CardContent>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-10">
          <MetricCard label="Original" value={data?.resumen.original ?? '0'} />
          <MetricCard label="Modificado" value={data?.resumen.modificado ?? '0'} />
          <MetricCard label="Valuado" value={data?.resumen.valuado ?? '0'} />
          <MetricCard label="Rec. precios" value={data?.resumen.reconsideracion_diferencial ?? '0'} />
          <MetricCard label="Eco. ajustado" value={data?.resumen.economico_ajustado ?? '0'} />
          <MetricCard label="Val. + rec." value={data?.resumen.valuado_reconsiderado ?? '0'} />
          <MetricCard label="Saldo Econ." value={data?.resumen.saldo_economico ?? '0'} tone={Number(data?.resumen.saldo_economico ?? 0) === 0 ? 'ok' : 'warn'} />
          <MetricCard label="Cant. Modif." value={data?.resumen.cantidad_modificada ?? '0'} decimals={4} />
          <MetricCard label="Medido" value={data?.resumen.medido ?? '0'} decimals={4} />
          <MetricCard label="Saldo Físico" value={data?.resumen.saldo_fisico ?? '0'} decimals={4} tone={Number(data?.resumen.saldo_fisico ?? 0) === 0 ? 'ok' : 'warn'} />
          <MetricCard label="Estado" value={data?.resumen.estado_cierre === 'listo_para_cerrar' ? 'Listo' : data?.resumen.estado_cierre === 'pendiente_formalizacion' ? 'Pend. formalización' : 'Con diferencias'} raw tone={data?.resumen.estado_cierre === 'listo_para_cerrar' ? 'ok' : 'warn'} />
        </CardContent>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Pendientes en borrador: mediciones {data?.resumen.formalizacion.mediciones_borrador ?? 0}, valuaciones {data?.resumen.formalizacion.valuaciones_borrador ?? 0}, reconsideraciones {data?.resumen.formalizacion.reconsideraciones_borrador ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalle de cierre por partida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-border/50">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando cierre...</div>
            ) : !data ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">Selecciona una obra y un presupuesto para ver el cierre.</div>
            ) : (
               <table className="min-w-[1480px] divide-y divide-border/50 text-sm">
                 <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                   <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Modificado</th>
                     <th className="px-3 py-2 text-right">Medido</th>
                     <th className="px-3 py-2 text-right">Valuado</th>
                     <th className="px-3 py-2 text-right">Rec. Precios</th>
                     <th className="px-3 py-2 text-right">Monto Modif.</th>
                     <th className="px-3 py-2 text-right">Monto Valuado</th>
                     <th className="px-3 py-2 text-right">Monto Val. + Rec.</th>
                   </tr>
                 </thead>
                <tbody className="divide-y divide-border/30">
                  {data.detalle.map((row) => (
                    <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                      <td className="px-3 py-2">{row.descripcion}</td>
                       <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.presupuesto_modificado, 4)}</td>
                       <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.medido, 4)}</td>
                       <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.valuado, 4)}</td>
                       <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.reconsideracion_diferencial, 2)}</td>
                       <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(row.monto_modificado, 2)}</td>
                       <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(row.monto_valuado, 2)}</td>
                       <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(row.monto_valuado_reconsiderado, 2)}</td>
                     </tr>
                   ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, decimals = 2, raw = false, tone = 'default' }: { label: string; value: string | number; decimals?: number; raw?: boolean; tone?: 'default' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-foreground'
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{raw ? String(value) : fmtNum(value, decimals)}</p>
    </div>
  )
}

export { CierreObraPanel }
