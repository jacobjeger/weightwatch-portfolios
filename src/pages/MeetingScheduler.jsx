import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Video, Phone, MapPin, Check, X } from 'lucide-react';
import { useAuth, getPortfolios } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Local storage key for meetings
const LS_MEETINGS = 'wwp_meetings';

function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getMeetings(userId) {
  return lsGet(LS_MEETINGS, []).filter(
    (m) => m.organizer_id === userId || m.attendee_id === userId
  ).sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
}

function saveMeeting(meeting) {
  const all = lsGet(LS_MEETINGS, []);
  const idx = all.findIndex((m) => m.id === meeting.id);
  if (idx >= 0) all[idx] = meeting;
  else all.push(meeting);
  lsSet(LS_MEETINGS, all);
}

function deleteMeeting(meetingId) {
  const all = lsGet(LS_MEETINGS, []).filter((m) => m.id !== meetingId);
  lsSet(LS_MEETINGS, all);
}

const MEETING_TYPES = [
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'in_person', label: 'In Person', icon: MapPin },
];

const TIME_SLOTS = [];
for (let h = 8; h <= 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hr = h.toString().padStart(2, '0');
    const mn = m.toString().padStart(2, '0');
    const label = `${h > 12 ? h - 12 : h}:${mn} ${h >= 12 ? 'PM' : 'AM'}`;
    TIME_SLOTS.push({ value: `${hr}:${mn}`, label });
  }
}

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

