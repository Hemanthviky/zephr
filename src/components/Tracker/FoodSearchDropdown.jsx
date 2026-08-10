import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, CornerDownLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchFoods, CATEGORIES, FOOD_COUNT } from '../../data/foodDatabase'
import Icon3D from '../shared/Icon3D'

/**
 * Search-as-you-type food picker.
 *
 * A real combobox: arrow keys move the highlight, Enter picks, Escape clears —
 * the list is not just a div of clickable rows. Search runs synchronously
 * against the in-memory database (160 rows), so there's no debounce and no
 * loading state to design around; results move with the keystroke.
 */
export default function FoodSearchDropdown({ onSelect, autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const results = useMemo(() => searchFoods(query), [query])
  const showingQuickPicks = query.trim() === ''

  useEffect(() => setHighlighted(0), [query])

  // Keep the highlighted row inside the scroll viewport during arrow-key nav.
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${highlighted}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  useEffect(() => {
    if (autoFocus) {
      // Wait for the sheet's entry animation, or iOS focuses mid-flight and
      // scrolls the layout to a strange offset.
      const timer = setTimeout(() => inputRef.current?.focus(), 260)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  function handleKeyDown(event) {
    if (!results.length) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlighted((i) => (i + 1) % results.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlighted((i) => (i - 1 + results.length) % results.length)
        break
      case 'Enter':
        event.preventDefault()
        onSelect(results[highlighted])
        break
      case 'Escape':
        event.preventDefault()
        setQuery('')
        break
      default:
    }
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
          strokeWidth={2.75}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="food-results"
          aria-autocomplete="list"
          aria-activedescendant={results[highlighted] ? `food-${results[highlighted].id}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Search ${FOOD_COUNT} foods — try "dosa"`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full min-h-[54px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 pl-12 pr-12 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        )}
      </div>

      {showingQuickPicks && (
        <p className="label-caps mt-4 mb-2 px-1">Logged all the time</p>
      )}

      <div
        id="food-results"
        role="listbox"
        aria-label="Food results"
        ref={listRef}
        className="no-scrollbar mt-2 max-h-[46vh] space-y-1.5 overflow-y-auto overscroll-contain pb-1"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {results.map((food, index) => (
            <motion.button
              key={food.id}
              layout="position"
              id={`food-${food.id}`}
              data-index={index}
              role="option"
              aria-selected={index === highlighted}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => onSelect(food)}
              onMouseEnter={() => setHighlighted(index)}
              className={[
                'flex w-full min-h-[60px] items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-colors',
                index === highlighted
                  ? 'border-ink-900 bg-lime-100'
                  : 'border-transparent bg-cream-100 hover:bg-cream-200',
              ].join(' ')}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900/10 bg-cream-50 text-xl"
                aria-hidden="true"
              >
                {food.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[0.95rem] font-extrabold leading-tight">
                  {food.name}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-ink-400">
                  {CATEGORIES[food.category].label} · {food.serving}g typical
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="nums block font-display text-base font-extrabold leading-none">
                  {food.calories}
                </span>
                <span className="mt-0.5 block text-[0.6rem] font-bold uppercase tracking-wider text-ink-400">
                  kcal/100g
                </span>
              </span>

              {index === highlighted && (
                <CornerDownLeft
                  className="hidden h-4 w-4 shrink-0 text-ink-400 sm:block"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              )}
            </motion.button>
          ))}
        </AnimatePresence>

        {!results.length && (
          <div className="py-10 text-center animate-pop-in">
            <Icon3D name="search" size={60} className="mb-3" />
            <p className="font-display text-base font-extrabold">
              Nothing matches “{query.trim()}”
            </p>
            <p className="mx-auto mt-1.5 max-w-[16rem] text-sm font-medium text-ink-400">
              Try a simpler word — “rice” instead of “jeera rice”, or “paneer”
              instead of a brand name.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
