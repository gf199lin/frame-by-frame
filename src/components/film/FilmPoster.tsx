import { useId, useState, type CSSProperties } from 'react'
import type { Film } from '@/types'
import { cn } from '@/lib/format'
import { frameSrc, portraitPosition } from '@/lib/media'

/**
 * Editorial frame masthead.
 *
 * The archive ships its own photographic "memory frame" per film. If that
 * image is missing (a film the visitor added themselves), we fall back to the
 * generated art print so the shelf never shows a broken slot.
 */
const PosterArt = ({ film }: { film: Film }) => {
  const rawId = useId()
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '')
  const { base, deep, accent, soft, paper } = film.palette

  const defs = (
    <defs>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor={base} />
        <stop offset="62%" stopColor={deep} />
        <stop offset="100%" stopColor="#060607" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
        <stop offset="100%" stopColor={accent} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="0.5">
        <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
        <stop offset="100%" stopColor={soft} stopOpacity="0.25" />
      </linearGradient>
      <filter id={`${id}-blur`}>
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <filter id={`${id}-blur-sm`}>
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  )

  const content = (() => {
    switch (film.motif) {
      case 'shore':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="292" cy="158" r="120" fill={`url(#${id}-glow)`} opacity="0.5" />
            <circle cx="292" cy="158" r="26" fill={paper} opacity="0.16" />
            <rect y="332" width="400" height="268" fill={deep} />
            <g stroke={accent} strokeOpacity="0.32" strokeWidth="1">
              {[352, 372, 396, 424, 456, 492, 532, 572].map((y, i) => (
                <line key={y} x1={-20 + i * 4} y1={y} x2={420 - i * 6} y2={y} />
              ))}
            </g>
            <path d="M0 332h400" stroke={accent} strokeOpacity="0.55" />
            <g fill="#05080A">
              <rect x="58" y="292" width="34" height="40" />
              <rect x="70" y="284" width="10" height="8" />
              <rect x="112" y="304" width="18" height="28" />
            </g>
            <rect x="254" y="300" width="2" height="16" fill="#05080A" />
            <rect x="256" y="300" width="8" height="2" fill="#05080A" />
            <g fill={accent} opacity="0.14">
              <circle cx="86" cy="120" r="2" />
              <circle cx="150" cy="88" r="1.5" />
              <circle cx="228" cy="132" r="1" />
            </g>
          </>
        )
      case 'orbit':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="290" r="150" fill={`url(#${id}-glow)`} opacity="0.5" />
            <g fill="none" stroke={accent} strokeOpacity="0.4">
              {[92, 128, 164, 204].map((r, i) => (
                <ellipse
                  key={r}
                  cx="200"
                  cy="290"
                  rx={r * 1.35}
                  ry={r * 0.52}
                  transform={`rotate(${-18 + i * 13} 200 290)`}
                  strokeWidth={i === 1 ? 1.2 : 0.7}
                />
              ))}
            </g>
            <circle cx="200" cy="290" r="34" fill={paper} opacity="0.1" filter={`url(#${id}-blur-sm)`} />
            <circle cx="200" cy="290" r="15" fill={paper} opacity="0.5" />
            <circle cx="200" cy="290" r="5" fill="#fffdf6" />
            <g fill={accent}>
              <circle cx="322" cy="252" r="3.4" opacity="0.85" />
              <circle cx="118" cy="352" r="2.2" opacity="0.6" />
              <circle cx="258" cy="398" r="1.6" opacity="0.5" />
              <circle cx="96" cy="196" r="1.8" opacity="0.45" />
            </g>
            <path d="M0 512q200-44 400 0" stroke={accent} strokeOpacity="0.22" fill="none" />
          </>
        )
      case 'stage':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <ellipse cx="240" cy="190" rx="210" ry="210" fill={`url(#${id}-glow)`} opacity="0.35" />
            <circle cx="286" cy="158" r="58" fill={accent} opacity="0.14" />
            <circle cx="286" cy="158" r="58" fill="none" stroke={accent} strokeOpacity="0.35" />
            <polygon points="214,0 320,0 372,600 118,600" fill={accent} opacity="0.09" />
            <polygon points="214,0 320,0 372,600 118,600" fill="none" stroke={accent} strokeOpacity="0.16" />
            <rect y="512" width="400" height="88" fill="#05060A" />
            <g fill="#04050A">
              <circle cx="182" cy="430" r="11" />
              <path d="M168 512v-56q0-14 14-14t14 14v56z" />
              <circle cx="236" cy="438" r="9" />
              <path d="M225 512v-48q0-12 11-12t11 12v48z" />
            </g>
            <g stroke={paper} strokeOpacity="0.5">
              <line x1="152" y1="522" x2="152" y2="590" strokeWidth="0.8" />
              <line x1="266" y1="522" x2="266" y2="590" strokeWidth="0.8" />
            </g>
            <g fill={accent} opacity="0.6">
              <circle cx="76" cy="86" r="2" />
              <circle cx="104" cy="132" r="1.2" />
              <circle cx="340" cy="86" r="1.4" />
            </g>
          </>
        )
      case 'dome':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="330" r="210" fill={`url(#${id}-glow)`} opacity="0.42" />
            <path d="M20 512V330a180 180 0 01360 0v182" fill={deep} stroke={accent} strokeOpacity="0.5" />
            <path d="M62 512V336a138 138 0 01276 0v176" fill="none" stroke={accent} strokeOpacity="0.2" strokeDasharray="2 6" />
            <g stroke={accent} strokeOpacity="0.18">
              {[290, 250, 210, 170].map((y, i) => (
                <path key={y} d={`M${40 + i * 10} ${y} Q200 ${y - 60 - i * 8} ${360 - i * 10} ${y}`} fill="none" />
              ))}
            </g>
            <g fill={paper} opacity="0.5">
              <circle cx="310" cy="120" r="1.4" />
              <circle cx="96" cy="180" r="1.1" />
              <circle cx="250" cy="82" r="1" />
              <circle cx="342" cy="214" r="1.3" />
            </g>
            <rect x="182" y="452" width="36" height="60" fill="#040A0C" stroke={accent} strokeOpacity="0.4" />
            <rect x="190" y="464" width="20" height="34" fill={accent} opacity="0.16" />
            <rect y="512" width="400" height="88" fill="#04090B" />
            <g fill="#04090B">
              <circle cx="200" cy="492" r="7" />
              <path d="M191 512v-12q0-9 9-9t9 9v12z" />
            </g>
          </>
        )
      case 'hotel':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <rect x="60" y="128" width="280" height="384" fill={soft} opacity="0.32" />
            <rect x="60" y="128" width="280" height="384" fill="none" stroke={accent} strokeOpacity="0.5" />
            <polygon points="60,128 200,64 340,128" fill={base} stroke={accent} strokeOpacity="0.55" />
            <g fill={accent} opacity="0.72">
              {[0, 1, 2, 3, 4, 5].map((row) =>
                [0, 1, 2, 3, 4].map((col) => (
                  <rect
                    key={`${row}-${col}`}
                    x={86 + col * 48}
                    y={158 + row * 46}
                    width="22"
                    height="26"
                    opacity={0.25 + ((row + col) % 3) * 0.2}
                  />
                )),
              )}
            </g>
            <rect x="172" y="430" width="56" height="82" fill={deep} stroke={accent} strokeOpacity="0.5" />
            <rect x="192" y="452" width="16" height="60" fill={accent} opacity="0.2" />
            <circle cx="200" cy="404" r="7" fill="#1A0D13" stroke={accent} strokeOpacity="0.5" />
            <g stroke={paper} strokeOpacity="0.18">
              <line x1="40" y1="512" x2="360" y2="512" />
              <line x1="40" y1="130" x2="40" y2="512" />
            </g>
            <g fill={paper} opacity="0.25">
              <circle cx="76" cy="96" r="1.4" />
              <circle cx="330" cy="88" r="1" />
            </g>
          </>
        )
      case 'bench':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="296" cy="160" r="180" fill={`url(#${id}-glow)`} opacity="0.55" />
            <circle cx="304" cy="142" r="30" fill={paper} opacity="0.14" filter={`url(#${id}-blur)`} />
            <g stroke={accent} strokeOpacity="0.2">
              {[80, 140, 200, 260, 320, 380].map((x) => (
                <line key={x} x1={x} y1="0" x2={x + 30} y2="330" />
              ))}
            </g>
            <path d="M0 392q100-38 200-10t200 4v214H0z" fill={deep} opacity="0.9" />
            <path d="M0 470q120-28 240 2t160 0" fill="none" stroke={accent} strokeOpacity="0.22" />
            <g stroke={accent} strokeOpacity="0.65">
              <line x1="92" y1="420" x2="92" y2="520" strokeWidth="1.6" />
              <line x1="118" y1="420" x2="118" y2="520" strokeWidth="1.6" />
              <line x1="72" y1="424" x2="192" y2="424" strokeWidth="1.4" />
              <line x1="72" y1="440" x2="192" y2="440" strokeWidth="1.4" />
              <line x1="82" y1="446" x2="82" y2="468" strokeWidth="1.2" />
              <line x1="178" y1="446" x2="178" y2="468" strokeWidth="1.2" />
            </g>
            <g fill="#050B08" stroke={paper} strokeOpacity="0.28" strokeWidth="0.9">
              <circle cx="128" cy="404" r="7" />
              <path d="M119 424v-10q0-8 9-8t9 8v10z" />
              <circle cx="158" cy="408" r="6" />
              <path d="M151 424v-8q0-7 7-7t7 7v8z" />
            </g>
            <g fill={paper} opacity="0.32">
              <circle cx="56" cy="120" r="1.2" />
              <circle cx="348" cy="232" r="1.5" />
              <circle cx="210" cy="86" r="1" />
              <circle cx="300" cy="360" r="1.3" />
            </g>
          </>
        )
      case 'space':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="292" cy="184" r="180" fill={`url(#${id}-glow)`} opacity="0.3" />
            <g fill={paper}>
              {Array.from({ length: 46 }).map((_, i) => {
                const x = (i * 137) % 400
                const y = (i * 223) % 560
                return <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 1.5 : 0.7} opacity={0.2 + (i % 5) * 0.1} />
              })}
            </g>
            <circle cx="286" cy="186" r="72" fill={soft} stroke={accent} strokeOpacity="0.5" />
            <ellipse cx="286" cy="186" rx="106" ry="20" fill="none" stroke={accent} strokeOpacity="0.4" transform="rotate(-16 286 186)" />
            <ellipse cx="286" cy="186" rx="120" ry="26" fill="none" stroke={accent} strokeOpacity="0.16" transform="rotate(-16 286 186)" />
            <path d="M60 520Q190 470 240 356" fill="none" stroke={accent} strokeOpacity="0.35" strokeDasharray="3 5" />
            <circle cx="60" cy="520" r="3" fill={paper} opacity="0.75" />
            <g fill={paper} opacity="0.18">
              <circle cx="92" cy="200" r="1" />
              <circle cx="342" cy="404" r="1.2" />
            </g>
          </>
        )
      case 'wall':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <g stroke={accent} strokeOpacity="0.2">
              {Array.from({ length: 16 }).map((_, row) => (
                <line
                  key={row}
                  x1="0"
                  y1={row * 38 + 120}
                  x2="400"
                  y2={row * 38 + 120}
                />
              ))}
              {Array.from({ length: 10 }).map((_, col) => (
                <line key={`v-${col}`} x1={col * 46} y1="120" x2={col * 46} y2="600" />
              ))}
            </g>
            <polygon points="250,0 330,0 210,600 120,600" fill={paper} opacity="0.05" />
            <circle cx="286" cy="96" r="150" fill={`url(#${id}-glow)`} opacity="0.6" />
            <circle cx="286" cy="112" r="34" fill={paper} opacity="0.2" filter={`url(#${id}-blur)`} />
            <g fill="#0A0805">
              <circle cx="196" cy="450" r="10" />
              <path d="M181 512v-58q0-16 15-16t15 16v58z" />
              <path d="M182 452l-30-30M210 452l30-30" stroke="#0A0805" strokeWidth="4" strokeLinecap="round" />
            </g>
            <rect y="512" width="400" height="88" fill="#080604" />
            <g stroke={accent} strokeOpacity="0.4">
              <line x1="0" y1="512" x2="400" y2="512" />
            </g>
          </>
        )
      case 'mind':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="300" r="190" fill={`url(#${id}-glow)`} opacity="0.35" />
            <g filter={`url(#${id}-blur-sm)`} opacity="0.75">
              <circle cx="156" cy="236" r="62" fill={accent} opacity="0.55" />
              <circle cx="252" cy="214" r="44" fill={soft} opacity="0.9" />
              <circle cx="244" cy="330" r="54" fill={paper} opacity="0.18" />
              <circle cx="140" cy="344" r="36" fill={accent} opacity="0.3" />
            </g>
            <g stroke={paper} strokeOpacity="0.18">
              <line x1="156" y1="236" x2="252" y2="214" />
              <line x1="252" y1="214" x2="244" y2="330" />
              <line x1="244" y1="330" x2="140" y2="344" />
              <line x1="140" y1="344" x2="156" y2="236" />
            </g>
            <g fill={paper} opacity="0.75">
              <circle cx="156" cy="236" r="2.6" />
              <circle cx="252" cy="214" r="2.2" />
              <circle cx="244" cy="330" r="2.4" />
              <circle cx="140" cy="344" r="2" />
            </g>
            <path d="M0 470q100-40 200-12t200 6" fill="none" stroke={accent} strokeOpacity="0.24" />
            <g fill={paper} opacity="0.2">
              <circle cx="80" cy="140" r="1.2" />
              <circle cx="330" cy="430" r="1.4" />
            </g>
          </>
        )
      case 'forest':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="286" cy="160" r="190" fill={`url(#${id}-glow)`} opacity="0.55" />
            <circle cx="300" cy="130" r="34" fill={paper} opacity="0.18" filter={`url(#${id}-blur)`} />
            <polygon points="280,0 400,0 210,600 120,600" fill={paper} opacity="0.075" />
            <g fill={soft} opacity="0.95">
              {[26, 68, 104, 300, 338, 372].map((x, i) => (
                <rect key={x} x={x} y="-10" width={i % 2 ? 9 : 14} height="620" opacity="0.9" />
              ))}
            </g>
            <g stroke={soft} strokeWidth="2.5" opacity="0.7">
              <line x1="30" y1="210" x2="78" y2="160" />
              <line x1="104" y1="270" x2="70" y2="222" />
              <line x1="338" y1="240" x2="380" y2="196" />
            </g>
            <g stroke={accent} strokeOpacity="0.22">
              {[150, 210, 270, 330, 390].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y - 20} />
              ))}
            </g>
            <rect y="330" width="400" height="190" fill={paper} opacity="0.03" />
            <rect y="470" width="400" height="60" fill={paper} opacity="0.045" />
            <line x1="0" y1="512" x2="400" y2="512" stroke={accent} strokeOpacity="0.35" />
            <g fill="#050A07" stroke={paper} strokeOpacity="0.22" strokeWidth="0.8">
              <circle cx="196" cy="460" r="8" />
              <path d="M184 512v-44q0-12 12-12t12 12v44z" />
            </g>
            <rect y="512" width="400" height="88" fill="#050A07" />
            <g fill={paper} opacity="0.3">
              <circle cx="240" cy="110" r="1.2" />
              <circle cx="90" cy="90" r="1" />
              <circle cx="350" cy="300" r="1.4" />
            </g>
          </>
        )
      case 'moon':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="200" r="150" fill={`url(#${id}-glow)`} opacity="0.5" />
            <circle cx="200" cy="196" r="84" fill={paper} opacity="0.2" />
            <circle cx="200" cy="196" r="84" fill="none" stroke={accent} strokeOpacity="0.45" />
            <g fill={base} opacity="0.22">
              <ellipse cx="158" cy="168" rx="24" ry="11" />
              <ellipse cx="238" cy="238" rx="14" ry="7" />
              <ellipse cx="172" cy="232" rx="8" ry="4" />
              <ellipse cx="228" cy="160" rx="10" ry="5" />
            </g>
            <g stroke={paper} strokeOpacity="0.12">
              <path d="M120 210q40-8 82-2t78-4" fill="none" />
              <path d="M132 222q34-6 70-1t66-3" fill="none" />
            </g>
            <rect y="300" width="400" height="300" fill={deep} />
            <g fill={paper} opacity="0.1">
              <rect x="188" y="300" width="24" height="240" />
              <rect x="196" y="300" width="8" height="260" opacity="0.6" />
            </g>
            <g stroke={accent} strokeOpacity="0.28">
              <line x1="0" y1="340" x2="400" y2="340" />
              <line x1="0" y1="372" x2="400" y2="372" />
              <line x1="0" y1="410" x2="400" y2="410" />
            </g>
            <g fill="#04070B">
              <path d="M252 404h28l-5 7h-18z" />
              <rect x="264" y="384" width="1.5" height="20" />
              <path d="M265 384l12 8-12 3z" opacity="0.8" />
            </g>
            <g fill="#04070B">
              <circle cx="140" cy="440" r="9" />
              <path d="M127 512v-56q0-14 13-14t13 14v56z" />
            </g>
            <rect y="512" width="400" height="88" fill="#04070B" />
          </>
        )
      case 'arrival':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="250" r="200" fill={`url(#${id}-glow)`} opacity="0.42" />
            <ellipse cx="200" cy="238" rx="96" ry="150" fill={accent} opacity="0.1" />
            <ellipse
              cx="200"
              cy="238"
              rx="96"
              ry="150"
              fill="none"
              stroke={paper}
              strokeOpacity="0.16"
              strokeWidth="7"
              filter={`url(#${id}-blur-sm)`}
            />
            <ellipse cx="200" cy="238" rx="96" ry="150" fill="none" stroke={accent} strokeOpacity="0.8" />
            <ellipse cx="200" cy="238" rx="72" ry="120" fill="none" stroke={accent} strokeOpacity="0.2" strokeDasharray="2 5" />
            <g stroke={paper} strokeOpacity="0.12">
              {[380, 420, 460, 500, 540].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y} />
              ))}
            </g>
            <polygon points="160,370 240,370 300,512 100,512" fill={paper} opacity="0.035" />
            <rect y="490" width="400" height="40" fill={paper} opacity="0.04" />
            <g fill="#05090B" stroke={paper} strokeOpacity="0.3" strokeWidth="0.8">
              <circle cx="200" cy="470" r="6" />
              <path d="M192 512v-36q0-8 8-8t8 8v36z" />
            </g>
            <rect y="512" width="400" height="88" fill="#04080A" />
            <g fill={paper} opacity="0.24">
              <circle cx="84" cy="120" r="1.2" />
              <circle cx="322" cy="420" r="1" />
              <circle cx="300" cy="92" r="1.4" />
            </g>
          </>
        )
      case 'signal':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="200" r="150" fill={`url(#${id}-glow)`} opacity="0.45" />
            <circle cx="200" cy="188" r="52" fill={accent} opacity="0.2" />
            <circle cx="200" cy="188" r="52" fill="none" stroke={accent} strokeOpacity="0.5" />
            <g fill="none" stroke={accent} strokeOpacity="0.28">
              {[80, 104, 130, 158].map((r) => (
                <circle key={r} cx="200" cy="188" r={r} />
              ))}
            </g>
            <path
              d="M40 340q30-34 60 0t60 0 60 0 60 0 60 0 40 0"
              fill="none"
              stroke={paper}
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
            <path
              d="M40 372q30-18 60 0t60 0 60 0 60 0 60 0 40 0"
              fill="none"
              stroke={accent}
              strokeOpacity="0.45"
            />
            <g fill="#0C0708">
              <circle cx="152" cy="470" r="9" />
              <path d="M140 512v-28q0-12 12-12t12 12v28z" />
              <circle cx="254" cy="478" r="8" />
              <path d="M244 512v-22q0-10 10-10t10 10v22z" />
            </g>
            <rect y="512" width="400" height="88" fill="#0C0708" />
          </>
        )
      case 'drum':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="286" cy="184" r="170" fill={`url(#${id}-glow)`} opacity="0.4" />
            <g fill="none" stroke={accent}>
              {[54, 84, 118, 156, 198].map((r, i) => (
                <ellipse key={r} cx="228" cy="300" rx={r} ry={r * 0.34} strokeOpacity={0.5 - i * 0.07} />
              ))}
              <ellipse cx="228" cy="296" rx="52" ry="18" fill={accent} fillOpacity="0.1" strokeOpacity="0.6" />
            </g>
            <g stroke={paper} strokeOpacity="0.5" strokeWidth="2">
              <line x1="150" y1="106" x2="238" y2="292" />
              <line x1="310" y1="96" x2="236" y2="292" />
            </g>
            <g fill={accent}>
              <circle cx="140" cy="90" r="2" opacity="0.7" />
              <circle cx="330" cy="118" r="1.6" opacity="0.6" />
              <circle cx="300" cy="60" r="1.2" opacity="0.5" />
            </g>
            <path d="M0 470h400" stroke={paper} strokeOpacity="0.14" />
            <g fill="#090705">
              <circle cx="96" cy="452" r="8" />
              <path d="M86 512v-38q0-10 10-10t10 10v38z" />
            </g>
            <rect y="512" width="400" height="88" fill="#070504" />
          </>
        )
      case 'city':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="108" cy="120" r="180" fill={`url(#${id}-glow)`} opacity="0.35" />
            <g fill={deep}>
              {[0, 52, 108, 156, 212, 268, 320, 366].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={300 - ((i * 37) % 120)}
                  width={i % 3 === 0 ? 52 : 44}
                  height={300 + ((i * 37) % 120)}
                  opacity={0.9}
                />
              ))}
            </g>
            <g fill={paper} opacity="0.4">
              {Array.from({ length: 34 }).map((_, i) => (
                <rect
                  key={i}
                  x={14 + ((i * 53) % 370)}
                  y={240 + ((i * 71) % 220)}
                  width="4"
                  height="5"
                  opacity={0.2 + (i % 4) * 0.16}
                />
              ))}
            </g>
            <g fill="#080B0E">
              <circle cx="176" cy="462" r="8" />
              <path d="M165 512v-38q0-11 11-11t11 11v38z" />
              <circle cx="232" cy="470" r="7" />
              <path d="M223 512v-30q0-10 9-10t9 10v30z" />
            </g>
            <rect y="512" width="400" height="88" fill="#080B0E" />
            <path d="M0 512h400" stroke={accent} strokeOpacity="0.3" />
          </>
        )
      case 'fire':
        return (
          <>
            <rect width="400" height="600" fill={`url(#${id}-bg)`} />
            <circle cx="200" cy="300" r="200" fill={`url(#${id}-glow)`} opacity="0.4" />
            <ellipse cx="200" cy="290" rx="112" ry="150" fill={soft} opacity="0.4" />
            <ellipse cx="200" cy="290" rx="112" ry="150" fill="none" stroke={accent} strokeOpacity="0.5" />
            <ellipse cx="200" cy="290" rx="96" ry="132" fill={base} opacity="0.8" />
            <g fill={accent} opacity="0.5" filter={`url(#${id}-blur-sm)`}>
              <ellipse cx="200" cy="330" rx="40" ry="82" />
              <ellipse cx="200" cy="350" rx="20" ry="52" fill={paper} opacity="0.5" />
            </g>
            <path d="M200 240q26 52 0 96-26-44 0-96z" fill={paper} opacity="0.35" />
            <g stroke={paper} strokeOpacity="0.28">
              <line x1="40" y1="290" x2="360" y2="290" />
              <line x1="200" y1="120" x2="200" y2="460" strokeOpacity="0.1" />
            </g>
            <g fill={paper} opacity="0.2">
              <circle cx="86" cy="150" r="1.4" />
              <circle cx="318" cy="420" r="1.2" />
            </g>
          </>
        )
      default:
        return <rect width="400" height="600" fill={`url(#${id}-bg)`} />
    }
  })()

  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`${film.title} poster illustration`}
    >
      {defs}
      {content}
      <rect width="400" height="600" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
    </svg>
  )
}

