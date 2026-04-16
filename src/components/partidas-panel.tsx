import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  FileDown,
  ListPlus,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, type AuthUser } from '@/lib/auth'

// ── Error boundary (catches render-time crashes and shows a message) ──

type EBState = { hasError: boolean; message: string }

class PanelErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(err: unknown): EBState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">Error inesperado en el panel de partidas</p>
          <p className="mt-1 font-mono text-xs opacity-80">{this.state.message}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs hover:bg-destructive/10"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
  materiales?: BimPartidaMaterial[]
}

type BimPartidaMaterial = {
  id: string
  partida_id: string
  recurso_id: string | null
  tipo: BimInsumoTipo
  codigo: string
  descripcion: string
  unidad: string
  cantidad: string
  costo: string
  desperdicio_pct: string
  total: string
  orden: number
}

type BimInsumoTipo = 'material' | 'equipo' | 'mano_obra'

type EditingInsumos = {
  partida: BimPartidaRow
  tipo: BimInsumoTipo
  insumos: BimPartidaMaterial[]
}

type BimMaterialRecurso = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  tipo: string
  precio: string
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

type BimApuDetalle = BimApu & {
  rendimiento: string
  vigencia: string
  descomposicion: BimDescomposicion[]
}

type MsgState = { tone: 'success' | 'error'; text: string } | null

// ── Props ──────────────────────────────────────────────────────────

type PartidasPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
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

const DEFAULT_CAPITULO = { codigo: '01', nombre: 'General' }

