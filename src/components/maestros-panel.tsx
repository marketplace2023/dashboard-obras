import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

type MsgState = { tone: 'success' | 'error'; text: string } | null

type MaestroSection = 'materiales' | 'equipos' | 'mano_obra' | 'partidas'

type BimRecurso = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  tipo: 'material' | 'equipo' | 'mano_obra'
  precio: string
  activo: number
}

type BimPrecioUnitario = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  categoria?: string | null
  rendimiento: string
  precio_base: string
  activo: number
}

type BimRecursoTipo = 'material' | 'equipo' | 'mano_obra'

type BimMaterialRecurso = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  tipo: string
  precio: string
}

type BimDescomposicion = {
  id: string
  tipo: string
  recurso_id: string
  cantidad: string
  precio_recurso: string
  importe_total: string
  orden: number
  recurso: {
    id: string
    codigo: string
    descripcion: string
    unidad: string
    tipo: string
    precio: string
  }
}

type BimPrecioUnitarioDetalle = BimPrecioUnitario & {
  vigencia?: string
  descomposicion: BimDescomposicion[]
}

type MaestroPrintSnapshot = {
  label: string
  printedAt: string
  isPartidas: boolean
  rows: Array<BimRecurso | BimPrecioUnitario>
}

type MaestrosPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialSection?: MaestroSection
}

const recursoSections: Array<{ key: MaestroSection; label: string; tipo?: 'material' | 'equipo' | 'mano_obra' }> = [
  { key: 'materiales', label: 'Materiales', tipo: 'material' },
  { key: 'equipos', label: 'Equipos', tipo: 'equipo' },
  { key: 'mano_obra', label: 'Mano de Obra', tipo: 'mano_obra' },
  { key: 'partidas', label: 'Partidas' },
]

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof data === 'string' ? data : Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || 'No se pudo completar la solicitud')
  }

  return data as T
}

function formatAmount(value: string | number) {
  return Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function sortRecursos(list: BimRecurso[]) {
  return [...list].sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' }))
}

function sortPartidas(list: BimPrecioUnitario[]) {
  return [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { sensitivity: 'base' }))
}

function MaestrosPanel({ token, onMessage, initialSection = 'materiales' }: MaestrosPanelProps) {
  const [activeSection, setActiveSection] = useState<MaestroSection>(initialSection)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recursos, setRecursos] = useState<BimRecurso[]>([])
  const [partidas, setPartidas] = useState<BimPrecioUnitario[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPartidaDetalle, setEditingPartidaDetalle] = useState<BimPrecioUnitarioDetalle | null>(null)
  const [loadingPartidaDetalle, setLoadingPartidaDetalle] = useState(false)
  const [resourcesByTipo, setResourcesByTipo] = useState<Record<BimRecursoTipo, BimMaterialRecurso[]>>({
    material: [],
    equipo: [],
    mano_obra: [],
  })
  const [loadingResourcesByTipo, setLoadingResourcesByTipo] = useState<Record<BimRecursoTipo, boolean>>({
    material: false,
    equipo: false,
    mano_obra: false,
  })
  const [savingDecompId, setSavingDecompId] = useState<string | null>(null)
  const [deletingDecompId, setDeletingDecompId] = useState<string | null>(null)
  const [printSnapshot, setPrintSnapshot] = useState<MaestroPrintSnapshot | null>(null)
  const [searchText, setSearchText] = useState('')
  const [form, setForm] = useState({
    codigo: '',
    descripcion: '',
    unidad: '',
    precio: '',
    categoria: '',
    rendimiento: '1',
  })

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const currentSection = recursoSections.find((item) => item.key === activeSection) ?? recursoSections[0]
  const isPartidas = activeSection === 'partidas'
  const rows = isPartidas ? partidas : recursos
  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((row) => {
      const values = 'tipo' in row
        ? [row.codigo, row.descripcion, row.unidad, row.tipo]
        : [row.codigo, row.descripcion, row.unidad, row.categoria ?? '', row.rendimiento]
      return values.some((value) => String(value).toLowerCase().includes(query))
    })
  }, [rows, searchText])
  const visibleRows = useMemo(() => filteredRows.slice(0, 120), [filteredRows])

  useEffect(() => {
    setActiveSection(initialSection)
    resetForm()
  }, [initialSection])

  async function loadSection(section = activeSection) {
    setLoading(true)
    try {
      if (section === 'partidas') {
        const data = await parseApiResponse<BimPrecioUnitario[]>(
          await fetch(`${API_BASE_URL}/precios-unitarios`, { headers }),
        )
        setPartidas(sortPartidas(Array.isArray(data) ? data : []))
      } else {
        const tipo = recursoSections.find((item) => item.key === section)?.tipo
        const data = await parseApiResponse<BimRecurso[]>(
          await fetch(`${API_BASE_URL}/precios-unitarios/recursos?tipo=${tipo}`, { headers }),
        )
        setRecursos(sortRecursos(Array.isArray(data) ? data : []))
      }
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el maestro.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSection(activeSection)
  }, [activeSection])

  useEffect(() => {
    setSearchText('')
  }, [activeSection])

  useEffect(() => {
    if (!printSnapshot) return

    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      document.body.classList.remove('printing-maestros')
      setPrintSnapshot(null)
    }

    const handleAfterPrint = () => {
      cleanup()
    }

    document.body.classList.add('printing-maestros')
    window.addEventListener('afterprint', handleAfterPrint)

    const timer = window.setTimeout(() => {
      window.print()
    }, 120)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
      if (!cleaned) {
        document.body.classList.remove('printing-maestros')
      }
    }
  }, [printSnapshot])

  useEffect(() => {
    if (!isPartidas) return

    let active = true
    const tipos: BimRecursoTipo[] = ['material', 'equipo', 'mano_obra']
    setLoadingResourcesByTipo({ material: true, equipo: true, mano_obra: true })

    void Promise.all(
      tipos.map(async (tipo) => {
        const data = await parseApiResponse<BimMaterialRecurso[]>(
          await fetch(`${API_BASE_URL}/precios-unitarios/recursos?tipo=${tipo}`, { headers }),
        )
        return { tipo, list: Array.isArray(data) ? data : [] }
      }),
    )
      .then((results) => {
        if (!active) return
        setResourcesByTipo({
          material: results.find((item) => item.tipo === 'material')?.list ?? [],
          equipo: results.find((item) => item.tipo === 'equipo')?.list ?? [],
          mano_obra: results.find((item) => item.tipo === 'mano_obra')?.list ?? [],
        })
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los recursos del maestro.' })
      })
      .finally(() => {
        if (active) setLoadingResourcesByTipo({ material: false, equipo: false, mano_obra: false })
      })

    return () => {
      active = false
    }
  }, [headers, isPartidas, onMessage])

  function resetForm() {
    setEditingId(null)
    setForm({ codigo: '', descripcion: '', unidad: '', precio: '', categoria: '', rendimiento: '1' })
  }

  function upsertRecurso(item: BimRecurso) {
    setRecursos((current) => sortRecursos([item, ...current.filter((row) => row.id !== item.id)]))
  }

  function upsertPartida(item: BimPrecioUnitario) {
    setPartidas((current) => sortPartidas([item, ...current.filter((row) => row.id !== item.id)]))
  }

  function handleEdit(item: BimRecurso | BimPrecioUnitario) {
    setEditingId(item.id)
    if ('tipo' in item) {
      setForm({
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        precio: item.precio,
        categoria: '',
        rendimiento: '1',
      })
    } else {
      setForm({
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        precio: item.precio_base,
        categoria: item.categoria ?? '',
        rendimiento: item.rendimiento,
      })
    }
  }

  async function handleOpenPartidaDetalle(id: string) {
    setLoadingPartidaDetalle(true)
    try {
      const data = await parseApiResponse<BimPrecioUnitarioDetalle>(
        await fetch(`${API_BASE_URL}/precios-unitarios/${id}`, { headers }),
      )
      const next = {
        ...data,
        descomposicion: Array.isArray(data.descomposicion) ? data.descomposicion : [],
      }
      setEditingPartidaDetalle(next)
      upsertPartida(next)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el detalle de la partida.' })
    } finally {
      setLoadingPartidaDetalle(false)
    }
  }

  async function refreshPartidaDetalle() {
    if (!editingPartidaDetalle?.id) return
    const data = await parseApiResponse<BimPrecioUnitarioDetalle>(
      await fetch(`${API_BASE_URL}/precios-unitarios/${editingPartidaDetalle.id}`, { headers }),
    )
    const next = {
      ...data,
      descomposicion: Array.isArray(data.descomposicion) ? data.descomposicion : [],
    }
    setEditingPartidaDetalle(next)
    upsertPartida(next)
  }

  async function handleCreateDecomp(input: {
    tipo: BimRecursoTipo
    recurso_id: string
    cantidad: string
    precio_recurso: string
  }) {
    if (!editingPartidaDetalle) return
    setSavingDecompId('new')
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/precios-unitarios/${editingPartidaDetalle.id}/descomposicion`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, orden: editingPartidaDetalle.descomposicion.length }),
        }),
      )
      await refreshPartidaDetalle()
      onMessage({ tone: 'success', text: 'Insumo APU agregado correctamente.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo agregar el insumo.' })
    } finally {
      setSavingDecompId(null)
    }
  }

  async function handleUpdateDecomp(id: string, input: { cantidad: string; precio_recurso: string }) {
    setSavingDecompId(id)
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/precios-unitarios/descomposicion/${id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      )
      await refreshPartidaDetalle()
      onMessage({ tone: 'success', text: 'Insumo APU actualizado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar el insumo.' })
    } finally {
      setSavingDecompId(null)
    }
  }

  async function handleDeleteDecomp(id: string) {
    setDeletingDecompId(id)
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/precios-unitarios/descomposicion/${id}`, {
          method: 'DELETE',
          headers,
        }),
      )
      await refreshPartidaDetalle()
      onMessage({ tone: 'success', text: 'Insumo APU eliminado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar el insumo.' })
    } finally {
      setDeletingDecompId(null)
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const vigencia = new Date().toISOString().slice(0, 10)

      if (isPartidas) {
        const payload = {
          codigo: form.codigo,
          descripcion: form.descripcion,
          unidad: form.unidad,
          categoria: form.categoria || undefined,
          rendimiento: form.rendimiento || '1',
          vigencia,
        }

        const saved = await parseApiResponse<BimPrecioUnitario>(
          await fetch(`${API_BASE_URL}/precios-unitarios${editingId ? `/${editingId}` : ''}`, {
            method: editingId ? 'PATCH' : 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(editingId ? payload : { ...payload, precio_base: '0' }),
          }),
        )
        upsertPartida(saved)
        if (editingPartidaDetalle?.id === saved.id) {
          setEditingPartidaDetalle((current) => current ? { ...current, ...saved } : current)
        }
      } else {
        const tipo = currentSection.tipo
        const payload = {
          codigo: form.codigo,
          descripcion: form.descripcion,
          unidad: form.unidad,
          precio: form.precio || '0',
          tipo,
          vigencia,
        }

        const saved = await parseApiResponse<BimRecurso>(
          await fetch(`${API_BASE_URL}/precios-unitarios/recursos${editingId ? `/${editingId}` : ''}`, {
            method: editingId ? 'PATCH' : 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        )
        upsertRecurso(saved)
      }

      onMessage({ tone: 'success', text: `${currentSection.label} guardado correctamente.` })
      resetForm()
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el registro.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await parseApiResponse(
        await fetch(`${API_BASE_URL}/${isPartidas ? `precios-unitarios/${id}` : `precios-unitarios/recursos/${id}`}`, {
          method: 'DELETE',
          headers,
        }),
      )
      onMessage({ tone: 'success', text: `${currentSection.label} eliminado correctamente.` })
      if (editingId === id) resetForm()
      if (isPartidas) {
        setPartidas((current) => current.filter((row) => row.id !== id))
        if (editingPartidaDetalle?.id === id) setEditingPartidaDetalle(null)
      } else {
        setRecursos((current) => current.filter((row) => row.id !== id))
      }
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar el registro.' })
    } finally {
      setDeletingId(null)
    }
  }

  function handlePrint() {
    if (rows.length === 0) {
      onMessage({ tone: 'error', text: `No hay registros para imprimir en ${currentSection.label.toLowerCase()}.` })
      return
    }
    setPrintSnapshot({
      label: currentSection.label,
      printedAt: new Date().toLocaleString('es-VE'),
      isPartidas,
      rows: [...rows],
    })
    onMessage(null)
  }

  return (
    <>
      <div className="grid gap-6">
      <Card className="border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="size-5 text-primary" />
                {currentSection.label}
              </CardTitle>
              <CardDescription>
                Ver, actualizar y eliminar registros del maestro seleccionado desde la navegacion lateral.
              </CardDescription>
            </div>
            <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              {rows.length} registro{rows.length === 1 ? '' : 's'} cargado{rows.length === 1 ? '' : 's'}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px] xl:items-start">
        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>{currentSection.label}</CardTitle>
                <CardDescription>Ver, actualizar y eliminar registros del maestro.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={handlePrint} disabled={loading || rows.length === 0}>
                  Imprimir
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
                  <Plus className="size-4" />
                  Nuevo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={`Buscar en ${currentSection.label.toLowerCase()}...`}
              />
              <div className="text-xs text-muted-foreground">
                Mostrando {visibleRows.length} de {filteredRows.length}
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando {currentSection.label.toLowerCase()}...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                {searchText.trim() ? 'No hay resultados para la búsqueda.' : 'No hay registros en este maestro.'}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRows.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{row.codigo}</span>
                        <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">{row.unidad}</span>
                        {'tipo' in row ? (
                          <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">{row.tipo}</span>
                        ) : row.categoria ? (
                          <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">{row.categoria}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground break-words">{row.descripcion}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {'tipo' in row ? (
                          <span>Precio: <span className="font-semibold text-foreground">{Number(row.precio).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        ) : (
                          <>
                            <span>Rendimiento: <span className="font-semibold text-foreground">{row.rendimiento}</span></span>
                            <span>Precio base: <span className="font-semibold text-foreground">{Number(row.precio_base).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                     <div className="flex shrink-0 items-center gap-2">
                      {isPartidas && 'rendimiento' in row ? (
                        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void handleOpenPartidaDetalle(row.id)}>
                          APU
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => handleEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-full text-destructive" disabled={deletingId === row.id} onClick={() => void handleDelete(row.id)}>
                        {deletingId === row.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredRows.length > visibleRows.length ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-4 text-center text-sm text-muted-foreground">
                    Hay {filteredRows.length - visibleRows.length} registros adicionales. Refina la búsqueda para acotar la lista.
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/90 shadow-sm xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle>{editingId ? `Editar ${currentSection.label.slice(0, -1)}` : `Nuevo ${currentSection.label.slice(0, -1)}`}</CardTitle>
            <CardDescription>Formulario rapido del maestro seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSave}>
              <div className="grid gap-2">
                <Label htmlFor="master-code">Codigo</Label>
                <Input id="master-code" value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value }))} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="master-description">Descripcion</Label>
                <Textarea id="master-description" value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="master-unit">Unidad</Label>
                  <Input id="master-unit" value={form.unidad} onChange={(event) => setForm((current) => ({ ...current, unidad: event.target.value }))} required />
                </div>

                {isPartidas ? (
                  <div className="grid gap-2">
                    <Label htmlFor="master-category">Categoria</Label>
                    <Input id="master-category" value={form.categoria} onChange={(event) => setForm((current) => ({ ...current, categoria: event.target.value }))} />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="master-price">Precio</Label>
                    <Input id="master-price" type="number" min="0" step="0.0001" value={form.precio} onChange={(event) => setForm((current) => ({ ...current, precio: event.target.value }))} required />
                  </div>
                )}
              </div>

              {isPartidas ? (
                <div className="grid gap-2">
                  <Label htmlFor="master-performance">Rendimiento</Label>
                  <Input id="master-performance" type="number" min="0.0001" step="0.0001" value={form.rendimiento} onChange={(event) => setForm((current) => ({ ...current, rendimiento: event.target.value }))} required />
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="rounded-full" disabled={saving}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  Guardar
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>

      {printSnapshot && typeof document !== 'undefined'
        ? createPortal(
            <section className="maestros-print-root" aria-hidden="true">
              <div className="maestros-print-header">
                <div>
                  <h1>Maestro: {printSnapshot.label}</h1>
                  <p>{printSnapshot.rows.length} registro{printSnapshot.rows.length === 1 ? '' : 's'}</p>
                </div>
                <div>
                  <p>Fecha de impresion: {printSnapshot.printedAt}</p>
                </div>
              </div>

              <table className="maestros-print-table">
                <thead>
                  {printSnapshot.isPartidas ? (
                    <tr>
                      <th>Codigo</th>
                      <th>Descripcion</th>
                      <th>Unidad</th>
                      <th>Categoria</th>
                      <th>Rendimiento</th>
                      <th>Precio base</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Codigo</th>
                      <th>Descripcion</th>
                      <th>Unidad</th>
                      <th>Tipo</th>
                      <th>Precio</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {printSnapshot.rows.map((row) => (
                    'tipo' in row ? (
                      <tr key={row.id}>
                        <td>{row.codigo}</td>
                        <td>{row.descripcion}</td>
                        <td>{row.unidad}</td>
                        <td>{row.tipo}</td>
                        <td className="num">{formatAmount(row.precio)}</td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td>{row.codigo}</td>
                        <td>{row.descripcion}</td>
                        <td>{row.unidad}</td>
                        <td>{row.categoria ?? ''}</td>
                        <td className="num">{row.rendimiento}</td>
                        <td className="num">{formatAmount(row.precio_base)}</td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </section>,
            document.body,
          )
        : null}

      {editingPartidaDetalle && typeof document !== 'undefined'
        ? createPortal(
            <ApuMasterModal
              partida={editingPartidaDetalle}
              loading={loadingPartidaDetalle}
              resourcesByTipo={resourcesByTipo}
              loadingResourcesByTipo={loadingResourcesByTipo}
              savingDecompId={savingDecompId}
              deletingDecompId={deletingDecompId}
              onClose={() => setEditingPartidaDetalle(null)}
              onCreateDecomp={handleCreateDecomp}
              onUpdateDecomp={handleUpdateDecomp}
              onDeleteDecomp={handleDeleteDecomp}
            />,
            document.body,
          )
        : null}
    </>
  )
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  mano_obra: { label: 'Mano de obra', color: 'text-blue-600 dark:text-blue-400' },
  material: { label: 'Material', color: 'text-emerald-600 dark:text-emerald-400' },
  equipo: { label: 'Equipo', color: 'text-orange-600 dark:text-orange-400' },
  subcontrato: { label: 'Subcontrato', color: 'text-purple-600 dark:text-purple-400' },
}

function tipoLabel(tipo: string) {
  return TIPO_LABELS[tipo] ?? { label: tipo, color: 'text-muted-foreground' }
}

function ApuMasterModal({
  partida,
  loading,
  resourcesByTipo,
  loadingResourcesByTipo,
  savingDecompId,
  deletingDecompId,
  onClose,
  onCreateDecomp,
  onUpdateDecomp,
  onDeleteDecomp,
}: {
  partida: BimPrecioUnitarioDetalle
  loading: boolean
  resourcesByTipo: Record<BimRecursoTipo, BimMaterialRecurso[]>
  loadingResourcesByTipo: Record<BimRecursoTipo, boolean>
  savingDecompId: string | null
  deletingDecompId: string | null
  onClose: () => void
  onCreateDecomp: (input: { tipo: BimRecursoTipo; recurso_id: string; cantidad: string; precio_recurso: string }) => Promise<void>
  onUpdateDecomp: (id: string, input: { cantidad: string; precio_recurso: string }) => Promise<void>
  onDeleteDecomp: (id: string) => Promise<void>
}) {
  const [activeTipo, setActiveTipo] = useState<BimRecursoTipo>('material')
  const [selectedRecursoId, setSelectedRecursoId] = useState('')
  const [newItem, setNewItem] = useState({ cantidad: '1', precio_recurso: '0' })

  useEffect(() => {
    setActiveTipo('material')
    setSelectedRecursoId('')
    setNewItem({ cantidad: '1', precio_recurso: '0' })
  }, [partida.id])

  const recursos = resourcesByTipo[activeTipo] ?? []
  const selectedRecurso = recursos.find((item) => item.id === selectedRecursoId) ?? null

  useEffect(() => {
    if (!selectedRecurso) return
    setNewItem((current) => ({ ...current, precio_recurso: selectedRecurso.precio || current.precio_recurso }))
  }, [selectedRecurso])

  const grouped = partida.descomposicion.reduce<Record<string, BimDescomposicion[]>>((acc, item) => {
    if (!acc[item.tipo]) acc[item.tipo] = []
    acc[item.tipo].push(item)
    return acc
  }, {})

  const totalGeneral = partida.descomposicion.reduce((sum, item) => sum + Number(item.importe_total), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-6xl flex-col rounded-2xl border border-border/60 bg-background shadow-2xl" style={{ maxHeight: '92vh' }}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">{partida.codigo}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{partida.unidad}</span>
              {partida.categoria ? <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">{partida.categoria}</span> : null}
            </div>
            <p className="mt-1 text-sm font-medium leading-5 text-foreground">{partida.descripcion}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Rendimiento: <strong className="text-foreground">{partida.rendimiento}</strong></span>
              <span>Precio base: <strong className="text-primary">{formatAmount(partida.precio_base)}</strong></span>
              <span>Total desglose: <strong className="text-primary">{formatAmount(totalGeneral)}</strong></span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,4fr)_minmax(320px,3fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-border/40 px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descomposición APU</h3>
                <p className="mt-1 text-xs text-muted-foreground">Materiales, equipos y mano de obra que componen esta partida maestra.</p>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Total APU: {formatAmount(totalGeneral)}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando desglose...
              </div>
            ) : partida.descomposicion.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                Esta partida no tiene insumos cargados todavía.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([tipo, items]) => {
                  const subtotal = items.reduce((sum, item) => sum + Number(item.importe_total), 0)
                  const { label, color } = tipoLabel(tipo)
                  return (
                    <div key={tipo} className="space-y-3">
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</div>
                      {items.map((item) => (
                        <ApuDecompRow
                          key={item.id}
                          item={item}
                          saving={savingDecompId === item.id}
                          deleting={deletingDecompId === item.id}
                          onSave={(input) => onUpdateDecomp(item.id, input)}
                          onDelete={() => onDeleteDecomp(item.id)}
                        />
                      ))}
                      <div className="text-right text-xs font-semibold text-muted-foreground">
                        Subtotal {label}: <span className={color}>{formatAmount(subtotal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agregar insumo</h3>
            <div className="mt-3 grid gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="grid gap-2">
                <Label className="text-xs">Tipo</Label>
                <div className="flex flex-wrap gap-2">
                  {(['material', 'equipo', 'mano_obra'] as BimRecursoTipo[]).map((tipo) => (
                    <Button key={tipo} type="button" variant={activeTipo === tipo ? 'default' : 'outline'} className="h-8 rounded-full px-3 text-xs" onClick={() => {
                      setActiveTipo(tipo)
                      setSelectedRecursoId('')
                      setNewItem({ cantidad: '1', precio_recurso: '0' })
                    }}>
                      {tipoLabel(tipo).label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Recurso del catálogo</Label>
                <select value={selectedRecursoId} onChange={(e) => setSelectedRecursoId(e.target.value)} className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Selecciona una opción</option>
                  {recursos.map((recurso) => (
                    <option key={recurso.id} value={recurso.id}>{recurso.codigo} · {recurso.descripcion}</option>
                  ))}
                </select>
                {loadingResourcesByTipo[activeTipo] ? <p className="text-xs text-muted-foreground">Cargando catálogo...</p> : null}
              </div>

              {selectedRecurso ? (
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs">
                  <div className="font-mono text-primary">{selectedRecurso.codigo}</div>
                  <div className="mt-1 text-foreground">{selectedRecurso.descripcion}</div>
                  <div className="mt-1 text-muted-foreground">Unidad: {selectedRecurso.unidad} · Costo base: {formatAmount(selectedRecurso.precio)}</div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min="0" step="0.0001" value={newItem.cantidad} onChange={(e) => setNewItem((current) => ({ ...current, cantidad: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Costo</Label>
                  <Input type="number" min="0" step="0.0001" value={newItem.precio_recurso} onChange={(e) => setNewItem((current) => ({ ...current, precio_recurso: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>

              <div className="rounded-lg bg-background px-3 py-2 text-sm">
                Total estimado: <span className="font-semibold tabular-nums text-primary">{formatAmount(Number(newItem.cantidad) * Number(newItem.precio_recurso))}</span>
              </div>

              <Button className="h-9 rounded-full" disabled={!selectedRecurso || savingDecompId === 'new' || Number(newItem.cantidad) <= 0} onClick={async () => {
                if (!selectedRecurso) return
                await onCreateDecomp({
                  tipo: activeTipo,
                  recurso_id: selectedRecurso.id,
                  cantidad: newItem.cantidad,
                  precio_recurso: newItem.precio_recurso,
                })
                setSelectedRecursoId('')
                setNewItem({ cantidad: '1', precio_recurso: '0' })
              }}>
                {savingDecompId === 'new' ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Agregar {tipoLabel(activeTipo).label.toLowerCase()}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApuDecompRow({
  item,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  item: BimDescomposicion
  saving: boolean
  deleting: boolean
  onSave: (input: { cantidad: string; precio_recurso: string }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [cantidad, setCantidad] = useState(item.cantidad)
  const [precio, setPrecio] = useState(item.precio_recurso)

  useEffect(() => {
    setCantidad(item.cantidad)
    setPrecio(item.precio_recurso)
  }, [item.id, item.cantidad, item.precio_recurso])

  const total = Number(cantidad) * Number(precio)

  return (
    <div className="rounded-xl border border-border/50 bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-primary">{item.recurso?.codigo}</div>
          <div className="mt-1 text-sm text-foreground">{item.recurso?.descripcion}</div>
          <div className="mt-1 text-xs text-muted-foreground">Unidad: {item.recurso?.unidad}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Total
          <div className="text-sm font-semibold tabular-nums text-primary">{formatAmount(total)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <Input type="number" min="0" step="0.0001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-8 text-sm" />
        <Input type="number" min="0" step="0.0001" value={precio} onChange={(e) => setPrecio(e.target.value)} className="h-8 text-sm" />
        <Button className="h-8 rounded-full px-3" disabled={saving} onClick={() => onSave({ cantidad, precio_recurso: precio })}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          Guardar
        </Button>
        <Button variant="outline" className="h-8 rounded-full px-3 text-destructive" disabled={deleting} onClick={() => void onDelete()}>
          {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Eliminar
        </Button>
      </div>
      <div className="mt-2 grid gap-2 text-[10px] uppercase tracking-wide text-muted-foreground md:grid-cols-2">
        <span>Cantidad</span>
        <span>Costo</span>
      </div>
    </div>
  )
}

export { MaestrosPanel }
