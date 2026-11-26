import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { WatchRecord } from '@/types'
import { AddFilmFlow } from './AddFilmFlow'

type FlowState =
  | { mode: 'add'; filmId?: string; rewatch?: boolean }
  | { mode: 'edit'; record: WatchRecord }
  | null

type AddFilmContextValue = {
  openAdd: (filmId?: string, rewatch?: boolean) => void
  openEdit: (record: WatchRecord) => void
}

const AddFilmContext = createContext<AddFilmContextValue | null>(null)

export const AddFilmProvider = ({ children }: { children: ReactNode }) => {
  const [flow, setFlow] = useState<FlowState>(null)

  const openAdd = useCallback((filmId?: string, rewatch?: boolean) => setFlow({ mode: 'add', filmId, rewatch }), [])
  const openEdit = useCallback((record: WatchRecord) => setFlow({ mode: 'edit', record }), [])
  const close = useCallback(() => setFlow(null), [])

  const value = useMemo(() => ({ openAdd, openEdit }), [openAdd, openEdit])

  return (
    <AddFilmContext.Provider value={value}>
      {children}
      {flow && (
        <AddFilmFlow
          open
          initialFilmId={flow.mode === 'add' ? flow.filmId : flow.record.filmId}
          editRecord={flow.mode === 'edit' ? flow.record : undefined}
          rewatch={flow.mode === 'add' && flow.rewatch}
          onClose={close}
        />
      )}
    </AddFilmContext.Provider>
  )
}

export const useAddFilm = (): AddFilmContextValue => {
  const ctx = useContext(AddFilmContext)
  if (!ctx) throw new Error('useAddFilm must be used inside AddFilmProvider')
  return ctx
}