function PartidasPanel({ token, onMessage, initialObraId }: PartidasPanelProps) {
  const bimHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  )

  // ── Obras ─────────────────────────────────────────────────────
  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  // ── Presupuestos ──────────────────────────────────────────────
  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)
  const [showNewPres, setShowNewPres] = useState(false)
  const [newPresNombre, setNewPresNombre] = useState('')
  const [creatingPres, setCreatingPres] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

  // ── Árbol ─────────────────────────────────────────────────────
  const [arbol, setArbol] = useState<PresupuestoArbol | null>(null)
  const [loadingArbol, setLoadingArbol] = useState(false)
  const [selectedCapituloId, setSelectedCapituloId] = useState('')

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

  // ── Modal detalle APU ─────────────────────────────────────────
  const [detailApu, setDetailApu] = useState<BimApuDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ── Edit / delete partida ─────────────────────────────────────
  const [editingInsumos, setEditingInsumos] = useState<EditingInsumos | null>(null)
  const [savingPartida, setSavingPartida] = useState(false)
  const [deletingPartidaId, setDeletingPartidaId] = useState<string | null>(null)
  const [loadingEditInsumos, setLoadingEditInsumos] = useState(false)
  const [savingInsumoId, setSavingInsumoId] = useState<string | null>(null)
  const [deletingInsumoId, setDeletingInsumoId] = useState<string | null>(null)
  const [resourcesByTipo, setResourcesByTipo] = useState<Record<BimInsumoTipo, BimMaterialRecurso[]>>({
    material: [],
    equipo: [],
    mano_obra: [],
  })
  const [loadingResourcesByTipo, setLoadingResourcesByTipo] = useState<Record<BimInsumoTipo, boolean>>({
    material: false,
    equipo: false,
    mano_obra: false,
  })

  // ── Load obras ────────────────────────────────────────────────
  useEffect(() => {
    if (initialObraId) setSelectedObraId(initialObraId)
  }, [initialObraId])

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

  useEffect(() => {
    let active = true
    const tipos: BimInsumoTipo[] = ['material', 'equipo', 'mano_obra']
    setLoadingResourcesByTipo({ material: true, equipo: true, mano_obra: true })

    void Promise.all(
      tipos.map(async (tipo) => {
        const r = await fetch(`${API_BASE_URL}/precios-unitarios/recursos?tipo=${tipo}`, { headers: bimHeaders })
        const data = await r.json() as unknown
        return { tipo, list: unwrapList<BimMaterialRecurso>(data) }
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
      })
      .finally(() => {
        if (active) setLoadingResourcesByTipo({ material: false, equipo: false, mano_obra: false })
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

  const partidasPlano = useMemo(() => {
    if (!arbol) return [] as Array<BimPartidaRow & { capitulo_codigo: string; capitulo_nombre: string }>
    return arbol.capitulos.flatMap((cap) =>
      cap.partidas.map((partida) => ({
        ...partida,
        capitulo_codigo: cap.codigo,
        capitulo_nombre: cap.nombre,
      })),
    )
  }, [arbol])

  // ── Handlers ──────────────────────────────────────────────────

  async function handleCreatePresupuesto() {
    if (!selectedObraId || !newPresNombre.trim()) return
    setCreatingPres(true)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_id: selectedObraId, nombre: newPresNombre.trim() }),
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

  async function handlePrintPresupuesto() {
    if (!selectedPresupuestoId || !selectedObraId) return
    setPrintingPdf(true)
    onMessage(null)
    try {
      const r = await fetch(
        `${API_BASE_URL}/reportes/pdf?type=presupuesto&obraId=${selectedObraId}&presupuestoId=${selectedPresupuestoId}`,
        {
        headers: bimHeaders,
        },
      )
      if (!r.ok) throw new Error('No se pudo generar el reporte PDF del presupuesto')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      onMessage(null)
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al imprimir el presupuesto.' })
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

    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/${presupuestoId}/capitulos`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: DEFAULT_CAPITULO.codigo,
          nombre: DEFAULT_CAPITULO.nombre,
          orden: 1,
        }),
      })
      if (!r.ok) throw new Error('No se pudo crear el capítulo')
      const cap = await r.json() as BimCapituloNodo
      setSelectedCapituloId(cap.id)
      await loadArbol()
      return cap.id
    } catch (error) {
      throw error instanceof Error ? error : new Error('No se pudo preparar el presupuesto')
    }
  }

  useEffect(() => {
    if (!selectedPresupuestoId || loadingArbol || !arbol) return
    if (arbol.capitulos[0]) {
      if (selectedCapituloId !== arbol.capitulos[0].id) {
        setSelectedCapituloId(arbol.capitulos[0].id)
      }
      return
    }

    void ensureDefaultCapitulo(selectedPresupuestoId, arbol).catch((error) => {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Error al preparar el presupuesto.' })
    })
  }, [selectedPresupuestoId, arbol, loadingArbol, selectedCapituloId, onMessage])

  function handleSelectApu(apu: BimApu) {
    setSelectedApu(apu)
    setPrecioOverride(apu.precio_base)
    setCantidad('1')
  }

  async function handleOpenDetail(apu: BimApu) {
    // Pre-select the APU so the add-form is ready when the modal opens
    handleSelectApu(apu)
    // Open modal immediately with basic data while we fetch the full breakdown
    setDetailApu({ ...apu, rendimiento: '1', vigencia: '', descomposicion: [] })
    setLoadingDetail(true)
    try {
      const r = await fetch(`${API_BASE_URL}/precios-unitarios/${apu.id}`, { headers: bimHeaders })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json() as BimApuDetalle
      // Ensure descomposicion is always an array even if the API omits it
      setDetailApu({ ...data, descomposicion: Array.isArray(data.descomposicion) ? data.descomposicion : [] })
    } catch {
      // keep modal open with basic data; breakdown just won't show
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleAddPartida() {
    if (!selectedApu) return
    setAddingPartida(true)
    try {
      const capituloId = selectedCapituloId || await ensureDefaultCapitulo()
      const precio = Number(precioOverride || selectedApu.precio_base)
      const r = await fetch(`${API_BASE_URL}/presupuestos/capitulos/${capituloId}/partidas`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio_unitario_id: String(selectedApu.id),
          codigo: selectedApu.codigo,
          descripcion: selectedApu.descripcion,
          unidad: selectedApu.unidad,
          cantidad: String(cantidad),
          precio_unitario: String(precio),
          orden: 0,
        }),
      })
      if (!r.ok) throw new Error('No se pudo agregar la partida')
      await loadArbol()
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

  async function handleOpenEditPartida(partida: BimPartidaRow, tipo: BimInsumoTipo) {
    setLoadingEditInsumos(true)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/${partida.id}/materiales?tipo=${tipo}`, {
        headers: bimHeaders,
      })
      if (!r.ok) throw new Error('No se pudieron cargar los insumos de la partida')
      const insumos = await r.json() as BimPartidaMaterial[]
      setEditingInsumos({
        partida,
        tipo,
        insumos: Array.isArray(insumos) ? insumos : [],
      })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al abrir la partida.' })
    } finally {
      setLoadingEditInsumos(false)
    }
  }

  async function handleUpdatePartida(id: string, cantidad: string) {
    setSavingPartida(true)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/${id}`, {
        method: 'PATCH',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad }),
      })
      if (!r.ok) throw new Error('No se pudo actualizar la partida')
      await reloadEditingPartidaMateriales(id)
      onMessage({ tone: 'success', text: 'Partida actualizada.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al actualizar partida.' })
    } finally {
      setSavingPartida(false)
    }
  }

  async function handleDeletePartida(id: string) {
    setDeletingPartidaId(id)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/${id}`, {
        method: 'DELETE',
        headers: bimHeaders,
      })
      if (!r.ok) throw new Error('No se pudo eliminar la partida')
      await loadArbol()
      onMessage({ tone: 'success', text: 'Partida eliminada.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al eliminar partida.' })
    } finally {
      setDeletingPartidaId(null)
    }
  }

  async function reloadEditingPartidaMateriales(partidaId: string) {
    if (!selectedPresupuestoId) {
      throw new Error('No hay presupuesto seleccionado')
    }
    if (!editingInsumos) {
      throw new Error('No hay tipo de insumo en edición')
    }
    const [partidaRes, materialesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/arbol`, { headers: bimHeaders }),
      fetch(`${API_BASE_URL}/presupuestos/partidas/${partidaId}/materiales?tipo=${editingInsumos.tipo}`, { headers: bimHeaders }),
    ])

    if (!partidaRes.ok || !materialesRes.ok) {
      throw new Error('No se pudo refrescar la partida editada')
    }

    const nextTree = await partidaRes.json() as PresupuestoArbol
    const nextMateriales = await materialesRes.json() as BimPartidaMaterial[]
    setArbol(nextTree)

    let nextPartida: BimPartidaRow | null = null
    for (const cap of nextTree.capitulos) {
      const found = cap.partidas.find((item) => item.id === partidaId)
      if (found) {
        nextPartida = found
        break
      }
    }

    if (nextPartida) {
      setEditingInsumos({
        partida: nextPartida,
        tipo: editingInsumos.tipo,
        insumos: Array.isArray(nextMateriales) ? nextMateriales : [],
      })
    } else {
      setEditingInsumos(null)
    }
  }

  async function handleCreateMaterial(input: {
    tipo: BimInsumoTipo
    recurso_id: string
    codigo: string
    descripcion: string
    unidad: string
    cantidad: string
    costo: string
    desperdicio_pct: string
  }) {
    if (!editingInsumos) return
    setSavingInsumoId('new')
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/${editingInsumos.partida.id}/materiales`, {
        method: 'POST',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error('No se pudo agregar el insumo')
      await reloadEditingPartidaMateriales(editingInsumos.partida.id)
      onMessage({ tone: 'success', text: 'Insumo agregado a la partida.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al agregar insumo.' })
    } finally {
      setSavingInsumoId(null)
    }
  }

  async function handleUpdateMaterial(
    id: string,
    input: { cantidad: string; costo: string; desperdicio_pct: string },
  ) {
    setSavingInsumoId(id)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/materiales/${id}`, {
        method: 'PATCH',
        headers: { ...bimHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error('No se pudo actualizar el insumo')
      if (editingInsumos) await reloadEditingPartidaMateriales(editingInsumos.partida.id)
      onMessage({ tone: 'success', text: 'Insumo actualizado.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al actualizar insumo.' })
    } finally {
      setSavingInsumoId(null)
    }
  }

  async function handleDeleteMaterial(id: string) {
    setDeletingInsumoId(id)
    try {
      const r = await fetch(`${API_BASE_URL}/presupuestos/partidas/materiales/${id}`, {
        method: 'DELETE',
        headers: bimHeaders,
      })
      if (!r.ok) throw new Error('No se pudo eliminar el insumo')
      if (editingInsumos) await reloadEditingPartidaMateriales(editingInsumos.partida.id)
      onMessage({ tone: 'success', text: 'Insumo eliminado.' })
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Error al eliminar insumo.' })
    } finally {
      setDeletingInsumoId(null)
    }
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
                <div className="flex items-center gap-2">
                  {selectedPresupuestoId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={handlePrintPresupuesto}
                      disabled={printingPdf}
                    >
                      {printingPdf ? <LoaderCircle className="size-3 animate-spin" /> : <FileDown className="size-3" />}
                      Imprimir PDF
                    </Button>
                  ) : null}
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

        {/* Paso 3: Partidas del presupuesto */}
        {selectedPresupuestoId ? (
          <Card className="border-border/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  3 · Partidas del presupuesto
                </CardTitle>
                {arbol ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Total: {arbol.moneda} {fmtNum(arbol.total_presupuesto)}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {loadingArbol ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando presupuesto...
                </div>
              ) : partidasPlano.length > 0 ? (
                <div className="grid gap-3">
                  {partidasPlano.map((p) => {
                    const isDeleting = deletingPartidaId === p.id
                    return (
                      <div
                        key={p.id}
                        className="group rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm transition-colors hover:bg-muted/10"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                                {p.codigo}
                              </span>
                              <span className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                                {p.unidad}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium leading-5 text-foreground break-words">
                              {p.descripcion}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2.5 py-1">
                                Cantidad: <span className="font-semibold tabular-nums text-foreground">{fmtNum(p.cantidad, 2)}</span>
                              </span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                                Total: <span className="font-semibold tabular-nums">{fmtNum(p.importe_total)}</span>
                              </span>
                              {arbol && arbol.capitulos.length > 1 ? (
                                <span className="rounded-full bg-muted px-2.5 py-1">
                                  {p.capitulo_codigo} · {p.capitulo_nombre}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[230px] lg:justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPartida(p, 'material')}
                              className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Ver materiales incluidos"
                            >
                              MAT
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPartida(p, 'equipo')}
                              className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Ver equipos incluidos"
                            >
                              EQ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPartida(p, 'mano_obra')}
                              className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Ver mano de obra incluida"
                            >
                              MO
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPartida(p, 'material')}
                              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Editar partida"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeletePartida(p.id)}
                              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                              title="Eliminar partida"
                            >
                              {isDeleting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin partidas aún. Selecciona una del catálogo y agrégala aquí.
                </p>
              )}
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
                    onClick={() => handleOpenDetail(apu)}
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
                    Agregar al presupuesto
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedPresupuestoId
                      ? 'Presupuesto activo listo para cargar partidas APU'
                      : '← Selecciona un presupuesto primero'}
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
                  !selectedPresupuestoId ||
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
                {selectedPresupuestoId ? 'Agregar partida' : 'Selecciona un presupuesto primero'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

      </div>

      {/* ── Modal detalle APU ── */}
      {detailApu ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDetailApu(null)}
          />

          {/* Panel — flex column, capped to 90vh so it never overflows */}
          <div className="relative z-10 flex w-full max-w-3xl flex-col rounded-2xl border border-border/60 bg-background shadow-2xl" style={{ maxHeight: '90vh' }}>

            {/* Header — sticky top */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">
                    {detailApu.codigo}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {detailApu.unidad}
                  </span>
                  {detailApu.categoria ? (
                    <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                      {detailApu.categoria}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium leading-5 text-foreground">
                  {detailApu.descripcion}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Precio base:{' '}
                    <span className="font-semibold tabular-nums text-primary">
                      {fmtNum(detailApu.precio_base)}
                    </span>
                  </span>
                  {detailApu.rendimiento && Number(detailApu.rendimiento) !== 1 ? (
                    <span>Rendimiento: {detailApu.rendimiento}</span>
                  ) : null}
                  {detailApu.vigencia ? (
                    <span>Vigencia: {String(detailApu.vigencia).slice(0, 10)}</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailApu(null)}
                className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Descomposición — scrollable middle */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descomposición del APU
              </h3>

              {loadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando descomposición...
                </div>
              ) : (detailApu.descomposicion?.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin descomposición registrada para este APU.
                </p>
              ) : (
                <ApuDesglose descomposicion={detailApu.descomposicion ?? []} />
              )}
            </div>

            {/* Agregar al capítulo — sticky footer */}
            <div className="shrink-0 border-t border-border/50 bg-muted/20 px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agregar al presupuesto activo
              </h3>
              {selectedPresupuestoId ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    {cantidad && precioOverride ? (
                      <div className="grid gap-1">
                        <Label className="text-xs">Importe estimado</Label>
                        <div className="flex h-8 items-center rounded-lg bg-background px-3 text-sm font-semibold tabular-nums text-primary">
                          {fmtNum(Number(cantidad) * Number(precioOverride))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-full px-4"
                      onClick={() => setDetailApu(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="h-9 rounded-full px-5"
                      disabled={addingPartida || !cantidad || Number(cantidad) <= 0}
                      onClick={async () => {
                        await handleAddPartida()
                        setDetailApu(null)
                      }}
                    >
                      {addingPartida ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <ListPlus className="size-4" />
                      )}
                      Agregar partida
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  Selecciona un presupuesto para poder agregar esta partida.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingInsumos ? (
        <PartidaMaterialsModal
          partida={editingInsumos.partida}
          tipo={editingInsumos.tipo}
          insumos={editingInsumos.insumos}
          loading={loadingEditInsumos}
          loadingMaterialResources={loadingResourcesByTipo[editingInsumos.tipo]}
          materialResources={resourcesByTipo[editingInsumos.tipo]}
          savingPartida={savingPartida}
          savingMaterialId={savingInsumoId}
          deletingMaterialId={deletingInsumoId}
          onClose={() => setEditingInsumos(null)}
          onSavePartida={handleUpdatePartida}
          onCreateMaterial={handleCreateMaterial}
          onUpdateMaterial={handleUpdateMaterial}
          onDeleteMaterial={handleDeleteMaterial}
        />
      ) : null}
    </div>
  )
}

// ── APU breakdown table ────────────────────────────────────────────

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  mano_obra:    { label: 'Mano de obra', color: 'text-blue-600 dark:text-blue-400' },
  material:     { label: 'Material',     color: 'text-emerald-600 dark:text-emerald-400' },
  equipo:       { label: 'Equipo',       color: 'text-orange-600 dark:text-orange-400' },
  subcontrato:  { label: 'Subcontrato',  color: 'text-purple-600 dark:text-purple-400' },
}

function tipoLabel(tipo: string) {
  return TIPO_LABELS[tipo] ?? { label: tipo, color: 'text-muted-foreground' }
}

function ApuDesglose({ descomposicion }: { descomposicion: BimDescomposicion[] }) {
  // Group by tipo maintaining insertion order
  const groups = descomposicion.reduce<Record<string, BimDescomposicion[]>>((acc, d) => {
    if (!acc[d.tipo]) acc[d.tipo] = []
    acc[d.tipo].push(d)
    return acc
  }, {})

  const totalGeneral = descomposicion.reduce((sum, d) => sum + Number(d.importe_total), 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-2 border-b border-border/50 bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Recurso</span>
        <span className="text-right">Unid.</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">P. unitario</span>
        <span className="text-right">Importe</span>
      </div>

      {Object.entries(groups).map(([tipo, rows]) => {
        const subtotal = rows.reduce((sum, r) => sum + Number(r.importe_total), 0)
        const { label, color } = tipoLabel(tipo)
        return (
          <div key={tipo}>
            {/* Group label */}
            <div className={`border-b border-border/30 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
              {label}
            </div>
            {/* Rows */}
            {rows.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-2 border-b border-border/20 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20"
              >
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {d.recurso?.codigo}
                  </span>
                  <span className="block leading-4 text-foreground">
                    {d.recurso?.descripcion}
                  </span>
                </div>
                <span className="self-center text-right text-muted-foreground">
                  {d.recurso?.unidad}
                </span>
                <span className="self-center text-right tabular-nums">
                  {fmtNum(d.cantidad, 4)}
                </span>
                <span className="self-center text-right tabular-nums">
                  {fmtNum(d.precio_recurso)}
                </span>
                <span className="self-center text-right font-medium tabular-nums">
                  {fmtNum(d.importe_total)}
                </span>
              </div>
            ))}
            {/* Subtotal */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-2 border-b border-border/30 bg-muted/30 px-3 py-1.5 text-[10px]">
              <span className={`col-span-4 text-right font-semibold uppercase tracking-wide ${color}`}>
                Subtotal {label}
              </span>
              <span className={`text-right font-bold tabular-nums ${color}`}>
                {fmtNum(subtotal)}
              </span>
            </div>
          </div>
        )
      })}

      {/* Total */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-2 bg-muted/50 px-3 py-2 text-xs">
        <span className="col-span-4 text-right font-bold uppercase tracking-wide text-foreground">
          Total APU
        </span>
        <span className="text-right font-bold tabular-nums text-primary">
          {fmtNum(totalGeneral)}
        </span>
      </div>
    </div>
  )
}

