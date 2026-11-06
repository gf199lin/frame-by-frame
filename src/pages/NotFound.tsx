import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export const NotFound = () => (
  <div className="mx-auto flex min-h-[60vh] max-w-shell flex-col justify-center px-5 py-20 lg:px-10">
    <p className="micro text-brass/80">404 — Off the reel</p>
    <h1 className="display-hero mt-6 max-w-3xl">
      This frame was
      <br />
      <span className="italic text-taupe">cut from the print.</span>
    </h1>
    <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/70">
      The page you asked for does not exist — or the record it pointed to was removed from the
      archive.
    </p>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={13} /> Back to My Cinema
      </Link>
      <Link to="/archive" className="btn btn-ghost">
        Open the archive
      </Link>
    </div>
  </div>
)
