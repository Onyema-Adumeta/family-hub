import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { useSocket } from '../hooks/useSocket';

interface TriviaQuestion {
  id: string; question: string; options: string[]; answer: string; order: number;
}
interface TriviaAnswer {
  id: string; questionId: string; memberId: string; answer: string; correct: boolean;
  member: { id: string; name: string; emoji: string; color: string };
}
interface TriviaSession {
  id: string; status: 'pending' | 'active' | 'finished';
  questions: TriviaQuestion[];
  answers: TriviaAnswer[];
}

const QUESTION_TIME = 20;
const CATEGORY_NAMES = ['Science & Nature','Pop Culture & Entertainment','History & Geography','Food, Sports & Life','Math, Logic & Language','Mixed Bag'];

function Leaderboard({ session, highlight, showReview, onToggleReview }: {
  session: TriviaSession; highlight?: string; showReview: boolean; onToggleReview: () => void;
}) {
  const scores: Record<string, { member: any; correct: number }> = {};
  for (const a of session.answers) {
    if (!scores[a.memberId]) scores[a.memberId] = { member: a.member, correct: 0 };
    if (a.correct) scores[a.memberId].correct++;
  }
  const ranked = Object.values(scores).sort((a, b) => b.correct - a.correct);
  const medals = ['🥇', '🥈', '🥉'];
  const myScore = scores[highlight || ''];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {myScore && (
        <div style={{
          padding: '16px', borderRadius: 16, marginBottom: 4, textAlign: 'center',
          background: myScore.correct >= session.questions.length * 0.7 ? 'rgba(74,222,128,0.1)' : 'rgba(99,102,241,0.1)',
          border: 1.5px solid ,
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>
            {myScore.correct === session.questions.length ? '🏆' :
             myScore.correct >= session.questions.length * 0.7 ? '🎉' :
             myScore.correct >= session.questions.length * 0.4 ? '👍' : '💪'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>
            {myScore.correct}/{session.questions.length}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
            {myScore.correct === session.questions.length ? 'Perfect score! Amazing!' :
             myScore.correct >= session.questions.length * 0.7 ? 'Great job!' :
             myScore.correct >= session.questions.length * 0.4 ? 'Good effort!' : 'Keep practicing!'}
          </div>
        </div>
      )}

      {ranked.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>No answers yet</div>
      )}
      {ranked.map((s, i) => (
        <div key={s.member.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
          background: s.member.id === highlight ? 'rgba(124,111,247,0.15)' : 'rgba(255,255,255,0.04)',
          border: 1.5px solid ,
        }}>
          <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{medals[i] || #}</span>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.member.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{s.member.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.correct}/{session.questions.length} correct</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: i === 0 ? '#FBBF24' : 'var(--text)' }}>{s.correct}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>pts</div>
          </div>
        </div>
      ))}

      {session.status === 'finished' && (
        <button onClick={onToggleReview} style={{
          marginTop: 8, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: showReview ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
          border: 1.5px solid ,
          color: showReview ? 'var(--primary)' : 'var(--text-muted)',
        }}>
          {showReview ? '▲ Hide Question Review' : '📋 Review All Questions & Answers'}
        </button>
      )}

      {showReview && session.status === 'finished' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {session.questions.map((q, i) => {
            const myAns = session.answers.find(a => a.questionId === q.id && a.memberId === highlight);
            return (
              <div key={q.id} style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>Q{i+1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, lineHeight: 1.4 }}>{q.question}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {q.options.map(opt => {
                    const isCorrect = opt === q.answer;
                    const isMine = opt === myAns?.answer;
                    return (
                      <div key={opt} style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: isCorrect ? 'rgba(74,222,128,0.1)' : isMine && !isCorrect ? 'rgba(248,113,113,0.1)' : 'transparent',
                        border: 1px solid ,
                        color: isCorrect ? '#4ADE80' : isMine && !isCorrect ? '#F87171' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {isCorrect ? '✅' : isMine && !isCorrect ? '❌' : ''}
                        {opt.replace(/^[A-D]\) /, '')}
                        {isCorrect && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800 }}>CORRECT</span>}
                      </div>
                    );
                  })}
                </div>
                {!myAns && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>⏰ Not answered</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TriviaPage() {
  const { member } = useAuthStore();
  const isParent = member?.role === 'parent';
  const [session, setSession]         = useState<TriviaSession | null>(null);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [currentQ, setCurrentQ]       = useState(0);
  const [selected, setSelected]       = useState<Record<string, string>>({});
  const [revealed, setRevealed]       = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft]       = useState(QUESTION_TIME);
  const [finishing, setFinishing]     = useState(false);
  const [view, setView]               = useState<'play' | 'leaderboard'>('play');
  const [showReview, setShowReview]   = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const timerRef = useRef<any>(null);

  async function fetchSession() {
    try {
      const { data } = await api.get('/trivia/current');
      setSession(data);
      if (data?.status === 'finished') setView('leaderboard');
    } catch { /* no session yet */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchSession(); }, []);

  useSocket((msg) => {
    if (msg.type === 'trivia:started') {
      setSession(msg.session); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play'); setShowReview(false);
    }
    if (msg.type === 'trivia:answer') {
      setSession(prev => prev ? { ...prev, answers: [...prev.answers, msg.answer] } : prev);
    }
    if (msg.type === 'trivia:finished') {
      setSession(msg.session); setView('leaderboard');
    }
  });

  useEffect(() => {
    if (!session || session.status !== 'active' || view !== 'play') return;
    const q = session.questions[currentQ];
    if (!q) return;
    const alreadyAnswered = session.answers.some(a => a.questionId === q.id && a.memberId === member?.id);
    if (alreadyAnswered) return;
    setTimeLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setRevealed(prev => ({ ...prev, [q.id]: true })); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQ, session?.id, view]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await api.post('/trivia/generate');
      setSession(data); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play'); setShowReview(false);
      setSessionCount(c => c + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to generate trivia');
    } finally { setGenerating(false); }
  }

  async function handleAnswer(questionId: string, answer: string) {
    if (!session || selected[questionId]) return;
    setSelected(prev => ({ ...prev, [questionId]: answer }));
    clearInterval(timerRef.current);
    setRevealed(prev => ({ ...prev, [questionId]: true }));
    try {
      const { data } = await api.post(/trivia//answer, { questionId, answer });
      setSession(prev => prev
        ? { ...prev, answers: [...prev.answers.filter(a => !(a.questionId === questionId && a.memberId === member?.id)), data.answer] }
        : prev);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to submit answer'); }
  }

  async function handleFinish() {
    if (!session) return;
    setFinishing(true);
    try {
      await api.post(/trivia//finish);
      await fetchSession();
      setView('leaderboard');
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to finish session'); }
    finally { setFinishing(false); }
  }

  async function handleNewGame() {
    if (!session) return;
    try {
      await api.delete(/trivia/);
      setSession(null); setCurrentQ(0); setSelected({}); setRevealed({}); setView('play'); setShowReview(false);
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{@keyframes spin{to{transform:rotate(360deg)}}}</style>
    </div>
  );

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (!session || session.status === 'pending') return (
    <div style={{ padding: '24px 16px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎮</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 8px' }}>Family Trivia Night</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          10 AI-generated questions · Live leaderboard · Winner gets ⭐ bonus stars
        </p>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <div style={{ padding: '20px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>HOW IT WORKS</div>
          {['🤖 AI generates 10 fun questions tailored to your family', '📱 Everyone answers on their own device', '⏱️ 20 seconds per question', '🏆 Winner gets 3 bonus stars', '📋 Review all answers when the game ends'].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>{s}</div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>NEXT CATEGORY</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{CATEGORY_NAMES[sessionCount % 6]}</div>
          </div>
        </div>
        {isParent ? (
          <button onClick={handleGenerate} disabled={generating} style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 900, background: 'linear-gradient(135deg, #6366F1, #A78BFA)', border: 'none', color: '#fff', cursor: 'pointer', opacity: generating ? 0.7 : 1, boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
            {generating ? '🤖 Generating questions...' : '🎮 Start Trivia Night!'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)', fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
            Waiting for a parent to start trivia night... 🎯
          </div>
        )}
      </div>
    </div>
  );

  const questions = session.questions;
  const currentQuestion = questions[currentQ];
  const myAnswers = session.answers.filter(a => a.memberId === member?.id);
  const allDone = myAnswers.length >= questions.length;

  // ── Leaderboard ────────────────────────────────────────────────────────────
  if (view === 'leaderboard' || session.status === 'finished') return (
    <div style={{ padding: '24px 16px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>
          {session.status === 'finished' ? '🏆' : '📊'}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>
          {session.status === 'finished' ? 'Final Results!' : 'Live Leaderboard'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {session.status === 'finished' ? 'Winner gets 3 bonus ⭐ stars!' : ${myAnswers.length} /  answered}
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Leaderboard
          session={session}
          highlight={member?.id}
          showReview={showReview}
          onToggleReview={() => setShowReview(v => !v)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {session.status === 'active' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setView('play')} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                ← Back to Questions
              </button>
              {isParent && (
                <button onClick={handleFinish} disabled={finishing} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.3)', color: '#4ADE80', cursor: 'pointer' }}>
                  {finishing ? 'Finishing...' : '🏁 End & Award Winner'}
                </button>
              )}
            </div>
          )}

          {session.status === 'finished' && (
            <div style={{ borderRadius: 16, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>
                🎉 Game over! Ready for another round?
              </div>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 14 }}>
                Next up: {CATEGORY_NAMES[(sessionCount + 1) % 6]} 🎯
              </div>
              {isParent ? (
                <button onClick={handleNewGame} style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 900, background: 'linear-gradient(135deg,#6366F1,#A78BFA)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
                  🎮 Start New Game
                </button>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Ask a parent to start a new game! 🙌
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Play ───────────────────────────────────────────────────────────────────
  if (!currentQuestion) return null;

  const myAnswer       = session.answers.find(a => a.questionId === currentQuestion.id && a.memberId === member?.id);
  const isRevealed     = revealed[currentQuestion.id] || !!myAnswer;
  const selectedOption = selected[currentQuestion.id] || myAnswer?.answer;
  const answersForQ    = session.answers.filter(a => a.questionId === currentQuestion.id);
  const timerPct       = (timeLeft / QUESTION_TIME) * 100;
  const isLastQuestion = currentQ === questions.length - 1;

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <style>{
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes spin{to{transform:rotate(360deg)}}
      }</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>🎮 Trivia Night</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Question {currentQ + 1} of {questions.length}</p>
        </div>
        <button onClick={() => setView('leaderboard')} style={{ padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)', cursor: 'pointer' }}>📊 Scores</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'var(--primary)', width: ${((currentQ + 1) / questions.length) * 100}%, transition: 'width 0.3s' }} />
      </div>

      {/* Question dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        {questions.map((q, i) => {
          const ans = session.answers.find(a => a.questionId === q.id && a.memberId === member?.id);
          return (
            <div key={q.id} onClick={() => setCurrentQ(i)} style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: i === currentQ ? 'var(--primary)' : ans ? (ans.correct ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)') : 'rgba(255,255,255,0.08)', border: 2px solid , color: i === currentQ ? '#fff' : ans ? (ans.correct ? '#4ADE80' : '#F87171') : 'var(--text-muted)' }}>
              {ans ? (ans.correct ? '✓' : '✗') : i + 1}
            </div>
          );
        })}
      </div>

      {/* Timer */}
      {!isRevealed && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none"
                stroke={timeLeft <= 5 ? '#F87171' : timeLeft <= 10 ? '#f59e0b' : '#6366f1'}
                strokeWidth="4"
                strokeDasharray={${2 * Math.PI * 28}}
                strokeDashoffset={${2 * Math.PI * 28 * (1 - timerPct / 100)}}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span style={{ fontSize: 18, fontWeight: 900, color: timeLeft <= 5 ? '#F87171' : 'var(--text)', zIndex: 1 }}>{timeLeft}</span>
          </div>
        </div>
      )}

      {/* Question card */}
      <div style={{ padding: '20px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.25)', marginBottom: 20, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', margin: 0, lineHeight: 1.4 }}>{currentQuestion.question}</p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {currentQuestion.options.map((option, i) => {
          const isCorrect  = option === currentQuestion.answer;
          const isSelected = option === selectedOption;
          const letters    = ['A', 'B', 'C', 'D'];
          let bg = 'rgba(255,255,255,0.05)', border = 'rgba(255,255,255,0.1)', color = 'var(--text)';
          if (isRevealed) {
            if (isCorrect) { bg = 'rgba(74,222,128,0.15)'; border = '#4ADE80'; color = '#4ADE80'; }
            else if (isSelected && !isCorrect) { bg = 'rgba(248,113,113,0.15)'; border = '#F87171'; color = '#F87171'; }
          } else if (isSelected) { bg = 'rgba(99,102,241,0.2)'; border = '#6366F1'; color = '#A78BFA'; }
          return (
            <button key={option} onClick={() => !isRevealed && handleAnswer(currentQuestion.id, option)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: bg, border: 1.5px solid , color, fontWeight: 700, fontSize: 14, cursor: isRevealed ? 'default' : 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: isRevealed && isCorrect ? '#4ADE80' : isRevealed && isSelected ? '#F87171' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: isRevealed ? '#fff' : 'var(--text-muted)' }}>{letters[i]}</div>
              <span>{option.replace(/^[A-D]\) /, '')}</span>
              {isRevealed && isCorrect && <span style={{ marginLeft: 'auto', fontSize: 18 }}>✅</span>}
              {isRevealed && isSelected && !isCorrect && <span style={{ marginLeft: 'auto', fontSize: 18 }}>❌</span>}
            </button>
          );
        })}
      </div>

      {/* Answer status */}
      {isRevealed && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: myAnswer?.correct ? '#4ADE80' : '#F87171', marginBottom: 4 }}>
            {myAnswer?.correct ? '🎉 Correct!' : myAnswer ? '❌ Wrong!' : '⏰ Time\'s up!'}
          </div>
          {!myAnswer?.correct && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Correct answer: <strong style={{ color: '#4ADE80' }}>{currentQuestion.answer.replace(/^[A-D]\) /, '')}</strong>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {answersForQ.length} family member{answersForQ.length !== 1 ? 's' : ''} answered
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: currentQ === 0 ? 'not-allowed' : 'pointer', opacity: currentQ === 0 ? 0.4 : 1 }}>← Prev</button>
        {!isLastQuestion ? (
          <button onClick={() => setCurrentQ(q => q + 1)} style={{ flex: 2, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer' }}>Next →</button>
        ) : (
          <button onClick={() => setView('leaderboard')} style={{ flex: 2, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer' }}>📊 Scores</button>
        )}
      </div>

      {/* ── Finish session banner — shown to everyone when all done ── */}
      {allDone && (
        <button onClick={handleFinish} disabled={finishing} style={{
          width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 900,
          background: finishing ? 'rgba(74,222,128,0.1)' : 'linear-gradient(135deg, #4ADE80, #22C55E)',
          border: 'none', color: finishing ? '#4ADE80' : '#0f0f13',
          cursor: finishing ? 'not-allowed' : 'pointer',
          boxShadow: finishing ? 'none' : '0 8px 24px rgba(74,222,128,0.35)',
          marginBottom: 12,
        }}>
          {finishing ? 'Finishing...' : '🏆 I\'m Done! See Final Results'}
        </button>
      )}

      {/* Parent early-finish (only shown when not all done yet) */}
      {isParent && !allDone && (
        <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleFinish} disabled={finishing} style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.3)', color: '#4ADE80', cursor: 'pointer' }}>
            {finishing ? 'Finishing...' : '🏁 End Game Early & Award Winner'}
          </button>
        </div>
      )}
    </div>
  );
}