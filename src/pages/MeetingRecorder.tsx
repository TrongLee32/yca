import { useRef, useState, useCallback, useEffect } from 'react'
import './MeetingRecorder.css'

const CHUNK_INTERVAL_MS = 30 * 1000 // 30 seconds

interface AudioChunkInfo {
  index: number
  blob: Blob
  url: string
  duration: number
  timestamp: Date
}

interface TranscriptEntry {
  id: number
  text: string
  timestamp: Date
  chunkIndex: number
}

type TaskStatus = 'draft' | 'approved' | 'rejected'

interface TaskItem {
  id: number
  title: string
  status: TaskStatus
  assignee: string
  chunkIndex: number
  createdAt: Date
}

const TEAM_MEMBERS = ['Minh', 'Hùng', 'Linh', 'Trang', 'Khoa']

function MeetingRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [chunks, setChunks] = useState<AudioChunkInfo[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksBufferRef = useRef<Blob[]>([])
  const chunkIndexRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const chunkStartTimeRef = useRef<number>(0)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const flushChunk = useCallback(() => {
    if (chunksBufferRef.current.length === 0) return

    const blob = new Blob(chunksBufferRef.current, { type: 'audio/webm;codecs=opus' })
    const duration = (Date.now() - chunkStartTimeRef.current) / 1000

    const chunkInfo: AudioChunkInfo = {
      index: chunkIndexRef.current,
      blob,
      url: URL.createObjectURL(blob),
      duration,
      timestamp: new Date(),
    }

    console.log(`[Audio Chunk #${chunkInfo.index}]`, {
      size: `${(blob.size / 1024).toFixed(1)} KB`,
      duration: `${duration.toFixed(1)}s`,
      timestamp: chunkInfo.timestamp.toISOString(),
      blob,
    })

    // Simulate AI transcription response
    const mockTranscript: TranscriptEntry = {
      id: Date.now(),
      text: `[Transcript chunk #${chunkInfo.index}] Đây là nội dung được AI transcribe từ audio ${duration.toFixed(0)}s (${(blob.size / 1024).toFixed(1)} KB). Trong thực tế, đoạn audio sẽ được gửi lên server và AI sẽ trả về text tại đây.`,
      timestamp: new Date(),
      chunkIndex: chunkInfo.index,
    }
    setTranscripts(prev => [...prev, mockTranscript])

    // Simulate task generation from AI
    const mockTask: TaskItem = {
      id: Date.now(),
      title: `Task từ chunk #${chunkInfo.index}: Review nội dung audio ${duration.toFixed(0)}s`,
      status: 'draft',
      assignee: '',
      chunkIndex: chunkInfo.index,
      createdAt: new Date(),
    }
    setTasks(prev => [...prev, mockTask])

    setChunks(prev => [...prev, chunkInfo])
    chunksBufferRef.current = []
    chunkIndexRef.current += 1
    chunkStartTimeRef.current = Date.now()
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        alert('Không có audio track. Hãy chọn tab có âm thanh và bật "Share audio".')
        stream.getTracks().forEach(t => t.stop())
        return
      }

      stream.getVideoTracks().forEach(t => t.stop())

      const audioStream = new MediaStream(audioTracks)
      streamRef.current = audioStream

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder
      chunksBufferRef.current = []
      chunkIndexRef.current = 0
      chunkStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksBufferRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        flushChunk()
      }

      audioTracks[0].onended = () => {
        stopRecording()
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setElapsed(0)
      setChunks([])
      setTranscripts([])
      setTasks([])

      intervalRef.current = window.setInterval(() => {
        flushChunk()
      }, CHUNK_INTERVAL_MS)

      timerRef.current = window.setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      alert('Không thể bắt đầu recording. Hãy cho phép chia sẻ tab.')
    }
  }, [flushChunk])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsPaused(true)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      timerRef.current = window.setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
      setIsPaused(false)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setIsRecording(false)
    setIsPaused(false)
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const updateTaskStatus = useCallback((taskId: number, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }, [])

  const assignTask = useCallback((taskId: number, assignee: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee } : t))
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="recorder-page">
      <div className="page-header">
        <h2>🎙️ Recording</h2>
        <p>Capture audio from another browser tab</p>
      </div>

      <div className="recorder-layout">
        <div className="recorder-left">
          <div className="recorder-card">
            <div className="controls">
              {!isRecording ? (
                <button className="btn btn-start" onClick={startRecording}>
                  ▶ Start Recording
                </button>
              ) : (
                <div className="controls-group">
                  {!isPaused ? (
                    <button className="btn btn-pause" onClick={pauseRecording}>
                      ⏸ Pause
                    </button>
                  ) : (
                    <button className="btn btn-resume" onClick={resumeRecording}>
                      ▶ Resume
                    </button>
                  )}
                  <button className="btn btn-stop" onClick={stopRecording}>
                    ⏹ End
                  </button>
                </div>
              )}
            </div>

            {isRecording && (
              <div className="status">
                <div className={`recording-indicator ${isPaused ? 'paused' : ''}`}>
                  <span className="dot" />
                  {isPaused ? 'Paused' : 'Recording...'}
                </div>
                <div className="timer">{formatTime(elapsed)}</div>
                <p className="info">Audio chunk mỗi 30 giây (console.log)</p>
              </div>
            )}
          </div>

          {chunks.length > 0 && (
            <div className="chunks-list">
              <h3>Audio Chunks</h3>
              {chunks.map(chunk => (
                <div key={chunk.index} className="chunk-item">
                  <div className="chunk-info">
                    <span>Chunk #{chunk.index}</span>
                    <span>{(chunk.blob.size / 1024).toFixed(1)} KB</span>
                    <span>{chunk.duration.toFixed(0)}s</span>
                    <span>{chunk.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <audio controls src={chunk.url} />
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="tasks-section">
              <h3>📝 Tasks</h3>
              {tasks.map(task => (
                <div key={task.id} className={`task-item task-${task.status}`}>
                  <div className="task-header">
                    <span className="task-title">{task.title}</span>
                    <span className={`task-badge badge-${task.status}`}>{task.status}</span>
                  </div>
                  <div className="task-meta">
                    <span>Chunk #{task.chunkIndex}</span>
                    <span>{task.createdAt.toLocaleTimeString()}</span>
                  </div>
                  <div className="task-assignee">
                    <label>Assign:</label>
                    <select
                      value={task.assignee}
                      onChange={(e) => assignTask(task.id, e.target.value)}
                    >
                      <option value="">-- Chọn người --</option>
                      {TEAM_MEMBERS.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="task-actions">
                    {task.status !== 'approved' && (
                      <button
                        className="task-btn task-btn-approve"
                        onClick={() => updateTaskStatus(task.id, 'approved')}
                      >
                        ✓ Approve
                      </button>
                    )}
                    {task.status !== 'rejected' && (
                      <button
                        className="task-btn task-btn-reject"
                        onClick={() => updateTaskStatus(task.id, 'rejected')}
                      >
                        ✗ Reject
                      </button>
                    )}
                    {task.status !== 'draft' && (
                      <button
                        className="task-btn task-btn-draft"
                        onClick={() => updateTaskStatus(task.id, 'draft')}
                      >
                        ↺ Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="transcript-panel">
          <div className="transcript-header">
            <h3>💬 Transcript</h3>
          </div>
          <div className="transcript-messages">
            {transcripts.length === 0 ? (
              <div className="transcript-empty">
                <p>Transcript sẽ hiển thị tại đây khi AI xử lý audio...</p>
              </div>
            ) : (
              transcripts.map(entry => (
                <div key={entry.id} className="transcript-entry">
                  <div className="transcript-meta">
                    <span className="transcript-chunk">Chunk #{entry.chunkIndex}</span>
                    <span className="transcript-time">{entry.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <p className="transcript-text">{entry.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetingRecorder
