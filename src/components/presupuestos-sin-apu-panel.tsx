import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown, ListPlus, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
}

type BimPartidaRow = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: string
  precio_unitario: string
  importe_total: string
  orden: number
}

type BimCapituloNodo = {
  id: string
  codigo: string
  nombre: string
  orden: number
  partidas: BimPartidaRow[]
}

type PresupuestoArbol = BimPresupuesto & { capitulos: BimCapituloNodo[] }

type BimCatalogoPartida = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  categoria: string | null
  precio_base: string
}

type PresupuestosSinApuPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
}

const DEFAULT_CAPITULO = { codigo: '01', nombre: 'General' }

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

function PresupuestosSinApuPanel({ token, onMessage, initialObraId }: PresupuestosSinApuPanelProps) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)
  const [showNewPres, setShowNewPres] = useState(false)
  const [newPresNombre, setNewPresNombre] = useState('')
  const [creatingPres, setCreatingPres] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

  const [arbol, setArbol] = useState<PresupuestoArbol | null>(null)
  const [loadingArbol, setLoadingArbol] = useState(false)
  const [selectedCapituloId, setSelectedCapituloId] = useState('')

  const [catalogo, setCatalogo] = useState<BimCatalogoPartida[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState('')
  const [selectedPartida, setSelectedPartida] = useState<BimCatalogoPartida | null>(null)

  const [cantidad, setCantidad] = useState('1')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [addingPartida, setAddingPartida] = useState(false)

  const [editingPartida, setEditingPartida] = useState<BimPartidaRow | null>(null)
  const [editCantidad, setEditCantidad] = useState('1')
  const [editPrecioUnitario, setEditPrecioUnitario] = useState('0')
  const [savingPartida, setSavingPartida] = useState(false)
  const [deletingPartidaId, setDeletingPartidaId] = useState<string | null>(null)

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
      setArbol(null)
      return
    }

    let active = true
    setLoadingPresupuestos(true)
    setSelectedPresupuestoId('')
    setArbol(null)

    fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=sin_apu`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return
        const list = unwrapList<BimPresupuesto>(data)
        setPresupuestos(list)
        if (list[0]) setSelectedPresupuestoId(String(list[0].id))
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los presupuestos sin A.P.U.' })
      })
      .finally(() => {
        if (active) setLoadingPresupuestos(false)
      })

    return () => {
      active = false
    }
  }, [selectedObraId, headers, onMessage])

  const loadArbol = useCallback(async () => {
    if (!selectedPresupuestoId) {
      setArbol(null)
      return
    }

    setLoadingArbol(true)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/arbol`, { headers })
      if (!response.ok) throw new Error()
      const data = await response.json() as PresupuestoArbol
      setArbol(data)
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el presupuesto sin A.P.U.' })
    } finally {
      setLoadingArbol(false)
    }
  }, [selectedPresupuestoId, headers, onMessage])

  useEffect(() => {
    void loadArbol()
  }, [loadArbol])

  useEffect(() => {
    let active = true
    setLoadingCatalogo(true)
    fetch(`${API_BASE_URL}/precios-unitarios`, { headers })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return
        setCatalogo(unwrapList<BimCatalogoPartida>(data))
      })
      .catch(() => {
        if (!active) return
      })
      .finally(() => {
        if (active) setLoadingCatalogo(false)
      })

    return () => {
      active = false
    }
  }, [headers])

  useEffect(() => {
    if (!selectedPresupuestoId || loadingArbol || !arbol) return
    if (arbol.capitulos[0]) {
      if (selectedCapituloId !== arbol.capitulos[0].id) {
        setSelectedCapituloId(arbol.capitulos[0].id)
      }
      return
    }

    void ensureDefaultCapitulo(selectedPresupuestoId, arbol).catch((error) => {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo preparar el presupuesto.' })
    })
  }, [selectedPresupuestoId, arbol, loadingArbol, selectedCapituloId, onMessage])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const item of catalogo) {
      if (item.categoria) set.add(item.categoria)
    }
    return Array.from(set).sort()
  }, [catalogo])

  const filteredCatalogo = useMemo(() => {
    const query = searchText.toLowerCase().trim()
    let list = catalogo
    if (selectedCategoria) list = list.filter((item) => item.categoria === selectedCategoria)
    if (query.length >= 2) {
      list = list.filter((item) => item.codigo.toLowerCase().includes(query) || item.descripcion.toLowerCase().includes(query))
    }
    return list.slice(0, 80)
  }, [catalogo, searchText, selectedCategoria])

  const partidasPlano = useMemo(() => {
    if (!arbol) return [] as Array<BimPartidaRow & { capitulo_codigo: string; capitulo_nombre: string }>
    return arbol.capitulos.flatMap((capitulo) =>
      capitulo.partidas.map((partida) => ({
        ...partida,
        capitulo_codigo: capitulo.codigo,
        capitulo_nombre: capitulo.nombre,
      })),
    )
  }, [arbol])

  async function handleCreatePresupuesto() {
    if (!selectedObraId || !newPresNombre.trim()) return
    setCreatingPres(true)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_id: selectedObraId, nombre: newPresNombre.trim(), tipo: 'sin_apu' }),
      })
      if (!response.ok) throw new Error('No se pudo crear el presupuesto sin A.P.U.')
      const presupuesto = await response.json() as BimPresupuesto
      setPresupuestos((current) => [...current, presupuesto])
      setSelectedPresupuestoId(String(presupuesto.id))
      setNewPresNombre('')
      setShowNewPres(false)
      onMessage({ tone: 'success', text: 'Presupuesto sin A.P.U. creado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el presupuesto.' })
    } finally {
      setCreatingPres(false)
    }
  }

  async function handlePrintPresupuesto() {
    if (!selectedObraId || !selectedPresupuestoId) return
    setPrintingPdf(true)
    onMessage(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/reportes/pdf?type=presupuesto&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`,
        { headers },
      )
      if (!response.ok) throw new Error('No se pudo generar el PDF del presupuesto')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo imprimir el presupuesto.' })
    } finally {
      setPrintingPdf(false)
    }
  }

  async function ensureDefaultCapitulo(presupuestoId = selectedPresupuestoId, tree = arbol) {
    if (!presupuestoId) throw new Error('No hay presupuesto seleccionado')
    if (tree?.capitulos?.[0]) {
      setSelectedCapituloId(tree.capitulos[0].id)
      return tree.capitulos[0].id
    }

    const response = await fetch(`${API_BASE_URL}/presupuestos/${presupuestoId}/capitulos`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: DEFAULT_CAPITULO.codigo, nombre: DEFAULT_CAPITULO.nombre, orden: 1 }),
    })

    if (!response.ok) {
      throw new Error('No se pudo crear el capítulo técnico del presupuesto')
    }

    const capitulo = await response.json() as BimCapituloNodo
    setSelectedCapituloId(capitulo.id)
    await loadArbol()
    return capitulo.id
  }

  function handleSelectPartida(item: BimCatalogoPartida) {
    setSelectedPartida(item)
    setCantidad('1')
    setPrecioUnitario(item.precio_base)
  }

  async function handleAddPartida() {
    if (!selectedPartida) return
    setAddingPartida(true)
    try {
      const capituloId = selectedCapituloId || await ensureDefaultCapitulo()
      const response = await fetch(`${API_BASE_URL}/presupuestos/capitulos/${capituloId}/partidas`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: selectedPartida.codigo,
          descripcion: selectedPartida.descripcion,
          unidad: selectedPartida.unidad,
          cantidad: String(cantidad),
          precio_unitario: String(precioUnitario),
          orden: 0,
        }),
      })
      if (!response.ok) throw new Error('No se pudo agregar la partida al presupuesto')
      await loadArbol()
      setSelectedPartida(null)
      setCantidad('1')
      setPrecioUnitario('')
      onMessage({ tone: 'success', text: `Partida ${selectedPartida.codigo} agregada al presupuesto.` })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo agregar la partida.' })
    } finally {
      setAddingPartida(false)
    }
  }

  function handleOpenEditPartida(partida: BimPartidaRow) {
    setEditingPartida(partida)
    setEditCantidad(partida.cantidad)
    setEditPrecioUnitario(partida.precio_unitario)
  }

  async function handleSavePartida() {
    if (!editingPartida) return
    setSavingPartida(true)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos/partidas/${editingPartida.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad: editCantidad, precio_unitario: editPrecioUnitario }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la partida')
      await loadArbol()
      setEditingPartida(null)
      onMessage({ tone: 'success', text: 'Partida actualizada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo actualizar la partida.' })
    } finally {
      setSavingPartida(false)
    }
  }

  async function handleDeletePartida(id: string) {
    setDeletingPartidaId(id)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos/partidas/${id}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) throw new Error('No se pudo eliminar la partida')
      await loadArbol()
      if (editingPartida?.id === id) setEditingPartida(null)
      onMessage({ tone: 'success', text: 'Partida eliminada.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar la partida.' })
    } finally {
      setDeletingPartidaId(null)
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid content-start gap-4">
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">1 · Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingObras ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando proyectos...
                </div>
              ) : obras.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay proyectos. Crea uno en "Mis proyectos".</p>
              ) : (
                <select
                  value={selectedObraId}
                  onChange={(event) => setSelectedObraId(event.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Selecciona un proyecto —</option>
                  {obras.map((obra) => (
                    <option key={obra.id} value={obra.id}>
                      {obra.codigo} · {obra.nombre}
                    </option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {selectedObraId ? (
            <Card className="border-border/60 bg-card/90 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">2 · Presupuesto sin A.P.U.</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedPresupuestoId ? (
                      <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={handlePrintPresupuesto} disabled={printingPdf}>
                        {printingPdf ? <LoaderCircle className="size-3 animate-spin" /> : <FileDown className="size-3" />}
                        Imprimir PDF
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setShowNewPres((current) => !current)}>
                      <Plus className="size-3" />
                      Nuevo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {loadingPresupuestos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando...
                  </div>
                ) : presupuestos.length > 0 ? (
                  <select
                    value={selectedPresupuestoId}
                    onChange={(event) => setSelectedPresupuestoId(event.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {presupuestos.map((presupuesto) => (
                      <option key={presupuesto.id} value={presupuesto.id}>
                        v{presupuesto.version} · {presupuesto.nombre} [{presupuesto.estado}]
                      </option>
                    ))}
                  </select>
                ) : !showNewPres ? (
                  <p className="text-sm text-muted-foreground">Sin presupuestos. Crea uno con "Nuevo".</p>
                ) : null}

                {showNewPres ? (
                  <div className="grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <Input
                      placeholder="Nombre del presupuesto"
                      value={newPresNombre}
                      onChange={(event) => setNewPresNombre(event.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={handleCreatePresupuesto} disabled={creatingPres || !newPresNombre.trim()}>
                        {creatingPres ? <LoaderCircle className="size-3 animate-spin" /> : <Plus className="size-3" />}
                        Crear
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => {
                        setShowNewPres(false)
                        setNewPresNombre('')
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {selectedPresupuestoId ? (
            <Card className="border-border/60 bg-card/90 shadow-sm">
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">3 · Partidas del presupuesto</CardTitle>
                  {arbol ? <p className="mt-0.5 text-xs text-muted-foreground">Total: {arbol.moneda} {fmtNum(arbol.total_presupuesto)}</p> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {loadingArbol ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando presupuesto...
                  </div>
                ) : partidasPlano.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin partidas aún. Selecciona una del catálogo y agrégala aquí.</p>
                ) : (
                  <div className="grid gap-3">
                    {partidasPlano.map((partida) => {
                      const isDeleting = deletingPartidaId === partida.id
                      return (
                        <div key={partida.id} className="rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm transition-colors hover:bg-muted/10">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{partida.codigo}</span>
                                <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">{partida.unidad}</span>
                              </div>
                              <p className="mt-2 text-sm font-medium leading-5 text-foreground break-words">{partida.descripcion}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-2.5 py-1">Cantidad: <span className="font-semibold tabular-nums text-foreground">{fmtNum(partida.cantidad, 2)}</span></span>
                                <span className="rounded-full bg-muted px-2.5 py-1">P.U.: <span className="font-semibold tabular-nums text-foreground">{fmtNum(partida.precio_unitario, 4)}</span></span>
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">Total: <span className="font-semibold tabular-nums">{fmtNum(partida.importe_total)}</span></span>
                                {arbol && arbol.capitulos.length > 1 ? (
                                  <span className="rounded-full bg-muted px-2.5 py-1">{partida.capitulo_codigo} · {partida.capitulo_nombre}</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" onClick={() => handleOpenEditPartida(partida)} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Editar partida">
                                <Pencil className="size-3.5" />
                              </button>
                              <button type="button" disabled={isDeleting} onClick={() => void handleDeletePartida(partida.id)} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40" title="Eliminar partida">
                                {isDeleting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Catálogo general de partidas</CardTitle>
              <CardDescription className="text-xs">
                {loadingCatalogo ? 'Cargando catálogo...' : `${catalogo.length.toLocaleString()} partidas maestras disponibles para presupuesto manual`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar código o descripción..." value={searchText} onChange={(event) => setSearchText(event.target.value)} className="h-8 pl-8 text-sm" />
                  {searchText ? (
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchText('')}>
                      <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  ) : null}
                </div>
                <select value={selectedCategoria} onChange={(event) => setSelectedCategoria(event.target.value)} className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Todas las categorías</option>
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
              </div>

              {searchText.length > 0 && searchText.length < 2 ? (
                <p className="text-xs text-muted-foreground">Escribe al menos 2 caracteres para filtrar.</p>
              ) : null}

              <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/50">
                {loadingCatalogo ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando catálogo...
                  </div>
                ) : filteredCatalogo.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {catalogo.length === 0 ? 'Sin datos en el catálogo' : 'Sin resultados. Refina la búsqueda.'}
                  </div>
                ) : (
                  filteredCatalogo.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectPartida(item)}
                      className={`flex w-full items-start gap-3 border-b border-border/30 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 ${selectedPartida?.id === item.id ? 'bg-primary/10 hover:bg-primary/10' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{item.codigo}</span>
                          <span className="text-[10px] text-muted-foreground">{item.unidad}</span>
                          {item.categoria ? <Badge variant="outline" className="h-4 rounded px-1 text-[9px]">{item.categoria}</Badge> : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground">{item.descripcion}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{fmtNum(item.precio_base)}</span>
                    </button>
                  ))
                )}
              </div>

              {filteredCatalogo.length === 80 ? (
                <p className="text-center text-xs text-muted-foreground">Mostrando 80 de {catalogo.length.toLocaleString()} — refina la búsqueda para ver más.</p>
              ) : null}
            </CardContent>
          </Card>

          {selectedPartida ? (
            <Card className="border-primary/25 bg-primary/5 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Incluir partida al presupuesto</CardTitle>
                    <CardDescription className="text-xs">Aquí solo capturas cantidad y precio unitario manual.</CardDescription>
                  </div>
                  <button type="button" onClick={() => setSelectedPartida(null)}>
                    <X className="size-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{selectedPartida.codigo}</span>
                    <span className="text-xs text-muted-foreground">· {selectedPartida.unidad}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-foreground">{selectedPartida.descripcion}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input type="number" min="0" step="0.01" value={cantidad} onChange={(event) => setCantidad(event.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Precio unitario</Label>
                    <Input type="number" min="0" step="0.0001" value={precioUnitario} onChange={(event) => setPrecioUnitario(event.target.value)} className="h-8 text-sm" />
                  </div>
                </div>

                {cantidad && precioUnitario ? (
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">Importe estimado:</span>
                    <span className="font-semibold tabular-nums">{fmtNum(Number(cantidad) * Number(precioUnitario))}</span>
                  </div>
                ) : null}

                <Button className="h-9 rounded-full" onClick={handleAddPartida} disabled={!selectedPresupuestoId || addingPartida || !cantidad || Number(cantidad) <= 0 || !precioUnitario || Number(precioUnitario) < 0}>
                  {addingPartida ? <LoaderCircle className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
                  {selectedPresupuestoId ? 'Agregar partida' : 'Selecciona un presupuesto primero'}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {editingPartida ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingPartida(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border/60 bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">{editingPartida.codigo}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{editingPartida.unidad}</span>
                </div>
                <p className="mt-1 text-sm font-medium leading-5 text-foreground">{editingPartida.descripcion}</p>
              </div>
              <button type="button" onClick={() => setEditingPartida(null)} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min="0" step="0.01" value={editCantidad} onChange={(event) => setEditCantidad(event.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Precio unitario</Label>
                  <Input type="number" min="0" step="0.0001" value={editPrecioUnitario} onChange={(event) => setEditPrecioUnitario(event.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Total estimado</span>
                <span className="font-semibold tabular-nums text-primary">{fmtNum(Number(editCantidad) * Number(editPrecioUnitario))}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setEditingPartida(null)}>Cancelar</Button>
                <Button className="rounded-full" disabled={savingPartida || !editCantidad || Number(editCantidad) < 0 || !editPrecioUnitario || Number(editPrecioUnitario) < 0} onClick={handleSavePartida}>
                  {savingPartida ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export { PresupuestosSinApuPanel }
