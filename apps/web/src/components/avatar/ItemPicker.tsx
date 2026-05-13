'use client'

import type { AvatarItem } from '@/lib/api/avatar'

interface ItemPickerProps {
  items: AvatarItem[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  category: string
}

function getItemEmoji(item: AvatarItem): string {
  if (item.category === 'hair') return item.is_default ? '💇' : '💇‍♀️'
  if (item.category === 'eyes') return '👁️'
  if (item.category === 'outfit') return item.is_premium ? '👑' : '👕'
  if (item.category === 'accessory') return item.is_premium ? '⭐' : '🎀'
  return '🌈'
}

export function ItemPicker({ items, selectedId, onSelect, category }: ItemPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`relative p-3 rounded-2xl border-2 text-center transition-all hover:scale-105 ${
            selectedId === item.id
              ? 'border-primary-400 bg-primary-50 shadow-lg ring-2 ring-primary-200'
              : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50'
          }`}
        >
          <div className="text-3xl mb-1.5">{getItemEmoji(item)}</div>
          <p className="text-xs font-semibold text-gray-700 leading-tight">{item.name}</p>
          {item.is_premium && (
            <span className="absolute top-1 right-1 text-[10px] bg-accent-100 text-accent-700 font-bold px-1 rounded">
              PRO
            </span>
          )}
          {selectedId === item.id && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs shadow">
              ✓
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
