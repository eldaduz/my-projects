import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'

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
    <div className="modal-shell">
      <section className="leaderboard panel">
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
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Level</th>
                <th>XP</th>
                <th>Streak</th>
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
      </section>
    </div>
  )
}
