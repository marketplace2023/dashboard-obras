import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileDown, LoaderCircle, Pencil, Plus, Save, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null

type BimObra = { id: string; codigo: string; nombre: string }
type BimPresupuesto = { id: string; nombre: string; total_presupuesto: string; version: number; tipo: string }
type Documento = { id: string; obra_id: string; presupuesto_id: string; tipo: string; numero: number; fecha: string; titulo: string; status: string }
type Detalle = { partida_id: string; capitulo_id: string | null; nro: number; codigo: string; descripcion: string; unidad: string; cantidad_extra: string; precio_unitario: string; monto_extra: string; justificacion: string | null }
type Resumen = { documento: Documento; resumen: { original: string; extras: string; aumentos: string; disminuciones: string; modificado: string }; detalle: Detalle[] }
type PresupuestoModificadoSnapshot = { presupuesto_modificado: { id: string; nombre: string; total_presupuesto: string; estado: string } | null }

type Props = { user: AuthUser; token: string; onMessage: (msg: MsgState) => void; initialObraId?: string }

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) return (data as { data: T[] }).data
  return []
}

function fmtNum(value: string | number, decimals = 2) {
  return Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function ObrasExtrasPanel({ token, onMessage, initialObraId }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const today = new Date().toISOString().slice(0, 10)

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
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
  const [draftRows, setDraftRows] = useState<Array<{ partida_id?: string; capitulo_id?: string | null; codigo: string; descripcion: string; unidad: string; cantidad_variacion: string; precio_unitario: string; justificacion: string }>>([])
  const [syncingModificado, setSyncingModificado] = useState(false)
  const [modificadoSnapshot, setModificadoSnapshot] = useState<PresupuestoModificadoSnapshot | null>(null)

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
      setDocumentos([])
      setSelectedDocumentoId('')
      setResumen(null)
      return
    }

    setLoading(true)
    fetch(`${API_BASE_URL}/reconsideraciones/obra/${selectedObraId}?tipo=extra&presupuestoId=${selectedPresupuestoId}`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        const list = unwrapList<Documento>(data)
        setDocumentos(list)
        if (list[0]) {
          setSelectedDocumentoId(String(list[0].id))
        } else {
          setSelectedDocumentoId('')
          setDocumentoFecha(today)
          setDocumentoTitulo('PRESUPUESTO DE OBRAS EXTRAS Nro. 1')
          setDraftRows([{ codigo: '', descripcion: '', unidad: '', cantidad_variacion: '0', precio_unitario: '0', justificacion: '' }])
        }
      })
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar las obras extras.' }))
      .finally(() => setLoading(false))
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage, today])

  const loadResumen = useCallback(async () => {
    if (!selectedDocumentoId) {
      setResumen(null)
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
      setDraftRows(data.detalle.map((row) => ({ partida_id: row.partida_id, capitulo_id: row.capitulo_id, codigo: row.codigo, descripcion: row.descripcion, unidad: row.unidad, cantidad_variacion: String(Number(row.cantidad_extra || '0')), precio_unitario: String(Number(row.precio_unitario || '0')), justificacion: row.justificacion ?? '' })))
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el detalle de obras extras.' })
    } finally {
      setLoadingResumen(false)
    }
  }, [selectedDocumentoId, headers, onMessage])

  useEffect(() => {
    void loadResumen()
  }, [loadResumen])

  useEffect(() => {
    if (!selectedPresupuestoId) {
      setModificadoSnapshot(null)
      return
    }

    fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/modificado`, { headers })
      .then((response) => response.json())
      .then((data: PresupuestoModificadoSnapshot) => setModificadoSnapshot(data))
      .catch(() => {})
  }, [selectedPresupuestoId, headers])

  async function handleCreateDocumento() {
    if (!selectedObraId || !selectedPresupuestoId) return
    setCreating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_id: selectedObraId, presupuesto_id: selectedPresupuestoId, tipo: 'extra', fecha: documentoFecha, titulo: documentoTitulo.trim() || undefined }),
      })
      if (!response.ok) throw new Error('No se pudo crear el documento de obras extras')
      const documento = await response.json() as Documento
      setDocumentos((current) => [documento, ...current])
      setSelectedDocumentoId(String(documento.id))
      onMessage({ tone: 'success', text: 'Documento de obras extras creado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el documento.' })
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
        body: JSON.stringify({ fecha: documentoFecha, titulo: documentoTitulo }),
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
    if (!selectedDocumentoId) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/reconsideraciones/documentos/${selectedDocumentoId}/detalles`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: draftRows.map((row) => ({
            partida_id: row.partida_id,
            capitulo_id: row.capitulo_id,
            codigo: row.codigo,
            descripcion: row.descripcion,
            unidad: row.unidad,
            cantidad_variacion: row.cantidad_variacion,
            precio_unitario: row.precio_unitario,
            justificacion: row.justificacion || undefined,
          })),
        }),
      })
      if (!response.ok) throw new Error('No se pudieron guardar las obras extras')
      const data = await response.json() as Resumen
      setResumen(data)
      setDraftRows(data.detalle.map((row) => ({ partida_id: row.partida_id, capitulo_id: row.capitulo_id, codigo: row.codigo, descripcion: row.descripcion, unidad: row.unidad, cantidad_variacion: String(Number(row.cantidad_extra || '0')), precio_unitario: String(Number(row.precio_unitario || '0')), justificacion: row.justificacion ?? '' })))
      onMessage({ tone: 'success', text: 'Obras extras guardadas.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudieron guardar las obras extras.' })
    } finally {
      setSaving(false)
    }
  }

  function addDraftRow() {
    setDraftRows((current) => [...current, { codigo: '', descripcion: '', unidad: '', cantidad_variacion: '0', precio_unitario: '0', justificacion: '' }])
  }

  async function handlePrint() {
    if (!selectedPresupuestoId || !selectedObraId || !selectedDocumentoId) return
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/pdf?type=extras&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}&documentoId=${selectedDocumentoId}`, { headers })
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
      const snapshotResponse = await fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/modificado`, { headers })
      if (snapshotResponse.ok) {
        setModificadoSnapshot(await snapshotResponse.json() as PresupuestoModificadoSnapshot)
      }
      onMessage({ tone: 'success', text: `Documento ${nextStatus === 'revisado' ? 'enviado a revisión' : 'aprobado'}.` })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar el estado.' })
    }
  }

  async function handleSyncModificado() {
    if (!selectedPresupuestoId) return
    setSyncingModificado(true)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/modificado/sync`, {
        method: 'POST',
        headers,
      })
      if (!response.ok) throw new Error('No se pudo sincronizar el presupuesto modificado')
      const data = await response.json() as PresupuestoModificadoSnapshot
      setModificadoSnapshot(data)
      onMessage({ tone: 'success', text: 'Presupuesto modificado sincronizado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo sincronizar el presupuesto modificado.' })
    } finally {
      setSyncingModificado(false)
    }
  }

  const filteredRows = useMemo(() => {
    const query = searchText.toLowerCase().trim()
    if (!query) return draftRows
    return draftRows.filter((row) => row.codigo.toLowerCase().includes(query) || row.descripcion.toLowerCase().includes(query))
  }, [draftRows, searchText])

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(260px,1fr)_auto] xl:grid-cols-[minmax(240px,0.9fr)_minmax(320px,1fr)_minmax(320px,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label className="text-xs">Obra</Label>
            <select value={selectedObraId} onChange={(event) => setSelectedObraId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona una obra</option>
              {obras.map((obra) => <option key={obra.id} value={obra.id}>{obra.codigo} · {obra.nombre}</option>)}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Presupuesto base</Label>
            <select value={selectedPresupuestoId} onChange={(event) => setSelectedPresupuestoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona un presupuesto</option>
              {presupuestos.map((presupuesto) => <option key={presupuesto.id} value={presupuesto.id}>{presupuesto.tipo === 'sin_apu' ? 'Sin A.P.U.' : 'Con A.P.U.'} · v{presupuesto.version} · {presupuesto.nombre}</option>)}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Documento de extras</Label>
            {documentos.length > 0 ? (
              <select value={selectedDocumentoId} onChange={(event) => setSelectedDocumentoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {documentos.map((documento) => <option key={documento.id} value={documento.id}>Extra Nro. {documento.numero} · {documento.titulo}</option>)}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 text-sm text-muted-foreground">Sin documentos aún</div>
            )}
          </div>

          <div className="flex items-end gap-2 xl:justify-end">
            <Button variant="outline" className="rounded-full" onClick={handlePrint} disabled={!selectedPresupuestoId}><FileDown className="size-4" />Imprimir PDF</Button>
            <Button className="rounded-full" onClick={handleCreateDocumento} disabled={!selectedObraId || !selectedPresupuestoId || creating}>{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Nuevo extra</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumen de presupuesto modificado</CardTitle>
          <CardDescription className="text-xs">Original + extras + aumentos - disminuciones.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Original" value={resumen?.resumen.original ?? '0'} />
          <MetricCard label="Extras" value={resumen?.resumen.extras ?? '0'} />
          <MetricCard label="Aumentos" value={resumen?.resumen.aumentos ?? '0'} />
          <MetricCard label="Disminuciones" value={resumen?.resumen.disminuciones ?? '0'} />
          <MetricCard label="Modificado" value={resumen?.resumen.modificado ?? '0'} tone="primary" />
        </CardContent>
        {modificadoSnapshot?.presupuesto_modificado ? (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Snapshot formal activo: {modificadoSnapshot.presupuesto_modificado.nombre} · Total {fmtNum(modificadoSnapshot.presupuesto_modificado.total_presupuesto)}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 xl:grid-cols-[150px_170px_minmax(360px,1fr)] xl:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Extra Nro.</Label>
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
                <Label className="text-xs">Titulo</Label>
                <Input value={documentoTitulo} onChange={(event) => setDocumentoTitulo(event.target.value)} placeholder="PRESUPUESTO DE OBRAS EXTRAS Nro. 1" disabled={!selectedDocumentoId} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full border border-border/60 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                {resumen?.documento.status ?? 'borrador'}
              </div>
              <Button variant="outline" className="rounded-full" onClick={handleSaveHeader} disabled={!selectedDocumentoId}><Pencil className="size-4" />Guardar cabecera</Button>
              <Button variant="outline" className="rounded-full" onClick={() => void handleStatusChange('revisado')} disabled={!selectedDocumentoId || !resumen || resumen.documento.status !== 'borrador'}>Enviar a revisión</Button>
              <Button variant="outline" className="rounded-full" onClick={() => void handleStatusChange('aprobado')} disabled={!selectedDocumentoId || !resumen || resumen.documento.status !== 'revisado'}>Aprobar</Button>
              <Button variant="outline" className="rounded-full" onClick={() => void handleSyncModificado()} disabled={!selectedPresupuestoId || syncingModificado}>
                {syncingModificado ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Sincronizar modificado
              </Button>
              <Button variant="outline" className="rounded-full" onClick={addDraftRow} disabled={!selectedDocumentoId}><Plus className="size-4" />Nueva partida extra</Button>
              <Button className="rounded-full" onClick={handleSaveDetalles} disabled={!selectedDocumentoId || saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar extras</Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar codigo o descripcion..." value={searchText} onChange={(event) => setSearchText(event.target.value)} className="pl-8" />
            {searchText ? <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchText('')}><X className="size-3.5 text-muted-foreground hover:text-foreground" /></button> : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            {loading || loadingResumen ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando detalle de extras...</div>
            ) : !selectedDocumentoId ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">Crea o selecciona un documento de extras para editar la grilla.</div>
            ) : (
              <table className="min-w-[1300px] divide-y divide-border/50 text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nro.</th>
                    <th className="px-3 py-2 text-left">Codigo</th>
                    <th className="px-3 py-2 text-left">Descripcion</th>
                    <th className="px-3 py-2 text-left">Und.</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">P.U.</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Justificacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRows.map((row, index) => {
                    const monto = Number(row.cantidad_variacion || '0') * Number(row.precio_unitario || '0')
                    return (
                      <tr key={row.partida_id ?? `draft-${index}`} className="bg-background/70 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium text-foreground">{index + 1}</td>
                        <td className="px-3 py-2"><Input value={row.codigo} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, codigo: event.target.value } : item))} className="h-8 min-w-[120px]" /></td>
                        <td className="px-3 py-2"><Input value={row.descripcion} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, descripcion: event.target.value } : item))} className="h-8 min-w-[260px]" /></td>
                        <td className="px-3 py-2"><Input value={row.unidad} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, unidad: event.target.value } : item))} className="h-8 min-w-[100px]" /></td>
                        <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.cantidad_variacion} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, cantidad_variacion: event.target.value } : item))} className="h-8 min-w-[110px] text-right tabular-nums" /></td>
                        <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.precio_unitario} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, precio_unitario: event.target.value } : item))} className="h-8 min-w-[110px] text-right tabular-nums" /></td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{fmtNum(monto, 2)}</td>
                        <td className="px-3 py-2"><Input value={row.justificacion} onChange={(event) => setDraftRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, justificacion: event.target.value } : item))} className="h-8 min-w-[220px]" /></td>
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

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'primary' }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>{fmtNum(value)}</p>
    </div>
  )
}

export { ObrasExtrasPanel }
