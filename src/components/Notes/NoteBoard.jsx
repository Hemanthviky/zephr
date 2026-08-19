import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import NoteCard from './NoteCard'
import VaultCard from './VaultCard'

/**
 * The wall.
 *
 * CSS multi-column, not a grid. A grid puts every card in a row on the same
 * baseline, which means a two-line note next to a twenty-line one leaves a
 * hole the height of eighteen lines — and a board of notes is *made* of cards
 * that disagree about height. Columns pack them, which is what a real pinboard
 * does and what every notes app worth copying does too.
 *
 * The trade is that columns order top-to-bottom then left-to-right, so the
 * newest note is at the top of column one rather than the top-left of a row.
 * That's the right reading order for a wall and the wrong one for a table; this
 * is a wall.
 *
 * Column count is a breakpoint decision rather than an auto-fill, because
 * `column-width` picks its own count from the available space and lands on
 * three narrow columns at exactly the width where two comfortable ones read
 * better.
 */
export default function NoteBoard({
  notes,
  loading,
  error,
  query,
  filter,
  vaultUnlocked,
  onOpen,
  onTogglePin,
  onToggleTask,
  onDelete,
  onReveal,
  onRequestUnlock,
  onRetry,
  onCreate,
}) {
  if (loading) return <BoardSkeleton />

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-coral-600" strokeWidth={2.75} />
        <p className="min-w-0 flex-1 text-sm font-semibold text-coral-600">{error}</p>
        <Button size="xs" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (notes.length === 0) {
    return <EmptyBoard query={query} filter={filter} onCreate={onCreate} />
  }

  return (
    <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
      <AnimatePresence initial={false}>
        {notes.map((note) =>
          note.kind === 'secret' ? (
            <VaultCard
              key={note.id}
              note={note}
              unlocked={vaultUnlocked}
              onOpen={onOpen}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onReveal={onReveal}
              onRequestUnlock={onRequestUnlock}
            />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={onOpen}
              onTogglePin={onTogglePin}
              onToggleTask={onToggleTask}
              onDelete={onDelete}
            />
          )
        )}
      </AnimatePresence>
    </ul>
  )
}

/**
 * Nothing to show — which is four different situations, and telling someone
 * "no notes yet" when they've just mistyped a search is how an app feels stupid.
 */
function EmptyBoard({ query, filter, onCreate }) {
  const searching = Boolean(query.trim())
  const vaultOnly = filter === 'secret'
  const listsOnly = filter === 'checklist'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center px-6 py-12 text-center"
    >
      <Icon3D
        name={searching ? 'search' : vaultOnly ? 'lockkey' : listsOnly ? 'clipboard' : 'pushpin'}
        size={78}
        float={!searching}
        className="mb-4"
      />

      <p className="font-display text-lg font-extrabold leading-tight">
        {searching
          ? 'Nothing matches that'
          : vaultOnly
            ? 'No passwords saved yet'
            : listsOnly
              ? 'Nothing to tick off'
              : filter === 'pinned'
                ? 'Nothing pinned up'
                : 'The board is empty'}
      </p>
      <p className="mx-auto mt-2 max-w-[20rem] text-sm font-medium leading-relaxed text-ink-400">
        {searching
          ? 'Titles, note text and tags are searchable. What’s inside a locked login isn’t — that’s the point of it.'
          : vaultOnly
            ? 'Passwords are encrypted on this device before they’re saved. Nobody on the other end can read them.'
            : listsOnly
              ? 'A checklist is a note with tick boxes in it. Shopping, packing, the four things you keep meaning to do.'
              : filter === 'pinned'
                ? 'Pin the ones you keep coming back to and they’ll stay at the top.'
                : 'Write the first thing down. Shopping list, a Wi-Fi password, the thing you’ll forget by evening.'}
      </p>

      {!searching && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={() => onCreate(vaultOnly ? 'secret' : listsOnly ? 'checklist' : 'note')}
        >
          {vaultOnly ? 'Save a password' : listsOnly ? 'Start a checklist' : 'Write a note'}
        </Button>
      )}
    </motion.div>
  )
}

/** Staggered heights, because a board of equal grey boxes is the one shape the
 *  real thing never takes. */
function BoardSkeleton() {
  const heights = [132, 96, 178, 112, 150, 88]

  return (
    <ul
      className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4"
      aria-busy="true"
      aria-label="Loading your board"
    >
      {heights.map((height, index) => (
        <li key={index} className="mb-4 break-inside-avoid" style={{ breakInside: 'avoid' }}>
          <div className="skeleton rounded-[1.4rem]" style={{ height }} />
        </li>
      ))}
    </ul>
  )
}
