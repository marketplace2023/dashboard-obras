import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileDown, LoaderCircle, Pencil, Plus, Save, Search, X } from 'lucide-react'

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

type ValuacionDocumento = {
  id: string
  obra_id: string
  presupuesto_id: string
  medicion_documento_id: string | null
  numero: number
  periodo_desde: string
  periodo_hasta: string
  estado: string
  observaciones: string | null
}

type MedicionDocumento = {
  id: string
  numero: number
  fecha: string
  titulo: string
  status: string
}

type ValuacionDetalleRow = {
  partida_id: string
  nro: number
  codigo: string
  descripcion: string
  unidad: string
  cantidad_presupuesto: string
  cantidad_anterior: string
  cantidad_actual: string
  cantidad_acumulada: string
  saldo_cantidad: string
  precio_unitario: string
  monto_presupuesto: string
  monto_anterior: string
  monto_actual: string
  monto_acumulado: string
  saldo_monto: string
  porcentaje_avance: string
}

type ValuacionResumen = {
  documento: ValuacionDocumento
  resumen: {
    presupuesto_base: string
    valuado_anterior: string
    valuado_actual: string
    valuado_acumulado: string
    saldo_por_valorar: string
    porcentaje_avance: string
  }
  detalle: ValuacionDetalleRow[]
}

