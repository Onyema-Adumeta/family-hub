import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '../store/auth';
import {useMembers,useRewards} from '../hooks/useApi';
import {api} from '../lib/api';
export default function RewardGoal(){
 const member=useAuthStore(s=>s.member),{data:members=[]}=useMembers(),{data:rewards=[]}=useRewards(),qc=useQueryClient();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const me=(members as any[]).find(m=>m.id===member?.id),goal=(rewards as any[]).find(r=>r.id===me?.rewardGoalId);
 if(!member||!(rewards as any[]).length)return null;
 async function choose(id:string){setBusy(true);setError('');try{await api.patch(`/members/${member!.id}/reward-goal`,{rewardId:id||null});await qc.invalidateQueries({queryKey:['members']});}catch{setError('Could not save your goal.');}finally{setBusy(false);}}
 const remaining=goal?Math.max(0,goal.cost-(me?.stars||0)):0;
 return <section className="card" style={{padding:16,marginBottom:16}}><h2 style={{fontSize:16}}>Your reward goal</h2><label>Choose what you are working towards <select disabled={busy} value={goal?.id||''} onChange={e=>choose(e.target.value)} style={{display:'block',marginTop:8,padding:8,maxWidth:'100%'}}><option value="">Choose a reward</option>{(rewards as any[]).map(r=><option key={r.id} value={r.id}>{r.name} · {r.cost} stars</option>)}</select></label>{goal&&<><p>{goal.emoji} {remaining?`${remaining} more stars until ${goal.name}`:`You have enough stars for ${goal.name}!`}</p><progress aria-label="Reward goal progress" max={Math.max(1,goal.cost)} value={Math.min(goal.cost,me?.stars||0)} style={{width:'100%'}}/><a href="/rewards">Open rewards →</a></>}<p role="status">{error}</p></section>;
}
