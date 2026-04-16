import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

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

function MaestrosPanel({ token, onMessage, initialSection = 'materiales' }: MaestrosPanelProps) {
  const [activeSection, setActiveSection] = useState<MaestroSection>(initialSection)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recursos, setRecursos] = useState<BimRecurso[]>([])
  const [partidas, setPartidas] = useState<BimPrecioUnitario[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [printSnapshot, setPrintSnapshot] = useState<MaestroPrintSnapshot | null>(null)
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
        setPartidas(Array.isArray(data) ? data : [])
      } else {
        const tipo = recursoSections.find((item) => item.key === section)?.tipo
        const data = await parseApiResponse<BimRecurso[]>(
          await fetch(`${API_BASE_URL}/precios-unitarios/recursos?tipo=${tipo}`, { headers }),
        )
        setRecursos(Array.isArray(data) ? data : [])
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

  function resetForm() {
    setEditingId(null)
    setForm({ codigo: '', descripcion: '', unidad: '', precio: '', categoria: '', rendimiento: '1' })
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

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      if (isPartidas) {
        const payload = {
          codigo: form.codigo,
          descripcion: form.descripcion,
          unidad: form.unidad,
          categoria: form.categoria || undefined,
          rendimiento: form.rendimiento || '1',
        }

        await parseApiResponse(
          await fetch(`${API_BASE_URL}/precios-unitarios${editingId ? `/${editingId}` : ''}`, {
            method: editingId ? 'PATCH' : 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(editingId ? payload : { ...payload, precio_base: '0' }),
          }),
        )
      } else {
        const tipo = currentSection.tipo
        const payload = {
          codigo: form.codigo,
          descripcion: form.descripcion,
          unidad: form.unidad,
          precio: form.precio || '0',
          tipo,
        }

        await parseApiResponse(
          await fetch(`${API_BASE_URL}/precios-unitarios/recursos${editingId ? `/${editingId}` : ''}`, {
            method: editingId ? 'PATCH' : 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        )
      }

      onMessage({ tone: 'success', text: `${currentSection.label} guardado correctamente.` })
      resetForm()
      await loadSection(activeSection)
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
      await loadSection(activeSection)
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
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando {currentSection.label.toLowerCase()}...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                No hay registros en este maestro.
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
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
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => handleEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-full text-destructive" disabled={deletingId === row.id} onClick={() => void handleDelete(row.id)}>
                        {deletingId === row.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
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
    </>
  )
}

export { MaestrosPanel }
