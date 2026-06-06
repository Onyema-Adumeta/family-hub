import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useSocket } from '../hooks/useSocket';

interface TriviaQuestion { id: string; question: string; options: string[]; answer: string; order: number; }
interface TriviaAnswer   { id: string; questionId: string; memberId: string; answer: string; correct: boolean; member: { id: string; name: string; emoji: string; color: string }; }
interface TriviaSession  { id: string; status: 'pending'|'active'|'finished'; questions: TriviaQuestion[]; answers: TriviaAnswer[]; }

const QUESTION_TIME = 20;

export default function TriviaScreen() {
  const { member } = useAuthStore();
  const isParent = member?.role === 'parent';
  const qc = useQueryClient();

  const [session, setSession]       = useState<TriviaSession | null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentQ, setCurrentQ]     = useState(0);
  const [selected, setSelected]     = useState<Record<string, string>>({});
  const [revealed, setRevealed]     = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft]     = useState(QUESTION_TIME);
  const [finishing, setFinishing]   = useState(false);
  const [view, setView]             = useState<'play'|'leaderboard'>('play');
  const timerRef = useRef<any>(null);

  async function fetchSession() {
    try {
      const { data } = await api.get('/trivia/current');
      setSession(data);
      if (data?.status === 'finished') setView('leaderboard');
    } catch { /* no session */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchSession(); }, []);

  // Real WebSocket updates
  useSocket((msg) => {
    if (msg.type === 'trivia:started') { setSession(msg.session); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play'); }
    if (msg.type === 'trivia:answer')  { setSession(prev => prev ? { ...prev, answers: [...prev.answers, msg.answer] } : prev); }
    if (msg.type === 'trivia:finished'){ setSession(msg.session); setView('leaderboard'); }
  });

  // Timer
  useEffect(() => {
    if (!session || session.status !== 'active' || view !== 'play') return;
    const q = session.questions[currentQ];
    if (!q) return;
    const answered = session.answers.some(a => a.questionId === q.id && a.memberId === member?.id);
    if (answered) return;
    setTimeLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setRevealed(p => ({ ...p, [q.id]: true })); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQ, session?.id, view]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await api.post('/trivia/generate');
      setSession(data); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to generate trivia');
    } finally { setGenerating(false); }
  }

  async function handleAnswer(questionId: string, answer: string) {
    if (!session || selected[questionId]) return;
    setSelected(p => ({ ...p, [questionId]: answer }));
    clearInterval(timerRef.current);
    setRevealed(p => ({ ...p, [questionId]: true }));
    try {
      const { data } = await api.post(`/trivia/${session.id}/answer`, { questionId, answer });
      setSession(prev => prev ? { ...prev, answers: [...prev.answers.filter(a => !(a.questionId === questionId && a.memberId === member?.id)), data.answer] } : prev);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
  }

  async function handleFinish() {
    if (!session) return;
    setFinishing(true);
    try {
      await api.post(`/trivia/${session.id}/finish`);
      await fetchSession();
      setView('leaderboard');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setFinishing(false); }
  }

  async function handleNewGame() {
    if (!session) return;
    try {
      await api.delete(`/trivia/${session.id}`);
      setSession(null); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play');
    } catch { /* ignore */ }
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#f0f0f5', fontSize: 16 }}>Loading...</Text>
      </View>
    </SafeAreaView>
  );

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (!session || session.status === 'pending') return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 20 }}>
          <Text style={{ fontSize: 64, marginBottom: 12 }}>🎮</Text>
          <Text style={s.title}>Family Trivia Night</Text>
          <Text style={s.subtitle}>10 AI questions · Live leaderboard · Winner gets ⭐ bonus stars</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>HOW IT WORKS</Text>
          {['🤖 AI generates 10 fun mixed questions', '📱 Everyone answers on their own device', '⏱️ 20 seconds per question', '🏆 Winner gets 3 bonus stars'].map((t, i) => (
            <Text key={i} style={{ color: '#f0f0f5', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t}</Text>
          ))}
        </View>
        {isParent ? (
          <TouchableOpacity style={s.startBtn} onPress={handleGenerate} disabled={generating}>
            <Text style={s.startBtnText}>{generating ? '🤖 Generating...' : '🎮 Start Trivia Night!'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.waitCard}>
            <Text style={{ color: 'rgba(240,240,245,0.5)', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
              Waiting for a parent to start trivia night... 🎯
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  const questions = session.questions;
  const currentQuestion = questions[currentQ];
  const myAnswers = session.answers.filter(a => a.memberId === member?.id);
  const allDone = myAnswers.length >= questions.length;

  // ── Leaderboard ───────────────────────────────────────────────────────────
  if (view === 'leaderboard' || session.status === 'finished') {
    const scores: Record<string, { member: any; correct: number }> = {};
    for (const a of session.answers) {
      if (!scores[a.memberId]) scores[a.memberId] = { member: a.member, correct: 0 };
      if (a.correct) scores[a.memberId].correct++;
    }
    const ranked = Object.values(scores).sort((a, b) => b.correct - a.correct);
    const medals = ['🥇','🥈','🥉'];

    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.content}>
          <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 20 }}>
            <Text style={{ fontSize: 56, marginBottom: 8 }}>🏆</Text>
            <Text style={s.title}>{session.status === 'finished' ? 'Final Results!' : 'Live Leaderboard'}</Text>
          </View>
          {ranked.length === 0 && <Text style={{ color: 'rgba(240,240,245,0.4)', textAlign: 'center' }}>No answers yet</Text>}
          {ranked.map((r, i) => (
            <View key={r.member.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }]}>
              <Text style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{medals[i] || `#${i+1}`}</Text>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: r.member.color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{r.member.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 14, color: '#f0f0f5' }}>{r.member.name}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)' }}>{r.correct}/{questions.length} correct</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: i === 0 ? '#FBBF24' : '#f0f0f5' }}>{r.correct}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {session.status === 'active' && (
              <TouchableOpacity style={[s.navBtn, { flex: 1, backgroundColor: '#6366f1' }]} onPress={() => setView('play')}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>← Questions</Text>
              </TouchableOpacity>
            )}
            {isParent && session.status === 'active' && (
              <TouchableOpacity style={[s.navBtn, { flex: 1, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1.5, borderColor: '#4ADE80' }]} onPress={handleFinish} disabled={finishing}>
                <Text style={{ color: '#4ADE80', fontWeight: '800' }}>{finishing ? 'Finishing...' : '🏁 End & Award'}</Text>
              </TouchableOpacity>
            )}
            {isParent && session.status === 'finished' && (
              <TouchableOpacity style={[s.startBtn, { flex: 1 }]} onPress={handleNewGame}>
                <Text style={s.startBtnText}>🎮 New Game</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Play ──────────────────────────────────────────────────────────────────
  if (!currentQuestion) return null;
  const myAnswer      = session.answers.find(a => a.questionId === currentQuestion.id && a.memberId === member?.id);
  const isRevealed    = revealed[currentQuestion.id] || !!myAnswer;
  const selectedOption = selected[currentQuestion.id] || myAnswer?.answer;
  const answersForQ   = session.answers.filter(a => a.questionId === currentQuestion.id);
  const letters       = ['A','B','C','D'];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
          <View>
            <Text style={s.title}>🎮 Trivia Night</Text>
            <Text style={{ fontSize: 12, color: 'rgba(240,240,245,0.4)' }}>Question {currentQ + 1} of {questions.length}</Text>
          </View>
          <TouchableOpacity onPress={() => setView('leaderboard')} style={s.scoresBtn}>
            <Text style={{ color: 'rgba(240,240,245,0.6)', fontSize: 12, fontWeight: '700' }}>📊 Scores</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 2, backgroundColor: '#6366f1', width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </View>

        {/* Question dots */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {questions.map((q, i) => {
            const ans = session.answers.find(a => a.questionId === q.id && a.memberId === member?.id);
            return (
              <TouchableOpacity key={q.id} onPress={() => setCurrentQ(i)} style={{
                width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: i === currentQ ? '#6366f1' : ans ? (ans.correct ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)') : 'rgba(255,255,255,0.08)',
                borderWidth: 2,
                borderColor: i === currentQ ? '#6366f1' : ans ? (ans.correct ? '#4ADE80' : '#F87171') : 'rgba(255,255,255,0.12)',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: i === currentQ ? '#fff' : ans ? (ans.correct ? '#4ADE80' : '#F87171') : 'rgba(240,240,245,0.5)' }}>
                  {ans ? (ans.correct ? '✓' : '✗') : i + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Timer */}
        {!isRevealed && (
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: timeLeft <= 5 ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: timeLeft <= 5 ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: timeLeft <= 5 ? '#F87171' : '#f0f0f5' }}>{timeLeft}s</Text>
            </View>
          </View>
        )}

        {/* Question */}
        <View style={s.questionCard}>
          <Text style={s.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Options */}
        {currentQuestion.options.map((option, i) => {
          const isCorrect  = option === currentQuestion.answer;
          const isSelected = option === selectedOption;
          let bg = 'rgba(255,255,255,0.05)';
          let border = 'rgba(255,255,255,0.1)';
          let color = '#f0f0f5';
          if (isRevealed) {
            if (isCorrect) { bg = 'rgba(74,222,128,0.15)'; border = '#4ADE80'; color = '#4ADE80'; }
            else if (isSelected) { bg = 'rgba(248,113,113,0.15)'; border = '#F87171'; color = '#F87171'; }
          } else if (isSelected) { bg = 'rgba(99,102,241,0.2)'; border = '#6366F1'; color = '#A78BFA'; }

          return (
            <TouchableOpacity key={option} onPress={() => !isRevealed && handleAnswer(currentQuestion.id, option)} disabled={isRevealed}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: bg, borderWidth: 1.5, borderColor: border, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isRevealed && isCorrect ? '#4ADE80' : isRevealed && isSelected ? '#F87171' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>{letters[i]}</Text>
              </View>
              <Text style={{ flex: 1, color, fontWeight: '700', fontSize: 14 }}>{option.replace(/^[A-D]\) /, '')}</Text>
              {isRevealed && isCorrect && <Text style={{ fontSize: 18 }}>✅</Text>}
              {isRevealed && isSelected && !isCorrect && <Text style={{ fontSize: 18 }}>❌</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Answer status */}
        {isRevealed && (
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: myAnswer?.correct ? '#4ADE80' : '#F87171', marginBottom: 4 }}>
              {myAnswer?.correct ? '🎉 Correct!' : myAnswer ? '❌ Wrong!' : "⏰ Time's up!"}
            </Text>
            {!myAnswer?.correct && (
              <Text style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)' }}>
                Answer: <Text style={{ color: '#4ADE80', fontWeight: '700' }}>{currentQuestion.answer.replace(/^[A-D]\) /, '')}</Text>
              </Text>
            )}
            <Text style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', marginTop: 4 }}>
              {answersForQ.length} family member{answersForQ.length !== 1 ? 's' : ''} answered
            </Text>
          </View>
        )}

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
            style={[s.navBtn, { flex: 1, opacity: currentQ === 0 ? 0.4 : 1 }]}>
            <Text style={{ color: 'rgba(240,240,245,0.6)', fontWeight: '700' }}>← Prev</Text>
          </TouchableOpacity>
          {currentQ < questions.length - 1 ? (
            <TouchableOpacity onPress={() => setCurrentQ(q => q + 1)} style={[s.navBtn, { flex: 2, backgroundColor: '#6366f1' }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setView('leaderboard')} style={[s.navBtn, { flex: 2, backgroundColor: allDone ? 'rgba(74,222,128,0.2)' : '#6366f1', borderWidth: allDone ? 1.5 : 0, borderColor: '#4ADE80' }]}>
              <Text style={{ color: allDone ? '#4ADE80' : '#fff', fontWeight: '800' }}>{allDone ? '🏆 Leaderboard!' : '📊 Scores'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Parent controls */}
        {isParent && (
          <TouchableOpacity onPress={handleFinish} disabled={finishing}
            style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.3)', alignItems: 'center' }}>
            <Text style={{ color: '#4ADE80', fontWeight: '800', fontSize: 13 }}>{finishing ? 'Finishing...' : '🏁 End Game & Award Winner'}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '900', color: '#f0f0f5' },
  subtitle: { fontSize: 13, color: 'rgba(240,240,245,0.5)', fontWeight: '600', textAlign: 'center', marginTop: 6 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.4)', marginBottom: 10, letterSpacing: 0.5 },
  startBtn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 16, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  waitCard: { padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  scoresBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  questionCard: { padding: 20, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.25)', marginBottom: 16, alignItems: 'center' },
  questionText: { fontSize: 17, fontWeight: '800', color: '#f0f0f5', textAlign: 'center', lineHeight: 24 },
  navBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
});