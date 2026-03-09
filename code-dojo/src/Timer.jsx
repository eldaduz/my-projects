import { useEffect, useMemo, useRef, useState } from 'react'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function Timer({ minutes, running, onStart, onExpire, resetKey }) {
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const totalSeconds = Math.max(0, Math.round((minutes || 0) * 60))
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)

  useEffect(() => {
    setRemainingSeconds(totalSeconds)
  }, [resetKey, totalSeconds])

  useEffect(() => {
    if (!running || remainingSeconds <= 0) return undefined

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((previousSeconds) => {
        if (previousSeconds <= 1) {
          window.clearInterval(intervalId)
          onExpireRef.current?.()
          return 0
        }
        return previousSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [running])

  const timerState = useMemo(() => {
    if (!totalSeconds) return 'success'
    const ratio = remainingSeconds / totalSeconds
    if (ratio <= 0.25) return 'danger'
    if (ratio <= 0.5) return 'warning'
    return 'success'
  }, [remainingSeconds, totalSeconds])

  return (
    <div className={`timer ${timerState}`}>
      <div>
        <span className="eyebrow">Timer</span>
        <strong>{formatTime(remainingSeconds)}</strong>
      </div>
      <button
        id="timer-start"
        type="button"
        className="btn-secondary"
        onClick={onStart}
        disabled={running}
      >
        {running ? 'Timer Running' : 'Start Timer'}
      </button>
    </div>
  )
}
