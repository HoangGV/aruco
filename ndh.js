(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),KEY='ndh-tg-v1',NET=window.PortableNet;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let D;try{D=JSON.parse(localStorage.getItem(KEY))}catch{}
D=D&&Array.isArray(D.classes)?D:{teacher:'',classes:[]};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(D))}catch{toast('Không lưu được vào trình duyệt. Hãy xuất sao lưu.')}};
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3800)}
const cls=id=>D.classes.find(c=>c.id===id),list=c=>(c.names||'').split('\n').map(s=>s.trim()).filter(Boolean);
const dl=(n,b)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
const modal=h=>{$('#modal').innerHTML=h?`<div class="dlg">${h}</div>`:''};
/* ---------- Markdown câu hỏi ---------- */
const md=s=>esc(s).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(m,a,u)=>/^(https?:|[\w./-])/.test(u)&&!/^javascript/i.test(u)?(/\.(mp4|webm|ogg)(\?|$)/i.test(u)||a==='video'?`<video src="${u}" controls playsinline></video>`:`<img src="${u}" alt="${a}">`):m).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
function parse(t,def=30){const qs=[],err=[];
 (t||'').split(/^##[ \t]+/m).slice(1).forEach((b,i)=>{const q={t:[],o:{},a:'',e:[],s:0};let mode='t',last='',m;
  for(const raw of b.split('\n')){const l=raw.trimEnd();
   if(m=l.match(/^([A-D])[.)]\s*(.*)$/)){q.o[m[1]]=m[2];mode='o';last=m[1]}
   else if(m=l.match(/^(?:Đáp án|Dap an)\s*:\s*(.+)$/i)){q.a=m[1].trim();mode='a'}
   else if(m=l.match(/^(?:Giải thích|Giai thich)\s*:\s*(.*)$/i)){q.e.push(m[1]);mode='e'}
   else if(m=l.match(/^(?:Thời gian|Thoi gian)\s*:\s*(\d+)/i)){q.s=+m[1];mode='s'}
   else if(mode==='t')q.t.push(l);else if(mode==='e')q.e.push(l);else if(mode==='o'&&l.trim())q.o[last]+='\n'+l}
  const keys=Object.keys(q.o).join(''),n=i+1,A=q.a.toUpperCase().replace(/Á/g,'A');
  let type,opts,ans;
  if(keys==='ABCD'){type='mcq';opts=['A','B','C','D'].map(k=>q.o[k]);ans=/^[A-D]/.test(A)?A[0]:''}
  else if(keys==='AB'||(keys===''&&/^(Đ|D|S|TRUE|FALSE|A|B)/i.test(q.a))){type='tf';opts=keys?[q.o.A,q.o.B]:['Đúng','Sai'];ans=/^(Đ|DUNG|TRUE|A\b)/i.test(q.a)?'A':/^(S|SAI|FALSE|B\b)/i.test(q.a)?'B':''}
  else{err.push(`Câu ${n}: cần đủ 4 phương án A–D (hoặc 2 phương án A, B cho Đúng/Sai).`);return}
  const text=q.t.join('\n').trim();
  if(!text)err.push(`Câu ${n}: thiếu nội dung câu hỏi.`);
  else if(!ans)err.push(`Câu ${n}: thiếu hoặc sai dòng "Đáp án:".`);
  else if(opts.some(x=>!String(x).trim()))err.push(`Câu ${n}: có phương án trống.`);
  else qs.push({id:'q'+n,type,text,options:opts,answer:ans,explanation:q.e.join('\n').trim(),seconds:q.s>=5&&q.s<=600?q.s:def})});
 return{qs,err}}
const GUIDE=`## Nội dung câu hỏi (có thể nhiều dòng)
![mô tả](https://.../hinh.jpg)
![video](https://.../clip.mp4)
A. Phương án A
B. Phương án B
C. Phương án C
D. Phương án D
Đáp án: B
Giải thích: Lời giải thích (không bắt buộc)
Thời gian: 30

## Câu đúng/sai (A = Đúng, B = Sai)
Đáp án: Đúng`;
/* ---------- Xuất xlsx (JSZip) ---------- */
const colN=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const cell=(v,r,c)=>typeof v==='number'?`<c r="${colN(c)}${r}"><v>${v}</v></c>`:`<c r="${colN(c)}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
const sheetXml=rows=>`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,c)=>v===''||v==null?'':cell(v,i+1,c)).join('')}</row>`).join('')}</sheetData></worksheet>`;
async function xlsx(cs){const fmt=t=>new Date(t).toLocaleString('vi-VN');
 const sh=[['Thông tin',[['Giáo viên',D.teacher||''],['Ngày xuất',fmt(Date.now())],[],['Lớp','Môn học','Số học sinh'],...cs.map(c=>[c.name,c.subject||'',list(c).length])]]];
 for(const c of cs){const ns=list(c),rs=c.results||[];
  sh.push([c.name,[['Giáo viên',D.teacher||''],['Môn học',c.subject||''],['Lớp',c.name],[],['Số thẻ','Học sinh',...rs.map(r=>fmt(r.at)+' ('+r.total+' câu)')],...ns.map((n,i)=>[i+1,n,...rs.map(r=>{const x=r.rows.find(x=>x.id===i+1);return x?x.score:''})])]])}
 const used=new Set(),Z=new JSZip(),names=sh.map(([n])=>{let b=n.replace(/[\\/?*\[\]:]/g,'_').slice(0,28)||'Lop',k=b,i=1;while(used.has(k.toLowerCase()))k=b+'_'+ ++i;used.add(k.toLowerCase());return k});
 Z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sh.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 Z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 Z.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${esc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 Z.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sh.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 sh.forEach(([,rows],i)=>Z.file(`xl/worksheets/sheet${i+1}.xml`,sheetXml(rows)));
 dl('NDH-ket-qua.xlsx',await Z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))}
/* ---------- In thẻ ---------- */
function printCards(c){const ns=list(c);if(!ns.length)return toast('Hãy nhập danh sách học sinh trước.');
 const w=window.open('','_blank');if(!w)return toast('Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.');
 w.document.write(`<!doctype html><meta charset=utf-8><title>Thẻ ${esc(c.name)}</title><style>body{margin:0;font:14px sans-serif}.g{display:grid;grid-template-columns:repeat(3,1fr)}.c{position:relative;height:9.2cm;border:1px dashed #666;text-align:center;page-break-inside:avoid}.m{position:absolute;left:50%;top:46%;width:4.6cm;height:4.6cm;transform:translate(-50%,-50%)}.m svg{width:100%;height:100%}b{position:absolute;font-size:30px}.a{top:.5cm;left:50%;transform:translateX(-50%)}.e{bottom:1.3cm;left:50%;transform:translateX(-50%)}.b{right:.35cm;top:46%}.d{left:.35cm;top:46%}p{position:absolute;bottom:.1cm;width:100%;margin:0}button{margin:8px;padding:8px 16px;font-size:16px}@media print{button{display:none}}</style><button onclick=print()>In thẻ</button><div class=g>${ns.map((n,i)=>`<div class=c><b class=a>A</b><b class=b>B</b><b class=e>C</b><b class=d>D</b><div class=m>${CardMarkers.svg(i+1)}</div><p>${i+1}. ${esc(n)}</p></div>`).join('')}</div>`);w.document.close()}
