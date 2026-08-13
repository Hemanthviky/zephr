import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional classNames, with later Tailwind utilities winning. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