function PartidaMaterialsModal({
  partida,
  tipo,
  insumos,
  loading,
  loadingMaterialResources,
  materialResources,
  savingPartida,
  savingMaterialId,
  deletingMaterialId,
  onClose,
  onSavePartida,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}: {
  partida: BimPartidaRow
  tipo: BimInsumoTipo
  insumos: BimPartidaMaterial[]
  loading: boolean
  loadingMaterialResources: boolean
  materialResources: BimMaterialRecurso[]
  savingPartida: boolean
  savingMaterialId: string | null
  deletingMaterialId: string | null
  onClose: () => void
  onSavePartida: (id: string, cantidad: string) => Promise<void>
  onCreateMaterial: (input: {
    tipo: BimInsumoTipo
    recurso_id: string
    codigo: string
    descripcion: string
    unidad: string
    cantidad: string
    costo: string
    desperdicio_pct: string
  }) => Promise<void>
  onUpdateMaterial: (id: string, input: { cantidad: string; costo: string; desperdicio_pct: string }) => Promise<void>
  onDeleteMaterial: (id: string) => Promise<void>
}) {
  const [cantidad, setCantidad] = useState(partida.cantidad)
  const [selectedRecursoId, setSelectedRecursoId] = useState('')
  const [newMaterial, setNewMaterial] = useState({ cantidad: '1', costo: '0', desperdicio_pct: '0' })

  useEffect(() => {
    setCantidad(partida.cantidad)
  }, [partida.id, partida.cantidad])

  useEffect(() => {
    const recurso = materialResources.find((item) => item.id === selectedRecursoId)
    if (!recurso) return
    setNewMaterial((current) => ({ ...current, costo: recurso.precio || current.costo }))
  }, [selectedRecursoId, materialResources])

  const selectedRecurso = materialResources.find((item) => item.id === selectedRecursoId) ?? null
  const materiales = insumos
  const totalMateriales = materiales.reduce((sum, item) => sum + Number(item.total), 0)
  const tipoLabels: Record<BimInsumoTipo, { titulo: string; agregar: string; catalogo: string; vacio: string; total: string }> = {
    material: {
      titulo: 'Materiales incluidos',
      agregar: 'Agregar material',
      catalogo: 'Material del catalogo',
      vacio: 'Esta partida no tiene materiales incluidos todavia.',
      total: 'Total materiales',
    },
    equipo: {
      titulo: 'Equipos incluidos',
      agregar: 'Agregar equipo',
      catalogo: 'Equipo del catalogo',
      vacio: 'Esta partida no tiene equipos incluidos todavia.',
      total: 'Total equipos',
    },
    mano_obra: {
      titulo: 'Mano de obra incluida',
      agregar: 'Agregar mano de obra',
      catalogo: 'Recurso de mano de obra',
      vacio: 'Esta partida no tiene mano de obra incluida todavia.',
      total: 'Total mano de obra',
    },
  }
  const labels = tipoLabels[tipo]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-6xl flex-col rounded-2xl border border-border/60 bg-background shadow-2xl" style={{ maxHeight: '92vh' }}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">{partida.codigo}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{partida.unidad}</span>
            </div>
            <p className="mt-1 text-sm font-medium leading-5 text-foreground">{partida.descripcion}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,4fr)_minmax(320px,3fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-border/40 px-6 py-4">
            <div className="mb-4 grid gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 md:grid-cols-[140px_160px_1fr]">
              <div className="grid gap-1">
                <Label className="text-xs">Cantidad partida</Label>
                <Input type="number" min="0" step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Precio unitario</Label>
                <div className="flex h-8 items-center rounded-lg border border-border/60 bg-background px-3 text-sm font-semibold tabular-nums text-primary">
                  {fmtNum(partida.precio_unitario, 4)}
                </div>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Importe partida</Label>
                <div className="flex h-8 items-center rounded-lg border border-border/60 bg-background px-3 text-sm font-semibold tabular-nums text-foreground">
                  {fmtNum(partida.importe_total)}
                </div>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button className="h-8 rounded-full px-4" disabled={savingPartida || !cantidad || Number(cantidad) < 0} onClick={() => onSavePartida(partida.id, cantidad)}>
                  {savingPartida ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Guardar partida
                </Button>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labels.titulo}</h3>
                <p className="mt-1 text-xs text-muted-foreground">El precio unitario de la partida se recalcula automaticamente con este detalle.</p>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {labels.total}: {fmtNum(totalMateriales)}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando materiales...
              </div>
            ) : materiales.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                {labels.vacio}
              </div>
            ) : (
              <div className="space-y-3">
                {materiales.map((material) => (
                  <MaterialEditRow
                    key={material.id}
                    material={material}
                    saving={savingMaterialId === material.id}
                    deleting={deletingMaterialId === material.id}
                    onSave={(input) => onUpdateMaterial(material.id, input)}
                    onDelete={() => onDeleteMaterial(material.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labels.agregar}</h3>
            <div className="mt-3 grid gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="grid gap-1">
                <Label className="text-xs">{labels.catalogo}</Label>
                <select
                  value={selectedRecursoId}
                  onChange={(e) => setSelectedRecursoId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Selecciona una opcion</option>
                  {materialResources.map((recurso) => (
                    <option key={recurso.id} value={recurso.id}>
                      {recurso.codigo} · {recurso.descripcion}
                    </option>
                  ))}
                </select>
                {loadingMaterialResources ? <p className="text-xs text-muted-foreground">Cargando catalogo...</p> : null}
              </div>

              {selectedRecurso ? (
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs">
                  <div className="font-mono text-primary">{selectedRecurso.codigo}</div>
                  <div className="mt-1 text-foreground">{selectedRecurso.descripcion}</div>
                  <div className="mt-1 text-muted-foreground">Unidad: {selectedRecurso.unidad} · Costo base: {fmtNum(selectedRecurso.precio, 4)}</div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min="0" step="0.0001" value={newMaterial.cantidad} onChange={(e) => setNewMaterial((current) => ({ ...current, cantidad: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Costo</Label>
                  <Input type="number" min="0" step="0.0001" value={newMaterial.costo} onChange={(e) => setNewMaterial((current) => ({ ...current, costo: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">% Desperdicio</Label>
                  <Input type="number" min="0" step="0.0001" value={newMaterial.desperdicio_pct} onChange={(e) => setNewMaterial((current) => ({ ...current, desperdicio_pct: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>

              <div className="rounded-lg bg-background px-3 py-2 text-sm">
                Total estimado:{' '}
                <span className="font-semibold tabular-nums text-primary">
                  {fmtNum((Number(newMaterial.cantidad) * Number(newMaterial.costo)) * (1 + (Number(newMaterial.desperdicio_pct) / 100)))}
                </span>
              </div>

              <Button
                className="h-9 rounded-full"
                disabled={!selectedRecurso || savingMaterialId === 'new' || Number(newMaterial.cantidad) <= 0}
                onClick={async () => {
                    if (!selectedRecurso) return
                  await onCreateMaterial({
                    tipo,
                    recurso_id: selectedRecurso.id,
                    codigo: selectedRecurso.codigo,
                    descripcion: selectedRecurso.descripcion,
                    unidad: selectedRecurso.unidad,
                    cantidad: newMaterial.cantidad,
                    costo: newMaterial.costo,
                    desperdicio_pct: newMaterial.desperdicio_pct,
                  })
                  setSelectedRecursoId('')
                  setNewMaterial({ cantidad: '1', costo: '0', desperdicio_pct: '0' })
                }}
              >
                {savingMaterialId === 'new' ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {labels.agregar}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MaterialEditRow({
  material,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  material: BimPartidaMaterial
  saving: boolean
  deleting: boolean
  onSave: (input: { cantidad: string; costo: string; desperdicio_pct: string }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [cantidad, setCantidad] = useState(material.cantidad)
  const [costo, setCosto] = useState(material.costo)
  const [desperdicio, setDesperdicio] = useState(material.desperdicio_pct)

  useEffect(() => {
    setCantidad(material.cantidad)
    setCosto(material.costo)
    setDesperdicio(material.desperdicio_pct)
  }, [material.id, material.cantidad, material.costo, material.desperdicio_pct])

  const total = (Number(cantidad) * Number(costo)) * (1 + (Number(desperdicio) / 100))

  return (
    <div className="rounded-xl border border-border/50 bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-primary">{material.codigo}</div>
          <div className="mt-1 text-sm text-foreground">{material.descripcion}</div>
          <div className="mt-1 text-xs text-muted-foreground">Unidad: {material.unidad}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Total
          <div className="text-sm font-semibold tabular-nums text-primary">{fmtNum(total)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <Input type="number" min="0" step="0.0001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-8 text-sm" />
        <Input type="number" min="0" step="0.0001" value={costo} onChange={(e) => setCosto(e.target.value)} className="h-8 text-sm" />
        <Input type="number" min="0" step="0.0001" value={desperdicio} onChange={(e) => setDesperdicio(e.target.value)} className="h-8 text-sm" />
        <Button className="h-8 rounded-full px-3" disabled={saving} onClick={() => onSave({ cantidad, costo, desperdicio_pct: desperdicio })}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          Guardar
        </Button>
        <Button variant="outline" className="h-8 rounded-full px-3 text-destructive" disabled={deleting} onClick={() => void onDelete()}>
          {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Eliminar
        </Button>
      </div>
      <div className="mt-2 grid gap-2 text-[10px] uppercase tracking-wide text-muted-foreground md:grid-cols-3">
        <span>Cantidad</span>
        <span>Costo</span>
        <span>% Desperdicio</span>
      </div>
    </div>
  )
}

export { PartidasPanel }

function PartidasPanelWithBoundary(props: PartidasPanelProps) {
  return (
    <PanelErrorBoundary>
      <PartidasPanel {...props} />
    </PanelErrorBoundary>
  )
}

export { PartidasPanelWithBoundary }