/* ---------- Trang chủ & lớp ---------- */
const app=$('#app');let cur=null,room=null,hostKey='',timerId=0,pollId=0,savedCode='',theme=localStorage.getItem('ndh-theme')||'dark',peerOn=false;
const head=(sub,extra='')=>`<header class="bar"><b>NDH</b><span>Tương tác giấy${sub?' · '+esc(sub):''}</span><i class="sp"></i>${extra}</header>`;
function home(){cur=null;app.innerHTML=head('',`<button class="btn" data-act="xall">Xuất kết quả .xlsx</button><button class="btn" data-act="bk">Sao lưu</button><button class="btn" data-act="rs">Nhập dữ liệu</button>`)+`<main class="wrap"><section class="box"><h2>Giáo viên</h2><label>Họ và tên<input type="text" data-f="teacher" value="${esc(D.teacher)}" autocomplete="name"></label></section><section class="box"><h2>Các lớp</h2><div class="grid">${D.classes.map(c=>`<div class="box"><h3>${esc(c.name)}</h3><div>${esc(c.subject||'Chưa có môn')}</div><div class="muted">${list(c).length} học sinh · ${parse(c.md).qs.length} câu</div><button class="btn pri" data-act="open" data-id="${c.id}">Mở lớp</button></div>`).join('')||'<p class="muted">Chưa có lớp nào. Hãy thêm lớp đầu tiên.</p>'}</div><button class="btn" data-act="add">Thêm lớp</button></section></main>`}
function klass(id){const c=cls(id);if(!c)return home();cur=id;const p=parse(c.md,c.sec||30);
 app.innerHTML=head(c.name,`<button class="btn" data-act="home">Về danh sách lớp</button>`)+`<main class="wrap">
<section class="box"><h2>Thông tin lớp</h2><div class="row"><label style="flex:1">Tên lớp<input type="text" data-f="cname" value="${esc(c.name)}"></label><label style="flex:1">Môn học<input type="text" data-f="csub" value="${esc(c.subject||'')}"></label></div></section>
<section class="box"><h2>Học sinh và bộ thẻ</h2><label>Mỗi dòng một học sinh (số thẻ theo thứ tự dòng)<textarea data-f="names" style="min-height:150px">${esc(c.names||'')}</textarea></label><div class="row"><span id="cnt" class="muted">${list(c).length} học sinh</span><button class="btn" data-act="print">In bộ thẻ của lớp</button></div></section>
<section class="box"><h2>Câu hỏi (Markdown)</h2><textarea data-f="md" placeholder="## Nội dung câu hỏi…">${esc(c.md||'')}</textarea><div id="qst" class="${p.err.length?'err':'muted'}">${p.err.join('\n')||p.qs.length+' câu hợp lệ'}</div><div class="row"><button class="btn" data-act="imd">Nhập .md</button><button class="btn" data-act="emd">Xuất .md</button></div><details><summary>Hướng dẫn viết câu hỏi</summary><pre>${esc(GUIDE)}</pre><p class="muted">Mỗi câu bắt đầu bằng "## ". Dòng Giải thích và Thời gian không bắt buộc. Ảnh và video dùng cú pháp ![](đường dẫn).</p></details></section>
<section class="box"><h2>Thiết lập</h2><div class="row"><label>Thời gian mỗi câu (giây)<input type="number" min="5" max="600" data-f="sec" value="${c.sec||30}"></label><label class="chk"><input type="checkbox" data-f="elim" ${c.elim?'checked':''}>Trả lời sai bị loại (có cứu hộ)</label></div></section>
<section class="box"><h2>Kết quả đã lưu</h2>${(c.results||[]).map((r,i)=>`<div class="row"><span>${new Date(r.at).toLocaleString('vi-VN')} · ${r.total} câu</span><button class="btn dng" data-act="delr" data-i="${i}">Xóa</button></div>`).join('')||'<p class="muted">Chưa có kết quả.</p>'}<div class="row"><button class="btn" data-act="xone">Xuất lớp này .xlsx</button></div></section>
<button class="btn pri" data-act="start" style="font-size:22px;padding:14px">Bắt đầu kiểm tra</button></main>`}
/* ---------- Màn kiểm tra ---------- */
const stat=()=>NET.status();
async function start(){const c=cls(cur),ns=list(c),p=parse(c.md,c.sec||30);
 if(!ns.length)return toast('Hãy nhập danh sách học sinh.');if(ns.length>250)return toast('Tối đa 250 học sinh mỗi lớp.');
 if(p.err.length||!p.qs.length)return toast(p.err[0]||'Hãy nhập ít nhất một câu hỏi.');
 try{const v=await NET.api('/rooms','POST',{config:{eliminate:!!c.elim,seconds:c.sec||30},players:ns.map((n,i)=>({id:i+1,name:n})),questions:p.qs},'');
  hostKey=v.hostKey;room=v.state;savedCode='';peerOn=false;stage();NET.ready(room.code).then(()=>{peerOn=true;if(room.phase==='lobby')pair()}).catch(e=>{toast(e.message);pair()});
  pair();clearInterval(pollId);pollId=setInterval(poll,400);clearInterval(timerId);timerId=setInterval(tick,200)}catch(e){toast(e.message)}}
let lastKey='';
async function poll(){if(!room)return;try{const v=await NET.api('/rooms/'+room.code+'?role=host','GET',null,hostKey);room=v.state;
 const k=room.phase+room.index;if(k!==lastKey)stage();else{const n=$('#ans');if(n)n.textContent=Object.keys(room.submissions).length+'/'+room.players.filter(p=>p.alive).length+' thẻ đã nhận'}}catch(e){}}
