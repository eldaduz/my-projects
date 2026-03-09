import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import ModalShell from './ModalShell'

export default function Leaderboard({ currentUserId, onClose }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    const load = async () => {
      const snapshot = await getDocs(
        query(collection(db, 'codeDojo_leaderboard'), orderBy('totalXp', 'desc'), limit(50)),
      )
      setRows(
        snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    }

    load().catch(() => setRows([]))
  }, [])

  return (
    <ModalShell className="leaderboard panel" onClose={onClose}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Social</span>
          <h2>Leaderboard</h2>
        </div>
        <button id="leaderboard-close" type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="table-shell">
        <table>
          <caption className="sr-only">Leaderboard rankings by XP</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Level</th>
              <th scope="col">XP</th>
              <th scope="col">Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={row.id === currentUserId ? 'current-row' : ''}>
                <td>#{index + 1}</td>
                <td>{row.displayName || 'Anonymous'}</td>
                <td>{row.levelName || 'White Belt'}</td>
                <td>{row.totalXp || 0}</td>
                <td>{row.streak || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  )
}
