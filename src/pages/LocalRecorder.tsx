import { useRef, useState, useCallback, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import './LocalRecorder.css'

const CHUNK_INTERVAL_MS = 30 * 1000 // 30 seconds
const SOCKET_URL = 'http://localhost:3001' // Socket server URL

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

// Fake transcript responses to simulate AI transcription
const FAKE_TRANSCRIPTS = [
  'Chúng ta cần hoàn thành báo cáo tháng này trước thứ 6. Mọi người kiểm tra lại số liệu và gửi cho Minh tổng hợp.',
  'Về dự án mới, team frontend sẽ bắt đầu sprint tiếp theo vào thứ 2. Linh sẽ lead phần UI redesign.',
  'Cần review lại API documentation trước khi release. Hùng và Khoa phối hợp test integration.',
  'Meeting với khách hàng được dời sang thứ 4 tuần sau. Trang chuẩn bị slide demo cho buổi đó.',
  'Bug critical trên production đã được fix. Cần deploy hotfix trong ngày hôm nay.',
  'Sprint retrospective cho thấy velocity tăng 20%. Team đang làm tốt, tiếp tục duy trì.',
]

// Fake task responses to simulate AI task extraction
const FAKE_TASKS = [
  { title: 'Hoàn thành báo cáo tháng', assignee: 'Minh' },
  { title: 'Lead UI redesign sprint mới', assignee: 'Linh' },
  { title: 'Review API documentation', assignee: 'Hùng' },
  { title: 'Chuẩn bị slide demo cho khách hàng', assignee: 'Trang' },
  { title: 'Deploy hotfix production', assignee: 'Khoa' },
  { title: 'Tổng hợp kết quả sprint retrospective', assignee: 'Minh' },
]

function LocalRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [chunks, setChunks] = useState<AudioChunkInfo[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [socketConnected, setSocketConnected] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksBufferRef = useRef<Blob[]>([])
  const chunkIndexRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const chunkStartTimeRef = useRef<number>(0)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    })

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setSocketConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      setSocketConnected(false)
    })

    // Listen for transcript response from server
    socket.on('transcript_result', (data: { id: number; text: string; chunkIndex: number; timestamp: string }) => {
      const entry: TranscriptEntry = {
        id: data.id,
        text: data.text,
        timestamp: new Date(data.timestamp),
        chunkIndex: data.chunkIndex,
      }
      setTranscripts(prev => [...prev, entry])
    })

    // Listen for task response from server
    socket.on('task_result', (data: { id: number; title: string; status: TaskStatus; assignee: string; chunkIndex: number; createdAt: string }) => {
      const task: TaskItem = {
        id: data.id,
        title: data.title,
        status: data.status,
        assignee: data.assignee,
        chunkIndex: data.chunkIndex,
        createdAt: new Date(data.createdAt),
      }
      setTasks(prev => [...prev, task])
    })

    socketRef.current = socket

    // Fake: simulate socket connection since there's no real server
    // The socket will fail to connect, so we simulate responses locally
    const fakeConnectTimeout = setTimeout(() => {
      if (!socket.connected) {
        console.log('[Socket] Using fake mode (no server available)')
        setSocketConnected(true)
      }
    }, 2000)

    return () => {
      clearTimeout(fakeConnectTimeout)
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const sendChunkViaSocket = useCallback((chunkInfo: AudioChunkInfo) => {
    const socket = socketRef.current

    // Convert blob to ArrayBuffer and send via socket
    chunkInfo.blob.arrayBuffer().then((buffer) => {
      if (socket?.connected) {
        socket.emit('audio_chunk', {
          index: chunkInfo.index,
          audio: buffer,
          size: chunkInfo.blob.size,
          duration: chunkInfo.duration,
          mimeType: 'audio/webm;codecs=opus',
          timestamp: chunkInfo.timestamp.toISOString(),
        })
        console.log(`[Socket] Sent audio chunk #${chunkInfo.index} (${(chunkInfo.blob.size / 1024).toFixed(1)} KB)`)
      } else {
        console.log(`[Socket] Fake send audio chunk #${chunkInfo.index} (${(chunkInfo.blob.size / 1024).toFixed(1)} KB)`)
      }
    })

    // Fake response: simulate server responding after a short delay
    const fakeIndex = chunkInfo.index % FAKE_TRANSCRIPTS.length
    setTimeout(() => {
      const fakeTranscript: TranscriptEntry = {
        id: Date.now(),
        text: FAKE_TRANSCRIPTS[fakeIndex],
        timestamp: new Date(),
        chunkIndex: chunkInfo.index,
      }
      setTranscripts(prev => [...prev, fakeTranscript])
    }, 1500) // Simulate 1.5s server processing delay

    setTimeout(() => {
      const fakeTask: TaskItem = {
        id: Date.now() + 1,
        title: FAKE_TASKS[fakeIndex].title,
        status: 'draft',
        assignee: FAKE_TASKS[fakeIndex].assignee,
        chunkIndex: chunkInfo.index,
        createdAt: new Date(),
      }
      setTasks(prev => [...prev, fakeTask])
    }, 2500) // Simulate 2.5s server processing delay for task
  }, [])

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

    console.log(`[Local Audio Chunk #${chunkInfo.index}]`, {
      size: `${(blob.size / 1024).toFixed(1)} KB`,
      duration: `${duration.toFixed(1)}s`,
      timestamp: chunkInfo.timestamp.toISOString(),
    })

    // Send chunk via socket and get fake response
    sendChunkViaSocket(chunkInfo)

    setChunks(prev => [...prev, chunkInfo])
    chunksBufferRef.current = []
    chunkIndexRef.current += 1
    chunkStartTimeRef.current = Date.now()
  }, [sendChunkViaSocket])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
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

      stream.getAudioTracks()[0].onended = () => {
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
      console.error('Error starting local recording:', err)
      alert('Không thể bắt đầu recording. Hãy cho phép truy cập microphone.')
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
    <div className="local-recorder-page">
      <div className="page-header">
        <h2>🎤 Local Record</h2>
        <div className="page-header-row">
          <p>Record audio directly from your microphone</p>
          <span className={`socket-status ${socketConnected ? 'connected' : 'disconnected'}`}>
            ● {socketConnected ? 'Socket Connected' : 'Socket Disconnected'}
          </span>
        </div>
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
                <p className="info">Audio chunk sent via socket every 30s</p>
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

export default LocalRecorder