export default function MeetingScheduler() {
  const { user, role } = useAuth();
  const toast = useToast();
  const [meetings, setMeetings] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [portfolios, setPortfolios] = useState([]);

  // New meeting form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [meetingType, setMeetingType] = useState('video');
  const [notes, setNotes] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');

  useEffect(() => {
    if (user) {
      setMeetings(getMeetings(user.id));
      setPortfolios(getPortfolios(user.id));
    }
  }, [user]);

  function handleCreate() {
    if (!title.trim() || !date) {
      toast.error('Please provide a title and date');
      return;
    }
    const meeting = {
      id: crypto.randomUUID(),
      organizer_id: user.id,
      organizer_email: user.email,
      organizer_role: role,
      attendee_email: attendeeEmail.trim() || null,
      attendee_id: null,
      portfolio_id: portfolioId || null,
      title: title.trim(),
      date,
      time,
      duration,
      type: meetingType,
      notes: notes.trim(),
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };
    saveMeeting(meeting);
    setMeetings(getMeetings(user.id));
    setShowNew(false);
    resetForm();
    toast.success('Meeting scheduled');
  }

  function handleDelete(meetingId) {
    deleteMeeting(meetingId);
    setMeetings(getMeetings(user.id));
    toast.success('Meeting cancelled');
  }

  function handleStatusChange(meetingId, status) {
    const all = lsGet(LS_MEETINGS, []);
    const idx = all.findIndex((m) => m.id === meetingId);
    if (idx >= 0) {
      all[idx].status = status;
      lsSet(LS_MEETINGS, all);
      setMeetings(getMeetings(user.id));
      toast.success(`Meeting ${status}`);
    }
  }

  function resetForm() {
    setTitle('');
    setDate('');
    setTime('09:00');
    setDuration(30);
    setMeetingType('video');
    setNotes('');
    setPortfolioId('');
    setAttendeeEmail('');
  }

  // Split meetings into upcoming and past
  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.date + 'T' + m.time) >= now && m.status !== 'cancelled');
  const past = meetings.filter((m) => new Date(m.date + 'T' + m.time) < now || m.status === 'cancelled');

  const todayStr = new Date().toISOString().slice(0, 10);

  // Calendar view: build a simple month view
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const calendarDays = (() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  })();

  const meetingsByDate = {};
  meetings.forEach((m) => {
    if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
    meetingsByDate[m.date].push(m);
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 inline-block mr-2 text-blue-500" />
            Meetings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Schedule meetings with {role === 'advisor' ? 'clients' : 'your advisor'}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowNew(true); resetForm(); }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Meeting</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar view */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                className="text-slate-400 hover:text-slate-600 text-sm"
                onClick={() => setViewMonth((v) => {
                  let m = v.month - 1, y = v.year;
                  if (m < 0) { m = 11; y--; }
                  return { year: y, month: m };
                })}
              >
                &larr; Prev
              </button>
              <h2 className="text-lg font-semibold text-slate-800">
                {monthNames[viewMonth.month]} {viewMonth.year}
              </h2>
              <button
                className="text-slate-400 hover:text-slate-600 text-sm"
                onClick={() => setViewMonth((v) => {
                  let m = v.month + 1, y = v.year;
                  if (m > 11) { m = 0; y++; }
                  return { year: y, month: m };
                })}
              >
                Next &rarr;
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] sm:text-xs font-semibold text-slate-400 py-1">
                  <span className="sm:hidden">{d}</span>
                  <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="h-14 sm:h-20" />;
                const dateStr = `${viewMonth.year}-${(viewMonth.month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const dayMeetings = meetingsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className={`h-14 sm:h-20 p-0.5 sm:p-1 border border-slate-100 rounded ${
                      isToday ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`text-[10px] sm:text-xs font-medium mb-0.5 ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                      {day}
                    </div>
                    {dayMeetings.slice(0, 2).map((m) => (
                      <div
                        key={m.id}
                        className={`text-[10px] truncate rounded px-0.5 sm:px-1 py-0.5 mb-0.5 ${
                          m.status === 'cancelled' ? 'bg-slate-100 text-slate-400 line-through' :
                          m.type === 'video' ? 'bg-blue-100 text-blue-700' :
                          m.type === 'phone' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {m.time.slice(0, 5)} {m.title}
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="text-[10px] text-slate-400">+{dayMeetings.length - 2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming meetings sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title mb-3">Upcoming Meetings</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No upcoming meetings</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => {
                  const TypeIcon = MEETING_TYPES.find((t) => t.value === m.type)?.icon || Video;
                  const meetingDate = new Date(m.date + 'T' + m.time);
                  return (
                    <div key={m.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <TypeIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="font-medium text-sm text-slate-800 truncate">{m.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            {meetingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {meetingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {m.duration}min
                          </div>
                          {m.attendee_email && (
                            <p className="text-xs text-slate-400 mt-1">With: {m.attendee_email}</p>
                          )}
                          {m.notes && (
                            <p className="text-xs text-slate-500 mt-1 italic">{m.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0 ml-2">
                          {m.organizer_id !== user?.id && m.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(m.id, 'confirmed')}
                                className="text-green-500 hover:text-green-700 p-0.5"
                                title="Confirm"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleStatusChange(m.id, 'declined')}
                                className="text-red-400 hover:text-red-600 p-0.5"
                                title="Decline"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="text-slate-300 hover:text-red-500 p-0.5"
                            title="Cancel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {m.status !== 'scheduled' && (
                        <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                          m.status === 'declined' ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past meetings */}
          {past.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title mb-3">Past Meetings</h2>
              <div className="space-y-2">
                {past.slice(0, 5).map((m) => (
                  <div key={m.id} className="text-sm border-b border-slate-50 pb-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-slate-600 ${m.status === 'cancelled' ? 'line-through' : ''}`}>
                        {m.title}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Meeting Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Meeting</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Portfolio Review Q1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="input"
                    min={todayStr}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <select
                    className="input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    {TIME_SLOTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                  <select
                    className="input"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Type</label>
                  <select
                    className="input"
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                  >
                    {MEETING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {role === 'advisor' ? 'Client Email' : 'Advisor Email'} (optional)
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="email@example.com"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                />
              </div>

              {portfolios.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Related Portfolio (optional)</label>
                  <select
                    className="input"
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Agenda items, topics to discuss..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn-secondary text-sm"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                onClick={handleCreate}
              >
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