function tick(){const t=$('#tm');if(!room||!t)return;const ms=room.phase==='paused'?room.remainingMs:room.deadline?room.deadline-Date.now():0;t.textContent=Math.max(0,Math.ceil(ms/1000))}
const act=async(a,extra={})=>{try{const v=await NET.api('/rooms/'+room.code+'/action','POST',{action:a,...extra},hostKey);room=v.state;stage()}catch(e){toast(e.message)}};
function stage(){if(!room)return;const q=room.currentQuestion,ph=room.phase;lastKey=ph+room.index;let body='';
 const dead=room.players.filter(p=>!p.alive).length;
 if(ph==='lobby')body=`<div class="big">${esc(cls(cur)?.name||'')}<br>Sẵn sàng · ${room.players.length} học sinh · ${room.questionCount} câu</div>`;
 else if(ph==='finished'){const hs=room.history.length,rows=[...room.players].sort((a,b)=>b.score-a.score);
  const c=cls(cur);if(c&&savedCode!==room.code){savedCode=room.code;(c.results=c.results||[]).push({at:Date.now(),total:hs,rows:room.players.map(p=>({id:p.id,name:p.name,score:p.score/10}))});save()}
  body=`<div class="top"><span>Kết quả</span></div><table><tr><th>Hạng</th><th>Học sinh</th><th>Số câu đúng</th></tr>${rows.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td>${p.score/10}/${hs}</td></tr>`).join('')}</table>`}
 else if(q){const rev=ph==='revealed';
  body=`<div class="top"><span>Câu ${room.index+1}/${room.questionCount}</span><span id="ans" style="font-size:.7em"></span><span class="tm" id="tm">${q.seconds}</span></div><div class="qt">${md(q.text)}</div>${ph==='paused'?'<div class="big">ĐÃ TẠM DỪNG</div>':`<div class="opts">${q.options.map((o,i)=>{const L='ABCD'[i];return`<div class="op${rev?(L===q.answer?' ok':' no'):''}"><i>${L}</i><span>${md(o)}</span></div>`}).join('')}</div>`}${rev&&q.explanation?`<div class="ex">${md(q.explanation)}</div>`:''}${rev&&room.config.eliminate?`<div class="top" style="font-size:.8em">Đã bị loại: ${dead}</div>`:''}`}
 const B=(a,t,c='')=>`<button class="btn ${c}" data-act="${a}">${t}</button>`,last=room.index+1>=room.questionCount;
 let ctl=ph==='lobby'?B('s-go','Bắt đầu','pri'):ph==='question'?B('s-pause','Tạm dừng')+B('s-reveal','Công bố đáp án','pri'):ph==='paused'?B('s-resume','Tiếp tục','pri')+B('s-reveal','Công bố đáp án'):ph==='revealed'?B('s-next',last?'Xem kết quả':'Câu tiếp theo','pri')+(room.config.eliminate?B('s-rescue','Cứu hộ'):''):B('xone','Xuất .xlsx','pri')+B('s-reset','Làm lại');
 app.innerHTML=`<div class="stage ${theme}">${body}</div><nav class="ctl">${ctl}<i class="sp"></i><span><i class="dot" id="ph"></i>Điện thoại</span>${B('pair','Ghép nối')}${B('s-theme','Nền: '+(theme==='dark'?'đen':'kem'))}${B('s-exit','Thoát','dng')}</nav>`;
 const ph2=$('#ph');if(ph2&&stat().phoneConnected)ph2.classList.add('on');tick()}
function pair(){if(!room)return;const base=location.origin+location.pathname,url=base+'?scan='+room.code+'#pair='+room.pairPin,link=base+'?scan='+room.code+'#pair='+room.pairKey;
 let qr='';try{const q=qrcode(0,'M');q.addData(link);q.make();qr=q.createSvgTag({cellSize:5,margin:3,scalable:true})}catch{}
 modal(`${qr}<div class="kv"><span>Lớp</span><b>${esc(cls(cur)?.name||'')}</b><span>Mã phòng</span><b>${room.code}</b><span>Mã PIN</span><b>${room.pairPin}</b><span>URL</span><b style="font-size:15px;letter-spacing:0">${esc(url)}</b></div>${location.protocol==='file:'?'<p class="err">Hãy mở trang qua địa chỉ https:// để điện thoại quét được.</p>':''}<div class="row"><button class="btn" data-act="copy" data-u="${esc(url)}">Sao chép URL</button><button class="btn pri" data-act="close">Đóng</button></div>`)}
function resume(){if(!room)return;try{NET.closeHost()}catch{}room=null;clearInterval(pollId);clearInterval(timerId)}
/* ---------- Điện thoại quét thẻ ---------- */
const SCAN=new URLSearchParams(location.search).get('scan');
function beep(){try{const A=window.AudioContext||window.webkitAudioContext;beep.c=beep.c||new A();const o=beep.c.createOscillator(),g=beep.c.createGain();o.frequency.value=880;g.gain.value=.25;o.connect(g);g.connect(beep.c.destination);o.start();o.stop(beep.c.currentTime+.09)}catch{}}
function scanner(){let st=null,sKey='',code=SCAN,sess=null,tracker=null,busy=false,log=[];
 document.title='NDH · Quét thẻ';
 app.innerHTML=head('Quét thẻ',`<span id="cn">Đang kết nối…</span>`)+`<main class="wrap"><div id="pf" class="box" hidden><label>Mã phòng<input type="text" id="pc" inputmode="numeric" value="${esc(code||'')}"></label><label>Mã PIN<input type="text" id="pp" inputmode="numeric"></label><button class="btn pri" data-act="sjoin">Kết nối</button></div><div class="vid"><video id="v" playsinline muted></video><canvas id="ov"></canvas></div><div class="row"><button class="btn pri" data-act="scam">Bật camera</button></div><div id="sq" class="box"><div class="muted">Chưa có câu hỏi.</div></div><div id="sl" class="muted"></div></main>`;
 const msg=t=>$('#cn').textContent=t,v=$('#v'),ov=$('#ov'),fc=document.createElement('canvas'),fx=fc.getContext('2d',{willReadFrequently:true});
 function show(s){st=s;const q=s.currentQuestion;$('#sq').innerHTML=!q||s.phase==='lobby'?'<div class="muted">Chờ giáo viên bắt đầu.</div>':`<div><b>Câu ${s.index+1}/${s.questionCount}</b>${s.phase==='question'?'':' · '+(s.phase==='paused'?'tạm dừng':'đã đóng')}</div><div style="font-size:20px">${md(q.text)}</div>`;if(s.phase!=='question')tracker?.reset()}
 async function join(pk){try{const r=await NET.api('/rooms/'+code+'/join','POST',{pairKey:pk},'');sKey=r.scannerKey;try{sessionStorage.setItem('ndh-pair-'+code,pk)}catch{}history.replaceState(null,'',location.pathname+location.search);$('#pf').hidden=true;msg('Đã kết nối');show(r.state)}catch(e){msg(e.message);$('#pf').hidden=false}}
 window.addEventListener('portable-state',e=>show(e.detail.state));
 window.addEventListener('portable-disconnected',()=>{msg('Mất kết nối, đang thử lại…');setTimeout(()=>{const pk=sessionStorage.getItem('ndh-pair-'+code);if(pk)join(pk)},2500)});
 setInterval(async()=>{if(!sKey)return;try{show((await NET.api('/rooms/'+code+'?role=scanner','GET',null,sKey)).state)}catch{}},2000);
 async function send(fresh){if(busy)return;busy=true;const qid=st.currentQuestion.id,batch=fresh.map(d=>({id:d.id,answer:d.answer}));
  try{const r=await NET.api('/rooms/'+code+'/answers','POST',{questionId:qid,batch},sKey),ok=MobileCamera.acknowledged(batch,r.state,code,qid);if(ok.length){beep();ok.forEach(a=>log.unshift(`${r.state.players.find(p=>p.id===a.id)?.name||a.id}: ${a.answer}`));log=log.slice(0,6);$('#sl').innerHTML=log.map(esc).join('<br>')}}catch(e){msg(e.message)}busy=false}
 function loop(){if(!sess?.stream)return;if(st?.phase==='question'&&v.videoWidth){const z=MobileCamera.frameSize(v.videoWidth,v.videoHeight,800),w=z.width,h=z.height;fc.width=ov.width=w;fc.height=ov.height=h;fx.drawImage(v,0,0,w,h);
   const found=CardMarkers.detect(fx.getImageData(0,0,w,h)),g=ov.getContext('2d');g.clearRect(0,0,w,h);g.lineWidth=4;g.strokeStyle='#2F54D0';
   const ok=found.filter(d=>{const p=st.players.find(p=>p.id===d.id);g.beginPath();d.corners.forEach((c,i)=>i?g.lineTo(c.x,c.y):g.moveTo(c.x,c.y));g.closePath();g.stroke();return p&&p.alive&&MobileCamera.allowed(d.answer,st.currentQuestion.type)&&CardMarkers.assess(d,w,h,36).ok});
   const fresh=tracker.observe(ok,performance.now());if(fresh.length)send(fresh)}
  setTimeout(loop,120)}
 window.ndhScan={join,cam:async()=>{try{sess=sess||new MobileCamera.Session({onInterrupted:msg});await sess.open(v,{facingMode:'environment'});tracker=CardMarkers.createTracker({stableReads:3,minStableMs:400});loop();msg(sKey?'Đã kết nối':'Chưa kết nối')}catch(e){msg(MobileCamera.message(e))}},manual:()=>{code=$('#pc').value.trim();join($('#pp').value.trim())}};
 const pk=new URLSearchParams(location.hash.slice(1)).get('pair')||(()=>{try{return sessionStorage.getItem('ndh-pair-'+code)}catch{return''}})();
 if(pk)join(pk);else{$('#pf').hidden=false;msg('Nhập mã phòng và PIN')}}
/* ---------- Sự kiện ---------- */
document.addEventListener('input',e=>{const f=e.target.dataset?.f;if(!f)return;const c=cls(cur);
 if(f==='teacher')D.teacher=e.target.value;else if(c){if(f==='cname')c.name=e.target.value;else if(f==='csub')c.subject=e.target.value;else if(f==='names'){c.names=e.target.value;$('#cnt').textContent=list(c).length+' học sinh'}else if(f==='md'){c.md=e.target.value;const p=parse(c.md,c.sec||30),n=$('#qst');n.className=p.err.length?'err':'muted';n.textContent=p.err.join('\n')||p.qs.length+' câu hợp lệ'}else if(f==='sec')c.sec=Math.min(600,Math.max(5,+e.target.value||30));else if(f==='elim')c.elim=e.target.checked}save()});
$('#fmd').onchange=async e=>{const f=e.target.files[0];if(f&&cls(cur)){cls(cur).md=await f.text();save();klass(cur);toast('Đã nhập câu hỏi.')}e.target.value=''};
$('#fjson').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const d=JSON.parse(await f.text());if(!d||!Array.isArray(d.classes))throw 0;D=d;D.teacher=D.teacher||'';save();home();toast('Đã nhập dữ liệu.')}catch{toast('Tệp sao lưu không hợp lệ.')}};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id,c=cls(cur);
 switch(a){
 case'home':home();break;case'open':klass(id);break;
 case'add':D.classes.push({id:'c'+Date.now().toString(36),name:'Lớp mới',subject:'',names:'',md:'',sec:30,elim:false,results:[]});save();klass(D.classes.at(-1).id);break;
 case'print':printCards(c);break;case'imd':$('#fmd').click();break;
 case'emd':dl((c.name||'lop')+'-cau-hoi.md',new Blob([c.md||''],{type:'text/markdown'}));break;
 case'xall':xlsx(D.classes);break;case'xone':if(c)xlsx([c]);break;
 case'bk':dl('NDH-sao-luu.json',new Blob([JSON.stringify(D)],{type:'application/json'}));break;case'rs':$('#fjson').click();break;
 case'delr':if(confirm('Xóa kết quả này?')){c.results.splice(+b.dataset.i,1);save();klass(cur)}break;
 case'start':start();break;
 case'pair':pair();break;case'close':modal('');break;
 case'copy':try{await navigator.clipboard.writeText(b.dataset.u);toast('Đã sao chép URL.')}catch{toast('Không sao chép được. Hãy chọn và sao chép thủ công.')}break;
 case's-go':act('start');break;case's-pause':act('pause');break;case's-resume':act('resume');break;case's-reveal':act('reveal');break;case's-next':act('next');break;
 case's-reset':act('reset');savedCode='';break;
 case's-theme':theme=theme==='dark'?'cream':'dark';localStorage.setItem('ndh-theme',theme);stage();break;
 case's-exit':if(confirm('Thoát khỏi bài kiểm tra?')){resume();klass(cur)}break;
 case's-rescue':{const d=room.players.filter(p=>!p.alive);modal(`<h2>Cứu hộ</h2>${d.length?d.map(p=>`<label class="chk"><input type="checkbox" value="${p.id}">${esc(p.name)}</label>`).join(''):'<p>Không có học sinh bị loại.</p>'}<div class="row"><button class="btn pri" data-act="rescue-ok">Cứu những em đã chọn</button><button class="btn" data-act="close">Đóng</button></div>`);break}
 case'rescue-ok':{const ids=[...document.querySelectorAll('.dlg input:checked')].map(x=>+x.value);modal('');if(ids.length)act('rescue',{ids});break}
 case'scam':window.ndhScan.cam();break;case'sjoin':window.ndhScan.manual();break}});
if(SCAN)scanner();else home();
})();
