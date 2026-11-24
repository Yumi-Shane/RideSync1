// Waynecorp
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.dp=e;try{if((S.screen==='login'||S.screen==='profile')&&!document.querySelector('#ov.show'))render()}catch(_){}});
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
let S={user:null,csrf:'',role:'passenger',screen:'login',param:null,dir:'out',sel:null,dsel:null,token:null,date:today(),trips:[],fleet:[],ann:[],myq:null,lastq:null,users:[],drivers:[],queues:[],notes:[],unread:0,dtrip:null,qsel:null};
const save=()=>{};
const trip=id=>S.trips.find(t=>t.id==id)||(S.myq&&S.myq.trip==id?S.myq.tr:null);
const me=()=>S.user;
const homeOf={passenger:'home',driver:'dhome',coordinator:'sched'};
const TABS={passenger:[['Home','home'],['Trips','trips'],['Queue','queue'],['Profile','profile']],
driver:[['Home','dhome'],['Status','dstatus'],['Demand','demand'],['Alerts','alerts'],['Profile','profile']],
coordinator:[['Schedule','sched'],['Queues','cqueue'],['Fleet','fleet'],['Alerts','alerts'],['Profile','profile']]};
const TABOF={tripdetail:'trips',vehicles:'home',roles:'profile'};
const AUTH=['login','signup','forgot','reset'];
const go=(s,p)=>{S.screen=s;S.param=p??null;save();render();scrollTo(0,0)};
const modal=h=>{$('#box').innerHTML=h;$('#ov').classList.add('show')};
const notice=t=>modal(`<h2 style="margin-top:0">RideSync</h2><p>${esc(t)}</p><button class="btn" data-a="close">Done</button>`);
const tag=(t,c='')=>`<span class="pill ${c}">${esc(t)}</span>`;
const st=s=>/Unavail|Cancel|Delay|Off duty/.test(s)?'bad':/Available|Active|Boarding|Departed|Completed|Scheduled|On a trip|Assigned/.test(s)?'ok':'';
const pst=t=>t.st==='Needs setup'?'Pending':t.st;
const seatLine=t=>t.seats!=null?`Seats available: ${t.seats} (confirmed by driver)`:'Seat availability not yet confirmed';
const mineTrips=()=>S.trips.filter(t=>t.mine);
const over=t=>!['Cancelled','Completed'].includes(t.st)&&(t.unmet>0||t.q>=t.cap||(t.seats!=null&&t.q>t.seats));
const lvl=t=>{const r=t.q/t.cap;return r>=.66?'High demand — monitor before departure':r>=.33?'Moderate demand':'Low demand'};
const addAnn=(ti,tx,tg)=>S.ann.unshift({ti,tx,tag:tg});
const activeTrip=()=>S.trips.find(t=>t.mine&&!['Completed','Cancelled'].includes(t.st));
const curTrip=()=>mineTrips().find(t=>t.id==S.dtrip)||activeTrip();
const pwField=(id,ph)=>`<div class="pw"><input id="${id}" type="password" placeholder="${ph}" autocomplete="off"><button type="button" data-a="eye" data-v="${id}">Show</button></div>`;
const logo=`<div class="logo"><img src="ridesync-logo.png" alt="RideSync"><p style="font-family:Georgia,serif;font-size:13px;color:#1e2150">“Sync Your Ride, <span style="color:var(--gold)">Simplify Your Journey.</span>”</p></div>`;
const logoS='<img class="logo-s" src="ridesync-logo.png" alt="RideSync">';
const standalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
const UA=navigator.userAgent;
const plat=()=>/FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|MicroMessenger|Twitter|TikTok/i.test(UA)?'inapp':/iPhone|iPad|iPod/i.test(UA)?'ios':/SamsungBrowser/i.test(UA)?'samsung':/Android/i.test(UA)?'android':/Edg\//.test(UA)?'edge':'desktop';
const instDismissed=()=>{try{return localStorage.getItem('rs_inst_x')==='1'}catch(e){return false}};
const installBtn=(cls)=>window.dp?`<button class="${cls}" data-a="install">Install</button>`:`<button class="${cls}" data-a="howinstall">How to install</button>`;
const installBox=()=>standalone()?'':`<div class="card dark"><div><b>Install RideSync</b><p>Add it to your home screen and open it like an app</p></div>${installBtn('mini')}</div>`;
const installCard=()=>standalone()||instDismissed()?'':`<div class="card dark"><div><b>Install RideSync</b><p>Open it like an app from your home screen</p></div><div style="display:flex;gap:6px;align-items:center">${installBtn('mini')}<button class="mini" style="background:transparent;color:#cfd2ee" data-a="instx" aria-label="Dismiss">✕</button></div></div>`;

