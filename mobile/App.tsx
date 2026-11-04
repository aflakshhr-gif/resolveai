import React,{useEffect,useMemo,useState}from"react";
import{ActivityIndicator,FlatList,KeyboardAvoidingView,Platform,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,TouchableOpacity,View}from"react-native";
import*as SecureStore from"expo-secure-store";import{StatusBar as ExpoStatusBar}from"expo-status-bar";
const API="https://resolveai.aflakshhr.workers.dev",KEY="resolveai.mobile.session";
type Msg={from:"customer"|"agent";text:string;time:string};
type Ticket={id:string;name:string;email:string;initials:string;subject:string;preview:string;status:"Open"|"Pending"|"Resolved";tag:string;messages:Msg[]};
type Insight={sentiment:string;urgency:string;intent:string;suggested_reply:string;next_step:string;disclaimer?:string};
async function api(path:string,token:string|null,options:RequestInit={}){
 const h=new Headers(options.headers||{});h.set("Accept","application/json");if(options.body)h.set("Content-Type","application/json");if(token)h.set("Authorization","Bearer "+token);
 const r=await fetch(API+path,{...options,headers:h,credentials:"omit"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"ارتباط با ResolveAI ناموفق بود.");return d;
}
function mapTicket(x:any):Ticket{
 const n=String(x.customer_name||"Customer");
 return{id:String(x.id),name:n,email:x.customer_email||"",initials:n.split(/\s+/).slice(0,2).map((v:string)=>v[0]||"").join("").toUpperCase(),subject:x.subject||"بدون موضوع",preview:x.preview||"",status:x.status==="resolved"?"Resolved":x.status==="pending"?"Pending":"Open",tag:x.tag||"General",messages:(x.messages||[]).map((m:any)=>({from:m.author_type==="agent"?"agent":"customer",text:String(m.body||""),time:m.created_at?new Date(m.created_at).toLocaleTimeString():""}))};
}
export default function App(){
 const[token,setToken]=useState<string|null>(null),[checking,setChecking]=useState(true),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[userEmail,setUserEmail]=useState(""),[workspace,setWorkspace]=useState("ResolveAI"),[role,setRole]=useState("");
 const[tickets,setTickets]=useState<Ticket[]>([]),[selected,setSelected]=useState<string|null>(null),[filter,setFilter]=useState("All"),[search,setSearch]=useState(""),[reply,setReply]=useState("");
 const[newName,setNewName]=useState(""),[newEmail,setNewEmail]=useState(""),[newSubject,setNewSubject]=useState(""),[newMessage,setNewMessage]=useState(""),[showCreate,setShowCreate]=useState(false);
 const[insight,setInsight]=useState<Insight|null>(null),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const active=tickets.find(t=>t.id===selected)||null;
 const visible=useMemo(()=>tickets.filter(t=>(filter==="All"||t.status===filter)&&(!search||(t.name+t.subject+t.preview).toLowerCase().includes(search.toLowerCase()))),[tickets,filter,search]);
 async function loadWorkspace(session:string){
  const me=await api("/api/auth/me",session),data=await api("/api/conversations",session);
  setUserEmail(me.user?.email||"");setWorkspace(me.workspace?.name||"ResolveAI");setRole(me.role||"");
  const rows=(data.conversations||[]).map(mapTicket)as Ticket[];setTickets(rows);setSelected(old=>rows.some(t=>t.id===old)?old:rows[0]?.id||null);setError("");
 }
 useEffect(()=>{let alive=true;(async()=>{try{const saved=await SecureStore.getItemAsync(KEY);if(saved){await loadWorkspace(saved);if(alive)setToken(saved);}}catch{await SecureStore.deleteItemAsync(KEY).catch(()=>undefined);}finally{if(alive)setChecking(false);}})();return()=>{alive=false};},[]);
 async function signIn(){
  if(!email.trim()||!password){setError("ایمیل و رمز عبور را وارد کنید.");return;}setBusy(true);setError("");
  try{const data=await api("/api/auth/login",null,{method:"POST",headers:{"X-ResolveAI-Client":"mobile"},body:JSON.stringify({email:email.trim(),password})});if(!data.access_token)throw new Error("توکن موبایل دریافت نشد.");await SecureStore.setItemAsync(KEY,data.access_token);await loadWorkspace(data.access_token);setToken(data.access_token);setPassword("");}
  catch(e){setError(e instanceof Error?e.message:"ورود ناموفق بود.");}finally{setBusy(false);}
 }
 async function signOut(){if(token)await api("/api/auth/logout",token,{method:"POST"}).catch(()=>undefined);await SecureStore.deleteItemAsync(KEY).catch(()=>undefined);setToken(null);setTickets([]);setSelected(null);setInsight(null);setPassword("");}
 async function refresh(){if(!token)return;setRefreshing(true);try{await loadWorkspace(token);}catch(e){setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}finally{setRefreshing(false);}}
 async function createConversation(){
  if(!token||!newName.trim()||!newSubject.trim())return;setBusy(true);setError("");
  try{const data=await api("/api/conversations",token,{method:"POST",body:JSON.stringify({customer_name:newName.trim(),customer_email:newEmail.trim(),subject:newSubject.trim(),message:newMessage.trim()})});await loadWorkspace(token);setSelected(data.id);setShowCreate(false);setNewName("");setNewEmail("");setNewSubject("");setNewMessage("");setNotice("گفتگو در فضای کاری ذخیره شد.");}
  catch(e){setError(e instanceof Error?e.message:"ساخت گفتگو ناموفق بود.");}finally{setBusy(false);}
 }
 async function saveReply(){
  if(!token||!active||!reply.trim())return;setBusy(true);setError("");
  try{await api("/api/conversations/"+encodeURIComponent(active.id)+"/messages",token,{method:"POST",body:JSON.stringify({body:reply.trim()})});setReply("");await loadWorkspace(token);setNotice("یادداشت داخلی ذخیره شد؛ برای مشتری ارسال نشد.");}
  catch(e){setError(e instanceof Error?e.message:"ذخیره یادداشت داخلی ناموفق بود.");}finally{setBusy(false);}
 }
 async function toggleStatus(){
  if(!token||!active)return;setBusy(true);try{await api("/api/conversations/"+encodeURIComponent(active.id),token,{method:"PATCH",body:JSON.stringify({status:active.status==="Resolved"?"open":"resolved"})});await loadWorkspace(token);}
  catch(e){setError(e instanceof Error?e.message:"تغییر وضعیت ناموفق بود.");}finally{setBusy(false);}
 }
 async function analyze(){
  if(!token||!active)return;setBusy(true);setError("");setInsight(null);
  try{const data=await api("/api/ai",token,{method:"POST",body:JSON.stringify({subject:active.subject,messages:active.messages.map(m=>({from:m.from==="agent"?"Agent":"Customer",text:m.text}))})});setInsight(data as Insight);}
  catch(e){setError(e instanceof Error?e.message:"تحلیل ناموفق بود.");}finally{setBusy(false);}
 }
 if(checking)return <SafeAreaView style={s.center}><ActivityIndicator color="#2c9b92"/><Text style={s.muted}>در حال بررسی حساب…</Text></SafeAreaView>;
 if(!token)return <SafeAreaView style={s.safe}><ExpoStatusBar style="dark"/><StatusBar barStyle="dark-content"/><KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==="ios"?"padding":undefined}><View style={s.card}><Text style={s.logo}>✳</Text><Text style={s.brand}>Resolve<Text style={{color:"#2c9b92"}}>AI</Text></Text><Text style={s.heading}>ورود به فضای کاری خصوصی</Text><Text style={s.muted}>با همان حسابی وارد شوید که در نسخه وب ساخته‌اید.</Text><TextInput value={email} onChangeText={setEmail} placeholder="ایمیل کاری" autoCapitalize="none" keyboardType="email-address" style={s.input}/><TextInput value={password} onChangeText={setPassword} placeholder="رمز عبور" secureTextEntry style={s.input}/>{!!error&&<Text style={s.error}>{error}</Text>}<TouchableOpacity style={s.primary} onPress={signIn} disabled={busy}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.primaryText}>ورود امن</Text>}</TouchableOpacity></View></KeyboardAvoidingView></SafeAreaView>;
 return <SafeAreaView style={s.safe}><ExpoStatusBar style="dark"/><StatusBar barStyle="dark-content"/><View style={s.header}><Text style={s.logoSmall}>✳</Text><View style={{flex:1}}><Text style={s.brandSmall}>Resolve<Text style={{color:"#2c9b92"}}>AI</Text></Text><Text style={s.mutedSmall}>{workspace} · {role}</Text></View><TouchableOpacity onPress={refresh}><Text style={s.link}>تازه‌سازی</Text></TouchableOpacity><TouchableOpacity onPress={signOut}><Text style={s.link}>خروج</Text></TouchableOpacity></View>
 {active?<KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}><View style={s.detail}><TouchableOpacity onPress={()=>setSelected(null)}><Text style={s.link}>‹ صندوق ورودی</Text></TouchableOpacity><Text style={s.heading}>{active.subject}</Text><Text style={s.muted}>{active.name} · {active.email}</Text><View style={s.row}><TouchableOpacity style={s.secondary} onPress={toggleStatus} disabled={busy}><Text style={s.link}>{active.status==="Resolved"?"بازگشایی":"حل شد"}</Text></TouchableOpacity><TouchableOpacity style={s.secondary} onPress={analyze} disabled={busy}><Text style={s.link}>راهنمای قانون‌محور</Text></TouchableOpacity></View></View><FlatList style={{flex:1}} data={active.messages} keyExtractor={(_,i)=>String(i)} contentContainerStyle={{padding:15,gap:12}} renderItem={({item})=><View style={{alignItems:item.from==="agent"?"flex-end":"flex-start"}}><Text style={s.mutedSmall}>{item.from==="agent"?"پاسخ تیم":"مشتری"} · {item.time}</Text><View style={[s.bubble,item.from==="agent"?s.agent:s.customer]}><Text style={s.body}>{item.text}</Text></View></View>}/>{insight&&<ScrollView style={s.insight}><Text style={s.link}>پیشنهاد قانون‌محور · {insight.urgency}</Text><Text style={s.body}>{insight.intent} · {insight.sentiment}</Text><Text style={s.body}>{insight.next_step}</Text><Text style={s.body}>{insight.suggested_reply}</Text><TouchableOpacity style={s.secondary} onPress={()=>setReply(insight.suggested_reply)}><Text style={s.link}>استفاده از پیشنهاد</Text></TouchableOpacity><Text style={s.mutedSmall}>{insight.disclaimer}</Text></ScrollView>}<View style={s.reply}><TextInput value={reply} onChangeText={setReply} multiline placeholder="یادداشت داخلی برای تیم را بنویسید…" style={s.input}/><TouchableOpacity style={s.primarySmall} onPress={saveReply} disabled={busy||!reply.trim()}><Text style={s.primaryText}>ذخیره یادداشت داخلی</Text></TouchableOpacity><Text style={s.mutedSmall}>پاسخ فقط در فضای کاری ذخیره می‌شود.</Text></View></KeyboardAvoidingView>:<View style={{flex:1}}><View style={s.title}><Text style={s.kicker}>PRIVATE TEAM WORKSPACE</Text><Text style={s.heading}>صندوق ورودی</Text><Text style={s.muted}>{userEmail}</Text></View><TextInput value={search} onChangeText={setSearch} placeholder="جست‌وجوی گفتگو…" style={s.input}/><View style={s.row}>{["All","Open","Pending","Resolved"].map(f=><TouchableOpacity key={f} style={[s.filter,filter===f&&s.filterOn]} onPress={()=>setFilter(f)}><Text style={s.link}>{f==="All"?"همه":f==="Open"?"باز":f==="Pending"?"در انتظار":"حل‌شده"}</Text></TouchableOpacity>)}</View><View style={s.row}><TouchableOpacity style={s.primarySmall} onPress={()=>setShowCreate(v=>!v)}><Text style={s.primaryText}>+ گفتگوی جدید</Text></TouchableOpacity><TouchableOpacity onPress={refresh}><Text style={s.link}>{refreshing?"در حال بارگذاری":"تازه‌سازی"}</Text></TouchableOpacity></View>{showCreate&&<View style={s.card}><TextInput value={newName} onChangeText={setNewName} placeholder="نام مشتری" style={s.input}/><TextInput value={newEmail} onChangeText={setNewEmail} placeholder="ایمیل مشتری" style={s.input}/><TextInput value={newSubject} onChangeText={setNewSubject} placeholder="موضوع" style={s.input}/><TextInput value={newMessage} onChangeText={setNewMessage} placeholder="پیام اولیه" style={s.input}/><TouchableOpacity style={s.primarySmall} onPress={createConversation} disabled={busy||!newName.trim()||!newSubject.trim()}><Text style={s.primaryText}>ذخیره گفتگو</Text></TouchableOpacity></View>}<FlatList data={visible} keyExtractor={t=>t.id} refreshing={refreshing} onRefresh={refresh} contentContainerStyle={{padding:14}} ListEmptyComponent={<Text style={s.muted}>هنوز گفتگویی ثبت نشده است.</Text>} renderItem={({item})=><TouchableOpacity style={s.ticket} onPress={()=>{setSelected(item.id);setInsight(null);}}><Text style={s.avatar}>{item.initials}</Text><View style={{flex:1}}><Text style={s.body}>{item.name} · {item.status==="Resolved"?"حل‌شده":item.status==="Pending"?"در انتظار":"باز"}</Text><Text style={s.body}>{item.subject}</Text><Text style={s.mutedSmall}>{item.preview}</Text></View></TouchableOpacity>}/></View>}
 {!!error&&<View style={s.errorBox}><Text style={s.error}>{error}</Text><TouchableOpacity onPress={()=>setError("")}><Text style={s.link}>بستن</Text></TouchableOpacity></View>}{!!notice&&<Text style={s.notice}>{notice}</Text>}<View style={s.footer}><Text style={s.mutedSmall}>ResolveAI · پاسخ‌ها داخلی هستند و برای مشتری ارسال نمی‌شوند.</Text></View></SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f2f7f7",paddingTop:Platform.OS==="android"?StatusBar.currentHeight:0},
 center:{flex:1,alignItems:"center",justifyContent:"center",gap:12,backgroundColor:"#f2f7f7"},
 loginWrap:{flex:1,justifyContent:"center",padding:20,backgroundColor:"#f2f7f7"},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e2ecea",borderRadius:22,padding:22,gap:13,shadowColor:"#103b47",shadowOpacity:.09,shadowRadius:22,shadowOffset:{width:0,height:12},elevation:5},
 logo:{width:48,height:48,overflow:"hidden",borderRadius:15,backgroundColor:"#e7f5f1",fontSize:27,color:"#258f89",textAlign:"center",textAlignVertical:"center"},
 logoSmall:{width:34,height:34,overflow:"hidden",borderRadius:11,backgroundColor:"#2d897f",fontSize:21,color:"#eafff8",textAlign:"center",textAlignVertical:"center"},
 brand:{fontSize:24,fontWeight:"800",color:"#173b45",letterSpacing:-.6},
 brandSmall:{fontSize:16,fontWeight:"800",color:"#f1fffb",letterSpacing:-.3},
 heading:{fontSize:19,fontWeight:"800",color:"#183d47",textAlign:"right",lineHeight:28},
 muted:{fontSize:11,color:"#82979a",textAlign:"right",lineHeight:19},
 mutedSmall:{fontSize:9,color:"#90a3a4",textAlign:"right",lineHeight:15},
 input:{minHeight:47,borderWidth:1,borderColor:"#dfeae8",borderRadius:10,paddingHorizontal:13,fontSize:11,textAlign:"right",backgroundColor:"#fbfdfd",color:"#31535a"},
 primary:{height:48,borderRadius:11,backgroundColor:"#248d87",alignItems:"center",justifyContent:"center",shadowColor:"#248d87",shadowOpacity:.2,shadowRadius:9,shadowOffset:{width:0,height:5},elevation:3},
 primarySmall:{backgroundColor:"#248d87",borderRadius:9,paddingVertical:11,paddingHorizontal:14,alignItems:"center",justifyContent:"center"},
 primaryText:{fontSize:10,color:"#fff",fontWeight:"800"},
 link:{fontSize:9,color:"#278f88",fontWeight:"800"},
 header:{minHeight:66,backgroundColor:"#123b47",borderBottomWidth:1,borderColor:"#234f58",paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:10},
 title:{padding:17,gap:6},
 kicker:{fontSize:8,color:"#4b9992",letterSpacing:1.25,fontWeight:"800"},
 row:{flexDirection:"row",gap:7,alignItems:"center",paddingHorizontal:13,paddingVertical:7},
 filter:{paddingVertical:8,paddingHorizontal:10,borderWidth:1,borderColor:"#e1ebea",borderRadius:9,backgroundColor:"#fff"},
 filterOn:{backgroundColor:"#e8f5f1",borderColor:"#cde7e1"},
 ticket:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e2ebea",borderRadius:13,padding:13,marginBottom:9,flexDirection:"row",gap:11,shadowColor:"#183e42",shadowOpacity:.035,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:1},
 avatar:{width:38,height:38,borderRadius:12,overflow:"hidden",textAlign:"center",textAlignVertical:"center",backgroundColor:"#e3f3ef",color:"#287f79",fontWeight:"800",paddingTop:10,fontSize:10},
 body:{fontSize:10,color:"#4d6970",textAlign:"right",lineHeight:19},
 detail:{backgroundColor:"#fff",padding:16,borderBottomWidth:1,borderColor:"#e6eeed",gap:8},
 bubble:{padding:12,borderRadius:12,maxWidth:"90%"},
 agent:{backgroundColor:"#eaf6f2",borderTopRightRadius:4},
 customer:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e4eceb",borderTopLeftRadius:4},
 reply:{padding:12,backgroundColor:"#fff",borderTopWidth:1,borderColor:"#e5eeec",gap:8},
 secondary:{borderWidth:1,borderColor:"#dceae7",borderRadius:9,padding:9,backgroundColor:"#f8fcfa"},
 insight:{maxHeight:180,backgroundColor:"#f3faf7",padding:13,borderTopWidth:1,borderColor:"#e4efec"},
 error:{fontSize:9,color:"#b4544a",textAlign:"right",lineHeight:17},
 errorBox:{padding:11,backgroundColor:"#fff3f0",borderTopWidth:1,borderColor:"#f0d8d3"},
 notice:{padding:9,color:"#287f70",textAlign:"center",fontSize:9,backgroundColor:"#eaf6f1"},
 footer:{padding:10,backgroundColor:"#fff",borderTopWidth:1,borderColor:"#e5eeec",alignItems:"center"}
});
