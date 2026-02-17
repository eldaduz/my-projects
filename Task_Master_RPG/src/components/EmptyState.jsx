import { CheckCircle } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center">
      <CheckCircle />
      <h2>No Quests Available</h2>
      <h4>Well done Adventurer 🧙‍♂️ 🐉</h4>
    </div>
  )
}
