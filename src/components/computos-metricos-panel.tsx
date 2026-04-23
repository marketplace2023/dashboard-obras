import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileDown, LoaderCircle, Pencil, Plus, RefreshCcw, Save, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null

type BimObra = {
  id: string
  codigo: string
  nombre: string
}

type BimPresupuesto = {
  id: string
  nombre: string
  estado: string
  total_presupuesto: string
  moneda: string
  version: number
  tipo: string
}

type ComputoDocumento = {
  id: string
  obra_id: string
  presupuesto_id: string
  numero: number
  fecha: string
  titulo: string
  status: string
}

type ComputoDetalleRow = {
  partida_id: string
  nro: number
  codigo: string
  descripcion_partida: string
  unidad: string
  cantidad_presupuesto: string
  descripcion_computo: string
  formula_tipo: 'directo' | 'largo' | 'largo_x_ancho' | 'largo_x_ancho_x_alto'
  cantidad: string
  largo: string
  ancho: string
  alto: string
  resultado: string
  precio_unitario: string
  total: string
  notas: string | null
}

type ComputoResumen = {
  documento: ComputoDocumento
  resumen: {
    partidas: number
    presupuesto_base: string
    computado_total: string
    monto_total: string
  }
  detalle: ComputoDetalleRow[]
}

type ComputosMetricosPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
  onWorkflowChange?: () => void
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

function computeResult(row: Pick<ComputoDetalleRow, 'formula_tipo' | 'cantidad' | 'largo' | 'ancho' | 'alto'>, overrides?: Partial<Record<'cantidad' | 'largo' | 'ancho' | 'alto', string>>) {
  const cantidad = Number(overrides?.cantidad ?? row.cantidad ?? '0')
  const largo = Number(overrides?.largo ?? row.largo ?? '0')
  const ancho = Number(overrides?.ancho ?? row.ancho ?? '0')
  const alto = Number(overrides?.alto ?? row.alto ?? '0')

  switch (row.formula_tipo) {
    case 'largo':
      return cantidad * largo
    case 'largo_x_ancho':
      return cantidad * largo * ancho
    case 'largo_x_ancho_x_alto':
      return cantidad * largo * ancho * alto
    case 'directo':
    default:
      return cantidad
  }
}

