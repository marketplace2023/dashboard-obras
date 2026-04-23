import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderTree, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'

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
  tipo: string
  version: number
  estado: string
  es_oficial?: boolean | null
  total_presupuesto?: string
  moneda?: string
}

type BimCapituloNodo = {
  id: string
  codigo: string
  nombre: string
  orden: number
  parent_id?: string | null
  partidas: Array<{ id: string }>
  children: BimCapituloNodo[]
}

type PresupuestoArbol = BimPresupuesto & { capitulos: BimCapituloNodo[] }

type CapituloPlano = BimCapituloNodo & {
  depth: number
  partidasCount: number
  childrenCount: number
}

type CapitulosPanelProps = {
  user: AuthUser
  token: string
  onMessage: (msg: MsgState) => void
  initialObraId?: string
  onWorkflowChange?: () => void
  onNavigateToBudget?: (section: 'partidas' | 'presupuestos-sin-apu') => void
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

function sortBudgets(list: BimPresupuesto[]) {
  return [...list].sort((a, b) => {
    const officialDiff = Number(b.es_oficial ? 1 : 0) - Number(a.es_oficial ? 1 : 0)
    if (officialDiff !== 0) return officialDiff
    const versionDiff = Number(b.version || 0) - Number(a.version || 0)
    if (versionDiff !== 0) return versionDiff
    return String(a.nombre || '').localeCompare(String(b.nombre || ''))
  })
}

function formatBudgetLabel(budget: BimPresupuesto) {
  const tipo = budget.tipo === 'sin_apu' ? 'Sin A.P.U.' : 'Con A.P.U.'
  return `${tipo} · v${budget.version} · ${budget.nombre}${budget.es_oficial ? ' · Oficial' : ''}`
}

function flattenCapitulos(nodes: BimCapituloNodo[], depth = 0): CapituloPlano[] {
  return nodes.flatMap((node) => [
    {
      ...node,
      depth,
      partidasCount: Array.isArray(node.partidas) ? node.partidas.length : 0,
      childrenCount: Array.isArray(node.children) ? node.children.length : 0,
    },
    ...flattenCapitulos(node.children ?? [], depth + 1),
  ])
}

function collectBlockedParentIds(nodes: BimCapituloNodo[], targetId: string) {
  const blocked = new Set<string>()

  const mark = (node: BimCapituloNodo) => {
    blocked.add(node.id)
    for (const child of node.children ?? []) mark(child)
  }

  const walk = (items: BimCapituloNodo[]) => {
    for (const item of items) {
      if (item.id === targetId) {
        mark(item)
        return true
      }
      if (walk(item.children ?? [])) return true
    }
    return false
  }

  walk(nodes)
  return blocked
}

export function CapitulosPanel({ token, onMessage, initialObraId, onWorkflowChange, onNavigateToBudget }: CapitulosPanelProps) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [obras, setObras] = useState<BimObra[]>([])
  const [selectedObraId, setSelectedObraId] = useState(initialObraId ?? '')
  const [loadingObras, setLoadingObras] = useState(true)

  const [presupuestos, setPresupuestos] = useState<BimPresupuesto[]>([])
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState('')
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false)

  const [arbol, setArbol] = useState<PresupuestoArbol | null>(null)
  const [loadingArbol, setLoadingArbol] = useState(false)

  const [editingCapituloId, setEditingCapituloId] = useState<string | null>(null)
  const [savingCapitulo, setSavingCapitulo] = useState(false)
  const [deletingCapituloId, setDeletingCapituloId] = useState<string | null>(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', orden: '1', parent_id: '' })

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
      setEditingCapituloId(null)
      return
    }

    let active = true
    setLoadingPresupuestos(true)
    setSelectedPresupuestoId('')
    setArbol(null)
    setEditingCapituloId(null)

    Promise.all([
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=obra`, { headers }),
      fetch(`${API_BASE_URL}/presupuestos/obra/${selectedObraId}?tipo=sin_apu`, { headers }),
    ])
      .then(async ([obraRes, sinApuRes]) => {
        const obraData = await obraRes.json() as unknown
        const sinApuData = await sinApuRes.json() as unknown
        return sortBudgets([...unwrapList<BimPresupuesto>(obraData), ...unwrapList<BimPresupuesto>(sinApuData)])
      })
      .then((list) => {
        if (!active) return
        setPresupuestos(list)
        if (list[0]) setSelectedPresupuestoId(String(list[0].id))
      })
      .catch(() => {
        if (!active) return
        onMessage({ tone: 'error', text: 'No se pudieron cargar los presupuestos base.' })
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
      if (!response.ok) throw new Error('No se pudo cargar el árbol de capítulos')
      const data = await response.json() as PresupuestoArbol
      setArbol(data)
    } catch (error) {
      setArbol(null)
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar la estructura del presupuesto.' })
    } finally {
      setLoadingArbol(false)
    }
  }, [headers, onMessage, selectedPresupuestoId])

  useEffect(() => {
    void loadArbol()
  }, [loadArbol])

  const capitulosPlano = useMemo(() => flattenCapitulos(arbol?.capitulos ?? []), [arbol])

  const selectedObra = useMemo(
    () => obras.find((obra) => obra.id === selectedObraId) ?? null,
    [obras, selectedObraId],
  )

  const selectedPresupuesto = useMemo(
    () => presupuestos.find((presupuesto) => presupuesto.id === selectedPresupuestoId) ?? null,
    [presupuestos, selectedPresupuestoId],
  )

  const blockedParentIds = useMemo(
    () => (editingCapituloId ? collectBlockedParentIds(arbol?.capitulos ?? [], editingCapituloId) : new Set<string>()),
    [arbol, editingCapituloId],
  )

  const parentOptions = useMemo(
    () => capitulosPlano.filter((capitulo) => !blockedParentIds.has(capitulo.id)),
    [blockedParentIds, capitulosPlano],
  )

  useEffect(() => {
    setEditingCapituloId(null)
    setForm({ codigo: '', nombre: '', orden: String(capitulosPlano.length + 1 || 1), parent_id: '' })
  }, [selectedPresupuestoId, capitulosPlano.length])

  function resetForm() {
    setEditingCapituloId(null)
    setForm({ codigo: '', nombre: '', orden: String(capitulosPlano.length + 1 || 1), parent_id: '' })
  }

  function handleEditCapitulo(capitulo: CapituloPlano) {
    setEditingCapituloId(capitulo.id)
    setForm({
      codigo: capitulo.codigo,
      nombre: capitulo.nombre,
      orden: String(capitulo.orden ?? 0),
      parent_id: capitulo.parent_id ? String(capitulo.parent_id) : '',
    })
  }

  async function handleSaveCapitulo() {
    if (!selectedPresupuestoId || !form.codigo.trim() || !form.nombre.trim()) return

    setSavingCapitulo(true)
    try {
      const response = await fetch(
        editingCapituloId
          ? `${API_BASE_URL}/presupuestos/capitulos/${editingCapituloId}`
          : `${API_BASE_URL}/presupuestos/${selectedPresupuestoId}/capitulos`,
        {
          method: editingCapituloId ? 'PATCH' : 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: form.codigo.trim(),
            nombre: form.nombre.trim(),
            orden: Number(form.orden || capitulosPlano.length + 1),
            parent_id: form.parent_id || undefined,
          }),
        },
      )
      if (!response.ok) throw new Error(editingCapituloId ? 'No se pudo actualizar el capítulo' : 'No se pudo crear el capítulo')

      await loadArbol()
      await onWorkflowChange?.()
      resetForm()
      onMessage({ tone: 'success', text: editingCapituloId ? 'Capítulo actualizado.' : 'Capítulo creado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el capítulo.' })
    } finally {
      setSavingCapitulo(false)
    }
  }

  async function handleDeleteCapitulo(capituloId: string) {
    setDeletingCapituloId(capituloId)
    try {
      const response = await fetch(`${API_BASE_URL}/presupuestos/capitulos/${capituloId}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) throw new Error('No se pudo eliminar el capítulo')

      await loadArbol()
      await onWorkflowChange?.()
      if (editingCapituloId === capituloId) resetForm()
      onMessage({ tone: 'success', text: 'Capítulo eliminado.' })
    } catch (error) {
      onMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar el capítulo.' })
    } finally {
      setDeletingCapituloId(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
      <div className="grid gap-6 content-start">
        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Contexto de capítulos</CardTitle>
            <CardDescription>Selecciona la obra y el presupuesto original donde vas a organizar capítulos y subcapítulos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Obra</Label>
              {loadingObras ? (
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando proyectos...
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
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Cargando presupuestos...
                </div>
              ) : presupuestos.length > 0 ? (
                <select value={selectedPresupuestoId} onChange={(event) => setSelectedPresupuestoId(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Selecciona un presupuesto</option>
                  {presupuestos.map((presupuesto) => (
                    <option key={presupuesto.id} value={presupuesto.id}>{formatBudgetLabel(presupuesto)}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Esta obra todavía no tiene presupuesto base. Crea primero un presupuesto con o sin A.P.U. para organizar capítulos.
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:bg-muted/35" onClick={() => onNavigateToBudget?.('partidas')}>
                <p className="font-medium text-foreground">Ir a presupuesto con A.P.U.</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Crea o abre un presupuesto analítico para estructurar capítulos.</p>
              </button>
              <button type="button" className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:bg-muted/35" onClick={() => onNavigateToBudget?.('presupuestos-sin-apu')}>
                <p className="font-medium text-foreground">Ir a presupuesto sin A.P.U.</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Trabaja la estructura por capítulos cuando el presupuesto sea directo.</p>
              </button>
            </div>

            {selectedObra ? (
              <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Obra activa</p>
                <p className="mt-1 font-medium text-foreground">{selectedObra.codigo} · {selectedObra.nombre}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{editingCapituloId ? 'Editar capítulo' : 'Nuevo capítulo'}</CardTitle>
            <CardDescription>{editingCapituloId ? 'Actualiza código, nombre, orden y jerarquía.' : 'Crea capítulos raíz o subcapítulos sobre el presupuesto seleccionado.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Código</Label>
              <Input value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value }))} placeholder="01" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Movimiento de tierra" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
              <div className="grid gap-1.5">
                <Label className="text-xs">Orden</Label>
                <Input type="number" min="0" step="1" value={form.orden} onChange={(event) => setForm((current) => ({ ...current, orden: event.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Capítulo padre</Label>
                <select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Capítulo raíz</option>
                  {parentOptions.map((capitulo) => (
                    <option key={capitulo.id} value={capitulo.id}>{`${'  '.repeat(capitulo.depth)}${capitulo.codigo} · ${capitulo.nombre}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => void handleSaveCapitulo()} disabled={!selectedPresupuestoId || savingCapitulo || !form.codigo.trim() || !form.nombre.trim()}>
                {savingCapitulo ? <LoaderCircle className="size-4 animate-spin" /> : editingCapituloId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                {editingCapituloId ? 'Guardar cambios' : 'Crear capítulo'}
              </Button>
              {editingCapituloId ? (
                <Button variant="outline" className="rounded-full" onClick={resetForm}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 content-start">
        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Estructura actual</CardTitle>
            <CardDescription>Gestiona la jerarquía real del presupuesto seleccionado desde un módulo dedicado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Presupuesto</p>
                <p className="mt-1 font-medium text-foreground">{selectedPresupuesto ? formatBudgetLabel(selectedPresupuesto) : 'Sin presupuesto seleccionado'}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Capítulos</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{capitulosPlano.length}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Partidas directas</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{capitulosPlano.reduce((sum, capitulo) => sum + capitulo.partidasCount, 0)}</p>
              </div>
            </div>

            {loadingArbol ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 px-4 py-12 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando estructura de capítulos...
              </div>
            ) : !selectedPresupuestoId ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-12 text-center text-sm text-muted-foreground">
                Selecciona un presupuesto para trabajar la jerarquía de capítulos.
              </div>
            ) : capitulosPlano.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-12 text-center text-sm text-muted-foreground">
                No hay capítulos todavía. Crea el primero desde el formulario de la izquierda.
              </div>
            ) : (
              <div className="grid gap-3">
                {capitulosPlano.map((capitulo) => {
                  const isDeleting = deletingCapituloId === capitulo.id
                  return (
                    <div key={capitulo.id} className="rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm transition-colors hover:bg-muted/10">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1" style={{ paddingLeft: `${capitulo.depth * 20}px` }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 font-mono">{capitulo.codigo}</Badge>
                            <Badge variant="secondary" className="rounded-full px-2.5 py-1">{capitulo.depth === 0 ? 'Raíz' : 'Subcapítulo'}</Badge>
                            <Badge variant="secondary" className="rounded-full px-2.5 py-1">Orden {capitulo.orden ?? 0}</Badge>
                          </div>
                          <div className="mt-3 flex items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <FolderTree className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-5 text-foreground break-words">{capitulo.nombre}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-2.5 py-1">Partidas directas: <span className="font-semibold text-foreground">{capitulo.partidasCount}</span></span>
                                <span className="rounded-full bg-muted px-2.5 py-1">Subcapítulos: <span className="font-semibold text-foreground">{capitulo.childrenCount}</span></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => handleEditCapitulo(capitulo)} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Editar capítulo">
                            <Pencil className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => void handleDeleteCapitulo(capitulo.id)} disabled={isDeleting} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50" title="Eliminar capítulo">
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
      </div>
    </div>
  )
}
