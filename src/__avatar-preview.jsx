import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Avatar from './components/shared/Avatar'
import { AVATARS, INITIALS_ID } from './components/shared/avatarArt'

function Preview() {
  const all = [{ id: INITIALS_ID, label: 'Initials' }, ...AVATARS]
  return (
    <div className="min-h-screen bg-cream-100 p-6 font-sans text-ink-900">
      <h1 className="mb-4 font-display text-xl font-extrabold">Catalogue @ 72px</h1>
      <div className="mb-8 flex flex-wrap gap-4">
        {all.map((a) => (
          <div key={a.id} className="w-[86px] text-center">
            <Avatar name="Hemanth Narayanan" avatarId={a.id} size={72} />
            <p className="mt-1 text-[0.65rem] font-bold text-ink-500">{a.label}</p>
          </div>
        ))}
      </div>

      <h1 className="mb-4 font-display text-xl font-extrabold">Header size (44px) & picker size (38px)</h1>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {all.map((a) => (
          <Avatar key={a.id} name="Asha R" avatarId={a.id} size={44} />
        ))}
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {all.map((a) => (
          <Avatar key={a.id} name="Asha R" avatarId={a.id} size={38} flat />
        ))}
      </div>

      <h1 className="mb-4 font-display text-xl font-extrabold">Profile size (80px)</h1>
      <div className="flex flex-wrap gap-4">
        {['guy', 'girl', 'hijab', 'turban', 'cap', 'shades', INITIALS_ID].map((id) => (
          <Avatar key={id} name="Hemanth Narayanan" avatarId={id} size={80} />
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Preview /></React.StrictMode>)
