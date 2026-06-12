import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView,
} from 'react-native';
import { useEvents, useCreateEvent, useDeleteEvent, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EVENT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899'];

// Strip corrupted/mojibake emoji (Google imports & old BOM-corrupted data)
function cleanEmoji(emoji?: string): string {
  if (!emoji) return '📅';
  // Mojibake from bad UTF-8 encoding — these lead sequences mean it's corrupted
  if (/ð|Ã|â‚|â€|Â|Å|Ÿ/.test(emoji)) return '📅';
  // Plain ASCII (letters, numbers, no real emoji) — fall back
  if (/^[\x00-\x7F]+$/.test(emoji)) return '📅';
  return emoji;
}

// Format an event's own date string ("2026-06-17" / ISO) as "June 17" — local-safe
function formatEventDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS[m - 1]} ${d}`;
}

export default function ScheduleScreen() {
  const { member } = useAuthStore();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showAdd, setShowAdd] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', color: EVENT_COLORS[0] });

  const { data: events = [] } = useEvents();
  const { data: members = [] } = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const isParent = member?.role === 'parent';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (events as any[]).filter((e: any) => e.date?.startsWith(dateStr));
  };

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  const handleCreate = () => {
    if (!newEvent.title.trim() || !selectedDay) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    createEvent.mutate({ ...newEvent, date: dateStr });
    setShowAdd(false);
    setNewEvent({ title: '', date: '', color: EVENT_COLORS[0] });
  };

  const handleDelete = (id: string) => {
    deleteEvent.mutate(id);
    setDetailEvent(null);
  };

  const calendarDays: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>📅 Schedule</Text>
          {isParent && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.addBtnText}>+ Event</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Month nav */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month - 1, 1))} style={s.monthArrow}>
            <Text style={s.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month + 1, 1))} style={s.monthArrow}>
            <Text style={s.monthArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={s.dayHeaderRow}>
          {DAYS.map(d => (
            <Text key={d} style={s.dayHeader}>{d.slice(0,1)}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {calendarDays.map((day, i) => {
            if (!day) return <View key={`e-${i}`} style={s.dayCell} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay;
            const dayEvents = eventsForDay(day);
            return (
              <TouchableOpacity
                key={day}
                style={[s.dayCell, isSelected && s.dayCellSelected, isToday && !isSelected && s.dayCellToday]}
                onPress={() => setSelectedDay(day === selectedDay ? null : day)}
              >
                <Text style={[s.dayNum, isSelected && s.dayNumSelected, isToday && !isSelected && s.dayNumToday]}>
                  {day}
                </Text>
                <View style={s.dotRow}>
                  {dayEvents.slice(0, 3).map((e: any, ei: number) => (
                    <View key={ei} style={[s.dot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : (e.color || '#6366f1') }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        {selectedDay && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>{MONTHS[month]} {selectedDay}</Text>
            {selectedEvents.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No events{isParent ? ' — tap + Event to add' : ''}</Text>
              </View>
            ) : selectedEvents.map((e: any) => {
              const assignee = (members as any[]).find((m: any) => m.id === e.assignedToId);
              const isGoogle = e.source === 'google';
              return (
                <TouchableOpacity key={e.id} style={s.eventCard} onPress={() => setDetailEvent(e)} activeOpacity={0.7}>
                  <View style={[s.eventBar, { backgroundColor: e.color || '#6366f1' }]} />
                  <View style={[s.eventIcon, { backgroundColor: (e.color || '#6366f1') + '33' }]}>
                    <Text style={{ fontSize: 16 }}>{cleanEmoji(e.emoji)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      {e.time && <Text style={s.eventSub}>🕐 {e.time}</Text>}
                      {assignee && <Text style={[s.eventSub, { color: assignee.color }]}>{assignee.emoji} {assignee.name}</Text>}
                      {isGoogle && <Text style={s.googleBadge}>Google</Text>}
                    </View>
                  </View>
                  {isParent && (
                    <TouchableOpacity onPress={() => deleteEvent.mutate(e.id)} style={s.deleteBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                      <Text style={{ fontSize: 16 }}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Event detail modal */}
      <Modal visible={!!detailEvent} transparent animationType="fade" onRequestClose={() => setDetailEvent(null)}>
        <TouchableOpacity style={s.detailOverlay} activeOpacity={1} onPress={() => setDetailEvent(null)}>
          <TouchableOpacity activeOpacity={1} style={s.detailCard} onPress={() => {}}>
            {detailEvent && (() => {
              const ev = detailEvent;
              const assignee = (members as any[]).find((m: any) => m.id === ev.assignedToId);
              const isGoogle = ev.source === 'google';
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <View style={[s.detailIcon, { backgroundColor: (ev.color || '#6366f1') + '33' }]}>
                      <Text style={{ fontSize: 24 }}>{cleanEmoji(ev.emoji)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailTitle}>{ev.title}</Text>
                      <Text style={s.detailDate}>{formatEventDate(ev.date)}</Text>
                    </View>
                    {isGoogle && <Text style={s.googleBadge}>Google</Text>}
                  </View>
                  <View style={{ gap: 10, marginBottom: 20 }}>
                    {ev.time && <Text style={s.detailRow}>🕐 {ev.time}</Text>}
                    {assignee && <Text style={[s.detailRow, { color: assignee.color }]}>{assignee.emoji} {assignee.name}</Text>}
                    {ev.notes ? <Text style={s.detailNotes}>{ev.notes}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setDetailEvent(null)}>
                      <Text style={s.modalBtnGhostText}>Close</Text>
                    </TouchableOpacity>
                    {isParent && (
                      <TouchableOpacity style={[s.modalBtn, s.deleteBtnFull]} onPress={() => handleDelete(ev.id)}>
                        <Text style={s.deleteBtnFullText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>📅 Add Event</Text>
            <TextInput
              style={s.input}
              placeholder="Event title"
              placeholderTextColor="rgba(240,240,245,0.35)"
              value={newEvent.title}
              onChangeText={t => setNewEvent(p => ({ ...p, title: t }))}
              autoFocus
            />
            <Text style={s.label}>Color</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {EVENT_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setNewEvent(p => ({ ...p, color: c }))}
                  style={[s.colorDot, { backgroundColor: c, borderWidth: newEvent.color === c ? 3 : 0, borderColor: '#fff' }]} />
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setShowAdd(false)}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={handleCreate} disabled={!newEvent.title.trim()}>
                <Text style={s.modalBtnPrimaryText}>Add Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f13' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5' },
  addBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 },
  monthArrow: { padding: 8 },
  monthArrowText: { fontSize: 22, color: 'rgba(240,240,245,0.6)' },
  monthLabel: { fontWeight: '900', fontSize: 15, color: '#f0f0f5' },
  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '900', color: 'rgba(240,240,245,0.35)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100/7}%`, paddingVertical: 6, alignItems: 'center', borderRadius: 8, minHeight: 48 },
  dayCellSelected: { backgroundColor: '#6366f1' },
  dayCellToday: { backgroundColor: 'rgba(99,102,241,0.15)' },
  dayNum: { fontSize: 13, fontWeight: '600', color: '#f0f0f5' },
  dayNumSelected: { color: '#fff', fontWeight: '900' },
  dayNumToday: { color: '#6366f1', fontWeight: '900' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: 'rgba(240,240,245,0.6)', marginBottom: 8 },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { color: 'rgba(240,240,245,0.35)', fontWeight: '700', fontSize: 13 },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  eventBar: { width: 4, alignSelf: 'stretch', borderRadius: 4, minHeight: 36 },
  eventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontWeight: '800', fontSize: 14, color: '#f0f0f5' },
  eventSub: { fontSize: 11, color: 'rgba(240,240,245,0.5)', fontWeight: '700' },
  googleBadge: { fontSize: 9, fontWeight: '800', color: '#4285F4', backgroundColor: 'rgba(66,133,244,0.12)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  deleteBtn: { padding: 4 },
  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  detailCard: { width: '100%', maxWidth: 400, backgroundColor: '#1a1a24', borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  detailIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 18, fontWeight: '900', color: '#f0f0f5' },
  detailDate: { fontSize: 12, color: 'rgba(240,240,245,0.5)', marginTop: 4 },
  detailRow: { fontSize: 14, fontWeight: '600', color: '#f0f0f5' },
  detailNotes: { fontSize: 13, color: 'rgba(240,240,245,0.6)', lineHeight: 20, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  deleteBtnFull: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  deleteBtnFullText: { color: '#ef4444', fontWeight: '800' },
  // Add modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a24', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#f0f0f5', marginBottom: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 15, fontWeight: '600', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)', marginBottom: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  modalBtnGhostText: { color: '#f0f0f5', fontWeight: '800' },
  modalBtnPrimary: { backgroundColor: '#6366f1' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '800' },
});