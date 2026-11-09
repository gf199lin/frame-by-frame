import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 诊断信息只留在控制台，用户界面不展示原始技术错误。
    console.error('Frame by Frame crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="micro text-paper/50">放映暂时中断</p>
        <h1 className="mt-4 font-zh-title text-3xl leading-snug text-paper sm:text-4xl">
          放映机出了一点问题
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-[1.9] text-paper-muted">
          你的片库仍然保存在这台设备的浏览器里。刷新页面即可重新进入博物馆；如果问题反复出现，可以在页脚恢复示例数据。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary mt-7"
        >
          刷新页面
        </button>
        <details className="mt-8 max-w-lg text-left">
          <summary className="cursor-pointer text-[12.5px] tracking-[0.08em] text-paper-muted/70">
            查看诊断信息（仅用于排查）
          </summary>
          <p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-paper-muted/60">
            {this.state.error.message}
          </p>
        </details>
      </div>
    )
  }
}