const V={
login:()=>`${logo}<p class="center">Your trip. Your queue. Your time.</p>
<label for="em">Email address</label><input id="em" type="email" placeholder="name@example.com" autocomplete="username">
<label for="pw">Password</label>${pwField('pw','Enter your password')}
<p class="err" id="err"></p><button class="btn" data-a="login">Log in</button>
<p class="center"><button class="link" data-a="go" data-v="signup">Create an account</button> • <button class="link" data-a="go" data-v="forgot">Forgot password?</button></p>${installBox()}
`,
signup:()=>`<div class="center">${logoS}<h1>Create your account</h1><p>Sign up to access transportation services</p></div>
<label for="n">Full name *</label><input id="n" placeholder="Enter your full name">
<label for="m">Mobile number *</label><input id="m" inputmode="tel" placeholder="09XX XXX XXXX">
<label for="em">Email address *</label><input id="em" type="email" placeholder="Enter your email address">
<label for="p1">Password *</label>${pwField('p1','Create a password')}
<label for="p2">Confirm password</label>${pwField('p2','Re-enter your password')}
<p class="err" id="err"></p><button class="btn" data-a="signup">Create account</button>
<p class="center">Already have an account? <button class="link" data-a="go" data-v="login">Log in</button></p>
<p class="center" style="font-size:13px">By signing up, you agree to the Terms</p>`,
forgot:()=>`<button class="back" data-a="go" data-v="login">‹ Back to login</button><div class="center">${logoS}<h1 style="margin-top:8px">Forgot password?</h1><p>Don't worry. Enter your registered email address to reset your password.</p></div>
<label for="em">Email address</label><input id="em" type="email" placeholder="Enter your registered email">
<button class="btn" data-a="reset">Send reset link</button>
<p class="center">Remember your password? <button class="link" data-a="go" data-v="login">Back to login</button></p>`,

home:()=>{const up=S.trips.filter(x=>!['Cancelled','Completed','Departed'].includes(x.st)).slice(0,3),q=S.myq,a=S.ann[0],av=S.fleet.filter(f=>f.ds==='Available').length;
return `${installCard()}<p>${new Date().getHours()<12?'Good morning!':new Date().getHours()<18?'Good afternoon!':'Good evening!'}</p><h1>Where are you going?</h1>
${S.unread?`<div class="card dark"><div><b>${S.unread} new update${S.unread>1?'s':''}</b><p>Trip status and schedule changes</p></div><button class="mini" data-a="go" data-v="alerts">View</button></div>`:''}
<h2>Upcoming trips</h2>${up.map(t=>`<div class="card" data-a="open" data-v="${t.id}"><div><b>${t.f} → ${t.to} • ${t.t}</b><p>${esc(t.via)}${t.prev?` • moved from ${t.prev}`:''}</p></div>${tag(pst(t),st(t.st))}</div>`).join('')||'<p>No upcoming trips for this date.</p>'}
<div class="card dark"><div><p>Your queue</p><b>${q?`${trip(q.trip).t} • ${q.no}`:'No active queue yet'}</b></div><button class="mini" data-a="go" data-v="${q?'queue':'trips'}">${q?'View':'Join'}</button></div>
<h2>Quick access</h2><div class="row"><button class="btn light" data-a="go" data-v="trips">View schedules</button><button class="btn light" data-a="go" data-v="trips">Join queue</button></div>
<h2>Vehicle availability</h2><div class="card dark"><div><p>Jeepney status</p><b>${S.trips.filter(x=>x.veh).length} scheduled • ${av} available</b></div><button class="mini" data-a="go" data-v="vehicles">View</button></div>
<h2>Announcements</h2>${a?`<div class="card dark"><div><b>${esc(a.ti)}</b><p>${esc(a.tx)}</p></div><button class="mini" data-a="go" data-v="alerts">All</button></div>`:'<p>No announcements yet.</p>'}`},
trips:()=>{const o=S.dir==='out',l=S.trips.filter(t=>o?t.f==='Binga':t.f==='Baguio');
return `<h1>Trip schedules</h1><p>Choose your direction and date</p><br>
<div class="seg"><button class="${o?'on':''}" data-a="dir" data-v="out">Outbound</button><button class="${o?'':'on'}" data-a="dir" data-v="ret">Return</button></div>
<label for="dt" style="font-weight:400;color:var(--mut)">Today • Select date</label><input id="dt" type="date" value="${S.date}">
<h2>${o?'Binga to Baguio':'Baguio to Binga'}</h2>
${l.map(t=>`<div class="card" data-a="open" data-v="${t.id}"><div><b>${t.t} departure</b><p>${esc(t.via)}${t.f==='Binga'?' • approx. 2 hrs':''}</p>${t.prev?`<p>Time changed from ${t.prev}</p>`:''}</div>${tag(pst(t),st(t.st))}</div>`).join('')||'<p>No trips scheduled.</p>'}`},
tripdetail:()=>{const t=trip(S.param),mine=S.myq&&S.myq.trip===t.id,can=t.veh&&['Scheduled','Boarding'].includes(t.st);
return `<button class="back" data-a="go" data-v="trips">‹ Back to schedules</button><h1>Trip details</h1>
<div class="card"><div><b>${t.f} → ${t.to}</b><p>${t.t} • ${esc(t.via)}</p></div>${tag(pst(t),st(t.st))}</div>
<h2>Trip information</h2><p>Departure point: ${t.f} terminal</p><p>Estimated travel: 2 hours</p>${t.prev?`<p>Schedule change: moved from ${t.prev}</p>`:''}<p>Vehicle: ${t.veh?'Jeepney assigned':'To be assigned'}</p>${t.veh?`<p>${seatLine(t)}</p>`:''}
<h2>Before joining</h2><p>• Join only one active queue per trip</p><p>• You may leave the queue before boarding</p><p>• Queue position may change as users board</p><br>
<button class="btn" data-a="${mine?'go':'join'}" data-v="${mine?'queue':t.id}" ${can||mine?'':'disabled'}>${mine?'View my queue':'Join this trip queue'}</button>${can||mine?'':`<p class="center">${t.veh?'Queue is closed for this trip.':'Queue opens once a vehicle is assigned.'}</p>`}`},
vehicles:()=>`<button class="back" data-a="go" data-v="home">‹ Back</button><h1>Vehicle availability</h1><p>Latest confirmed information for ${esc(S.date)}</p>
${S.fleet.map(f=>`<div class="card" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${esc(f.n)}</b><p>${f.s==='Unavailable'?esc(f.note):f.ds==='Available'?'Ready for coordinator assignment':f.ds==='On a trip'?'Currently on a trip':'Scheduled for a trip'}</p></div>${tag(f.ds,st(f.ds))}</div>${f.tr.map(t=>`<div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px"><div><b style="font-weight:500">${t.t} • ${t.f} → ${t.to}</b>${t.seats!=null?`<p>${t.seats} seats confirmed available</p>`:''}</div>${tag(t.st==='Needs setup'?'Pending':t.st,st(t.st))}</div>`).join('')}</div>`).join('')}
<div class="card dark"><div><b>Important</b><p>Seat availability appears only when confirmed by the driver</p></div></div>`,
queue:()=>{const q=S.myq,lq=S.lastq;if(!q&&lq&&lq.tr)return `<h1>Your virtual queue</h1><div class="card"><div><b>${lq.tr.f} → ${lq.tr.to} • ${lq.tr.t}</b><p>Queue number: ${lq.no}</p></div>${tag('Boarded','ok')}</div><div class="card dark"><div><b>You have boarded</b><p>Have a safe trip. Thank you for using RideSync.</p></div></div><button class="btn" data-a="go" data-v="trips">Browse trips</button>`;
if(!q)return `<h1>Your virtual queue</h1><div class="card"><div><b>No active queue</b><p>Pick a trip to join its queue.</p></div></div><button class="btn" data-a="go" data-v="trips">Browse trips</button>`;
const t=trip(q.trip);return `<h1>Your virtual queue</h1>
<div class="card"><div><b>${t.f} → ${t.to} • ${t.t}</b><p>Queue number: ${q.no}</p></div>${tag(t.st==='Cancelled'?'Cancelled':'Active',st(t.st))}</div>
<div class="card dark" style="display:block;text-align:center"><p>Your position</p><div class="big">${String(q.pos).padStart(2,'0')}</div></div>
<p><b>${Math.max(q.pos-1,0)} passengers ahead of you</b></p><h2>Queue updates</h2>
<div class="card"><div><b>Joined queue</b><p>${q.at}</p></div>${tag('Done')}</div>
<div class="card"><div><b>${t.st==='Boarding'?'Boarding now':t.st==='Departed'?'Trip departed':'Waiting for boarding'}</b><p>${t.st==='Boarding'?'Go to the pickup point':'Stay near pickup point'}</p></div>${tag(t.st==='Scheduled'?'Current':t.st,st(t.st))}</div>
<button class="btn" data-a="leave">Leave queue</button>`},
profile:()=>{const u=me()||{name:'Account name',email:'user@example.com'};
return `<h1>My account</h1><div class="avatar">${esc((u.name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())}</div><div class="center"><b>${esc(u.name)}</b><p>${esc(u.email)}</p><p>${S.role}</p></div><br>
<div class="card"><div><b>Account information</b><p>View or update profile details</p></div><button class="pill" data-a="editacct">Edit</button></div>
<div class="card"><div><b>Role and access</b><p>Passenger / Driver / Coordinator</p></div><button class="pill" data-a="go" data-v="roles">View</button></div>
<div class="card"><div><b>Password and security</b><p>Change password or recover access</p></div><button class="pill" data-a="chpw">Open</button></div>
${standalone()?'':`<div class="card"><div><b>Install the app</b><p>Add RideSync to your home screen</p></div>${installBtn('pill')}</div>`}<div class="card" data-a="logout"><div><b>Sign out</b><p>Log out from this device</p></div></div>`},
roles:()=>`<button class="back" data-a="go" data-v="profile">‹ Back to account</button><h1>Role and access</h1><p>Your role: <b>${S.role}</b></p>${S.role==='coordinator'?`<h2>People</h2>${S.users.map(u=>`<div class="card" style="display:block"><b>${esc(u.name)}</b><p>${esc(u.email)}</p><div class="row" style="margin-top:8px"><select data-a="setrole" data-v="${u.id}" ${u.id==S.user.id?'disabled':''}>${['passenger','driver','coordinator'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select><button class="btn ghost" style="margin:0" data-a="tmppw" data-v="${u.id}">Reset password</button></div></div>`).join('')}`:'<p>Ask a coordinator to change your role.</p>'}`,
reset:()=>`<div class="center">${logoS}<h1>Set a new password</h1></div><label for="p1">New password</label>${pwField('p1','At least 8 characters')}<label for="p2">Confirm password</label>${pwField('p2','Re-enter your password')}<p class="err" id="err"></p><button class="btn" data-a="doreset">Update password</button>`,

dhome:()=>{const mt=mineTrips(),v=S.fleet.find(f=>f.m),c=curTrip(),qs=c?S.queues.filter(e=>e.trip==c.id&&e.s!=='left'):[],tot=mt.filter(t=>!['Cancelled','Completed'].includes(t.st)).reduce((n,t)=>n+t.q,0),a=S.ann[0],on=+me().duty===1;
return `${installCard()}<h1>Driver dashboard</h1><p>Your assigned trips and passenger queue</p>
<label for="dt" style="font-weight:400;color:var(--mut)">Date</label><input id="dt" type="date" value="${S.date}">
<div class="card dark" style="display:block;text-align:center"><p>Passengers across your active trips</p><div class="big">${tot}</div></div>
<h2>Assigned trips</h2>${mt.map(t=>`<div class="card ${c&&c.id===t.id?'sel':''}" data-a="dpick" data-v="${t.id}"><div><b>${t.t} • ${t.f} → ${t.to}</b><p>${t.q}/${t.cap} passengers • ${esc(t.veh||'')}</p>${t.prev?`<p>Time changed from ${t.prev}</p>`:''}</div>${tag(pst(t),st(t.st))}</div>`).join('')||'<p>No trips assigned for this date.</p>'}
${c?`<h2>Current queue • ${c.t}</h2>${qs.map(e=>`<div class="card"><div><b>${e.no}</b><p>${esc(e.n)} • joined ${e.at}</p></div>${tag(e.s==='boarded'?'Boarded':'Waiting',e.s==='boarded'?'ok':'')}</div>`).join('')}${c.wk?`<p>+ ${c.wk} walk-in passenger${c.wk>1?'s':''} counted by you</p>`:''}${qs.length||c.wk?'':'<p>No one is in the queue yet.</p>'}<button class="btn" data-a="go" data-v="dstatus">Update this trip</button>`:''}
<h2>My vehicle</h2><div class="card"><div><b>${v?esc(v.n):'No vehicle assigned yet'}</b><p>${v?esc(v.note):'The coordinator will assign you.'}</p></div>${v?tag(v.ds,st(v.ds)):''}</div>
<div class="seg"><button class="${on?'on':''}" data-a="duty" data-v="1">On duty</button><button class="${on?'':'on'}" data-a="duty" data-v="0">Off duty</button></div>
<h2>Latest update</h2>${a?`<div class="card"><div><b>${esc(a.ti)}</b><p>${esc(a.tx)}</p></div>${tag(a.tag)}</div>`:'<p>No announcements yet.</p>'}`},
dstatus:()=>{const mt=mineTrips(),t=curTrip();if(!t)return '<h1>Update trip status</h1><p>No assigned trip right now.</p>';const c=S.dsel||t.st;
return `<h1>Update trip status</h1>${mt.length>1?`<label for="dtp">Trip</label><select id="dtp" data-a="dpicksel">${mt.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${x.t} ${x.f} → ${x.to}</option>`).join('')}</select>`:''}<div class="card"><div><b>${t.f} → ${t.to}</b><p>Assigned departure: ${t.t}</p></div>${tag(pst(t),st(t.st))}</div>
<h2>Select current status</h2>${['Boarding','Departed','Completed','Delayed','Cancelled'].map(s=>`<div class="opt ${c===s?'on':''}" data-a="dsel" data-v="${s}">${s}</div>`).join('')}
<h2>Report issue or add note</h2><textarea id="note" rows="3" placeholder="Describe delay or vehicle problem..."></textarea>
<button class="btn" data-a="dsubmit">Submit trip update</button>
<h2>Confirm seats available</h2><input id="seats" inputmode="numeric" placeholder="Seats free (blank to clear)" value="${t.seats==null?'':t.seats}"><p>Passengers only see a seat count after you confirm it here.</p>
<button class="btn ghost" data-a="seats">Publish seat availability</button>
${t.vid?`<h2>Vehicle availability</h2><p>${esc(t.veh)}</p><select id="dvs"><option value="Unavailable">Report vehicle problem (unavailable)</option><option value="Available">Mark vehicle available</option></select><br><br><textarea id="dvn" rows="2" placeholder="Describe the problem..."></textarea><button class="btn ghost" data-a="dveh">Update vehicle availability</button>`:''}`},
demand:()=>{const mt=mineTrips();if(!mt.length)return '<h1>Passenger demand</h1><p>No assigned trip right now.</p>';
return `<h1>Passenger demand</h1><p>Queue totals for your trips on ${esc(S.date)}</p>${mt.map(t=>`<div class="card"><div><b>${t.t} • ${t.f} → ${t.to}</b><p>${esc(t.veh||'')}</p></div>${tag(pst(t),st(t.st))}</div>
<div class="card dark" style="display:block"><p>Passengers in queue</p><div class="big">${t.q} / ${t.cap}</div><p>${Math.max(t.cap-t.q,0)} seats remaining • ${t.wq} in app • ${t.wk} walk-in • ${t.bd} boarded</p></div>
<div class="bar"><i style="width:${Math.min(100,t.q/t.cap*100)}%"></i></div><p>${lvl(t)}</p>
${['Cancelled','Completed','Departed'].includes(t.st)?'':`<div class="row"><button class="btn" data-a="cnt" data-v="${t.id}" data-d="-1">− Remove</button><button class="btn" data-a="cnt" data-v="${t.id}" data-d="1">+ Add</button></div>`}`).join('<br>')}
<p>Counts update as passengers join, leave, or board.</p>`},
alerts:()=>`<h1>Notifications</h1>${S.role==='coordinator'?'<button class="btn" data-a="newann">+ Create announcement</button>':''}
${S.notes.length?`<h2>For you</h2>${S.notes.map(n=>`<div class="card ${n.rd?'':'sel'}"><div><b>${esc(n.ti)}</b><p>${esc(n.tx)}</p><p style="font-size:12px">${esc(n.ts)}</p></div>${tag(n.tag)}</div>`).join('')}`:''}
<h2>Announcements</h2>${S.ann.map(a=>`<div class="card"><div><b>${esc(a.ti)}</b><p>${esc(a.tx)}</p><p style="font-size:12px">${esc(a.ts||'')}</p></div>${tag(a.tag)}</div>`).join('')||'<p>No announcements yet.</p>'}<p>Announcement history is available here.</p>`,
sched:()=>`${installCard()}<h1>Schedule management</h1><button class="btn" data-a="newtrip">+ Create scheduled trip</button><h2>Schedule for</h2><input id="dt" type="date" value="${S.date}">
${S.trips.map(t=>`<div class="card ${S.sel==t.id?'sel':''}" data-a="pick" data-v="${t.id}"><div><b>${t.t} • ${t.f} → ${t.to}</b><p>Driver: ${esc(t.drv||'Unassigned')} • Vehicle: ${esc(t.veh||'—')}</p>${t.prev?`<p>Time changed from ${t.prev}</p>`:''}</div>${t.st!=='Scheduled'?tag(pst(t),st(t.st)):tag('Ready','ok')}</div>`).join('')||'<p>No trips for this date.</p>'}
<h2>Trip actions</h2><div class="row"><button class="btn" data-a="edittrip">Edit selected</button><button class="btn" data-a="canceltrip">Cancel trip</button></div>
<div class="row"><button class="btn ghost" data-a="tdelay">Mark delayed</button><button class="btn ghost" data-a="tresume">Back on schedule</button></div>`,
cqueue:()=>`<h1>Queue monitoring</h1><p>Passengers waiting for each trip</p><label for="dt" style="font-weight:400;color:var(--mut)">Date</label><input id="dt" type="date" value="${S.date}">
${S.trips.map(t=>{const es=S.queues.filter(e=>e.trip===t.id&&e.s!=='left'),ov=over(t);
return `<div class="card ${ov?'sel':''}" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px" data-a="qopen" data-v="${t.id}"><div><b>${t.t} • ${t.f} → ${t.to}</b><p>${t.wq} waiting • ${t.wk} walk-in • ${t.bd} boarded • ${t.lf} left</p><p>${t.q}/${t.cap} seats${t.seats!=null?` • ${t.seats} confirmed free`:''}</p></div>${tag(pst(t),st(t.st))}</div>
<div class="bar" style="margin-top:8px"><i style="width:${Math.min(100,t.q/t.cap*100)}%"></i></div>
${ov?`<p style="color:#b3261e"><b style="display:inline">Demand may exceed seats</b> — consider another vehicle${t.unmet?` (${t.unmet} turned away)`:''}</p><button class="btn ghost" data-a="assign">Assign another vehicle</button>`:''}
${S.qsel===t.id?(es.map(e=>`<div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px"><div><b style="font-weight:600">${e.no}</b><p>${esc(e.n)} • joined ${e.at}</p></div>${tag(e.s==='boarded'?'Boarded':'Waiting',e.s==='boarded'?'ok':'')}</div>`).join('')||'<p style="margin-top:8px">No passengers in the app queue.</p>'):'<p style="margin-top:8px;font-size:13px">Tap to see passengers</p>'}</div>`}).join('')||'<p>No trips for this date.</p>'}`,
fleet:()=>`<h1>Fleet availability</h1><p>Registered vehicles and drivers</p><label for="dt" style="font-weight:400;color:var(--mut)">Date</label><input id="dt" type="date" value="${S.date}">
<p><b>${S.fleet.filter(f=>f.tr.some(t=>t.st!=='Cancelled')).length}</b> vehicle(s) scheduled on this date</p>
${S.fleet.map(f=>`<div class="card" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${esc(f.n)} • Driver: ${esc(f.d)}</b><p>${esc(f.note)}</p></div>${tag(f.ds,st(f.ds))}</div>${f.tr.map(t=>`<p style="margin-top:6px">${t.t} ${t.f} → ${t.to} • ${t.st==='Needs setup'?'Pending':t.st}</p>`).join('')}</div>`).join('')}
<h2>Driver availability</h2>${S.drivers.map(d=>`<div class="card"><div><b>${esc(d.name)}</b><p>${d.n} trip${d.n===1?'':'s'} on this date</p></div>${tag(d.av,st(d.av))}</div>`).join('')||'<p>No drivers yet. Set a person\'s role to Driver in Role and access.</p>'}
<button class="btn ghost" data-a="addveh">+ Add vehicle</button><button class="btn" data-a="assign">Assign vehicle and driver</button>
<h2>Record a vehicle issue</h2><select id="iv">${S.fleet.map(f=>`<option value="${f.id}">${esc(f.n)}</option>`).join('')}</select><br><br><select id="ist"><option value="Unavailable">Mark unavailable</option><option value="Available">Mark available</option></select><br><br><textarea id="is" rows="2" placeholder="Enter issue or note"></textarea>
<button class="btn" data-a="issue">Save availability update</button>`
};

function render(){
 if(!me()&&!AUTH.includes(S.screen))S.screen='login';
 const s=S.screen;$('#main').innerHTML=V[s]();
 const nav=$('#nav'),show=!AUTH.includes(s);nav.hidden=!show;
 if(show)renderNav()}
function renderNav(){const on=TABOF[S.screen]||S.screen;$('#nav').innerHTML=TABS[S.role].map(([l,k])=>`<button class="${k===on?'on':''}" data-a="go" data-v="${k}">${l}${k==='alerts'&&S.unread?` (${S.unread})`:''}</button>`).join('')}
const val=id=>($('#'+id)||{}).value||'';
const opts=a=>a.map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('');
async function api(a,body){
 try{const r=await fetch('api.php?a='+a+'&d='+S.date,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF':S.csrf},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({error:'Unexpected server response.'}));
  if(r.status===401&&S.user){S.user=null;if(!AUTH.includes(S.screen))go('login')}
  if(!r.ok)return{error:j.error||'Something went wrong.'};
  if(j.csrf!==undefined)apply(j);
  return j}catch(e){return{error:'Cannot reach the server. Check your connection.'}}}
function apply(j){S.csrf=j.csrf||S.csrf;S.user=j.user||null;S.role=S.user?S.user.role:'passenger';
 for(const k of['trips','fleet','ann','users','drivers','queues','notes'])S[k]=j[k]||[];S.myq=j.myq||null;S.lastq=j.lastq||null;S.unread=j.unread||0}
const act=async(a,b)=>{const j=await api(a,b);if(j.error){notice(j.error);return null}render();return j};
const mfield=(id,l,v='',t='text',ph='')=>`<label for="${id}">${l}</label><input id="${id}" type="${t}" value="${esc(v)}" placeholder="${ph}">`;
const A={
 instx(){try{localStorage.setItem('rs_inst_x','1')}catch(e){}render()},
 async copylink(){try{await navigator.clipboard.writeText(location.origin+location.pathname);notice('Link copied. Paste it into Chrome (Android) or Safari (iPhone).')}catch(e){notice('Copy this address: '+location.origin+location.pathname)}},
 howinstall(){const p=plat(),G={
 inapp:['You are inside another app (Facebook, Messenger, etc.), which cannot install web apps.','Tap the ⋮ or … menu and choose Open in browser, or copy the link and paste it into Chrome (Android) or Safari (iPhone).','Then follow the install steps from there.'],
 ios:['Open this page in Safari (not Chrome).','Tap the Share button (square with an arrow) at the bottom.','Scroll down and tap Add to Home Screen, then tap Add.'],
 android:['Tap the ⋮ menu at the top right of Chrome.','Tap Install app (or Add to Home screen).','Tap Install to confirm. RideSync appears on your home screen.'],
 samsung:['Tap the ≡ menu at the bottom right.','Tap Add page to, then Home screen (or Install app).','Tap Add to confirm.'],
 edge:['Click the ⋯ menu at the top right.','Choose Apps, then Install this site as an app.','Click Install.'],
 desktop:['Look for the install icon at the right end of the address bar, or open the ⋮ menu.','Choose Install RideSync.','Click Install.']}[p];
  modal(`<h2 style="margin-top:0">Install RideSync</h2>${G.map((t,i)=>`<p style="margin:8px 0"><b style="display:inline">${i+1}.</b> ${t}</p>`).join('')}${p==='inapp'?'<button class="btn ghost" data-a="copylink">Copy link</button>':''}<p style="font-size:12px;margin-top:12px">Tip: the app must be opened over https in a regular browser. If you do not see these options, reload the page once and try again.</p><button class="btn" data-a="close">Got it</button>`)},
 go:v=>{go(v);if(v==='alerts'&&S.unread)api('notes_read',{}).then(()=>renderNav())},close:()=>$('#ov').classList.remove('show'),
 eye:v=>{const i=$('#'+v);i.type=i.type==='password'?'text':'password'},
 async login(){const j=await api('login',{email:val('em'),password:val('pw')});if(j.error)return void($('#err').textContent=j.error);go(homeOf[S.role])},
 async signup(){const er=$('#err'),p=val('p1');if(p!==val('p2'))return void(er.textContent='Passwords do not match.');
  const j=await api('signup',{name:val('n'),mobile:val('m'),email:val('em'),password:p});if(j.error)return void(er.textContent=j.error);go(homeOf[S.role])},
 async reset(){await api('forgot',{email:val('em')});notice('If an account matches this email, you will receive password reset instructions.')},
 async doreset(){const er=$('#err');if(val('p1')!==val('p2'))return void(er.textContent='Passwords do not match.');
  const j=await api('resetpw',{token:S.token,password:val('p1')});if(j.error)return void(er.textContent=j.error);
  S.token=null;history.replaceState(null,'',location.pathname);go('login');notice('Password updated. Log in with your new password.')},
 async install(){if(!window.dp)return;window.dp.prompt();await window.dp.userChoice;window.dp=null;render()},
 async logout(){await api('logout',{});go('login')},
 dir:v=>{S.dir=v;go('trips')},open:v=>go('tripdetail',+v),
 async join(v){if(await act('join',{trip:+v}))go('queue')},
 async leave(){await act('leave',{});go('queue')},
 dsel:v=>{const n=val('note');S.dsel=v;render();$('#note').value=n},
 async dsubmit(){const t=curTrip();if(!t)return;const s=S.dsel||t.st;if(!['Boarding','Departed','Completed','Delayed','Cancelled'].includes(s))return notice('Choose a status first.');
  if(await act('dstatus',{trip:t.id,status:s,note:val('note')})){S.dsel=null;render();notice('Update saved. Passengers and the coordinator have been notified.')}},
 async cnt(v,el){await act('cnt',{trip:+v,delta:+el.dataset.d})},
 dpick:v=>{S.dtrip=+v;S.dsel=null;render()},dpicksel:(v,el)=>{S.dtrip=+el.value;S.dsel=null;render()},
 async seats(){const t=curTrip();if(t&&await act('seats',{trip:t.id,seats:val('seats')}))notice('Seat availability updated.')},
 async dveh(){const t=curTrip();if(t&&t.vid&&await act('dveh',{vehicle:t.vid,status:val('dvs'),note:val('dvn')}))notice('Vehicle availability updated. The coordinator has been notified.')},
 async duty(v){await act('duty',{on:+v})},
 qopen:v=>{S.qsel=S.qsel==+v?null:+v;render()},
 tdelay(){if(!trip(S.sel))return notice('Select a trip first.');modal(`<h2 style="margin-top:0">Mark trip delayed</h2>${mfield('dn','Reason or new expected time','','text','e.g. Departing 8:00 AM')}<button class="btn" data-a="savedelay">Mark delayed</button><button class="btn ghost" data-a="close">Cancel</button>`)},
 async savedelay(){if(await act('trip_status',{id:S.sel,status:'Delayed',note:val('dn')}))A.close()},
 async tresume(){if(!trip(S.sel))return notice('Select a trip first.');if(await act('trip_status',{id:S.sel,status:'Scheduled'}))notice('Trip is back on schedule. Affected passengers and the driver were notified.')},
 pick:v=>{S.sel=+v;render()},
 newann:()=>modal(`<h2 style="margin-top:0">Create announcement</h2>${mfield('at','Title')}<label for="ax">Message</label><textarea id="ax" rows="3"></textarea><button class="btn" data-a="saveann">Post announcement</button><button class="btn ghost" data-a="close">Cancel</button>`),
 async saveann(){if(await act('ann_create',{title:val('at'),body:val('ax')}))A.close()},
 newtrip:()=>modal(`<h2 style="margin-top:0">Create scheduled trip</h2>${mfield('nd','Date',S.date,'date')}${mfield('tt','Departure time','07:00','time')}${mfield('tc','Seats (capacity)','18','number')}<label for="td">Direction</label><select id="td"><option value="o">Binga → Baguio</option><option value="r">Baguio → Binga</option></select>${mfield('tv','Route note','','text','Via Guisset Road')}<button class="btn" data-a="savetrip">Create trip</button><button class="btn ghost" data-a="close">Cancel</button>`),
 async savetrip(){if(await act('trip_create',{date:val('nd'),time:val('tt'),dir:val('td'),via:val('tv'),cap:val('tc')}))A.close()},
 edittrip(){const t=trip(S.sel);if(!t)return notice('Select a trip first.');
  modal(`<h2 style="margin-top:0">Edit trip</h2>${mfield('tt','Departure time',t.t24,'time')}${mfield('tc','Seats (capacity)',t.cap,'number')}${mfield('tv','Route note',t.via)}<button class="btn" data-a="saveedit">Save changes</button><button class="btn ghost" data-a="close">Cancel</button>`)},
 async saveedit(){if(await act('trip_edit',{id:S.sel,time:val('tt'),via:val('tv'),cap:val('tc')}))A.close()},
 async canceltrip(){if(!trip(S.sel))return notice('Select a trip first.');if(await act('trip_cancel',{id:S.sel}))S.sel=null},
 assign(){const ts=S.trips.filter(t=>t.st!=='Cancelled'),fs=S.fleet.filter(f=>f.s!=='Unavailable');
  if(!ts.length)return notice('Create a trip for this date first.');if(!fs.length)return notice('No vehicles are available.');if(!S.drivers.length)return notice('No drivers yet. Set a person\'s role to Driver in Role and access.');
  modal(`<h2 style="margin-top:0">Assign vehicle and driver</h2><label for="at">Trip</label><select id="at">${opts(ts.map(t=>[t.id,`${t.t} ${t.f} → ${t.to}`]))}</select><label for="av">Vehicle</label><select id="av">${opts(fs.map(f=>[f.id,f.n]))}</select><label for="ad">Driver</label><select id="ad">${opts(S.drivers.map(d=>[d.id,d.name+(d.duty?'':' (off duty)')]))}</select><button class="btn" data-a="saveassign">Assign</button><button class="btn ghost" data-a="close">Cancel</button>`)},
 async saveassign(){if(await act('assign',{trip:+val('at'),vehicle:+val('av'),driver:+val('ad')}))A.close()},
 addveh:()=>modal(`<h2 style="margin-top:0">Add vehicle</h2>${mfield('vn','Vehicle name','','text','Jeepney 04')}<button class="btn" data-a="saveveh">Add vehicle</button><button class="btn ghost" data-a="close">Cancel</button>`),
 async saveveh(){if(await act('vehicle_add',{name:val('vn')}))A.close()},
 async issue(){if(await act('issue',{vehicle:+val('iv'),status:val('ist'),note:val('is')}))notice('Update saved.')},
 editacct(){const u=me();modal(`<h2 style="margin-top:0">Account information</h2>${mfield('en','Full name',u.name)}${mfield('em2','Mobile number',u.mobile)}<p class="err" id="err2"></p><button class="btn" data-a="saveacct">Save changes</button><button class="btn ghost" data-a="close">Cancel</button>`)},
 async saveacct(){const j=await api('acct',{name:val('en'),mobile:val('em2')});if(j.error)return void($('#err2').textContent=j.error);A.close();render()},
 chpw:()=>modal(`<h2 style="margin-top:0">Change password</h2><label for="c0">Current password</label>${pwField('c0','Current password')}<label for="c1">New password</label>${pwField('c1','At least 8 characters')}<p class="err" id="err2"></p><button class="btn" data-a="savepw">Update password</button><button class="btn ghost" data-a="close">Cancel</button>`),
 async savepw(){const j=await api('pw',{current:val('c0'),password:val('c1')});if(j.error)return void($('#err2').textContent=j.error);A.close();notice('Password updated.')},
 async setrole(v,el){await act('user_role',{id:+v,role:el.value})},
 async tmppw(v){const j=await api('user_tmp_pw',{id:+v});if(j.error)return notice(j.error);
  modal(`<h2 style="margin-top:0">Temporary password</h2><p>Share it with the person securely. It is shown once:</p><p><b>${esc(j.temp)}</b></p><button class="btn" data-a="close">Done</button>`)}
};
document.addEventListener('click',e=>{if(e.target.id==='ov')return A.close();const el=e.target.closest('[data-a]');if(el&&el.tagName!=='SELECT'&&A[el.dataset.a])A[el.dataset.a](el.dataset.v,el)});
document.addEventListener('change',e=>{const el=e.target;if(el.id==='dt'){S.date=el.value||today();api('state').then(render);return}
 if(el.tagName==='SELECT'&&el.dataset.a&&A[el.dataset.a])A[el.dataset.a](el.dataset.v,el)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')A.close();if(e.key==='Enter'&&e.target.tagName==='INPUT'&&AUTH.includes(S.screen)){const b=document.querySelector('main .btn[data-a]');if(b)b.click()}});
setInterval(async()=>{if(document.hidden||!S.user||$('#ov').classList.contains('show')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;await api('state');render()},15000);
(async()=>{S.token=new URLSearchParams(location.search).get('reset');await api('state');
 S.screen=S.user?homeOf[S.role]:(S.token?'reset':'login');render()})();

addEventListener('appinstalled',()=>{window.dp=null;render()});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
