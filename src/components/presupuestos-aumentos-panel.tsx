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

type ReconsideracionDocumento = {
  id: string
  obra_id: string
  presupuesto_id: string
  tipo: string
  numero: number
  fecha: string
  titulo: string
  status: string
}

type ReconsideracionDetalleRow = {
  partida_id: string
  nro: number
  codigo: string
  descripcion: string
  unidad: string
  cantidad_original: string
  precio_unitario: string
  total_original: string
  aumento_actual: string
  monto_aumento_actual: string
  cantidad_aumento_acumulado: string
  total_aumento_acumulado: string
  cantidad_disminucion_acumulada: string
  total_disminucion_acumulada: string
  por_ejecutar: string
  total_por_ejecutar: string
  cantidad_modificada: string
  total_modificado: string
  justificacion: string | null
}

type ReconsideracionResumen = {
  documento: ReconsideracionDocumento
  resumen: {
    original: string
    extras: string
    aumentos_anteriores: string
    aumentos_actuales: string
    aumentos_acumulados: string
    disminuciones: string
    modificado: string
  }
  detalle: ReconsideracionDetalleRow[]
}

type PresupuestosAumentosPanelProps = {
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

function PresupuestosAumentosPanel({ token, onMessage, initialObraId }: PresupuestosAumentosPanelProps) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)

  const [documentos, setDocumentos] = useState<ReconsideracionDocumento[]>([])
  const [selectedDocumentoId, setSelectedDocumentoId] = useState('')
  const [loadingDocumentos, setLoadingDocumentos] = useState(false)
  const [creatingDocumento, setCreatingDocumento] = useState(false)

  const [documentoFecha, setDocumentoFecha] = useState(new Date().toISOString().slice(0, 10))
  const [documentoTitulo, setDocumentoTitulo] = useState('')

  const [resumen, setResumen] = useState<ReconsideracionResumen | null>(null)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [savingDetalles, setSavingDetalles] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [draftAumentos, setDraftAumentos] = useState<Record<string, string>>({})

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

    fetch(`${API_BASE_URL}/reconsideraciones/obra/${selectedObraId}?tipo=aumento&presupuestoId=${selectedPresupuestoId}`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return
        const list = unwrapList<ReconsideracionDocumento>(data)
        setDocumentos(list)
        if (list[0]) {
          setSelectedDocumentoId(String(list[0].id))
        } else {
          const nextNumero = 1
          setDocumentoFecha(new Date().toISOString().slice(0, 10))
          setDocumentoTitulo(`PRESUPUESTO DE AUMENTOS Nro. ${nextNumero}`)
        }
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los documentos de aumento.' })
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
      setDraftAumentos({})
      return
    }

    setLoadingResumen(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/resumen`, { headers })
      if (!response.ok) throw new Error()
      const data = await response.json() as ReconsideracionResumen
      setResumen(data)
      setDocumentoFecha(data.documento.fecha.slice(0, 10))
      setDocumentoTitulo(data.documento.titulo)
      setDraftAumentos(
        Object.fromEntries(
          data.detalle.map((row) => [row.partida_id, String(Number(row.aumento_actual || '0'))]),
        ),
      )
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el detalle del aumento.' })
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
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obra_id: selectedObraId,
          presupuesto_id: selectedPresupuestoId,
          tipo: 'aumento',
          fecha: documentoFecha,
          titulo: documentoTitulo.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error('No se pudo crear el documento de aumento')
      const documento = await response.json() as ReconsideracionDocumento
      setDocumentos((current) => [documento, ...current])
      setSelectedDocumentoId(String(documento.id))
      onMessage({ tone: 'success', text: 'Documento de aumento creado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el aumento.' })
    } finally {
      setCreatingDocumento(false)
    }
  }

  async function handleSaveHeader() {
    if (!selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: documentoFecha, titulo: documentoTitulo }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la cabecera del aumento')
      const updated = await response.json() as ReconsideracionDocumento
      setDocumentos((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      onMessage({ tone: 'success', text: 'Cabecera del aumento actualizada.' })
      await loadResumen()
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la cabecera.' })
    }
  }

  async function handleSaveDetalles() {
    if (!selectedDocumentoId || !resumen) return
    setSavingDetalles(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/detalles`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: resumen.detalle.map((row) => ({
            partida_id: row.partida_id,
            cantidad_variacion: String(Math.max(Number(draftAumentos[row.partida_id] ?? row.aumento_actual ?? '0'), 0)),
          })),
        }),
      })
      if (!response.ok) throw new Error('No se pudieron guardar los aumentos')
      const data = await response.json() as ReconsideracionResumen
      setResumen(data)
      setDraftAumentos(Object.fromEntries(data.detalle.map((row) => [row.partida_id, String(Number(row.aumento_actual || '0'))])))
      onMessage({ tone: 'success', text: 'Aumentos guardados.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron guardar los aumentos.' })
    } finally {
      setSavingDetalles(false)
    }
  }

  async function handlePrint() {
    if (!selectedPresupuestoId || !selectedObraId) return
    try {
      const response = await fetch(
        `${API_BASE_URL}/reportes/pdf?type=modificado&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`,
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
            <Label className="text-xs">Documento de aumento</Label>
            {loadingDocumentos ? (
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando documentos...
              </div>
            ) : documentos.length > 0 ? (
              <select value={selectedDocumentoId} onChange={(event) => setSelectedDocumentoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {documentos.map((documento) => (
                  <option key={documento.id} value={documento.id}>Aumento Nro. {documento.numero} · {documento.titulo}</option>
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
              Nuevo aumento
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen de montos</CardTitle>
          <CardDescription className="text-xs">Original, aumentos y modificado del presupuesto seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Original" value={resumen?.resumen.original ?? (selectedPresupuesto?.total_presupuesto ?? '0')} />
          <MetricCard label="Extras" value={resumen?.resumen.extras ?? '0'} />
          <MetricCard label="Aumentos ant." value={resumen?.resumen.aumentos_anteriores ?? '0'} />
          <MetricCard label="Aumentos act." value={resumen?.resumen.aumentos_actuales ?? '0'} />
          <MetricCard label="Disminuciones" value={resumen?.resumen.disminuciones ?? '0'} />
          <MetricCard label="Modificado" value={resumen?.resumen.modificado ?? (selectedPresupuesto?.total_presupuesto ?? '0')} tone="primary" />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 xl:grid-cols-[150px_170px_minmax(360px,1fr)] xl:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Aumento Nro.</Label>
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
                <Input value={documentoTitulo} onChange={(event) => setDocumentoTitulo(event.target.value)} placeholder="PRESUPUESTO DE AUMENTOS Nro. 1" disabled={!selectedDocumentoId} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={handleSaveHeader} disabled={!selectedDocumentoId}>
                <Pencil className="size-4" />
                Guardar cabecera
              </Button>
              <Button className="rounded-full" onClick={handleSaveDetalles} disabled={!selectedDocumentoId || savingDetalles || !resumen}>
                {savingDetalles ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar aumentos
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
                Cargando detalle del aumento...
              </div>
            ) : !selectedDocumentoId ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                Crea o selecciona un documento de aumento para editar la grilla.
              </div>
            ) : (
              <table className="min-w-[1500px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Codigo</th>
                    <th className="px-3 py-2 text-left">Descripcion</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Can. Ori.</th>
                    <th className="px-3 py-2 text-right">Pre. Uni.</th>
                    <th className="px-3 py-2 text-right">Total Ori.</th>
                    <th className="px-3 py-2 text-right">Aumento</th>
                    <th className="px-3 py-2 text-right">Monto Aum.</th>
                    <th className="px-3 py-2 text-right">Can. Aum. Acu.</th>
                    <th className="px-3 py-2 text-right">Total Aum.</th>
                    <th className="px-3 py-2 text-right">Can. Dism. Acu.</th>
                    <th className="px-3 py-2 text-right">Total Dism.</th>
                    <th className="px-3 py-2 text-right">Por Ejecu.</th>
                    <th className="px-3 py-2 text-right">Total Por Eje.</th>
                    <th className="px-3 py-2 text-right">Can. Modi.</th>
                    <th className="px-3 py-2 text-right">Total Mod.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRows.map((row) => {
                    const aumento = Number(draftAumentos[row.partida_id] ?? row.aumento_actual ?? '0')
                    const precioUnitario = Number(row.precio_unitario)
                    const montoActual = aumento * precioUnitario
                    const totalAumento = (Number(row.total_aumento_acumulado) - Number(row.monto_aumento_actual)) + montoActual
                    const cantidadAumentoAcu = (Number(row.cantidad_aumento_acumulado) - Number(row.aumento_actual)) + aumento
                    const cantidadModificada = Number(row.cantidad_original) + cantidadAumentoAcu - Number(row.cantidad_disminucion_acumulada)
                    const totalModificado = cantidadModificada * precioUnitario
                    return (
                      <tr key={row.partida_id} className="bg-background/70 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nro}</td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">{row.codigo}</td>
                        <td className="px-3 py-2 text-foreground">{row.descripcion}</td>
                        <td className="px-3 py-2 text-foreground">{row.unidad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_original, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.precio_unitario, 4)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.total_original)}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftAumentos[row.partida_id] ?? row.aumento_actual}
                            onChange={(event) => setDraftAumentos((current) => ({ ...current, [row.partida_id]: event.target.value }))}
                            className="h-8 min-w-[110px] text-right tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(montoActual)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(cantidadAumentoAcu, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(totalAumento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.cantidad_disminucion_acumulada, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.total_disminucion_acumulada)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.por_ejecutar, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.total_por_ejecutar)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{fmtNum(cantidadModificada, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(totalModificado)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total Aumentos Acumulados anterior</span>
            <span className="font-semibold tabular-nums">{fmtNum(resumen?.resumen.aumentos_anteriores ?? '0')}</span>
            <span className="text-muted-foreground">Total Aumentos Actuales</span>
            <span className="font-semibold tabular-nums text-primary">{fmtNum(resumen?.resumen.aumentos_actuales ?? '0')}</span>
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
        {fmtNum(value)}
      </p>
    </div>
  )
}

export { PresupuestosAumentosPanel }
