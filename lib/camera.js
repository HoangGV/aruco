
/* Camera lifecycle shared by Android Chrome and iOS Safari. No image is uploaded. */
(function(root){'use strict';
function platform(nav=root.navigator){const ua=nav?.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&nav?.maxTouchPoints>1);return{ios,android:/Android/i.test(ua),embedded:/FBAN|FBAV|Instagram|Zalo|Line\//i.test(ua),browser:ios?'Safari':'Chrome'};}
function message(error){switch(error?.name){case'NotAllowedError':case'SecurityError':return'Chưa được cấp quyền camera. Mở bằng Safari trên iPhone hoặc Chrome trên Android, cho phép camera cho trang này rồi bấm Bật camera lại.';case'NotReadableError':case'AbortError':return'Camera đang bận hoặc bị gián đoạn. Đóng ứng dụng đang dùng camera rồi bấm Bật camera lại.';case'NotFoundError':return'Không tìm thấy camera. Kiểm tra quyền và thử camera khác.';case'OverconstrainedError':return'Camera không đáp ứng thiết lập. Chọn Tự chọn camera sau rồi thử lại.';default:return error?.message||'Chưa mở được camera. Hãy thử lại.';}}
function frameSize(width,height,longEdge=960){const scale=Math.min(1,longEdge/Math.max(width,height));return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
class Session{
 constructor({nav=root.navigator,onInterrupted=()=>{}}={}){this.nav=nav;this.onInterrupted=onInterrupted;this.serial=0;this.stream=null;this.video=null;this.listeners=[];this.muteTimer=null;}
 close(){this.serial++;clearTimeout(this.muteTimer);for(const [t,n,f]of this.listeners)t.removeEventListener?.(n,f);this.listeners=[];const stream=this.stream;this.stream=null;if(this.video){try{this.video.pause()}catch{}this.video.srcObject=null}this.video=null;stream?.getTracks().forEach(t=>t.stop());}
 async open(video,{deviceId='',facingMode='environment'}={}){
  this.close();const serial=this.serial;
  if(!this.nav?.mediaDevices?.getUserMedia)throw Error('Mở cùng đường dẫn HTTPS bằng Safari trên iPhone hoặc Chrome trên Android để dùng camera.');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;for(const a of ['muted','playsinline','webkit-playsinline','autoplay'])video.setAttribute(a,'');
  const preferred={...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:facingMode}}),width:{ideal:1280},height:{ideal:720},frameRate:{ideal:15,max:24}};
  let stream;
  try{stream=await this.nav.mediaDevices.getUserMedia({audio:false,video:preferred})}catch(e){if(!['OverconstrainedError','NotFoundError'].includes(e.name))throw e;if(serial!==this.serial)throw Error('Đã dừng yêu cầu camera.');stream=await this.nav.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode}}});}
  if(serial!==this.serial){stream.getTracks().forEach(t=>t.stop());throw Error('Đã dừng yêu cầu camera.');}
  this.stream=stream;this.video=video;video.srcObject=stream;
  let timer;
  try{await Promise.race([Promise.resolve(video.play()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Camera chưa phát hình. Bấm Bật camera lại; trên iPhone hãy dùng Safari.')),8000)})]);if(serial!==this.serial)throw Error('Đã dừng yêu cầu camera.');}
  catch(e){if(serial===this.serial)this.close();throw e}finally{clearTimeout(timer)}
  const track=stream.getVideoTracks()[0];if(!track){this.close();throw Error('Camera không cung cấp hình ảnh.');}
  const interrupt=()=>{if(serial===this.serial){this.close();this.onInterrupted('Camera bị gián đoạn. Bấm Tiếp tục camera để mở lại.')}};
  for(const[n,f]of [['ended',interrupt],['mute',()=>{clearTimeout(this.muteTimer);this.muteTimer=setTimeout(interrupt,2500)}],['unmute',()=>clearTimeout(this.muteTimer)]]){track.addEventListener?.(n,f);this.listeners.push([track,n,f]);}
  const capabilities=track.getCapabilities?.()||{};
  // These extensions are optional; an unsupported camera must still work.
  for(const key of ['focusMode','exposureMode','whiteBalanceMode'])if(capabilities[key]?.includes?.('continuous'))try{await track.applyConstraints({advanced:[{[key]:'continuous'}]})}catch{}
  if(serial!==this.serial)throw Error('Đã dừng yêu cầu camera.');
  let devices=[];try{devices=(await this.nav.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput')}catch{}
  return{stream,track,capabilities,devices,settings:track.getSettings?.()||{}};
 }
 async setting(key,value){const track=this.stream?.getVideoTracks()[0],caps=track?.getCapabilities?.()||{};if(!track||!track.applyConstraints)throw Error('Camera không hỗ trợ điều chỉnh này.');if(key==='torch'&&caps.torch!==true)throw Error('Camera này không hỗ trợ đèn.');if(key==='zoom'){if(!caps.zoom)throw Error('Camera này không hỗ trợ zoom.');value=Math.max(caps.zoom.min,Math.min(caps.zoom.max,Number(value)));}await track.applyConstraints({advanced:[{[key]:value}]});return track.getSettings?.()||{};}
}
function answerLabel(answer,type){return type==='tf'?(answer==='A'?'A · ĐÚNG':answer==='B'?'B · SAI':'KHÔNG HỢP LỆ · '+answer):answer;}
function allowed(answer,type){return typeof answer==='string'&&answer.length===1&&(type==='tf'?'AB':'ABCD').includes(answer);}
function acknowledged(batch,state,code,questionId){if(!state||state.code!==code||state.currentQuestion?.id!==questionId)return[];return batch.filter(a=>state.submissions?.[a.id]===a.answer);}
root.MobileCamera={Session,platform,message,frameSize,answerLabel,allowed,acknowledged};
})(typeof window==='undefined'?globalThis:window);

