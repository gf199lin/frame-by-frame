import { useMemo, useRef, useState } from 'react'
import { ClipboardCopy, Download, FileUp, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { buildAgentInput } from '@/lib/taste/evolutionInput'
import { cn } from '@/lib/format'

type Status = { tone: 'ok' | 'error'; lines: string[] } | null

/**
 * The only bridge between a real agent run and the site. It never invents a
 * run: it exports the exact history the agent needs, and imports only a
 * document that passes record/film/hash/quote checks.
 */
export const EvolutionTransfer = () => {
  const { state, records, films, importEvolution, evolution } = useAppStore()
  const candidates = useMemo(
    () => records.filter((record) => state.analyses.some((a) => a.recordId === record.id)),
    [records, state.analyses],
  )
  const [recordId, setRecordId] = useState(candidates[0]?.id ?? '')
  const [raw, setRaw] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const titleOf = (id: string) => {
    const record = records.find((item) => item.id === id)
    return films.find((film) => film.id === record?.filmId)?.title ?? id
  }

  const handleExport = async () => {
    setStatus(null)
    if (!recordId) {
      setStatus({ tone: 'error', lines: ['请先选择一部电影'] })
      return
    }
    const payload = await buildAgentInput(
      state,
      films,
      recordId,
      `run-input-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`,
    )
    if (!payload) {
      setStatus({ tone: 'error', lines: ['无法读取这部电影的笔记'] })
      return
    }
    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setStatus({
        tone: 'ok',
        lines: [`已复制 Agent 输入（含 ${payload.history.feedback.length} 条反馈）到剪贴板`],
      })
    } catch {
      setRaw(text)
      setStatus({ tone: 'ok', lines: ['剪贴板不可用，输入已填入下方文本框'] })
    }
  }

  const handleDownload = () => {
    if (!raw.trim()) {
      setStatus({ tone: 'error', lines: ['先点击“导出输入”，或把 evolution JSON 粘到文本框'] })
      return
    }
    try {
      const doc = JSON.parse(raw)
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${String(doc.run_id ?? 'evolution')}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setStatus({ tone: 'error', lines: ['文本框当前内容不是合法 JSON'] })
    }
  }

  const handleImport = async () => {
    setStatus(null)
    let doc: unknown
    try {
      doc = JSON.parse(raw)
    } catch {
      setStatus({ tone: 'error', lines: ['不是合法 JSON'] })
      return
    }
    setBusy(true)
    try {
      const result = await importEvolution(doc)
      const lines = [
        ...result.failures,
        ...result.warnings,
        ...(result.ok && !result.alreadyImported
          ? [
              `已导入 run ${result.runId}`,
              `观察 ${result.bundles.length} 条，快照 ${result.snapshot?.snapshot_id ?? '无'}`,
            ]
          : []),
      ]
      setStatus({ tone: result.ok ? 'ok' : 'error', lines })
    } finally {
      setBusy(false)
    }
  }

  const latest = [...state.agentObservations].sort((a, b) =>
    b.analyzed_at.localeCompare(a.analyzed_at),
  )[0]

  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto max-w-shell px-5 py-12 lg:px-10 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
          <div>
            <p className="artifact-label">
              <b>Agent</b> 跨记录交接
            </p>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.8] text-taupe">
              导出包含历史记录、观察、反馈与最新快照的输入；只导入通过
              record_id / film_id / note_sha256 / 逐字引用校验的 evolution JSON。
              导入失败不会覆盖上一次有效快照。
            </p>
          </div>
          <p className="text-[12.5px] tracking-[0.05em] text-taupe">
            {latest ? `最近运行 ${latest.run_id}` : '尚无 DeepWorks 运行'}
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block text-[12.5px] tracking-[0.05em] text-taupe">
            为哪部电影准备输入
            <select
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              className="mt-2 w-full border border-ink/20 bg-paper px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/50"
            >
              {candidates.map((record) => (
                <option key={record.id} value={record.id}>
                  {titleOf(record.id)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 border border-ink/25 px-3.5 py-2 text-[13px] text-ink transition hover:border-ink/60"
            >
              <ClipboardCopy size={14} /> 导出输入
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 border border-ink/25 px-3.5 py-2 text-[13px] text-ink transition hover:border-ink/60"
            >
              <FileUp size={14} /> 选择 JSON
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 border border-ink/25 px-3.5 py-2 text-[13px] text-ink transition hover:border-ink/60"
            >
              <Download size={14} /> 下载
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            setRaw(await file.text())
            setStatus({ tone: 'ok', lines: [`已读入 ${file.name}`] })
            event.target.value = ''
          }}
        />

        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="把 DeepWorks Film Curator 输出的 taste-evolution.v1 JSON 粘贴到这里"
          spellCheck={false}
          className="mt-4 h-40 w-full resize-y border border-ink/20 bg-white/50 p-3 font-mono text-[12px] leading-[1.7] text-ink outline-none focus:border-ink/50"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-2 bg-ink px-4 py-2 text-[13px] text-paper transition',
              busy && 'opacity-60',
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            校验并导入
          </button>
          <span className="text-[12px] text-taupe">
            当前 {evolution.observations.length} 条观察 · {state.tasteSnapshots.length} 个快照
          </span>
        </div>

        {status && (
          <ul
            className={cn(
              'mt-3 space-y-1 border-l-2 pl-3 text-[13px] leading-[1.75]',
              status.tone === 'ok' ? 'border-ocean/50 text-ink/80' : 'border-[#8c4b3a]/60 text-[#8c4b3a]',
            )}
          >
            {status.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
