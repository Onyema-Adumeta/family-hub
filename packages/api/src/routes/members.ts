import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();
import { prisma } from '../db';

// GET /api/members — list all members in the family
router.get('/', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Name-based dashboard selection. IDs stay internal to the application.
router.get('/dashboard-access', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: {familyId: req.familyId, ...(req.role === 'parent' ? {} : {id: req.memberId})},
      select: {id:true, name:true, role:true, canOpenPersonalOS:true, canOpenPremed:true},
      orderBy: {createdAt:'asc'},
    });
    res.json(members);
  } catch { res.status(500).json({error:'Could not load dashboard access'}); }
});
router.patch('/:id/dashboard-access', async (req: AuthRequest, res) => {
  if(req.role !== 'parent') return res.status(403).json({error:'Only parents can manage dashboard links'});
  const {canOpenPersonalOS, canOpenPremed}=req.body || {};
  if(typeof canOpenPersonalOS !== 'boolean' || typeof canOpenPremed !== 'boolean') return res.status(400).json({error:'Choose dashboard access'});
  try {
    const result = await prisma.member.updateMany({
      where:{id:req.params.id, familyId:req.familyId},
      data:{canOpenPersonalOS, canOpenPremed},
    });
    if(!result.count) return res.status(404).json({error:'Member not found'});
    res.json({ok:true});
  } catch {res.status(500).json({error:'Could not save dashboard access'});}
});

router.patch('/:id/reward-goal',async(req:AuthRequest,res)=>{
 if(req.memberId!==req.params.id&&req.role!=='parent')return res.status(403).json({error:'Choose your own reward goal'});
 const {rewardId}=req.body||{};
 if(rewardId!==null&&typeof rewardId!=='string')return res.status(400).json({error:'Choose a reward'});
 try{
  if(rewardId){const reward=await prisma.reward.findFirst({where:{id:rewardId,familyId:req.familyId}});if(!reward)return res.status(404).json({error:'Reward not found'});}
  const result=await prisma.member.updateMany({where:{id:req.params.id,familyId:req.familyId},data:{rewardGoalId:rewardId}});
  if(!result.count)return res.status(404).json({error:'Member not found'});res.json({ok:true});
 }catch{res.status(500).json({error:'Could not save reward goal'});}
});

// PATCH /api/members/:id — update profile (name, emoji, color, avatar)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, emoji, color, avatar, pushToken, birthday } = req.body;

  // Members can only edit themselves; parents can edit anyone
  if (req.memberId !== id && req.role !== 'parent') {
    return res.status(403).json({ error: 'Not allowed' });
  }

  try {
    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(name      !== undefined && { name }),
        ...(emoji     !== undefined && { emoji }),
        ...(color     !== undefined && { color }),
        ...(avatar    !== undefined && { avatar }),
        ...(pushToken !== undefined && { pushToken }),
        ...(birthday  !== undefined && { birthday: birthday ? new Date(birthday) : null }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/members/:id — parent only, cannot remove yourself
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Must be a parent
  if (req.role !== 'parent') {
    return res.status(403).json({ error: 'Only parents can remove members' });
  }

  // Cannot remove yourself
  if (req.memberId === id) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }

  // Target must be in same family
  const target = await prisma.member.findFirst({
    where: { id, familyId: req.familyId },
  });

  if (!target) {
    return res.status(404).json({ error: 'Member not found' });
  }

  try {
    await prisma.$transaction([
      // Unassign their chores
      prisma.chore.updateMany({
        where: { assignedToId: id, familyId: req.familyId },
        data: { assignedToId: null },
      }),
      // Delete their chat messages
      prisma.message.deleteMany({ where: { memberId: id } }),
      // Delete the member
      prisma.member.delete({ where: { id } }),
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;