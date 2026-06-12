import './MeetingList.css'

function MeetingList() {
  return (
    <div className="meetings-page">
      <div className="page-header">
        <h2>📋 Meetings</h2>
        <p>Danh sách các cuộc họp đã record</p>
      </div>

      <div className="meetings-empty">
        <span className="empty-icon">📂</span>
        <p>Chưa có meeting nào được lưu</p>
        <p className="empty-hint">Bắt đầu recording từ tab "Recording" để tạo meeting mới</p>
      </div>
    </div>
  )
}

export default MeetingList
