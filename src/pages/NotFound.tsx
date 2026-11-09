import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export const NotFound = () => (
  <div className="mx-auto flex min-h-[60vh] max-w-shell flex-col justify-center px-5 py-20 lg:px-10">
    <p className="micro text-brass/80">404 — 这一帧不在片卷上</p>
    <h1 className="mt-6 max-w-3xl font-zh-title text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.15]">
      这一帧，
      <br />
      <span className="text-taupe">已经从拷贝里剪掉了。</span>
    </h1>
    <p className="mt-5 max-w-md text-[15px] leading-[1.9] text-ink/80">
      你访问的页面不存在，或者它指向的那条观影记录已经从片库中移除。
    </p>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={13} /> 返回我的电影
      </Link>
      <Link to="/archive" className="btn btn-ghost">
        打开我的片库
      </Link>
    </div>
  </div>
)
