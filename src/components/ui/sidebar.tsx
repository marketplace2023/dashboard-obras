import { createContext, useContext, useMemo, useState } from 'react'
import { Menu, PanelLeftClose } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SidebarContextValue = {
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error('Sidebar components must be used inside SidebarProvider')
  }

  return context
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false)
  const value = useMemo(() => ({ openMobile, setOpenMobile }), [openMobile])

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

function Sidebar({ className, children }: React.ComponentProps<'aside'>) {
  const { openMobile, setOpenMobile } = useSidebar()

  return (
    <>
      <aside className={cn('hidden w-72 shrink-0 border-r border-border/70 bg-card/80 md:flex md:flex-col', className)}>
        {children}
      </aside>

      {openMobile ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} type="button" />
          <aside className={cn('relative z-10 flex h-full w-[86vw] max-w-[320px] flex-col border-r border-border/70 bg-background shadow-2xl', className)}>
            <div className="flex items-center justify-end p-3">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setOpenMobile(false)}>
                <PanelLeftClose className="size-4" />
              </Button>
            </div>
            {children}
          </aside>
        </div>
      ) : null}
    </>
  )
}

function SidebarTrigger({ className }: { className?: string }) {
  const { setOpenMobile } = useSidebar()

  return (
    <Button variant="outline" size="icon" className={cn('rounded-xl md:hidden', className)} onClick={() => setOpenMobile(true)}>
      <Menu className="size-4" />
      <span className="sr-only">Abrir sidebar</span>
    </Button>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('border-b border-border/70 p-4', className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto p-4', className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('border-t border-border/70 p-4', className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-2', className)} {...props} />
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground', className)} {...props} />
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-1', className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('', className)} {...props} />
}

function SidebarMenuButton({ className, isActive, ...props }: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/60',
        isActive ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-foreground',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('ml-4 mt-0.5 grid gap-0.5 border-l border-border/50 pl-3', className)}
      {...props}
    />
  )
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('', className)} {...props} />
}

function SidebarMenuSubButton({
  className,
  isActive,
  ...props
}: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
        isActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-w-0 flex-1', className)} {...props} />
}

export {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
}
