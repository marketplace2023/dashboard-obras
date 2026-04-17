import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileDown, LoaderCircle, Pencil, Plus, Save, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null

type BimObra = { id: string; codigo: string; nombre: string }
type BimPresupuesto = { id: string; nombre: string; version: number; tipo: string }
type Valuacion = { id: string; numero: number; periodo_desde: string; periodo_hasta: string }

type Documento = {
  id: string
  obra_id: string
  presupuesto_id: string
  certificacion_id: string | null
  tipo: string
  numero: number
  fecha: string
  titulo: string
  status: string
}

type Resumen = {
  documento: Documento
  resumen: {
    base: string
    reconsiderado: string
    diferencial: string
    fuente: 'presupuesto' | 'valuacion'
  }
  detalle: Array<{
    partida_id: string
    nro: number
    codigo: string
    descripcion: string
    unidad: string
    cantidad_base: string
    precio_unitario_original: string
    precio_unitario_reconsiderado: string
    monto_base: string
    monto_reconsiderado: string
    diferencial: string
    justificacion: string | null
  }>
}

type Props = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

function fmtNum(value: string | number, decimals = 2) {
  return Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function ReconsideracionPreciosPanel({ token, onMessage, initialObraId }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const today = new Date().toISOString().slice(0, 10)

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [valuaciones, setValuaciones] = useState<Valuacion[]>([])
  const [selectedValuacionId, setSelectedValuacionId] = useState('')
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [selectedDocumentoId, setSelectedDocumentoId] = useState('')
  const [documentoFecha, setDocumentoFecha] = useState(today)
  const [documentoTitulo, setDocumentoTitulo] = useState('')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draftPrecios, setDraftPrecios] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialObraId) setSelectedObraId(initialObraId)
  }, [initialObraId])

  useEffect(() => {
    fetch(`${API_BASE_URL}/obras`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => setObras(unwrapList<BimObra>(data)))
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar los proyectos.' }))
  }, [headers, onMessage])

  useEffect(() => {
    if (!selectedObraId) {
      setPresupuestos([])
      setSelectedPresupuestoId('')
      return
    }

    setLoading(true)
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
      .finally(() => setLoading(false))
  }, [selectedObraId, headers, onMessage])

  useEffect(() => {
    if (!selectedObraId || !selectedPresupuestoId) {
      setValuaciones([])
      setSelectedValuacionId('')
      setDocumentos([])
      setSelectedDocumentoId('')
      setResumen(null)
      return
    }

    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/certificaciones/obra/${selectedObraId}?presupuestoId=${selectedPresupuestoId}`, { headers }),
      fetch(`${API_BASE_URL}/reconsideraciones/obra/${selectedObraId}?tipo=precio&presupuestoId=${selectedPresupuestoId}`, { headers }),
    ])
      .then(async ([valuacionesRes, documentosRes]) => {
        const valuacionesData = await valuacionesRes.json() as unknown
        const documentosData = await documentosRes.json() as unknown
        const nextValuaciones = unwrapList<Valuacion>(valuacionesData)
        const nextDocumentos = unwrapList<Documento>(documentosData)
        setValuaciones(nextValuaciones)
        setDocumentos(nextDocumentos)
        setSelectedValuacionId('')
        if (nextDocumentos[0]) {
          setSelectedDocumentoId(String(nextDocumentos[0].id))
        } else {
          setSelectedDocumentoId('')
          setDocumentoFecha(today)
          setDocumentoTitulo('RECONSIDERACION DE PRECIOS Nro. 1')
        }
      })
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar las reconsideraciones.' }))
      .finally(() => setLoading(false))
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage, today])

  const loadResumen = useCallback(async () => {
    if (!selectedDocumentoId) {
      setResumen(null)
      setDraftPrecios({})
      return
    }

    setLoadingResumen(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/resumen`, { headers })
      if (!response.ok) throw new Error()
      const data = await response.json() as Resumen
      setResumen(data)
      setDocumentoFecha(data.documento.fecha.slice(0, 10))
      setDocumentoTitulo(data.documento.titulo)
      setSelectedValuacionId(data.documento.certificacion_id ?? '')
      setDraftPrecios(Object.fromEntries(data.detalle.map((row) => [row.partida_id, String(Number(row.precio_unitario_reconsiderado || '0'))])))
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el detalle de reconsideración.' })
    } finally {
      setLoadingResumen(false)
    }
  }, [selectedDocumentoId, headers, onMessage])

  useEffect(() => {
    void loadResumen()
  }, [loadResumen])

  async function handleCreateDocumento() {
    if (!selectedObraId || !selectedPresupuestoId) return
    setCreating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obra_id: selectedObraId,
          presupuesto_id: selectedPresupuestoId,
          certificacion_id: selectedValuacionId || undefined,
          tipo: 'precio',
          fecha: documentoFecha,
          titulo: documentoTitulo.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error('No se pudo crear la reconsideración de precios')
      const documento = await response.json() as Documento
      setDocumentos((current) => [documento, ...current])
      setSelectedDocumentoId(String(documento.id))
      onMessage({ tone: 'success', text: 'Reconsideración de precios creada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear la reconsideración.' })
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveHeader() {
    if (!selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: documentoFecha,
          titulo: documentoTitulo,
          certificacion_id: selectedValuacionId || null,
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la cabecera')
      const updated = await response.json() as Documento
      setDocumentos((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      onMessage({ tone: 'success', text: 'Cabecera actualizada.' })
      await loadResumen()
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la cabecera.' })
    }
  }

  async function handleSaveDetalles() {
    if (!selectedDocumentoId || !resumen) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/detalles`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: resumen.detalle.map((row) => ({
            partida_id: row.partida_id,
            precio_unitario_reconsiderado: String(Math.max(Number(draftPrecios[row.partida_id] ?? row.precio_unitario_reconsiderado ?? '0'), 0)),
          })),
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la reconsideración de precios')
      const data = await response.json() as Resumen
      setResumen(data)
      setDraftPrecios(Object.fromEntries(data.detalle.map((row) => [row.partida_id, String(Number(row.precio_unitario_reconsiderado || '0'))])))
      onMessage({ tone: 'success', text: 'Reconsideración guardada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la reconsideración.' })
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    if (!selectedPresupuestoId || !selectedObraId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/pdf?type=comparativo&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`, { headers })
      if (!response.ok) throw new Error('No se pudo generar el PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo imprimir.' })
    }
  }

  async function handleStatusChange(nextStatus: 'revisado' | 'aprobado') {
    if (!selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('No se pudo actualizar el estado del documento')
      await loadResumen()
      onMessage({ tone: 'success', text: `Documento ${nextStatus === 'revisado' ? 'enviado a revisión' : 'aprobado'}.` })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar el estado.' })
    }
  }

  const filteredRows = useMemo(() => {
    const query = searchText.toLowerCase().trim()
    if (!resumen) return []
    if (!query) return resumen.detalle
    return resumen.detalle.filter((row) => row.codigo.toLowerCase().includes(query) || row.descripcion.toLowerCase().includes(query))
  }, [resumen, searchText])

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos del documento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
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
          <div className="grid gap-1.5">
            <Label className="text-xs">Basado en valuación</Label>
            <select value={selectedValuacionId} onChange={(event) => setSelectedValuacionId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Usar presupuesto base</option>
              {valuaciones.map((valuacion) => <option key={valuacion.id} value={valuacion.id}>Valuación Nro. {valuacion.numero} · {valuacion.periodo_desde.slice(0, 10)} al {valuacion.periodo_hasta.slice(0, 10)}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={handlePrint} disabled={!selectedPresupuestoId}>
              <FileDown className="size-4" />
              Imprimir PDF
            </Button>
            <Button className="rounded-full" onClick={handleCreateDocumento} disabled={!selectedObraId || !selectedPresupuestoId || creating}>
              {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Nueva reconsideración
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen económico</CardTitle>
          <CardDescription className="text-xs">Comparación entre base y monto reconsiderado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Base" value={resumen?.resumen.base ?? '0'} />
          <MetricCard label="Reconsiderado" value={resumen?.resumen.reconsiderado ?? '0'} />
          <MetricCard label="Diferencial" value={resumen?.resumen.diferencial ?? '0'} tone="primary" />
          <MetricCard label="Fuente" value={resumen?.resumen.fuente === 'valuacion' ? 'Valuación' : 'Presupuesto'} raw />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 xl:grid-cols-[150px_170px_minmax(360px,1fr)] xl:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Documento Nro.</Label>
                <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background px-3 text-sm font-semibold">{resumen?.documento.numero ?? (documentos.length + 1)}</div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fecha</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={documentoFecha} onChange={(event) => setDocumentoFecha(event.target.value)} className="pl-10" disabled={!selectedDocumentoId} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={documentoTitulo} onChange={(event) => setDocumentoTitulo(event.target.value)} disabled={!selectedDocumentoId} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-border/60 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                {resumen?.documento.status ?? 'borrador'}
              </div>
              <Button variant="outline" className="rounded-full" onClick={handleSaveHeader} disabled={!selectedDocumentoId}>
                <Pencil className="size-4" />
                Guardar cabecera
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => void handleStatusChange('revisado')} disabled={!selectedDocumentoId || !resumen || resumen.documento.status !== 'borrador'}>
                Enviar a revisión
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => void handleStatusChange('aprobado')} disabled={!selectedDocumentoId || !resumen || resumen.documento.status !== 'revisado'}>
                Aprobar
              </Button>
              <Button className="rounded-full" onClick={handleSaveDetalles} disabled={!selectedDocumentoId || saving || !resumen}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar reconsideración
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar código o descripción..." value={searchText} onChange={(event) => setSearchText(event.target.value)} className="pl-8" />
            {searchText ? <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchText('')}><X className="size-3.5 text-muted-foreground hover:text-foreground" /></button> : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            {loading || loadingResumen ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando reconsideración...
              </div>
            ) : !selectedDocumentoId ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">Crea o selecciona un documento para editar la grilla.</div>
            ) : (
              <table className="min-w-[1450px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Cantidad Base</th>
                    <th className="px-3 py-2 text-right">PU Original</th>
                    <th className="px-3 py-2 text-right">PU Reconsiderado</th>
                    <th className="px-3 py-2 text-right">Monto Base</th>
                    <th className="px-3 py-2 text-right">Monto Reconsiderado</th>
                    <th className="px-3 py-2 text-right">Diferencial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRows.map((row) => {
                    const reconsiderado = Number(draftPrecios[row.partida_id] ?? row.precio_unitario_reconsiderado)
                    const cantidadBase = Number(row.cantidad_base)
                    const montoReconsiderado = cantidadBase * reconsiderado
                    const diferencial = montoReconsiderado - Number(row.monto_base)

                    return (
                      <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nro}</td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                        <td className="px-3 py-2 text-foreground">{row.descripcion}</td>
                        <td className="px-3 py-2 text-foreground">{row.unidad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_base, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.precio_unitario_original, 4)}</td>
                        <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={draftPrecios[row.partida_id] ?? row.precio_unitario_reconsiderado} onChange={(event) => setDraftPrecios((current) => ({ ...current, [row.partida_id]: event.target.value }))} className="h-8 min-w-[110px] text-right tabular-nums" /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.monto_base, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{fmtNum(montoReconsiderado, 2)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${diferencial >= 0 ? 'text-amber-700' : 'text-sky-700'}`}>{fmtNum(diferencial, 2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, tone = 'default', raw = false }: { label: string; value: string | number; tone?: 'default' | 'primary'; raw?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {raw ? String(value) : fmtNum(value)}
      </p>
    </div>
  )
}

export { ReconsideracionPreciosPanel }
