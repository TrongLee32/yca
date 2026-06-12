import { useState } from 'react'
import Layout from './components/Layout'
import MeetingRecorder from './pages/MeetingRecorder'
import MeetingList from './pages/MeetingList'
import './App.css'

export type PageKey = 'recorder' | 'meetings'

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>('recorder')

  const renderPage = () => {
    switch (currentPage) {
      case 'recorder':
        return <MeetingRecorder />
      case 'meetings':
        return <MeetingList />
      default:
        return <MeetingRecorder />
    }
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  )
}

export default App
