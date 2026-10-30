import { pushToMember } from '../services/push';
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { prisma } from '../db';
const router = Router();
const chatInclude={member:{select:{id:true,name:true,emoji:true,color:true,avatarUrl:true}},acknowledgements:{include:{member:{select:{id:true,name:true}}}},votes:true};
const memberFields = {id:true,name:true,emoji:true,color:true,avatarUrl:true};
router.get('/', async (req: AuthRequest, res) => {
 try {
  // Fetch the latest window, then return chronological display order.
  const messages = await prisma.message.findMany({where:{familyId:req.familyId},include:chatInclude,orderBy:{createdAt:'desc'},take:100});
  res.json(messages.reverse());
 }catch{res.status(500).json({error:'Could not load chat'});}
});
router.post('/', async (req: AuthRequest, res) => {
 try {
  const {text,mediaUrl,mediaType,replyToId,pollQuestion,pollOptions}=req.body || {};
  if(text!==undefined && typeof text!=='string')return res.status(400).json({error:'Message text must be a string'});
  const cleanText=typeof text==='string'?text.trim():'';
  if(cleanText.length>4000)return res.status(400).json({error:'Message is too long (maximum 4,000 characters)'});
  let poll:any={};
  if(pollQuestion!==undefined){
   if(typeof pollQuestion!=='string'||!pollQuestion.trim()||pollQuestion.length>200||!Array.isArray(pollOptions)||pollOptions.length<2||pollOptions.length>6||pollOptions.some((o:any)=>typeof o!=='string'||!o.trim()||o.length>80)||new Set(pollOptions.map((o:string)=>o.trim().toLowerCase())).size!==pollOptions.length)return res.status(400).json({error:'Use a question and 2–6 distinct options'});
   poll={pollQuestion:pollQuestion.trim(),pollOptions:pollOptions.map((o:string)=>o.trim())};
  }
  if(!cleanText&&!mediaUrl&&!pollQuestion)return res.status(400).json({error:'Write a message or attach a photo/video'});
  if(mediaUrl && (typeof mediaUrl!=='string'||mediaUrl.length>2000||!['image','video'].includes(mediaType)))return res.status(400).json({error:'Invalid attachment'});
  if(mediaUrl){
   let parsed:URL;try{parsed=new URL(mediaUrl,process.env.CLIENT_URL||'https://family-hub-web-omega.vercel.app');}catch{return res.status(400).json({error:'Invalid attachment URL'});}
   if(!['https:','http:'].includes(parsed.protocol))return res.status(400).json({error:'Invalid attachment URL'});
  }
  if(replyToId!==undefined && replyToId!==null){
   if(typeof replyToId!=='string')return res.status(400).json({error:'Invalid reply'});
   const original=await prisma.message.findFirst({where:{id:replyToId,familyId:req.familyId}});
   if(!original)return res.status(400).json({error:'That message is no longer available to reply to'});
  }
  const message=await prisma.message.create({data:{familyId:req.familyId!,memberId:req.memberId!,text:cleanText||null,...(mediaUrl?{mediaUrl,mediaType}:{}),...(replyToId?{replyToId}:{}),...poll},include:chatInclude});
  broadcast(req.familyId!,{type:'message:new',message});
  res.json(message);
  // Generic lock-screen body: names identify the sender without exposing message content.
  prisma.member.findMany({where:{familyId:req.familyId,id:{not:req.memberId}},select:{id:true}}).then(recipients=>Promise.allSettled(recipients.map(async recipient=>{
   const title=`Family chat · ${message.member.name}`;
   const body=pollQuestion?'Posted a family poll. Open Kinroost to vote.':mediaUrl?'Shared a photo or video. Open Kinroost to view it.':'Sent a message. Open Kinroost to read it.';
   await prisma.notification.create({data:{familyId:req.familyId!,memberId:recipient.id,title,body}});
   await pushToMember(recipient.id,{title,body,url:'/chat',category:'chat'});
  }))).catch(e=>console.error('Chat notification failed',e));
 }catch{res.status(500).json({error:'Could not send message. Your draft can be retried.'});}
});
router.patch('/:id/pin',async(req:AuthRequest,res)=>{
 if(req.role!=='parent')return res.status(403).json({error:'Only parents can pin messages'});
 try{
  const target=await prisma.message.findFirst({where:{id:req.params.id,familyId:req.familyId}});
  if(!target)return res.status(404).json({error:'Message not found'});
  const message=await prisma.message.update({where:{id:target.id},data:{pinned:!target.pinned}});
  broadcast(req.familyId!,{type:'message:pinned',messageId:message.id,pinned:message.pinned});res.json(message);
 }catch{res.status(500).json({error:'Could not update pinned message'});}
});
router.delete('/:id',async(req:AuthRequest,res)=>{
 try{
  const target=await prisma.message.findFirst({where:{id:req.params.id,familyId:req.familyId}});
  if(!target)return res.status(404).json({error:'Message not found'});
  if(target.memberId!==req.memberId&&req.role!=='parent')return res.status(403).json({error:'You can only delete your own messages'});
  await prisma.message.delete({where:{id:target.id}});broadcast(req.familyId!,{type:'message:deleted',messageId:target.id});res.json({ok:true});
 }catch{res.status(500).json({error:'Could not delete message'});}
});
router.post('/:id/ack',async(req:AuthRequest,res)=>{
 const {kind}=req.body||{};if(!['seen','done'].includes(kind))return res.status(400).json({error:'Choose Seen or Done'});
 try{
  const message=await prisma.message.findFirst({where:{id:req.params.id,familyId:req.familyId}});
  if(!message)return res.status(404).json({error:'Message not found'});
  await prisma.messageAcknowledgement.upsert({where:{messageId_memberId:{messageId:message.id,memberId:req.memberId!}},create:{messageId:message.id,memberId:req.memberId!,kind},update:{kind}});
  broadcast(req.familyId!,{type:'message:updated',messageId:message.id});res.json({ok:true});
 }catch{res.status(500).json({error:'Could not acknowledge message'});}
});
router.post('/:id/vote',async(req:AuthRequest,res)=>{
 const {optionIndex}=req.body||{};
 try{
  const message=await prisma.message.findFirst({where:{id:req.params.id,familyId:req.familyId}});
  if(!message||!message.pollQuestion)return res.status(404).json({error:'Poll not found'});
  if(!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=message.pollOptions.length)return res.status(400).json({error:'Choose a poll option'});
  await prisma.messagePollVote.upsert({where:{messageId_memberId:{messageId:message.id,memberId:req.memberId!}},create:{messageId:message.id,memberId:req.memberId!,optionIndex},update:{optionIndex}});
  broadcast(req.familyId!,{type:'message:updated',messageId:message.id});res.json({ok:true});
 }catch{res.status(500).json({error:'Could not save vote'});}
});
export default router;