type ValuacionesPanelProps = {
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

function ValuacionesPanel({ token, onMessage, initialObraId }: ValuacionesPanelProps) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)

  const [documentos, setDocumentos] = useState<ValuacionDocumento[]>([])
  const [selectedDocumentoId, setSelectedDocumentoId] = useState('')
  const [loadingDocumentos, setLoadingDocumentos] = useState(false)
  const [creatingDocumento, setCreatingDocumento] = useState(false)

  const [mediciones, setMediciones] = useState<MedicionDocumento[]>([])
  const [selectedMedicionId, setSelectedMedicionId] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const [periodoDesde, setPeriodoDesde] = useState(today)
  const [periodoHasta, setPeriodoHasta] = useState(today)

  const [resumen, setResumen] = useState<ValuacionResumen | null>(null)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingDetalles, setSavingDetalles] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [draftActuales, setDraftActuales] = useState<Record<string, string>>({})

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
      setMediciones([])
      setSelectedMedicionId('')
      setResumen(null)
      return
    }

    let active = true
    setLoadingDocumentos(true)
    setSelectedDocumentoId('')
    setResumen(null)

    Promise.all([
      fetch(`${API_BASE_URL}/certificaciones/obra/${selectedObraId}?presupuestoId=${selectedPresupuestoId}`, { headers }),
      fetch(`${API_BASE_URL}/mediciones/obra/${selectedObraId}?presupuestoId=${selectedPresupuestoId}`, { headers }),
    ])
      .then(async ([certRes, medicionRes]) => {
        const data = await certRes.json() as unknown
        const medicionesData = await medicionRes.json() as unknown
        if (!active) return
        const list = unwrapList<ValuacionDocumento>(data)
        const medicionesList = unwrapList<MedicionDocumento>(medicionesData)
        setDocumentos(list)
        setMediciones(medicionesList)
        if (list[0]) {
          setSelectedDocumentoId(String(list[0].id))
        } else {
          setPeriodoDesde(today)
          setPeriodoHasta(today)
          setSelectedMedicionId(medicionesList.find((documento) => documento.status === 'revisado' || documento.status === 'aprobado')?.id ?? '')
        }
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar las valuaciones.' })
      })
      .finally(() => {
        if (active) setLoadingDocumentos(false)
      })

    return () => {
      active = false
    }
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage, today])

  const loadResumen = useCallback(async () => {
    if (!selectedDocumentoId) {
      setResumen(null)
      setDraftActuales({})
      return
    }

    setLoadingResumen(true)
    try {
      const response = await fetch(`${API_BASE_URL}/certificaciones/${selectedDocumentoId}/resumen`, { headers })
      if (!response.ok) throw new Error()
      const data = await response.json() as ValuacionResumen
      setResumen(data)
      setPeriodoDesde(data.documento.periodo_desde.slice(0, 10))
      setPeriodoHasta(data.documento.periodo_hasta.slice(0, 10))
      setSelectedMedicionId(data.documento.medicion_documento_id ?? '')
      setDraftActuales(Object.fromEntries(data.detalle.map((row) => [row.partida_id, String(Number(row.cantidad_actual || '0'))])))
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el detalle de valuaciones.' })
    } finally {
      setLoadingResumen(false)
    }
  }, [selectedDocumentoId, headers, onMessage])

  useEffect(() => {
    void loadResumen()
  }, [loadResumen])

  const medicionesDisponibles = useMemo(
    () => mediciones.filter((documento) => documento.status === 'revisado' || documento.status === 'aprobado'),
    [mediciones],
  )

  async function handleCreateDocumento() {
    if (!selectedObraId || !selectedPresupuestoId) return
    if (!selectedMedicionId) {
      onMessage({ tone: 'error', text: 'La valuación requiere una medición base revisada o aprobada.' })
      return
    }
    setCreatingDocumento(true)
    try {
      const response = await fetch(`${API_BASE_URL}/certificaciones`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obra_id: selectedObraId,
          presupuesto_id: selectedPresupuestoId,
          medicion_documento_id: selectedMedicionId || undefined,
          periodo_desde: periodoDesde,
          periodo_hasta: periodoHasta,
        }),
      })
      if (!response.ok) throw new Error('No se pudo crear la valuación')
      const documento = await response.json() as ValuacionDocumento
      setDocumentos((current) => [documento, ...current])
      setSelectedDocumentoId(String(documento.id))
      onMessage({ tone: 'success', text: 'Valuación creada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear la valuación.' })
    } finally {
      setCreatingDocumento(false)
    }
  }

  async function handleSaveHeader() {
    if (!selectedDocumentoId) return
    if (!selectedMedicionId) {
      onMessage({ tone: 'error', text: 'Debes seleccionar una medición revisada o aprobada.' })
      return
    }
    setSavingHeader(true)
    try {
      const response = await fetch(`${API_BASE_URL}/certificaciones/${selectedDocumentoId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodo_desde: periodoDesde, periodo_hasta: periodoHasta, medicion_documento_id: selectedMedicionId }),
        })
      if (!response.ok) throw new Error('No se pudo guardar la cabecera de valuación')
      await loadResumen()
      onMessage({ tone: 'success', text: 'Cabecera de valuación actualizada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la cabecera.' })
    } finally {
      setSavingHeader(false)
    }
  }

  async function handleSaveDetalles() {
    if (!selectedDocumentoId || !resumen) return
    setSavingDetalles(true)
    try {
      const response = await fetch(`${API_BASE_URL}/certificaciones/${selectedDocumentoId}/detalles`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: resumen.detalle.map((row) => ({
            partida_id: row.partida_id,
            cantidad_actual: String(Math.max(Number(draftActuales[row.partida_id] ?? row.cantidad_actual ?? '0'), 0)),
          })),
        }),
      })
      if (!response.ok) throw new Error('No se pudieron guardar las valuaciones')
      const data = await response.json() as ValuacionResumen
      setResumen(data)
      setDraftActuales(Object.fromEntries(data.detalle.map((row) => [row.partida_id, String(Number(row.cantidad_actual || '0'))])))
      onMessage({ tone: 'success', text: 'Valuaciones guardadas.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron guardar las valuaciones.' })
    } finally {
      setSavingDetalles(false)
    }
  }

  async function handlePrint() {
    if (!selectedPresupuestoId || !selectedObraId) return
    try {
      const response = await fetch(
        `${API_BASE_URL}/reportes/pdf?type=valuaciones&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`,
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
    return resumen.detalle.filter((row) => row.codigo.toLowerCase().includes(query) || row.descripcion.toLowerCase().includes(query))
  }, [resumen, searchText])

  const selectedObra = obras.find((item) => item.id === selectedObraId) ?? null
  const selectedPresupuesto = presupuestos.find((item) => item.id === selectedPresupuestoId) ?? null

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(220px,0.85fr)_minmax(240px,1fr)_minmax(240px,1fr)_auto] xl:grid-cols-[minmax(220px,0.85fr)_minmax(260px,1fr)_minmax(320px,1fr)_minmax(320px,1fr)_auto]">
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
            <Label className="text-xs">Valuación</Label>
            {loadingDocumentos ? (
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando valuaciones...
              </div>
            ) : documentos.length > 0 ? (
              <select value={selectedDocumentoId} onChange={(event) => setSelectedDocumentoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {documentos.map((documento) => (
                  <option key={documento.id} value={documento.id}>Valuación Nro. {documento.numero} · {documento.periodo_desde.slice(0, 10)} al {documento.periodo_hasta.slice(0, 10)}</option>
                ))}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 text-sm text-muted-foreground">
                Sin valuaciones aún
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Medición base</Label>
            <select value={selectedMedicionId} onChange={(event) => setSelectedMedicionId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona una medición revisada o aprobada</option>
              {medicionesDisponibles.map((documento) => (
                <option key={documento.id} value={documento.id}>Medición Nro. {documento.numero} · {documento.fecha.slice(0, 10)} · {documento.titulo}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 xl:justify-end">
            <Button variant="outline" className="rounded-full" onClick={handlePrint} disabled={!selectedPresupuestoId}>
              <FileDown className="size-4" />
              Imprimir PDF
            </Button>
            <Button className="rounded-full" onClick={handleCreateDocumento} disabled={!selectedObraId || !selectedPresupuestoId || !selectedMedicionId || creatingDocumento}>
              {creatingDocumento ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Nueva valuación
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen de valuación</CardTitle>
          <CardDescription className="text-xs">Presupuesto base, valuado anterior, actual, acumulado y saldo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Presupuesto base" value={resumen?.resumen.presupuesto_base ?? '0'} />
          <MetricCard label="Valuado anterior" value={resumen?.resumen.valuado_anterior ?? '0'} />
          <MetricCard label="Valuado actual" value={resumen?.resumen.valuado_actual ?? '0'} />
          <MetricCard label="Valuado acumulado" value={resumen?.resumen.valuado_acumulado ?? '0'} />
          <MetricCard label="Saldo" value={resumen?.resumen.saldo_por_valorar ?? '0'} />
          <MetricCard label="% Avance" value={resumen?.resumen.porcentaje_avance ?? '0'} tone="primary" suffix="%" />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 xl:grid-cols-[150px_170px_170px] xl:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valuación Nro.</Label>
                <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background px-3 text-sm font-semibold">
                  {resumen?.documento.numero ?? (documentos.length + 1)}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Periodo desde</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={periodoDesde} onChange={(event) => setPeriodoDesde(event.target.value)} className="pl-10" disabled={!selectedDocumentoId} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Periodo hasta</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={periodoHasta} onChange={(event) => setPeriodoHasta(event.target.value)} className="pl-10" disabled={!selectedDocumentoId} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={handleSaveHeader} disabled={!selectedDocumentoId || savingHeader}>
                {savingHeader ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                Guardar cabecera
              </Button>
              <Button className="rounded-full" onClick={handleSaveDetalles} disabled={!selectedDocumentoId || savingDetalles || !resumen}>
                {savingDetalles ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar valuación
              </Button>
            </div>
          </div>

          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>{selectedObra ? `${selectedObra.codigo} · ${selectedObra.nombre}` : 'Selecciona una obra'}</span>
            <span>{selectedPresupuesto ? selectedPresupuesto.nombre : 'Selecciona un presupuesto base'}</span>
            <span>{selectedMedicionId ? `Valuación ligada a medición base ${selectedMedicionId}.` : 'Debes escoger una medición revisada o aprobada.'}</span>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar codigo o descripcion..." value={searchText} onChange={(event) => setSearchText(event.target.value)} className="pl-8" />
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
                Cargando detalle de valuaciones...
              </div>
            ) : !selectedDocumentoId ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                Crea o selecciona una valuación para editar la grilla.
              </div>
            ) : (
              <table className="min-w-[1550px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Codigo</th>
                    <th className="px-3 py-2 text-left">Descripcion</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Cant. Presup.</th>
                    <th className="px-3 py-2 text-right">Cant. Anterior</th>
                    <th className="px-3 py-2 text-right">Cant. Actual</th>
                    <th className="px-3 py-2 text-right">Cant. Acum.</th>
                    <th className="px-3 py-2 text-right">Saldo Cant.</th>
                    <th className="px-3 py-2 text-right">P.U.</th>
                    <th className="px-3 py-2 text-right">Monto Anterior</th>
                    <th className="px-3 py-2 text-right">Monto Actual</th>
                    <th className="px-3 py-2 text-right">Monto Acum.</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-right">% Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRows.map((row) => {
                    const cantidadActual = Number(draftActuales[row.partida_id] ?? row.cantidad_actual ?? '0')
                    const cantidadAnterior = Number(row.cantidad_anterior)
                    const cantidadPresupuesto = Number(row.cantidad_presupuesto)
                    const cantidadAcumulada = cantidadAnterior + cantidadActual
                    const saldoCantidad = cantidadPresupuesto - cantidadAcumulada
                    const precioUnitario = Number(row.precio_unitario)
                    const montoAnterior = Number(row.monto_anterior)
                    const montoActual = cantidadActual * precioUnitario
                    const montoAcumulado = montoAnterior + montoActual
                    const saldoMonto = Number(row.monto_presupuesto) - montoAcumulado
                    const avance = cantidadPresupuesto > 0 ? (cantidadAcumulada / cantidadPresupuesto) * 100 : 0

                    return (
                      <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nro}</td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                        <td className="px-3 py-2 text-foreground">{row.descripcion}</td>
                        <td className="px-3 py-2 text-foreground">{row.unidad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_presupuesto, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_anterior, 2)}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftActuales[row.partida_id] ?? row.cantidad_actual}
                            onChange={(event) => setDraftActuales((current) => ({ ...current, [row.partida_id]: event.target.value }))}
                            className="h-8 min-w-[110px] text-right tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{fmtNum(cantidadAcumulada, 2)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${saldoCantidad < 0 ? 'text-amber-700' : 'text-foreground'}`}>{fmtNum(saldoCantidad, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.precio_unitario, 4)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.monto_anterior, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-primary">{fmtNum(montoActual, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{fmtNum(montoAcumulado, 2)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${saldoMonto < 0 ? 'text-amber-700' : 'text-foreground'}`}>{fmtNum(saldoMonto, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(avance, 2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Monto valuado anterior</span>
            <span className="font-semibold tabular-nums">{fmtNum(resumen?.resumen.valuado_anterior ?? '0', 2)}</span>
            <span className="text-muted-foreground">Monto valuado actual</span>
            <span className="font-semibold tabular-nums text-primary">{fmtNum(resumen?.resumen.valuado_actual ?? '0', 2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, tone = 'default', suffix = '' }: { label: string; value: string | number; tone?: 'default' | 'primary'; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {fmtNum(value)}{suffix}
      </p>
    </div>
  )
}

export { ValuacionesPanel }
