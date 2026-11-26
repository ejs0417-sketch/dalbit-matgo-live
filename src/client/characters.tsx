import type { Mood } from '../shared/cast'
import { avatarById } from '../shared/cast'

function eyes(mood: Mood) {
  if (mood === 'happy' || mood === 'cheer' || mood === 'smug') return 'M34 58 Q40 52 46 58 M74 58 Q80 52 86 58'
  if (mood === 'sad') return 'M34 60 Q40 66 46 60 M74 60 Q80 66 86 60'
  if (mood === 'angry') return 'M32 56 L46 62 M74 62 L88 56'
  if (mood === 'shock') return 'M37 58 h8 M77 58 h8'
  if (mood === 'think') return 'M34 59 h12 M78 57 h10'
  return 'M34 58 h12 M74 58 h12'
}

function mouth(mood: Mood) {
  if (mood === 'happy' || mood === 'cheer') return 'M48 78 Q60 92 72 78'
  if (mood === 'smug') return 'M50 80 Q60 86 74 76'
  if (mood === 'sad') return 'M48 86 Q60 76 72 86'
  if (mood === 'angry') return 'M48 82 L60 78 L72 84'
  if (mood === 'shock') return 'M56 78 h8 a6 7 0 1 1 -8 0z'
  if (mood === 'think') return 'M52 82 h16'
  return 'M50 80 Q60 86 70 80'
}

function Prop({ id }: { id: string }) {
  const person = avatarById(id)
  if (person.prop === 'glasses') {
    return (
      <g fill="none" stroke="#1b1b1b" strokeWidth="3">
        <circle cx="40" cy="59" r="10" fill="#1c2430" fillOpacity="0.35" />
        <circle cx="80" cy="59" r="10" fill="#1c2430" fillOpacity="0.35" />
        <path d="M50 59 H70" />
      </g>
    )
  }
  if (person.prop === 'cap') {
    return (
      <g>
        <path d="M24 46 Q60 18 100 42 L92 50 Q60 34 30 50 Z" fill={person.hair} />
        <path d="M22 48 H78" stroke={person.accent} strokeWidth="5" strokeLinecap="round" />
      </g>
    )
  }
  if (person.prop === 'straw') {
    return (
      <g>
        <ellipse cx="60" cy="40" rx="40" ry="10" fill="#e2c16a" />
        <path d="M28 40 Q60 8 92 40" fill="#f0d48a" stroke="#b8893a" strokeWidth="2" />
        <path d="M78 18 Q96 8 100 24" stroke="#c81d25" strokeWidth="3" fill="none" />
      </g>
    )
  }
  if (person.prop === 'pin') {
    return <path d="M78 34 l8 -16 l6 6 l-10 14z" fill={person.accent} stroke="#7a1c24" strokeWidth="1" />
  }
  if (person.prop === 'band') {
    return <path d="M30 42 H92" stroke={person.accent} strokeWidth="8" strokeLinecap="round" />
  }
  if (person.prop === 'beard') {
    return (
      <g fill="#f7f4ee">
        <path d="M46 84 Q60 108 74 84 Q68 96 60 98 Q52 96 46 84Z" />
        <path d="M38 70 h10 M72 70 h10" stroke="#f7f4ee" strokeWidth="4" strokeLinecap="round" />
      </g>
    )
  }
  return null
}

export function Portrait({ id, mood = 'idle', className = '' }: { id: string; mood?: Mood; className?: string }) {
  const person = avatarById(id)
  if (person.portrait) {
    return (
      <img
        src={person.portrait}
        alt={`${person.name} · ${person.title}`}
        draggable={false}
        className={`portrait wx-portrait mood-${mood} ${className}`}
        style={{ ['--wx-accent' as string]: person.accent }}
      />
    )
  }
  const hairFront =
    person.prop === 'perm'
      ? 'M22 62 Q18 28 40 24 Q60 6 82 24 Q104 30 98 64 Q90 40 60 38 Q32 42 22 62Z'
      : person.prop === 'long'
        ? 'M26 50 Q20 20 60 16 Q100 20 96 78 L88 120 H72 L70 70 Q60 48 50 70 L48 120 H34 Z'
        : person.prop === 'beard'
          ? 'M30 48 Q28 22 60 20 Q92 22 90 50 Q84 36 60 36 Q36 36 30 48Z'
          : 'M28 52 Q26 24 60 20 Q96 24 92 54 Q84 36 60 34 Q36 36 28 52Z'
  return (
    <svg viewBox="0 0 120 150" className={`portrait mood-${mood} ${className}`} role="img" aria-label={person.name}>
      <ellipse cx="60" cy="138" rx="36" ry="8" fill="rgba(0,0,0,.25)" />
      {person.prop === 'long' && <path d="M30 60 Q18 110 34 132 H48 Q40 90 52 64Z M90 60 Q102 110 86 132 H72 Q80 90 68 64Z" fill={person.hair} />}
      <path d="M34 96 Q30 128 42 140 H78 Q90 128 86 96 Q60 108 34 96Z" fill={person.cloth} />
      <path d="M52 98 H68 L72 140 H48Z" fill={person.accent} />
      <circle cx="60" cy="68" r="32" fill={person.skin} />
      <path d={hairFront} fill={person.hair} />
      {person.prop === 'perm' && (
        <g fill={person.hair}>
          <circle cx="28" cy="58" r="10" />
          <circle cx="92" cy="58" r="10" />
          <circle cx="36" cy="34" r="9" />
          <circle cx="84" cy="34" r="9" />
        </g>
      )}
      <path d={eyes(mood)} stroke="#2a211c" strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood !== 'happy' && mood !== 'cheer' && mood !== 'smug' && (
        <g fill="#2a211c">
          <circle cx="40" cy="59" r={mood === 'shock' ? 3.2 : 2.2} />
          <circle cx="80" cy="59" r={mood === 'shock' ? 3.2 : 2.2} />
        </g>
      )}
      <path d={mouth(mood)} stroke="#8a3b42" strokeWidth="3" fill={mood === 'shock' ? '#6d2430' : 'none'} strokeLinecap="round" />
      {(mood === 'happy' || mood === 'cheer') && (
        <g fill="#f0a0a8" opacity="0.8">
          <ellipse cx="30" cy="72" rx="6" ry="3.5" />
          <ellipse cx="90" cy="72" rx="6" ry="3.5" />
        </g>
      )}
      {mood === 'angry' && <path d="M30 48 L46 54 M90 48 L74 54" stroke="#4a2a24" strokeWidth="3" strokeLinecap="round" />}
      {mood === 'sad' && <path d="M92 40 q8 10 2 16" stroke="#7eb6e0" strokeWidth="3" fill="none" strokeLinecap="round" />}
      <Prop id={id} />
    </svg>
  )
}