function ComputosMetricosPanel({ token, onMessage, initialObraId, onWorkflowChange }: ComputosMetricosPanelProps) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)

  const [documentos, setDocumentos] = useState<ComputoDocumento[]>([])
  const [selectedDocumentoId, setSelectedDocumentoId] = useState('')
  const [loadingDocumentos, setLoadingDocumentos] = useState(false)
  const [creatingDocumento, setCreatingDocumento] = useState(false)

  const [documentoFecha, setDocumentoFecha] = useState(new Date().toISOString().slice(0, 10))
  const [documentoTitulo, setDocumentoTitulo] = useState('')

  const [resumen, setResumen] = useState<ComputoResumen | null>(null)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [savingDetalles, setSavingDetalles] = useState(false)
  const [syncingPresupuesto, setSyncingPresupuesto] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [draftRows, setDraftRows] = useState<Record<string, Pick<ComputoDetalleRow, 'descripcion_computo' | 'formula_tipo' | 'cantidad' | 'largo' | 'ancho' | 'alto'>>>({})

  useEffect(() => {
    if (initialObraId) setSelectedObraId(initialObraId)
  }, [initialObraId])

  useEffect(() => {
    let active = true
    setLoadingObras(true)
    fetch(`${API_BASE_URL}/obras`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return
        setObras(unwrapList<BimObra>(data))
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los proyectos.' })
      })
      .finally(() => {
        if (active) setLoadingObras(false)
      })

    return () => {
      active = false
    }
  }, [headers, onMessage])

  useEffect(() => {
    if (!selectedObraId) {
      setPresupuestos([])
      setSelectedPresupuestoId('')
      setDocumentos([])
      setSelectedDocumentoId('')
      setResumen(null)
      return
    }

    let active = true
    setLoadingPresupuestos(true)
    setSelectedPresupuestoId('')
    setDocumentos([])
    setSelectedDocumentoId('')
    setResumen(null)

    Promise.all([
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=obra`, { headers }),
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=sin_apu`, { headers }),
    ])
      .then(async ([obraRes, sinApuRes]) => {
        const obraData = await obraRes.json() as unknown
        const sinApuData = await sinApuRes.json() as unknown
        return [...unwrapList<BimPresupuesto>(obraData), ...unwrapList<BimPresupuesto>(sinApuData)]
      })
      .then((list) => {
        if (!active) return
        const sorted = [...list].sort((a, b) => Number(b.version) - Number(a.version))
        setPresupuestos(sorted)
        if (sorted[0]) setSelectedPresupuestoId(String(sorted[0].id))
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los presupuestos de la obra.' })
      })
      .finally(() => {
        if (active) setLoadingPresupuestos(false)
      })

    return () => {
      active = false
    }
  }, [selectedObraId, headers, onMessage])

  useEffect(() => {
    if (!selectedObraId || !selectedPresupuestoId) {
      setDocumentos([])
      setSelectedDocumentoId('')
      setResumen(null)
      return
    }

    let active = true
    setLoadingDocumentos(true)
    setSelectedDocumentoId('')
    setResumen(null)

    fetch(`${API_BASE_URL}/computos/obra/${selectedObraId}?presupuestoId=${selectedPresupuestoId}`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return
        const list = unwrapList<ComputoDocumento>(data)
        setDocumentos(list)
        if (list[0]) {
          setSelectedDocumentoId(String(list[0].id))
        } else {
          const nextNumero = 1
          setDocumentoFecha(new Date().toISOString().slice(0, 10))
          setDocumentoTitulo(`COMPUTOS METRICOS Nro. ${nextNumero}`)
        }
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los documentos de cómputos.' })
      })
      .finally(() => {
        if (active) setLoadingDocumentos(false)
      })

    return () => {
      active = false
    }
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage])

  const loadResumen = useCallback(async () => {
    if (!selectedDocumentoId) {
      setResumen(null)
      setDraftRows({})
      return
    }

    setLoadingResumen(true)
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos/${selectedDocumentoId}/resumen`, { headers })
      if (!response.ok) throw new Error()
      const data = await response.json() as ComputoResumen
      setResumen(data)
      setDocumentoFecha(data.documento.fecha.slice(0, 10))
      setDocumentoTitulo(data.documento.titulo)
      setDraftRows(
        Object.fromEntries(
          data.detalle.map((row) => [
            row.partida_id,
            {
              descripcion_computo: row.descripcion_computo,
              formula_tipo: row.formula_tipo,
              cantidad: String(Number(row.cantidad || '0')),
              largo: String(Number(row.largo || '0')),
              ancho: String(Number(row.ancho || '0')),
              alto: String(Number(row.alto || '0')),
            },
          ]),
        ),
      )
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el detalle de cómputos.' })
    } finally {
      setLoadingResumen(false)
    }
  }, [selectedDocumentoId, headers, onMessage])

  useEffect(() => {
    void loadResumen()
  }, [loadResumen])

  async function handleCreateDocumento() {
    if (!selectedObraId || !selectedPresupuestoId) return
    setCreatingDocumento(true)
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obra_id: selectedObraId,
          presupuesto_id: selectedPresupuestoId,
          fecha: documentoFecha,
          titulo: documentoTitulo.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error('No se pudo crear el documento de cómputos')
      const documento = await response.json() as ComputoDocumento
      setDocumentos((current) => [documento, ...current])
      setSelectedDocumentoId(String(documento.id))
      onWorkflowChange?.()
      onMessage({ tone: 'success', text: 'Documento de cómputos creado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el documento de cómputos.' })
    } finally {
      setCreatingDocumento(false)
    }
  }

  async function handleSaveHeader() {
    if (!selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos/${selectedDocumentoId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: documentoFecha, titulo: documentoTitulo }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la cabecera del documento')
      const updated = await response.json() as ComputoDocumento
      setDocumentos((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      onMessage({ tone: 'success', text: 'Cabecera de cómputos actualizada.' })
      await loadResumen()
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la cabecera.' })
    }
  }

  async function handleSaveDetalles() {
    if (!selectedDocumentoId || !resumen) return
    setSavingDetalles(true)
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos/${selectedDocumentoId}/detalles`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: resumen.detalle.map((row) => {
            const draft = draftRows[row.partida_id] ?? {
              descripcion_computo: row.descripcion_computo,
              formula_tipo: row.formula_tipo,
              cantidad: row.cantidad,
              largo: row.largo,
              ancho: row.ancho,
              alto: row.alto,
            }

            return {
              partida_id: row.partida_id,
              descripcion: draft.descripcion_computo,
              formula_tipo: draft.formula_tipo,
              cantidad: String(Math.max(Number(draft.cantidad || '0'), 0)),
              largo: String(Math.max(Number(draft.largo || '0'), 0)),
              ancho: String(Math.max(Number(draft.ancho || '0'), 0)),
              alto: String(Math.max(Number(draft.alto || '0'), 0)),
            }
          }),
        }),
      })
      if (!response.ok) throw new Error('No se pudieron guardar los cómputos')
      const data = await response.json() as ComputoResumen
      setResumen(data)
      setDraftRows(
        Object.fromEntries(
          data.detalle.map((row) => [
            row.partida_id,
            {
              descripcion_computo: row.descripcion_computo,
              formula_tipo: row.formula_tipo,
              cantidad: String(Number(row.cantidad || '0')),
              largo: String(Number(row.largo || '0')),
              ancho: String(Number(row.ancho || '0')),
              alto: String(Number(row.alto || '0')),
            },
          ]),
        ),
      )
      onWorkflowChange?.()
      onMessage({ tone: 'success', text: 'Cómputos guardados.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron guardar los cómputos.' })
    } finally {
      setSavingDetalles(false)
    }
  }

  async function handleSyncPresupuesto() {
    if (!selectedDocumentoId) return
    setSyncingPresupuesto(true)
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos/${selectedDocumentoId}/sync-presupuesto`, {
        method: 'POST',
        headers,
      })
      if (!response.ok) throw new Error('No se pudieron sincronizar las cantidades al presupuesto')
      const data = await response.json() as { message: string }
      onMessage({ tone: 'success', text: data.message })
      await loadResumen()
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo sincronizar el presupuesto.' })
    } finally {
      setSyncingPresupuesto(false)
    }
  }

  async function handleStatusChange(nextStatus: 'revisado' | 'aprobado') {
    if (!selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/computos/documentos/${selectedDocumentoId}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('No se pudo actualizar el estado del documento')
      await loadResumen()
      onWorkflowChange?.()
      onMessage({ tone: 'success', text: `Documento ${nextStatus === 'revisado' ? 'enviado a revisión' : 'aprobado'}.` })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar el estado.' })
    }
  }

  async function handlePrint() {
    if (!selectedPresupuestoId || !selectedObraId || !selectedDocumentoId) return
    try {
      const response = await fetch(
        `${API_BASE_URL}/reportes/pdf?type=computos&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}&documentoId=${selectedDocumentoId}`,
        { headers },
      )
      if (!response.ok) throw new Error('No se pudo generar el PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo imprimir.' })
    }
  }

  const filteredRows = useMemo(() => {
    const query = searchText.toLowerCase().trim()
    if (!resumen) return []
    if (!query) return resumen.detalle
    return resumen.detalle.filter((row) => row.codigo.toLowerCase().includes(query) || row.descripcion_partida.toLowerCase().includes(query) || row.descripcion_computo.toLowerCase().includes(query))
  }, [resumen, searchText])

  const selectedObra = obras.find((item) => item.id === selectedObraId) ?? null
  const selectedPresupuesto = presupuestos.find((item) => item.id === selectedPresupuestoId) ?? null

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(260px,1fr)_auto] xl:grid-cols-[minmax(240px,0.9fr)_minmax(320px,1fr)_minmax(320px,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label className="text-xs">Obra</Label>
            {loadingObras ? (
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando obras...
              </div>
            ) : (
              <select value={selectedObraId} onChange={(event) => setSelectedObraId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Selecciona una obra</option>
                {obras.map((obra) => (
                  <option key={obra.id} value={obra.id}>{obra.codigo} · {obra.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Presupuesto base</Label>
            {loadingPresupuestos ? (
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando presupuestos...
              </div>
            ) : (
              <select value={selectedPresupuestoId} onChange={(event) => setSelectedPresupuestoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Selecciona un presupuesto</option>
                {presupuestos.map((presupuesto) => (
                  <option key={presupuesto.id} value={presupuesto.id}>
                    {presupuesto.tipo === 'sin_apu' ? 'Sin A.P.U.' : 'Con A.P.U.'} · v{presupuesto.version} · {presupuesto.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Documento de cómputos</Label>
            {loadingDocumentos ? (
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando documentos...
              </div>
            ) : documentos.length > 0 ? (
              <select value={selectedDocumentoId} onChange={(event) => setSelectedDocumentoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {documentos.map((documento) => (
                  <option key={documento.id} value={documento.id}>Cómputo Nro. {documento.numero} · {documento.titulo}</option>
                ))}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 text-sm text-muted-foreground">
                Sin documentos aún
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 xl:justify-end">
            <Button variant="outline" className="rounded-full" onClick={handlePrint} disabled={!selectedPresupuestoId}>
              <FileDown className="size-4" />
              Imprimir PDF
            </Button>
            <Button className="rounded-full" onClick={handleCreateDocumento} disabled={!selectedObraId || !selectedPresupuestoId || creatingDocumento}>
              {creatingDocumento ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Nuevo cómputo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen de cómputos</CardTitle>
          <CardDescription className="text-xs">Cantidad base del presupuesto, cómputo total y monto asociado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Partidas" value={resumen?.resumen.partidas ?? 0} />
          <MetricCard label="Presupuesto base" value={resumen?.resumen.presupuesto_base ?? '0'} />
          <MetricCard label="Computado total" value={resumen?.resumen.computado_total ?? '0'} />
          <MetricCard label="Monto total" value={resumen?.resumen.monto_total ?? '0'} tone="primary" />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 xl:grid-cols-[150px_170px_minmax(360px,1fr)] xl:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Cómputo Nro.</Label>
                <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background px-3 text-sm font-semibold">
                  {resumen?.documento.numero ?? (documentos.length + 1)}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fecha</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={documentoFecha} onChange={(event) => setDocumentoFecha(event.target.value)} className="pl-10" disabled={!selectedDocumentoId} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Titulo</Label>
                <Input value={documentoTitulo} onChange={(event) => setDocumentoTitulo(event.target.value)} placeholder="COMPUTOS METRICOS Nro. 1" disabled={!selectedDocumentoId} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
              <Button variant="outline" className="rounded-full" onClick={handleSyncPresupuesto} disabled={!selectedDocumentoId || syncingPresupuesto}>
                {syncingPresupuesto ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                Sincronizar al presupuesto
              </Button>
              <Button className="rounded-full" onClick={handleSaveDetalles} disabled={!selectedDocumentoId || savingDetalles || !resumen}>
                {savingDetalles ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar cómputos
              </Button>
            </div>
          </div>

          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>{selectedObra ? `${selectedObra.codigo} · ${selectedObra.nombre}` : 'Selecciona una obra'}</span>
            <span>{selectedPresupuesto ? selectedPresupuesto.nombre : 'Selecciona un presupuesto base'}</span>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar código o descripción..." value={searchText} onChange={(event) => setSearchText(event.target.value)} className="pl-8" />
            {searchText ? (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchText('')}>
                <X className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            {loadingResumen ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando detalle de cómputos...
              </div>
            ) : !selectedDocumentoId ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                Crea o selecciona un documento de cómputos para editar la grilla.
              </div>
            ) : (
              <table className="min-w-[1700px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Partida</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Cant. base</th>
                    <th className="px-3 py-2 text-left">Descripción cómputo</th>
                    <th className="px-3 py-2 text-left">Fórmula</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">Largo</th>
                    <th className="px-3 py-2 text-right">Ancho</th>
                    <th className="px-3 py-2 text-right">Alto</th>
                    <th className="px-3 py-2 text-right">Resultado</th>
                    <th className="px-3 py-2 text-right">P.U.</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRows.map((row) => {
                    const draft = draftRows[row.partida_id] ?? {
                      descripcion_computo: row.descripcion_computo,
                      formula_tipo: row.formula_tipo,
                      cantidad: row.cantidad,
                      largo: row.largo,
                      ancho: row.ancho,
                      alto: row.alto,
                    }
                    const resultado = computeResult(
                      {
                        formula_tipo: draft.formula_tipo,
                        cantidad: draft.cantidad,
                        largo: draft.largo,
                        ancho: draft.ancho,
                        alto: draft.alto,
                      } as ComputoDetalleRow,
                    )
                    const total = resultado * Number(row.precio_unitario)

                    return (
                      <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nro}</td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                        <td className="px-3 py-2 text-foreground">{row.descripcion_partida}</td>
                        <td className="px-3 py-2 text-foreground">{row.unidad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_presupuesto, 2)}</td>
                        <td className="px-3 py-2 min-w-[280px]">
                          <Input value={draft.descripcion_computo} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, descripcion_computo: event.target.value } }))} className="h-8" />
                        </td>
                        <td className="px-3 py-2 min-w-[180px]">
                          <select value={draft.formula_tipo} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, formula_tipo: event.target.value as ComputoDetalleRow['formula_tipo'] } }))} className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
                            <option value="directo">Directo</option>
                            <option value="largo">Cantidad x Largo</option>
                            <option value="largo_x_ancho">Cantidad x Largo x Ancho</option>
                            <option value="largo_x_ancho_x_alto">Cantidad x Largo x Ancho x Alto</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-[120px]"><Input type="number" min="0" step="0.01" value={draft.cantidad} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, cantidad: event.target.value } }))} className="h-8 text-right tabular-nums" /></td>
                        <td className="px-3 py-2 min-w-[120px]"><Input type="number" min="0" step="0.01" value={draft.largo} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, largo: event.target.value } }))} className="h-8 text-right tabular-nums" /></td>
                        <td className="px-3 py-2 min-w-[120px]"><Input type="number" min="0" step="0.01" value={draft.ancho} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, ancho: event.target.value } }))} className="h-8 text-right tabular-nums" /></td>
                        <td className="px-3 py-2 min-w-[120px]"><Input type="number" min="0" step="0.01" value={draft.alto} onChange={(event) => setDraftRows((current) => ({ ...current, [row.partida_id]: { ...draft, alto: event.target.value } }))} className="h-8 text-right tabular-nums" /></td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{fmtNum(resultado, 4)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.precio_unitario, 4)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Cómputo total del documento</span>
            <span className="font-semibold tabular-nums">{fmtNum(resumen?.resumen.computado_total ?? '0', 4)}</span>
            <span className="text-muted-foreground">Monto total computado</span>
            <span className="font-semibold tabular-nums text-primary">{fmtNum(resumen?.resumen.monto_total ?? '0')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'primary' }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {typeof value === 'number' ? value.toLocaleString('es-VE') : fmtNum(value)}
      </p>
    </div>
  )
}

export { ComputosMetricosPanel }
