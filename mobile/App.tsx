import React, { useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

type Ticket = { id: number; name: string; initials: string; subject: string; preview: string; status: "Open" | "Pending" | "Resolved"; tag: string; messages: { from: "customer" | "agent"; text: string; time: string }[] };

const seed: Ticket[] = [
  { id: 1, name: "Olivia Rhye", initials: "OR", subject: "Issue with my recent order", preview: "I haven't received a tracking update yet...", status: "Open", tag: "Shipping", messages: [{ from: "customer", text: "Hi team, I placed an order three days ago and haven't received a tracking update yet. Could you help me check what's happening?", time: "10:42 AM" }, { from: "agent", text: "Hi Olivia! Thanks for reaching out. I'm happy to look into this for you.", time: "10:46 AM" }] },
  { id: 2, name: "Phoenix Baker", initials: "PB", subject: "Can't access my account", preview: "The password reset link seems to be expired...", status: "Open", tag: "Account", messages: [{ from: "customer", text: "The password reset link seems to be expired. I've tried twice and still can't get in.", time: "10:21 AM" }] },
  { id: 3, name: "Lana Steiner", initials: "LS", subject: "Question about team billing", preview: "Can you clarify how seats are counted?", status: "Pending", tag: "Billing", messages: [{ from: "customer", text: "Can you clarify how seats are counted on the Pro plan? We have a few contractors.", time: "9:30 AM" }] },
  { id: 4, name: "Demi Wilkinson", initials: "DW", subject: "Feature request: dark mode", preview: "Would love to see a dark mode option.", status: "Open", tag: "Feedback", messages: [{ from: "customer", text: "Would love to see a dark mode option in the dashboard. The product is great otherwise!", time: "8:15 AM" }] }
];

export default function App() {
  const [tickets, setTickets] = useState(seed);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const active = tickets.find(t => t.id === selected);
  const visible = useMemo(() => tickets.filter(t => (filter === "All" || t.status === filter) && (!search || (t.name + t.subject + t.preview).toLowerCase().includes(search.toLowerCase()))), [tickets, filter, search]);
  const send = () => {
    if (!active || !reply.trim()) return;
    setTickets(old => old.map(t => t.id === active.id ? { ...t, status: "Pending", preview: reply.trim(), messages: [...t.messages, { from: "agent", text: reply.trim(), time: "Now" }] } : t));
    setReply("");
    setToast("پاسخ در نسخه آزمایشی ثبت شد");
    setTimeout(() => setToast(""), 2400);
  };
  return <SafeAreaView style={s.safe}>
    <ExpoStatusBar style="dark" />
    <StatusBar barStyle="dark-content" backgroundColor="#f7f8fc" />
    <View style={s.header}>
      <View style={s.brandMark}><Text style={s.brandMarkText}>✳</Text></View>
      <View style={{flex:1}}><Text style={s.brand}>resolve<Text style={{color:"#635bff"}}>ai</Text></Text><Text style={s.subBrand}>CUSTOMER SUPPORT</Text></View>
      {active ? <TouchableOpacity onPress={() => setSelected(null)} style={s.back}><Text style={s.backText}>بازگشت</Text></TouchableOpacity> : <View style={s.admin}><Text style={s.adminText}>JD</Text></View>}
    </View>
    {active ? <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.detailTop}><Text style={s.detailTitle}>{active.subject}</Text><Text style={s.detailMeta}>{active.name} · {active.tag}</Text><TouchableOpacity style={s.resolve} onPress={() => setTickets(old => old.map(t => t.id === active.id ? {...t,status:t.status === "Resolved" ? "Open" : "Resolved"} : t))}><Text style={s.resolveText}>{active.status === "Resolved" ? "بازگشایی" : "حل شد"}</Text></TouchableOpacity></View>
      <FlatList style={s.thread} data={active.messages} keyExtractor={(_,i)=>String(i)} contentContainerStyle={{padding:16,gap:14}} renderItem={({item})=><View style={[s.bubbleWrap,item.from === "agent" ? {alignItems:"flex-end"} : {alignItems:"flex-start"}]}><Text style={s.messageAuthor}>{item.from === "agent" ? "Jordan Davis · پشتیبان" : active.name}</Text><View style={[s.bubble,item.from === "agent" ? s.agentBubble : s.customerBubble]}><Text style={s.messageText}>{item.text}</Text></View><Text style={s.messageTime}>{item.time}</Text></View>} />
      <View style={s.replyPanel}><TextInput value={reply} onChangeText={setReply} placeholder="پاسخ خود را بنویسید..." multiline style={s.replyInput}/><TouchableOpacity style={s.send} onPress={send}><Text style={s.sendText}>ارسال پاسخ  ↗</Text></TouchableOpacity></View>
    </KeyboardAvoidingView> : <View style={{flex:1}}>
      <View style={s.titleArea}><Text style={s.kicker}>WORKSPACE / INBOX</Text><Text style={s.title}>صندوق ورودی</Text><Text style={s.description}>گفت‌وگوهای مشتریان را مدیریت و پیگیری کنید.</Text></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="جست‌وجوی گفت‌وگو..." style={s.search}/>
      <View style={s.filters}>{["All","Open","Pending","Resolved"].map(f=><TouchableOpacity key={f} onPress={()=>setFilter(f)} style={[s.filter,filter===f&&s.filterActive]}><Text style={[s.filterText,filter===f&&s.filterTextActive]}>{f==="All"?"همه":f==="Open"?"باز":f==="Pending"?"در انتظار":"حل‌شده"}</Text></TouchableOpacity>)}</View>
      <FlatList data={visible} keyExtractor={t=>String(t.id)} contentContainerStyle={{paddingHorizontal:16,paddingBottom:30}} ListEmptyComponent={<Text style={s.empty}>گفت‌وگویی پیدا نشد.</Text>} renderItem={({item})=><TouchableOpacity onPress={()=>setSelected(item.id)} style={s.ticket}><View style={s.avatar}><Text style={s.avatarText}>{item.initials}</Text></View><View style={{flex:1}}><View style={s.ticketLine}><Text style={s.ticketName}>{item.name}</Text><Text style={s.ticketStatus}>{item.status==="Open"?"باز":item.status==="Pending"?"در انتظار":"حل‌شده"}</Text></View><Text style={s.ticketSubject}>{item.subject}</Text><Text style={s.ticketPreview} numberOfLines={1}>{item.preview}</Text><Text style={s.tag}>{item.tag}</Text></View><Text style={s.chevron}>‹</Text></TouchableOpacity>}/>
    </View>}
    {!!toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
    <View style={s.footer}><Text style={s.footerText}>ResolveAI · Demo mode — اتصال به سرویس زنده هنوز فعال نیست</Text></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f7f8fc",paddingTop:Platform.OS==="android"?StatusBar.currentHeight:0},
 header:{height:66,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#eceef3",paddingHorizontal:18,flexDirection:"row",alignItems:"center",gap:10},
 brandMark:{width:34,height:34,borderRadius:10,backgroundColor:"#efeeff",alignItems:"center",justifyContent:"center"},brandMarkText:{fontSize:21,color:"#635bff"},brand:{fontSize:19,fontWeight:"800",color:"#252d40",letterSpacing:-1},subBrand:{fontSize:8,color:"#9aa1ae",letterSpacing:1.4,marginTop:1},admin:{width:31,height:31,borderRadius:10,backgroundColor:"#efedff",alignItems:"center",justifyContent:"center"},adminText:{color:"#655be9",fontSize:10,fontWeight:"700"},back:{padding:8},backText:{color:"#635bff",fontSize:12,fontWeight:"700"},
 titleArea:{paddingHorizontal:19,paddingTop:24,paddingBottom:14},kicker:{fontSize:9,color:"#9aa1ae",letterSpacing:1.3,fontWeight:"700"},title:{fontSize:26,fontWeight:"800",color:"#252d40",marginTop:8},description:{fontSize:12,color:"#929aaa",marginTop:4},
 search:{marginHorizontal:16,marginBottom:12,height:43,borderRadius:9,borderWidth:1,borderColor:"#e8eaf0",backgroundColor:"#fff",paddingHorizontal:13,fontSize:12,textAlign:"right"},
 filters:{flexDirection:"row",gap:8,paddingHorizontal:16,paddingBottom:12},filter:{paddingVertical:8,paddingHorizontal:13,borderRadius:8,backgroundColor:"#fff",borderWidth:1,borderColor:"#eceef3"},filterActive:{backgroundColor:"#efeeff",borderColor:"#dedbff"},filterText:{fontSize:10,color:"#8e96a6"},filterTextActive:{color:"#635bff",fontWeight:"700"},
 ticket:{backgroundColor:"#fff",borderWidth:1,borderColor:"#eceef3",borderRadius:11,padding:13,marginTop:9,flexDirection:"row",gap:11,alignItems:"flex-start"},avatar:{width:38,height:38,borderRadius:11,backgroundColor:"#efedff",alignItems:"center",justifyContent:"center"},avatarText:{fontSize:11,fontWeight:"700",color:"#655be9"},ticketLine:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},ticketName:{fontSize:12,fontWeight:"700",color:"#3d4659"},ticketStatus:{fontSize:9,color:"#635bff"},ticketSubject:{fontSize:11,color:"#5b6477",fontWeight:"600",marginTop:7},ticketPreview:{fontSize:10,color:"#9aa1ae",marginTop:5},tag:{fontSize:9,color:"#6c63d8",marginTop:8},chevron:{fontSize:22,color:"#b0b6c2",alignSelf:"center"},empty:{textAlign:"center",padding:30,color:"#929aaa"},
 footer:{borderTopWidth:1,borderTopColor:"#eceef3",padding:10,backgroundColor:"#fff"},footerText:{fontSize:9,textAlign:"center",color:"#a0a7b3"},
 detailTop:{padding:17,backgroundColor:"#fff",borderBottomWidth:1,borderColor:"#eceef3"},detailTitle:{fontSize:15,fontWeight:"700",color:"#30394d",textAlign:"left"},detailMeta:{fontSize:10,color:"#929aaa",marginTop:6},resolve:{alignSelf:"flex-start",borderWidth:1,borderColor:"#e6e8ef",borderRadius:7,paddingVertical:7,paddingHorizontal:12,marginTop:12},resolveText:{fontSize:10,color:"#635bff",fontWeight:"700"},thread:{flex:1},bubbleWrap:{maxWidth:"88%"},messageAuthor:{fontSize:10,color:"#697286",marginBottom:5},bubble:{padding:12,borderRadius:11},customerBubble:{backgroundColor:"#fff",borderWidth:1,borderColor:"#eceef3",borderTopLeftRadius:3},agentBubble:{backgroundColor:"#efeeff",borderTopRightRadius:3},messageText:{fontSize:12,lineHeight:19,color:"#596174",textAlign:"left"},messageTime:{fontSize:9,color:"#a2a9b6",marginTop:5},replyPanel:{padding:12,backgroundColor:"#fff",borderTopWidth:1,borderColor:"#eceef3"},replyInput:{minHeight:58,maxHeight:110,textAlign:"right",fontSize:12,color:"#3d4659"},send:{alignSelf:"flex-end",backgroundColor:"#635bff",borderRadius:7,paddingVertical:10,paddingHorizontal:14,marginTop:8},sendText:{color:"#fff",fontSize:11,fontWeight:"700"},toast:{position:"absolute",bottom:55,alignSelf:"center",backgroundColor:"#252d40",paddingVertical:10,paddingHorizontal:16,borderRadius:9},toastText:{color:"#fff",fontSize:11}
});
