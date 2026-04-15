import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ListPlus,
  LoaderCircle,
  Plus,
  Search,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

// ── Types ──────────────────────────────────────────────────────────

type BimObra = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  estado: string
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
  children: BimCapituloNodo[]
}

type PresupuestoArbol = BimPresupuesto & { capitulos: BimCapituloNodo[] }

type BimApu = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  categoria: string | null
  precio_base: string
}

type MsgState = { tone: 'success' | 'error'; text: string } | null

// ── Props ──────────────────────────────────────────────────────────

type PartidasPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
}

// ── Helpers ────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────

function PartidasPanel({ token, onMessage }: PartidasPanelProps) {
  const bimHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  )

  // ── Obras ─────────────────────────────────────────────────────
  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState('')
  const [loadingObras, setLoadingObras] = useState(true)

  // ── Presupuestos ──────────────────────────────────────────────
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)
  const [showNewPres, setShowNewPres] = useState(false)
  const [newPresNombre, setNewPresNombre] = useState('')
  const [creatingPres, setCreatingPres] = useState(false)

  // ── Árbol ─────────────────────────────────────────────────────
  const [arbol, setArbol] = useState<PresupuestoArbol | null>(null)
  const [loadingArbol, setLoadingArbol] = useState(false)
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set())
  const [selectedCapituloId, setSelectedCapituloId] = useState('')

  // ── Capítulo nuevo ────────────────────────────────────────────
  const [showNewCap, setShowNewCap] = useState(false)
  const [newCap, setNewCap] = useState({ codigo: '', nombre: '' })
  const [addingCap, setAddingCap] = useState(false)

  // ── Catálogo APU ──────────────────────────────────────────────
  const [allApus, setAllApus] = useState<BimApu[]>([])
  const [loadingApus, setLoadingApus] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState('')
  const [selectedApu, setSelectedApu] = useState<BimApu | null>(null)

  // ── Agregar partida ───────────────────────────────────────────
  const [cantidad, setCantidad] = useState('1')
  const [precioOverride, setPrecioOverride] = useState('')
  const [addingPartida, setAddingPartida] = useState(false)

  // ── Load obras ────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setLoadingObras(true)
    fetch(`${API_BASE_URL}/obras`, { headers: bimHeaders })
      .then((r) => r.json())
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
  }, [bimHeaders, onMessage])

  // ── Load presupuestos when obra changes ───────────────────────
  useEffect(() => {
    if (!selectedObraId) {
      setPresupuestos([])
      setSelectedPresupuestoId('')
      setArbol(null)
      return
    }
    let active = true
    setLoadingPresupuestos(true)
    setArbol(null)
    setSelectedPresupuestoId('')
    fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}`, { headers: bimHeaders })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!active) return
        const list = unwrapList<BimPresupuesto>(data)
        setPresupuestos(list)
        if (list[0]) setSelectedPresupuestoId(String(list[0].id))
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los presupuestos.' })
      })
      .finally(() => {
        if (active) setLoadingPresupuestos(false)
      })
    return () => {
      active = false
    }
  }, [selectedObraId, bimHeaders, onMessage])

  // ── Load árbol ────────────────────────────────────────────────
  const loadArbol = useCallback(async () => {
    if (!selectedPresupuestoId) {
      setArbol(null)
      return
    }
    setLoadingArbol(true)
    try {
      const r = await fetch(
        `${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/arbol`,
        { headers: bimHeaders },
      )
      if (!r.ok) throw new Error()
      const data: PresupuestoArbol = await r.json() as PresupuestoArbol
      setArbol(data)
    } catch {
      onMessage({ tone: 'error', text: 'No se pudo cargar el árbol del presupuesto.' })
    } finally {
      setLoadingArbol(false)
    }
  }, [selectedPresupuestoId, bimHeaders, onMessage])

  useEffect(() => {
    void loadArbol()
  }, [loadArbol])

  // ── Load APU catalog ──────────────────────────────────────────
  useEffect(() => {
    let active = true
    setLoadingApus(true)
    fetch(`${API_BASE_URL}/precios-unitarios`, { headers: bimHeaders })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!active) return
        setAllApus(unwrapList<BimApu>(data))
      })
      .catch(() => {
        if (!active) return
      })
      .finally(() => {
        if (active) setLoadingApus(false)
      })
    return () => {
      active = false
    }
  }, [bimHeaders])

  // ── Derived: categorías ───────────────────────────────────────
  const categorias = useMemo(() => {
    const cats = new Set<string>()
    for (const apu of allApus) {
      if (apu.categoria) cats.add(apu.categoria)
    }
    return Array.from(cats).sort()
  }, [allApus])

  // ── Derived: APUs filtradas ───────────────────────────────────
  const filteredApus = useMemo(() => {
    const q = searchText.toLowerCase().trim()
    let list = allApus
    if (selectedCategoria) list = list.filter((a) => a.categoria === selectedCategoria)
    if (q.length >= 2) {
      list = list.filter(
        (a) =>
          a.codigo.toLowerCase().includes(q) ||
          a.descripcion.toLowerCase().includes(q),
      )
    }
    return list.slice(0, 80)
  }, [allApus, searchText, selectedCategoria])

  // ── Handlers ──────────────────────────────────────────────────

  async function handleCreatePresupuesto() {
    if (!selectedObraId || !newPresNombre.trim()) return
    setCreatingPres(true)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_id: Number(selectedObraId), nombre: newPresNombre.trim() }),
      })
      if (!r.ok) throw new Error('No se pudo crear el presupuesto')
      const pres = await r.json() as BimPresupuesto
      setPresupuestos((p) => [...p, pres])
      setSelectedPresupuestoId(String(pres.id))
      setNewPresNombre('')
      setShowNewPres(false)
      onMessage({ tone: 'success', text: 'Presupuesto creado.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al crear presupuesto.' })
    } finally {
      setCreatingPres(false)
    }
  }

  async function handleAddChapter() {
    if (!selectedPresupuestoId || !newCap.codigo.trim() || !newCap.nombre.trim()) return
    setAddingCap(true)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/capitulos`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: newCap.codigo.trim(),
          nombre: newCap.nombre.trim(),
          orden: (arbol?.capitulos?.length ?? 0) + 1,
        }),
      })
      if (!r.ok) throw new Error('No se pudo crear el capítulo')
      await loadArbol()
      setNewCap({ codigo: '', nombre: '' })
      setShowNewCap(false)
      onMessage({ tone: 'success', text: 'Capítulo agregado.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al agregar capítulo.' })
    } finally {
      setAddingCap(false)
    }
  }

  function handleSelectApu(apu: BimApu) {
    setSelectedApu(apu)
    setPrecioOverride(apu.precio_base)
    setCantidad('1')
  }

  async function handleAddPartida() {
    if (!selectedCapituloId || !selectedApu) return
    setAddingPartida(true)
    try {
      const precio = Number(precioOverride || selectedApu.precio_base)
      const r = await fetch(`${API_BASE_URL}/presupuestos/capitulos/${selectedCapituloId}/partidas`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio_unitario_id: Number(selectedApu.id),
          codigo: selectedApu.codigo,
          descripcion: selectedApu.descripcion,
          unidad: selectedApu.unidad,
          cantidad: Number(cantidad),
          precio_unitario: precio,
          orden: 0,
        }),
      })
      if (!r.ok) throw new Error('No se pudo agregar la partida')
      await loadArbol()
      // expand the chapter so user sees the new row
      setExpandedCaps((prev) => new Set(prev).add(selectedCapituloId))
      setSelectedApu(null)
      setPrecioOverride('')
      setCantidad('1')
      onMessage({ tone: 'success', text: `Partida ${selectedApu.codigo} agregada.` })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al agregar partida.' })
    } finally {
      setAddingPartida(false)
    }
  }

  function toggleCap(id: string) {
    setExpandedCaps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">

      {/* ── LEFT: Obra / Presupuesto / Árbol ── */}
      <div className="grid content-start gap-4">

        {/* Paso 1: Obra */}
        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              1 · Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingObras ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando proyectos...
              </div>
            ) : obras.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay proyectos. Créa uno en "Mis proyectos".
              </p>
            ) : (
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">— Selecciona un proyecto —</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} · {o.nombre}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>

        {/* Paso 2: Presupuesto */}
        {selectedObraId ? (
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  2 · Presupuesto
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setShowNewPres((v) => !v)}
                >
                  <Plus className="size-3" />
                  Nuevo
                </Button>
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
                  onChange={(e) => setSelectedPresupuestoId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {presupuestos.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version} · {p.nombre} [{p.estado}]
                    </option>
                  ))}
                </select>
              ) : !showNewPres ? (
                <p className="text-sm text-muted-foreground">
                  Sin presupuestos. Crea uno con "Nuevo".
                </p>
              ) : null}

              {showNewPres ? (
                <div className="grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                  <Input
                    placeholder="Nombre del presupuesto"
                    value={newPresNombre}
                    onChange={(e) => setNewPresNombre(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={handleCreatePresupuesto}
                      disabled={creatingPres || !newPresNombre.trim()}
                    >
                      {creatingPres ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3" />
                      )}
                      Crear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => {
                        setShowNewPres(false)
                        setNewPresNombre('')
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Paso 3: Árbol de capítulos */}
        {selectedPresupuestoId ? (
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    3 · Capítulos
                  </CardTitle>
                  {arbol ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Total: {arbol.moneda}{' '}
                      {fmtNum(arbol.total_presupuesto)}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setShowNewCap((v) => !v)}
                >
                  <Plus className="size-3" />
                  Capítulo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {loadingArbol ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando árbol...
                </div>
              ) : arbol && arbol.capitulos.length > 0 ? (
                arbol.capitulos.map((cap) => (
                  <CapituloNodo
                    key={cap.id}
                    cap={cap}
                    expanded={expandedCaps.has(cap.id)}
                    selected={selectedCapituloId === cap.id}
                    onToggle={() => toggleCap(cap.id)}
                    onSelect={() => setSelectedCapituloId(cap.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin capítulos aún. Agrega uno con el botón.
                </p>
              )}

              {showNewCap ? (
                <div className="mt-1 grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="grid grid-cols-[90px_1fr] gap-2">
                    <Input
                      placeholder="Código"
                      value={newCap.codigo}
                      onChange={(e) => setNewCap((c) => ({ ...c, codigo: e.target.value }))}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Input
                      placeholder="Nombre del capítulo"
                      value={newCap.nombre}
                      onChange={(e) => setNewCap((c) => ({ ...c, nombre: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={handleAddChapter}
                      disabled={addingCap || !newCap.codigo.trim() || !newCap.nombre.trim()}
                    >
                      {addingCap ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3" />
                      )}
                      Agregar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => {
                        setShowNewCap(false)
                        setNewCap({ codigo: '', nombre: '' })
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* ── RIGHT: Catálogo APU + Formulario ── */}
      <div className="grid content-start gap-4">

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Catálogo de precios unitarios
            </CardTitle>
            <CardDescription className="text-xs">
              {loadingApus ? (
                'Cargando catálogo...'
              ) : (
                `${allApus.length.toLocaleString()} partidas disponibles · Selecciona una para agregarla`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">

            {/* Búsqueda + filtro categoría */}
            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar código o descripción..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
                {searchText ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchText('')}
                  >
                    <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                ) : null}
              </div>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {searchText.length > 0 && searchText.length < 2 ? (
              <p className="text-xs text-muted-foreground">
                Escribe al menos 2 caracteres para filtrar.
              </p>
            ) : null}

            {/* Lista de APUs */}
            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border/50">
              {loadingApus ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando catálogo...
                </div>
              ) : filteredApus.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {allApus.length === 0
                    ? 'Sin datos en el catálogo'
                    : 'Sin resultados. Refina la búsqueda.'}
                </div>
              ) : (
                filteredApus.map((apu) => (
                  <button
                    key={apu.id}
                    type="button"
                    onClick={() => handleSelectApu(apu)}
                    className={`flex w-full items-start gap-3 border-b border-border/30 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 ${
                      selectedApu?.id === apu.id
                        ? 'bg-primary/10 hover:bg-primary/10'
                        : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {apu.codigo}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{apu.unidad}</span>
                        {apu.categoria ? (
                          <Badge variant="outline" className="h-4 rounded px-1 text-[9px]">
                            {apu.categoria}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground">
                        {apu.descripcion}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                      {fmtNum(apu.precio_base)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {filteredApus.length === 80 ? (
              <p className="text-center text-xs text-muted-foreground">
                Mostrando 80 de {allApus.length.toLocaleString()} — refina la búsqueda para ver
                más.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Formulario agregar partida */}
        {selectedApu ? (
          <Card className="border-primary/25 bg-primary/5 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Agregar al capítulo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedCapituloId
                      ? `Capítulo seleccionado en el árbol izquierdo`
                      : '← Selecciona un capítulo en el árbol izquierdo'}
                  </CardDescription>
                </div>
                <button type="button" onClick={() => setSelectedApu(null)}>
                  <X className="size-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">

              {/* APU seleccionada */}
              <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {selectedApu.codigo}
                  </span>
                  <span className="text-xs text-muted-foreground">· {selectedApu.unidad}</span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-foreground">
                  {selectedApu.descripcion}
                </p>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Precio unitario</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={precioOverride}
                    onChange={(e) => setPrecioOverride(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Preview importe */}
              {cantidad && precioOverride ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-xs text-muted-foreground">Importe estimado:</span>
                  <span className="font-semibold tabular-nums">
                    {fmtNum(Number(cantidad) * Number(precioOverride))}
                  </span>
                </div>
              ) : null}

              <Button
                className="h-9 rounded-full"
                onClick={handleAddPartida}
                disabled={
                  !selectedCapituloId ||
                  addingPartida ||
                  !cantidad ||
                  Number(cantidad) <= 0
                }
              >
                {addingPartida ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ListPlus className="size-4" />
                )}
                {selectedCapituloId ? 'Agregar partida' : 'Selecciona un capítulo primero'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

      </div>
    </div>
  )
}

// ── Capitulo node ──────────────────────────────────────────────────

type CapituloNodoProps = {
  cap: BimCapituloNodo
  expanded: boolean
  selected: boolean
  onToggle: () => void
  onSelect: () => void
}

function CapituloNodo({ cap, expanded, selected, onToggle, onSelect }: CapituloNodoProps) {
  const partidaCount = cap.partidas?.length ?? 0

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        selected ? 'border-primary/40 bg-primary/5' : 'border-border/50'
      }`}
    >
      {/* Cabecera capítulo */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Expandir"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <span className="font-mono text-xs text-muted-foreground">{cap.codigo}</span>
          <span
            className={`ml-2 text-sm ${selected ? 'font-semibold text-primary' : 'font-medium text-foreground'}`}
          >
            {cap.nombre}
          </span>
        </button>

        <Badge
          variant={selected ? 'default' : 'outline'}
          className="shrink-0 rounded-full px-2 py-0 text-[10px]"
        >
          {partidaCount}
        </Badge>
      </div>

      {/* Partidas */}
      {expanded && partidaCount > 0 ? (
        <div className="border-t border-border/40 bg-muted/10">
          {cap.partidas.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-2 border-b border-border/20 px-4 py-2 text-xs last:border-b-0"
            >
              <span className="w-20 shrink-0 font-mono text-muted-foreground">{p.codigo}</span>
              <span className="min-w-0 flex-1 leading-4 text-foreground line-clamp-1">
                {p.descripcion}
              </span>
              <span className="shrink-0 text-muted-foreground">{p.unidad}</span>
              <span className="shrink-0 tabular-nums">{fmtNum(p.cantidad, 2)}</span>
              <span className="shrink-0 font-semibold tabular-nums text-primary">
                {fmtNum(p.importe_total)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {expanded && partidaCount === 0 ? (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
          Sin partidas. Selecciona una del catálogo y agrégala aquí.
        </div>
      ) : null}
    </div>
  )
}

export { PartidasPanel }
