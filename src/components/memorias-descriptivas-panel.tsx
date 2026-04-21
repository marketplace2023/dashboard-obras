import { useEffect, useMemo, useState } from 'react'
import { FileText, LoaderCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null

type BimObra = { id: string; codigo: string; nombre: string }
type BimPresupuesto = { id: string; nombre: string; version: number; tipo: string }
type Partida = { id: string; codigo: string; descripcion: string }
type Memoria = {
  id: string
  obra_id: string
  presupuesto_id: string
  partida_id: string | null
  tipo: 'proyecto' | 'partida' | 'aumento' | 'disminucion' | 'extra'
  titulo: string
  contenido: string
  status: string
  updated_at?: string
}

type Props = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) return (data as { data: T[] }).data
  return []
}

function statusLabel(status: string) {
  switch (status) {
    case 'revisado':
      return 'Revisado'
    case 'aprobado':
      return 'Aprobado'
    default:
      return 'Borrador'
  }
}

function statusClassName(status: string) {
  switch (status) {
    case 'revisado':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700'
    case 'aprobado':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground'
  }
}

function tipoLabel(tipo: Memoria['tipo']) {
  switch (tipo) {
    case 'partida':
      return 'Partida'
    case 'aumento':
      return 'Aumento'
    case 'disminucion':
      return 'Disminución'
    case 'extra':
      return 'Extra'
    default:
      return 'Proyecto'
  }
}

