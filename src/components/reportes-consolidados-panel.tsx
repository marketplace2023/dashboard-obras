import { useEffect, useMemo, useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null
type BimObra = { id: string; codigo: string; nombre: string }
type BimPresupuesto = { id: string; nombre: string; version: number; tipo: string }
type Comparativo = {
  summary: {
    original: string
    modificado: string
    valuado: string
    computado: string
    medido: string
    cantidad_modificada: string
    variaciones: {
      extras: string
      aumentos: string
      disminuciones: string
    }
  }
  detalle: Array<{
    nro: number
    capitulo: string
    partida_id: string
    codigo: string
    descripcion: string
    unidad: string
    presupuesto_original: string
    extras: string
    aumentos: string
    disminuciones: string
    presupuesto_modificado: string
    computado: string
    medido: string
    valuado: string
    precio_unitario: string
    monto_original: string
    monto_modificado: string
    monto_valuado: string
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

function ReportesConsolidadosPanel({ token, onMessage, initialObraId }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [data, setData] = useState<Comparativo | null>(null)
  const [loading, setLoading] = useState(false)

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
    ])
      .then(async ([obraRes, sinApuRes]) => {
        const obraData = await obraRes.json() as unknown
        const sinApuData = await sinApuRes.json() as unknown
        const list = [...unwrapList<BimPresupuesto>(obraData), ...unwrapList<BimPresupuesto>(sinApuData)]
        const sorted = [...list].sort((a, b) => Number(b.version) - Number(a.version))
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
    fetch(`${API_BASE_URL}/reportes/comparativo?obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers })
      .then((response) => response.json())
      .then((payload: Comparativo) => setData(payload))
      .catch(() => onMessage({ tone: 'error', text: 'No se pudo cargar el comparativo consolidado.' }))
      .finally(() => setLoading(false))
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage])

  async function handlePrint(type: 'comparativo' | 'modificado') {
    if (!selectedObraId || !selectedPresupuestoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/pdf?type=${type}&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers })
      if (!response.ok) throw new Error('No se pudo generar el PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo imprimir.' })
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reporte consolidado</CardTitle>
          <CardDescription className="text-xs">Presupuesto original, modificado, computado, medido y valuado.</CardDescription>
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
              {presupuestos.map((presupuesto) => <option key={presupuesto.id} value={presupuesto.id}>{presupuesto.tipo === 'sin_apu' ? 'Sin A.P.U.' : 'Con A.P.U.'} · v{presupuesto.version} · {presupuesto.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 lg:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => void handlePrint('comparativo')} disabled={!selectedPresupuestoId}><FileDown className="size-4" />PDF comparativo</Button>
            <Button className="rounded-full" onClick={() => void handlePrint('modificado')} disabled={!selectedPresupuestoId}><FileDown className="size-4" />PDF modificado</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen global</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Original" value={data?.summary.original ?? '0'} />
          <MetricCard label="Modificado" value={data?.summary.modificado ?? '0'} tone="primary" />
          <MetricCard label="Valuado" value={data?.summary.valuado ?? '0'} />
          <MetricCard label="Computado" value={data?.summary.computado ?? '0'} decimals={4} />
          <MetricCard label="Medido" value={data?.summary.medido ?? '0'} decimals={4} />
          <MetricCard label="Cant. Modificada" value={data?.summary.cantidad_modificada ?? '0'} decimals={4} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalle comparativo por partida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-border/50">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando comparativo...</div>
            ) : !data ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">Selecciona una obra y un presupuesto para ver el consolidado.</div>
            ) : (
              <table className="min-w-[1680px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Capítulo</th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Original</th>
                    <th className="px-3 py-2 text-right">Extras</th>
                    <th className="px-3 py-2 text-right">Aumentos</th>
                    <th className="px-3 py-2 text-right">Dismin.</th>
                    <th className="px-3 py-2 text-right">Modificado</th>
                    <th className="px-3 py-2 text-right">Computado</th>
                    <th className="px-3 py-2 text-right">Medido</th>
                    <th className="px-3 py-2 text-right">Valuado</th>
                    <th className="px-3 py-2 text-right">Monto Modif.</th>
                    <th className="px-3 py-2 text-right">Monto Valuado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.detalle.map((row) => (
                    <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                      <td className="px-3 py-2">{row.nro}</td>
                      <td className="px-3 py-2">{row.capitulo}</td>
                      <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                      <td className="px-3 py-2">{row.descripcion}</td>
                      <td className="px-3 py-2">{row.unidad}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.presupuesto_original, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.extras, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.aumentos, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.disminuciones, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(row.presupuesto_modificado, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.computado, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.medido, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary">{fmtNum(row.valuado, 4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(row.monto_modificado, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(row.monto_valuado, 2)}</td>
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

function MetricCard({ label, value, decimals = 2, tone = 'default' }: { label: string; value: string | number; decimals?: number; tone?: 'default' | 'primary' }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>{fmtNum(value, decimals)}</p>
    </div>
  )
}

export { ReportesConsolidadosPanel }
