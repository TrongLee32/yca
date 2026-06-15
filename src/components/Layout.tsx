import { ReactNode } from 'react'
import type { PageKey } from '../App'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
}

interface MenuItem {
  key: PageKey
  label: string
  icon: string
}

const menuItems: MenuItem[] = [
  { key: 'recorder', label: 'Recording', icon: '🎙️' },
  { key: 'local-recorder', label: 'Local Record', icon: '🎤' },
  { key: 'meetings', label: 'Meetings', icon: '📋' },
]

function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">🎧</span>
          <h1>Meeting Recorder</h1>
        </div>
        <div className="header-right">
          <span className="header-user">Admin</span>
        </div>
      </header>

      <div className="layout-body">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.key}
                className={`sidebar-item ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