export const FilmPoster = ({
  film,
  className,
  showTitle = true,
  eager = false,
  position,
}: {
  film: Film
  className?: string
  showTitle?: boolean
  eager?: boolean
  position?: string
}) => {
  const [failed, setFailed] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)
  const style = {
    '--film-accent': film.palette.accent,
    backgroundColor: film.palette.deep,
  } as CSSProperties

  const showPhoto = !frameFailed && !failed

  return (
    <div className={cn('poster-frame relative h-full w-full', className)} style={style}>
      {film.posterUrl && !failed ? (
        <img
          src={film.posterUrl}
          alt={`${film.title} poster`}
          className="absolute inset-0 h-full w-full object-cover"
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : showPhoto ? (
        <img
          src={frameSrc(film.id)}
          alt={`A memory frame from ${film.title}`}
          className="film-tone absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position ?? portraitPosition(film.id) }}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFrameFailed(true)}
        />
      ) : (
        <PosterArt film={film} />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,6,7,0.42) 0%, rgba(6,6,7,0) 22%, rgba(6,6,7,0) 46%, rgba(6,6,7,0.74) 82%, rgba(6,6,7,0.92) 100%)',
        }}
      />
      <div className="poster-grain pointer-events-none absolute inset-0" />

      {showTitle && (
        <>
          <div className="absolute left-[6%] right-[6%] top-[5%] flex items-start justify-between gap-3">
            <span className="poster-meta uppercase text-paper/55">
              {film.year} · {film.country}
            </span>
            <span className="poster-genre poster-meta text-right uppercase text-paper/40">
              {film.genres[0]}
            </span>
          </div>

          <div className="absolute bottom-[5.5%] left-[6%] right-[6%]">
            {film.director && film.director !== 'Unknown director' && (
              <p className="poster-meta mb-2 uppercase text-paper/45">{film.director}</p>
            )}
            <h3 className="poster-title font-display text-paper">{film.title}</h3>
            <div className="mt-2 flex items-end justify-between gap-3 border-t border-white/20 pt-2">
              {film.titleZh && film.titleZh !== film.title && (
                <p className="poster-title-zh text-paper/60">{film.titleZh}</p>
              )}
              <p className="poster-meta whitespace-nowrap text-right uppercase text-paper/40">
                {film.runtime} min
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
