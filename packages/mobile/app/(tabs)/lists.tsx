import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";
import { api } from "../lib/api";

const GROCERY_CATS = ["Produce","Dairy","Meat & Fish","Bakery","Frozen","Pantry","Drinks","Snacks","Household","Other"];
const NEEDS_CATS   = ["Clothing","Shoes","School Supplies","Electronics","Toiletries","Medicine","Home & Garden","Other"];
type Tab = "grocery" | "needs" | "wishlist";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  approved: { label: "Approved", color: "#10B981", icon: "✅" },
  declined: { label: "Declined", color: "#EF4444", icon: "❌" },
  deferred: { label: "Maybe later", color: "#F59E0B", icon: "⏳" },
};

export default function ListsScreen() {
  const qc = useQueryClient();
  const { member, isParent } = useAuthStore() as any;
  const [tab, setTab] = useState<Tab>("grocery");

  const { data: allItems = [] } = useQuery({ queryKey: ["grocery"], queryFn: () => api.get("/grocery").then(r => r.data) });
  const createItem = useMutation({ mutationFn: (d: any) => api.post("/grocery", d).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }) });
  const updateItem = useMutation({ mutationFn: ({ id, data }: any) => api.patch(`/grocery/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }) });
  const deleteItem = useMutation({ mutationFn: (id: string) => api.delete(`/grocery/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }) });

  const [showAdd, setShowAdd] = useState(false);
  const [iname, setIname] = useState("");
  const [iqty,  setIqty]  = useState("1");
  const [icat,  setIcat]  = useState("");
  const [inotes,setInotes]= useState("");

  const CATS        = tab === "grocery" ? GROCERY_CATS : NEEDS_CATS;
  const listItems   = (allItems as any[]).filter(i => (i.listType || "grocery") === tab);
  const unchecked   = listItems.filter(i => !i.checked);
  const gotItems    = listItems.filter(i =>  i.checked);
  const pct         = listItems.length ? Math.round((gotItems.length / listItems.length) * 100) : 0;
  const groceryCount= (allItems as any[]).filter(i => (i.listType||"grocery")==="grocery" && !i.checked).length;
  const needsCount  = (allItems as any[]).filter(i => i.listType==="needs" && !i.checked).length;

  async function addItem() {
    if (!iname.trim()) return;
    await createItem.mutateAsync({ name: iname.trim(), qty: iqty, category: icat || CATS[CATS.length-1], listType: tab, notes: inotes.trim()||null });
    setIname(""); setIqty("1"); setIcat(""); setInotes(""); setShowAdd(false);
  }

  // Wishlist
  const [selMember, setSelMember] = useState<string>(member?.id || "");
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api.get("/members").then(r => r.data) });
  const { data: wishlist = [] } = useQuery({ queryKey: ["wishlist", selMember], queryFn: () => selMember ? api.get(`/wishlist/${selMember}`).then(r => r.data) : [], enabled: !!selMember });
  const [showWish, setShowWish] = useState(false);
  const [wtitle, setWtitle] = useState("");
  const [wurl,   setWurl]   = useState("");
  const [wprice, setWprice] = useState("");

  // Review modal
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewMode, setReviewMode] = useState<"decline" | "defer">("decline");
  const [reason, setReason] = useState("");

  const memberList     = members as any[];
  const visibleMembers = isParent ? memberList : memberList.filter((m: any) => m.id === member?.id);
  const wishItems      = wishlist as any[];
  const wishUnclaimed  = wishItems.filter(i => !i.claimed);
  const wishClaimed    = wishItems.filter(i =>  i.claimed);

  async function addWish() {
    if (!wtitle.trim()) return;
    await api.post(`/wishlist/${selMember}`, { title: wtitle.trim(), url: wurl.trim()||null, price: wprice ? parseFloat(wprice) : null });
    qc.invalidateQueries({ queryKey: ["wishlist", selMember] });
    setWtitle(""); setWurl(""); setWprice(""); setShowWish(false);
  }
  async function claimWish(id: string) {
    await api.patch(`/wishlist/${id}/claim`, {});
    qc.invalidateQueries({ queryKey: ["wishlist", selMember] });
  }
  function deleteWish(id: string) {
    Alert.alert("Remove wish?", "", [{ text:"Cancel", style:"cancel" }, { text:"Remove", style:"destructive", onPress: async () => { await api.delete(`/wishlist/${id}`); qc.invalidateQueries({ queryKey: ["wishlist", selMember] }); } }]);
  }
  async function approveWish(id: string) {
    try {
      await api.patch(`/wishlist/${id}/approve`, {});
      qc.invalidateQueries({ queryKey: ["wishlist", selMember] });
    } catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Failed to approve"); }
  }
  function openReview(item: any, mode: "decline" | "defer") {
    setReviewItem(item);
    setReviewMode(mode);
    setReason(item.declineReason || "");
  }
  async function submitReview() {
    if (!reviewItem || !reason.trim()) return;
    try {
      if (reviewMode === "decline") {
        await api.patch(`/wishlist/${reviewItem.id}/decline`, { reason: reason.trim() });
      } else {
        await api.patch(`/wishlist/${reviewItem.id}/defer`, { reason: reason.trim() });
      }
      qc.invalidateQueries({ queryKey: ["wishlist", selMember] });
      setReviewItem(null); setReason("");
    } catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Failed to save"); }
  }

  const TABS = [
    { key:"grocery"  as Tab, icon:"🛒", label:"Groceries", count: groceryCount },
    { key:"needs"    as Tab, icon:"🧢", label:"Needs",     count: needsCount   },
    { key:"wishlist" as Tab, icon:"🎁", label:"Wishlist"                        },
  ];

  return (
    <View style={s.container}>
      <Text style={s.title}>Family Lists</Text>

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[s.tabBtn, tab===t.key && s.tabActive]}>
            <Text style={s.tabIcon}>{t.icon}</Text>
            <Text style={[s.tabLabel, tab===t.key && { color:"#fff" }]}>{t.label}</Text>
            {!!t.count && <View style={s.badge}><Text style={s.badgeText}>{t.count}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      {tab !== "wishlist" && (
        <>
          <TouchableOpacity onPress={() => setShowAdd(true)} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Add Item</Text>
          </TouchableOpacity>

          {listItems.length > 0 && (
            <View style={s.progressBox}>
              <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:6 }}>
                <Text style={s.progressLabel}>{gotItems.length} of {listItems.length} got</Text>
                <Text style={[s.progressLabel, { fontWeight:"800", color: pct===100 ? "#4ADE80" : "#f0f0f5" }]}>{pct}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: pct===100 ? "#4ADE80" : "#6366F1" }]} />
              </View>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex:1 }}>
            {unchecked.map((item: any) => (
              <TouchableOpacity key={item.id} onPress={() => updateItem.mutate({ id:item.id, data:{ checked:true } })} style={s.itemRow}>
                <View style={s.checkbox} />
                <View style={{ flex:1 }}>
                  <Text style={s.itemName}>{item.name}{item.qty && item.qty!=="1" ? ` x${item.qty}` : ""}</Text>
                  {item.notes ? <Text style={s.itemNote}>{item.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => deleteItem.mutate(item.id)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                  <Text style={{ color:"#F87171", fontSize:18, fontWeight:"700" }}>x</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {gotItems.length > 0 && (
              <>
                <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:12, marginBottom:6 }}>
                  <Text style={s.sectionLabel}>GOT IT</Text>
                  <TouchableOpacity onPress={() => gotItems.forEach(i => deleteItem.mutate(i.id))}>
                    <Text style={{ color:"#F87171", fontSize:12, fontWeight:"700" }}>Clear {gotItems.length}</Text>
                  </TouchableOpacity>
                </View>
                {gotItems.map((item: any) => (
                  <TouchableOpacity key={item.id} onPress={() => updateItem.mutate({ id:item.id, data:{ checked:false } })} style={[s.itemRow, { opacity:0.4 }]}>
                    <View style={[s.checkbox, { backgroundColor:"#4ADE80", borderColor:"#4ADE80", alignItems:"center", justifyContent:"center" }]}>
                      <Text style={{ color:"#000", fontSize:11, fontWeight:"900" }}>✓</Text>
                    </View>
                    <Text style={[s.itemName, { textDecorationLine:"line-through", color:"#666" }]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {listItems.length === 0 && <Text style={s.empty}>Nothing here yet — tap + Add Item</Text>}
          </ScrollView>
        </>
      )}

      {tab === "wishlist" && (
        <>
          {visibleMembers.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight:44, marginBottom:12 }}>
              {visibleMembers.map((m: any) => (
                <TouchableOpacity key={m.id} onPress={() => setSelMember(m.id)}
                  style={[s.chip, { borderColor:m.color||"#6366F1", backgroundColor: selMember===m.id ? (m.color||"#6366F1")+"30":"transparent" }]}>
                  <Text style={[s.chipText, selMember===m.id && { color:"#fff" }]}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {(isParent || selMember === member?.id) && (
            <TouchableOpacity onPress={() => setShowWish(true)} style={s.addBtn}>
              <Text style={s.addBtnText}>+ Add a Wish</Text>
            </TouchableOpacity>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex:1 }}>
            {wishUnclaimed.map((item: any) => {
              const sm = STATUS_META[item.status];
              return (
                <View key={item.id} style={[s.itemRow, { flexDirection:"column", alignItems:"stretch", gap:0 }]}>
                  <View style={{ flexDirection:"row", alignItems:"flex-start" }}>
                    <View style={{ flex:1 }}>
                      <Text style={s.itemName}>{item.title}</Text>
                      {item.price ? <Text style={{ fontSize:12, color:"#F59E0B", marginTop:2 }}>${item.price.toFixed(2)}</Text> : null}
                      {item.url   ? <Text style={{ fontSize:11, color:"#60A5FA", marginTop:2 }} numberOfLines={1}>{item.url}</Text> : null}
                    </View>
                    <View style={{ gap:6 }}>
                      {isParent && selMember !== member?.id && (
                        <TouchableOpacity onPress={() => claimWish(item.id)} style={[s.smBtn, { backgroundColor:"#10B981" }]}>
                          <Text style={s.smBtnText}>Claim</Text>
                        </TouchableOpacity>
                      )}
                      {(isParent || selMember === member?.id) && (
                        <TouchableOpacity onPress={() => deleteWish(item.id)} style={[s.smBtn, { backgroundColor:"#EF4444" }]}>
                          <Text style={s.smBtnText}>Del</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {sm && (
                    <View style={{ marginTop:10, padding:8, borderRadius:8, backgroundColor: sm.color+"18", borderWidth:1, borderColor: sm.color+"40" }}>
                      <Text style={{ fontSize:12, fontWeight:"700", color: sm.color }}>
                        {sm.icon} {sm.label}{item.status==="deferred" && item.deferUntil ? ` until ${new Date(item.deferUntil).toLocaleDateString()}` : ""}
                      </Text>
                      {item.declineReason ? <Text style={{ fontSize:12, color:"#f0f0f5", marginTop:3, opacity:0.85 }}>{item.declineReason}</Text> : null}
                    </View>
                  )}

                  {isParent && (
                    <View style={{ flexDirection:"row", gap:6, marginTop:10, flexWrap:"wrap" }}>
                      <TouchableOpacity onPress={() => approveWish(item.id)} style={[s.smBtn, { backgroundColor:"#10B981" }]}><Text style={s.smBtnText}>Approve</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => openReview(item, "defer")} style={[s.smBtn, { backgroundColor:"#F59E0B" }]}><Text style={s.smBtnText}>Maybe later</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => openReview(item, "decline")} style={[s.smBtn, { backgroundColor:"#EF4444" }]}><Text style={s.smBtnText}>Decline</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {wishClaimed.length > 0 && <Text style={[s.sectionLabel, { color:"#10B981", marginTop:12 }]}>{isParent ? "CLAIMED" : "SOMEONE IS ON IT!"}</Text>}
            {wishClaimed.map((item: any) => (
              <View key={item.id} style={[s.itemRow, { opacity:0.5, borderColor:"#10B981" }]}>
                <Text style={[s.itemName, { textDecorationLine:"line-through" }]}>{item.title}</Text>
                {isParent && item.claimedBy && (
                  <Text style={{ fontSize:11, color:"#10B981" }}>
                    {memberList.find((m:any) => m.id===item.claimedBy)?.name || "someone"}
                  </Text>
                )}
              </View>
            ))}
            {wishItems.length === 0 && <Text style={s.empty}>No wishes yet — add something!</Text>}
          </ScrollView>
        </>
      )}

      {/* ADD GROCERY/NEEDS MODAL */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>+ Add to {tab === "grocery" ? "Groceries" : "Other Needs"}</Text>
            <TextInput style={s.input} placeholder="Item name *" placeholderTextColor="#666" value={iname} onChangeText={setIname} autoFocus />
            <TextInput style={s.input} placeholder="Qty (e.g. 2, 500g)" placeholderTextColor="#666" value={iqty} onChangeText={setIqty} />
            <TextInput style={s.input} placeholder="Notes — brand, size..." placeholderTextColor="#666" value={inotes} onChangeText={setInotes} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
              {CATS.map(c => (
                <TouchableOpacity key={c} onPress={() => setIcat(c)} style={[s.chip, icat===c && { backgroundColor:"#6366F1", borderColor:"#6366F1" }]}>
                  <Text style={[s.chipText, icat===c && { color:"#fff" }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection:"row", gap:8 }}>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={[s.smBtn, { backgroundColor:"#444", flex:1, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addItem} disabled={!iname.trim()} style={[s.smBtn, { backgroundColor:"#6366F1", flex:2, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD WISH MODAL */}
      <Modal visible={showWish} transparent animationType="slide" onRequestClose={() => setShowWish(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>+ Add a Wish</Text>
            <TextInput style={s.input} placeholder="What do you wish for? *" placeholderTextColor="#666" value={wtitle} onChangeText={setWtitle} autoFocus />
            <TextInput style={s.input} placeholder="Link (optional)" placeholderTextColor="#666" value={wurl} onChangeText={setWurl} autoCapitalize="none" />
            <TextInput style={s.input} placeholder="Price (optional)" placeholderTextColor="#666" value={wprice} onChangeText={setWprice} keyboardType="numeric" />
            <View style={{ flexDirection:"row", gap:8 }}>
              <TouchableOpacity onPress={() => setShowWish(false)} style={[s.smBtn, { backgroundColor:"#444", flex:1, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addWish} disabled={!wtitle.trim()} style={[s.smBtn, { backgroundColor:"#6366F1", flex:2, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>Save Wish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal visible={!!reviewItem} transparent animationType="slide" onRequestClose={() => setReviewItem(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{reviewMode === "decline" ? "Decline this wish" : "Maybe later"}</Text>
            <Text style={{ fontSize:13, color:"rgba(240,240,245,0.5)", marginBottom:4 }}>{reviewItem?.title}</Text>
            <TextInput
              style={[s.input, { minHeight:80, textAlignVertical:"top" }]}
              placeholder={reviewMode === "decline" ? "Why not? (e.g. too expensive right now)" : "Why wait? (e.g. saving for your birthday)"}
              placeholderTextColor="#666"
              value={reason}
              onChangeText={setReason}
              multiline
              autoFocus
            />
            <View style={{ flexDirection:"row", gap:8 }}>
              <TouchableOpacity onPress={() => setReviewItem(null)} style={[s.smBtn, { backgroundColor:"#444", flex:1, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitReview} disabled={!reason.trim()} style={[s.smBtn, { backgroundColor: reviewMode==="decline" ? "#EF4444" : "#F59E0B", flex:2, paddingVertical:13 }]}>
                <Text style={s.smBtnText}>{reviewMode === "decline" ? "Decline" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex:1, backgroundColor:"#0f0f13", paddingTop:56, paddingHorizontal:16 },
  title:         { fontSize:22, fontWeight:"800", color:"#f0f0f5", marginBottom:12 },
  tabBar:        { flexDirection:"row", backgroundColor:"rgba(255,255,255,0.05)", borderRadius:14, padding:4, marginBottom:14, borderWidth:1, borderColor:"rgba(255,255,255,0.08)" },
  tabBtn:        { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingVertical:9, borderRadius:10 },
  tabActive:     { backgroundColor:"#6366F1" },
  tabIcon:       { fontSize:13 },
  tabLabel:      { fontSize:11, fontWeight:"700", color:"rgba(240,240,245,0.5)" },
  badge:         { backgroundColor:"rgba(255,255,255,0.25)", borderRadius:8, paddingHorizontal:4 },
  badgeText:     { fontSize:10, fontWeight:"800", color:"#fff" },
  addBtn:        { backgroundColor:"#6366F1", borderRadius:10, padding:13, alignItems:"center", marginBottom:12 },
  addBtnText:    { color:"#fff", fontWeight:"800", fontSize:14 },
  progressBox:   { backgroundColor:"rgba(255,255,255,0.04)", borderRadius:10, padding:12, marginBottom:12, borderWidth:1, borderColor:"rgba(255,255,255,0.08)" },
  progressLabel: { fontSize:12, color:"rgba(240,240,245,0.5)" },
  progressTrack: { height:5, backgroundColor:"rgba(255,255,255,0.08)", borderRadius:3, overflow:"hidden" },
  progressFill:  { height:"100%" as any, borderRadius:3 },
  itemRow:       { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:"rgba(255,255,255,0.05)", borderRadius:12, padding:13, marginBottom:8, borderWidth:1, borderColor:"rgba(255,255,255,0.08)" },
  checkbox:      { width:22, height:22, borderRadius:6, borderWidth:2, borderColor:"rgba(255,255,255,0.2)" },
  itemName:      { fontSize:14, fontWeight:"600", color:"#f0f0f5" },
  itemNote:      { fontSize:11, color:"rgba(240,240,245,0.4)", marginTop:2 },
  sectionLabel:  { fontSize:10, fontWeight:"800", color:"rgba(240,240,245,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:6 },
  empty:         { textAlign:"center", color:"rgba(240,240,245,0.3)", marginTop:40, fontSize:14 },
  chip:          { paddingHorizontal:12, paddingVertical:7, borderRadius:16, borderWidth:1.5, borderColor:"rgba(255,255,255,0.15)", marginRight:6 },
  chipText:      { fontSize:12, fontWeight:"700", color:"rgba(240,240,245,0.6)" },
  smBtn:         { paddingHorizontal:12, paddingVertical:7, borderRadius:8, alignItems:"center" },
  smBtnText:     { color:"#fff", fontWeight:"700", fontSize:13 },
  overlay:       { flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.7)" },
  modal:         { backgroundColor:"#1a1a24", borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, paddingBottom:36, borderWidth:1.5, borderColor:"rgba(255,255,255,0.1)", gap:10 },
  modalTitle:    { fontSize:16, fontWeight:"900", color:"#f0f0f5", marginBottom:4 },
  input:         { backgroundColor:"rgba(255,255,255,0.05)", borderWidth:1.5, borderColor:"rgba(255,255,255,0.08)", borderRadius:10, padding:12, color:"#f0f0f5", fontSize:14 },
});