function MemoriasDescriptivasPanel({ token, onMessage, initialObraId }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [memorias, setMemorias] = useState<Memoria[]>([])
  const [selectedMemoriaId, setSelectedMemoriaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tipo, setTipo] = useState<Memoria['tipo']>('proyecto')
  const [partidaId, setPartidaId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')

  const selectedMemoria = memorias.find((item) => item.id === selectedMemoriaId) ?? null
  const selectedPartida = partidas.find((item) => item.id === partidaId) ?? null

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
    if (!selectedPresupuestoId) {
      setPartidas([])
      setMemorias([])
      setSelectedMemoriaId('')
      return
    }

    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/arbol`, { headers }),
      fetch(`${API_BASE_URL}/memorias/obra/${selectedObraId}?presupuestoId=${selectedPresupuestoId}`, { headers }),
    ])
      .then(async ([presupuestoRes, memoriasRes]) => {
        const presupuestoData = await presupuestoRes.json() as { capitulos?: Array<{ partidas?: Partida[] }> }
        const memoriasData = await memoriasRes.json() as unknown
        const nextPartidas = (presupuestoData.capitulos ?? []).flatMap((capitulo) => capitulo.partidas ?? [])
        const nextMemorias = unwrapList<Memoria>(memoriasData)
        setPartidas(nextPartidas)
        setMemorias(nextMemorias)
        if (nextMemorias[0]) {
          selectMemoria(nextMemorias[0])
        } else {
          resetForm()
        }
      })
      .catch(() => onMessage({ tone: 'error', text: 'No se pudieron cargar memorias descriptivas.' }))
      .finally(() => setLoading(false))
  }, [selectedObraId, selectedPresupuestoId, headers, onMessage])

  function resetForm() {
    setSelectedMemoriaId('')
    setTipo('proyecto')
    setPartidaId('')
    setTitulo('')
    setContenido('')
  }

  function selectMemoria(memoria: Memoria) {
    setSelectedMemoriaId(memoria.id)
    setTipo(memoria.tipo)
    setPartidaId(memoria.partida_id ?? '')
    setTitulo(memoria.titulo)
    setContenido(memoria.contenido)
  }

  async function handleSave() {
    if (!selectedObraId || !selectedPresupuestoId || !titulo.trim() || !contenido.trim()) {
      onMessage({ tone: 'error', text: 'Completa obra, presupuesto, título y contenido.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        obra_id: selectedObraId,
        presupuesto_id: selectedPresupuestoId,
        partida_id: tipo === 'partida' ? partidaId || undefined : undefined,
        tipo,
        titulo,
        contenido,
      }

      const response = await fetch(
        selectedMemoriaId ? `${API_BASE_URL}/memorias/${selectedMemoriaId}` : `${API_BASE_URL}/memorias`,
        {
          method: selectedMemoriaId ? 'PATCH' : 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) throw new Error('No se pudo guardar la memoria descriptiva')
      const memoria = await response.json() as Memoria

      setMemorias((current) => {
        if (selectedMemoriaId) return current.map((item) => (item.id === memoria.id ? memoria : item))
        return [memoria, ...current]
      })
      selectMemoria(memoria)
      onMessage({ tone: 'success', text: 'Memoria descriptiva guardada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar la memoria.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedMemoriaId) return

    try {
      const response = await fetch(`${API_BASE_URL}/memorias/${selectedMemoriaId}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) throw new Error('No se pudo eliminar la memoria descriptiva')
      setMemorias((current) => current.filter((item) => item.id !== selectedMemoriaId))
      resetForm()
      onMessage({ tone: 'success', text: 'Memoria descriptiva eliminada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar la memoria.' })
    }
  }

  async function handleStatusChange(nextStatus: 'revisado' | 'aprobado') {
    if (!selectedMemoriaId) return
    try {
      const response = await fetch(`${API_BASE_URL}/memorias/${selectedMemoriaId}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('No se pudo actualizar el estado de la memoria')
      const memoria = await response.json() as Memoria
      setMemorias((current) => current.map((item) => (item.id === memoria.id ? memoria : item)))
      selectMemoria(memoria)
      onMessage({ tone: 'success', text: `Memoria ${nextStatus === 'revisado' ? 'enviada a revisión' : 'aprobada'}.` })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar el estado.' })
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Memorias descriptivas</CardTitle>
          <CardDescription className="text-xs">
            Documenta alcance, criterios técnicos, observaciones de ejecución y soporte administrativo del presupuesto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,0.85fr)_minmax(260px,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label className="text-xs">Obra</Label>
            <select value={selectedObraId} onChange={(event) => setSelectedObraId(event.target.value)} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona una obra</option>
              {obras.map((obra) => <option key={obra.id} value={obra.id}>{obra.codigo} · {obra.nombre}</option>)}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Presupuesto</Label>
            <select value={selectedPresupuestoId} onChange={(event) => setSelectedPresupuestoId(event.target.value)} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona un presupuesto</option>
              {presupuestos.map((presupuesto) => <option key={presupuesto.id} value={presupuesto.id}>{presupuesto.tipo === 'sin_apu' ? 'Sin A.P.U.' : 'Con A.P.U.'} · v{presupuesto.version} · {presupuesto.nombre}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-2 lg:justify-end">
            <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
              <Plus className="size-4" />Nueva memoria
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Memorias registradas</CardTitle>
          <CardDescription className="text-xs">Proyecto, partida o documentos de cambio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-border/50 bg-muted/15 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Memorias</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{memorias.length}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/15 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Partidas</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{partidas.length}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/15 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Estado actual</p>
              <p className="mt-2 text-sm font-semibold tracking-tight">{statusLabel(selectedMemoria?.status ?? 'borrador')}</p>
            </div>
          </div>

          <div className="grid gap-2">
            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border/50 px-4 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando memorias...</div>
            ) : memorias.length > 0 ? (
              memorias.map((memoria) => (
                <button key={memoria.id} type="button" onClick={() => selectMemoria(memoria)} className={`rounded-2xl border px-4 py-3 text-left transition ${selectedMemoriaId === memoria.id ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/50 bg-background hover:bg-muted/20'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <FileText className="size-3.5" />{tipoLabel(memoria.tipo)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{memoria.titulo}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{memoria.contenido}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${statusClassName(memoria.status)}`}>
                      {statusLabel(memoria.status)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">Sin memorias descriptivas aún.</div>
            )}
          </div>
        </CardContent>
      </Card>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Editor de memoria descriptiva</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Redacta una memoria clara y deja trazabilidad del alcance técnico del proyecto o la partida seleccionada.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide ${statusClassName(selectedMemoria?.status ?? 'borrador')}`}>
                  {statusLabel(selectedMemoria?.status ?? 'borrador')}
                </span>
                {selectedPartida ? (
                  <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    {selectedPartida.codigo}
                  </span>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,260px)_minmax(0,1fr)]">
              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs">Tipo</Label>
                <select value={tipo} onChange={(event) => setTipo(event.target.value as Memoria['tipo'])} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="proyecto">Proyecto</option>
                  <option value="partida">Partida</option>
                  <option value="aumento">Aumento</option>
                  <option value="disminucion">Disminución</option>
                  <option value="extra">Extra</option>
                </select>
              </div>

              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs">Partida relacionada</Label>
                <select value={partidaId} onChange={(event) => setPartidaId(event.target.value)} disabled={tipo !== 'partida'} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60">
                  <option value="">Sin partida específica</option>
                  {partidas.map((partida) => <option key={partida.id} value={partida.id}>{partida.codigo} · {partida.descripcion}</option>)}
                </select>
              </div>

              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs">Título</Label>
                <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Memoria descriptiva del proyecto" className="w-full" />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs">Contenido</Label>
                <Textarea value={contenido} onChange={(event) => setContenido(event.target.value)} placeholder="Describe alcance, criterios técnicos, proceso constructivo, condiciones especiales y soporte documental." className="min-h-[380px] resize-y" />
              </div>

              <div className="grid gap-3 content-start">
                <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Resumen</p>
                  <div className="mt-3 grid gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="mt-1 font-medium">{tipoLabel(tipo)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Partida</p>
                      <p className="mt-1 break-words font-medium">{selectedPartida ? `${selectedPartida.codigo} · ${selectedPartida.descripcion}` : 'Sin partida específica'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Título</p>
                      <p className="mt-1 break-words font-medium">{titulo.trim() || 'Sin título aún'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Usa memorias de proyecto para alcance general y memorias de partida para detalles constructivos específicos.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
              <Button className="rounded-full" onClick={handleSave} disabled={saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar memoria
              </Button>
              {selectedMemoriaId ? <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleStatusChange('revisado')} disabled={(selectedMemoria?.status ?? 'borrador') !== 'borrador'}>Enviar a revisión</Button> : null}
              {selectedMemoriaId ? <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleStatusChange('aprobado')} disabled={(selectedMemoria?.status ?? 'borrador') !== 'revisado'}>Aprobar</Button> : null}
              {selectedMemoriaId ? <Button variant="outline" className="rounded-full" onClick={handleDelete}><Trash2 className="size-4" />Eliminar</Button> : null}
              {selectedMemoriaId ? <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}><Pencil className="size-4" />Duplicar como nueva</Button> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { MemoriasDescriptivasPanel }
