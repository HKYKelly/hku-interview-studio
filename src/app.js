import {topics} from './data/curriculum.js';
import {interviews} from './data/interviews.js';

const root=document.querySelector('#app');
const KEY='hku-study-v1';
let storageError='';
let saved={answers:{},notes:{},interview:{},lastTopic:topics[0].id};
try { const data=JSON.parse(localStorage.getItem(KEY)); if(data&&data.version===1) saved={...saved,...data,answers:data.answers||{},notes:data.notes||{},interview:data.interview||{}}; } catch {storageError='学习记录读取失败，本次可继续练习。';}
let category='全部', search='', reviewOnly=false, stage=0, questionIndex=0, selected=null, submitted=false, hints=0, guidedStep=0;
let program='全部', origin='全部', interviewId=interviews[0].id, followup=false;
let stream,recorder,recognition,audioURL,timer,seconds=0,sessionActive=false,recording=false,readGeneration=0,recordGeneration=0;
const escape=(text='')=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=t=>t.questions.filter(q=>saved.answers[q.id]?.passed).length;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify({...saved,version:1}));}catch{storageError='浏览器无法保存记录，请使用导出备份。';}};
const route=()=>location.hash.slice(1).split('/');
const button=(label,action,cls='',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
function shell(content,area='cards'){
 root.innerHTML=`<aside><div class="brand">▤ 赴港练习室<small>STUDY STUDIO</small></div><nav><a class="${area==='cards'?'active':''}" href="#cards">▱ 笔试题卡</a><a class="${area==='interview'?'active':''}" href="#interview">◉ 面试练习</a><a class="${area==='progress'?'active':''}" href="#progress">▥ 学习进度</a></nav><div class="sidebar-foot">四天，一题一步。<br>记录保存在当前浏览器<br>题目按你提供的面经考点编写</div></aside><main>${storageError?`<div class="error-notice">${escape(storageError)}</div>`:''}${content}<footer>练习题为教学改编，面经为考生回忆。题型与考试安排请以你的邀请为准。</footer></main>`;
}
function library(){
 const current=topics.find(t=>t.id===saved.lastTopic)||topics[0];
 const filtered=topics.filter(t=>(category==='全部'||t.category===category)&&(!reviewOnly||t.questions.some(q=>saved.answers[q.id]&&!saved.answers[q.id].passed))&&`${t.title}${t.principle}`.includes(search));
 shell(`<div class="top"><div><h1>把不会的，练成会的。</h1><p class="muted">先理解原理，再一步步做题。</p></div><a href="#topic/${current.id}">继续学习 ↗</a></div><div class="banner"><div><small>从一张题卡开始</small><h2>${escape(current.title)}</h2><p class="muted">原理讲解、分步引导，以及三道变式。</p></div><a href="#topic/${current.id}"><button class="primary">开始学习 →</button></a></div><div class="top"><input class="search" id="search" aria-label="搜索知识点" placeholder="搜索知识点…" value="${escape(search)}">${button(reviewOnly?'显示全部题卡':'只看需要复习','review',reviewOnly?'active':'')}</div><div class="filters" aria-label="知识分类">${['全部',...new Set(topics.map(t=>t.category))].map(c=>button(escape(c),'category',category===c?'active':'',`data-value="${c}"`)).join('')}</div><p class="muted">${filtered.length} 张题卡 · 每张 1 道基础题 + 3 道变式</p><div class="cards">${filtered.map(t=>`<button class="card" data-action="open-topic" data-value="${t.id}"><span class="label">${t.category}</span><h3>${t.title}</h3><small>${escape(t.principle.slice(0,40))}…</small><div class="card-bottom"><span class="bar"><i style="width:${count(t)*25}%"></i></span><span>${count(t)}/4 独立答对</span></div></button>`).join('')}</div>${filtered.length?'':'<div class="empty">没有匹配的题卡，试试其他分类或关键词。</div>'}`);
 document.querySelector('#search').addEventListener('input',e=>{const position=e.target.selectionStart;search=e.target.value;library();const input=document.querySelector('#search');input.focus();input.setSelectionRange(position,position);});
}
function resetQuestion(){selected=null;submitted=false;hints=0;}
function topicPage(){
 const t=topics.find(x=>x.id===route()[1]);if(!t){location.hash='cards';return;}
 saved.lastTopic=t.id;persist();
 const q=t.questions[stage===3?questionIndex:0];
 let body='';
 if(stage===0){body=`<h2>先理解这个原理</h2><p class="principle">${escape(t.principle)}</p><div class="formula">${escape(t.formula)}</div><h3 style="margin-top:25px">做题时，按这个顺序</h3><ol class="ordered">${t.steps.map(s=>`<li>${escape(s)}</li>`).join('')}</ol><div class="note">容易错在这里<br>${escape(t.trap)}</div>${button('我理解了，跟着做 →','next-stage','primary wide','style="margin-top:24px"')}`;}
 else if(stage===1){body=`<h2>跟着拆解一道题</h2><div class="question">${escape(q.prompt)}</div><p class="muted">先在草稿里尝试，再逐步展开提示。</p><ol class="ordered">${t.steps.slice(0,guidedStep+1).map(s=>`<li>${escape(s)}</li>`).join('')}</ol><textarea id="scratch" aria-label="草稿" placeholder="写下你的第一步、计算过程或代码…">${escape(saved.notes[t.id]||'')}</textarea>${guidedStep>=t.steps.length?`<div class="feedback"><strong>完整示范</strong><p>${escape(q.explanation)}</p></div>`:''}<div class="actions">${guidedStep<t.steps.length?button('展开下一步','guide','primary'):button('开始独立练习 →','next-stage','primary')}</div>`;}
 else {body=`<div class="top"><h2>${stage===2?'独立练习':`变式 ${questionIndex} / 3`}</h2><span class="muted">${stage===2?'基础题':'换一种情境，再试一次'}</span></div>${stage===3?`<div class="practice-nav">${[1,2,3].map(i=>button(`变式 ${i}${saved.answers[t.questions[i].id]?.passed?' ✓':''}`,'variant',questionIndex===i?'active':'',`data-value="${i}"`)).join('')}</div>`:''}<div class="question">${escape(q.prompt)}</div><div class="options">${q.options.map((o,i)=>`<button data-action="answer" data-value="${i}" class="option ${selected===i?'active':''} ${submitted&&i===q.answer?'correct':''} ${submitted&&i===selected&&i!==q.answer?'wrong':''}" ${submitted?'disabled':''}><b>${String.fromCharCode(65+i)}</b><span>${escape(o)}</span></button>`).join('')}</div>${hints?`<div class="note" style="margin-top:20px">${t.steps.slice(0,hints).map(escape).join('<br>')}</div>`:''}${submitted?`<div class="feedback ${selected===q.answer?'':'error'}" role="status"><strong>${selected===q.answer?(hints?'在提示下答对了，再独立做一次就能记为掌握。':'答对了，这题已记录。'):'我们把它拆开看。'}</strong><p>${escape(q.explanation)}</p>${selected===q.answer?'':'<p>接下来用三道变式检验同一个原理。</p>'}</div><div class="actions">${button('重新尝试','retry')}${stage===2?button('进入三道变式 →','variants','primary'):button(questionIndex<3?'下一道变式 →':'查看本卡进度','next-variant','primary')}</div>`:`<div class="actions">${button('提交答案','submit','primary',selected===null?'disabled':'')}${button('我不会，给我提示','hint')}${hints>=t.steps.length?button('看讲解并进入补练','solution'):''}</div>`}`;}
 shell(`<a class="back" href="#cards">← 返回题卡库</a><div class="top"><div><h1>${escape(t.title)}</h1><p class="source">${escape(t.source)}</p></div><span>${count(t)}/4 独立答对</span></div><div class="steps">${['理解原理','跟着做','独立练','变式巩固'].map((s,i)=>button(`${i+1} ${s}`,'stage',stage===i?'active':'',`data-value="${i}"`)).join('')}</div><div class="lesson-layout"><section class="panel">${body}</section><div class="sidebar-panel"><section class="panel"><h3>这一张，练到什么程度</h3><p>能解释原理，完成基础题，并独立答对三道变式。</p><div class="bar"><i style="width:${count(t)*25}%"></i></div><p>${count(t)===4?'✓ 本卡练习已完成':'提示后答对会保留练习记录，重新独立答对后计入进度。'}</p></section><section class="panel"><h3>遇到卡点时</h3><p>点“我不会”逐步展开方法，再查看完整讲解。三道变式始终可以从上方进入。</p></section></div></div>`);
 document.querySelector('#scratch')?.addEventListener('input',e=>{saved.notes[t.id]=e.target.value;persist();});
}
function interviewPage(){
 const filtered=interviews.filter(q=>(program==='全部'||q.program===program||q.program==='通用')&&(origin==='全部'||q.origin===origin));
 if(!filtered.some(q=>q.id===interviewId))interviewId=filtered[0]?.id;
 const q=interviews.find(q=>q.id===interviewId);
 shell(`<div class="top"><div><h1>面试练习</h1><p class="muted">先把想法说出来，再练清楚、具体的表达。</p></div><a href="#interview" target="_blank" rel="noopener">独立窗口 ↗</a></div><div class="filters">${['全部','CS','AI','ECIC'].map(p=>button(p,'program',program===p?'active':'',`data-value="${p}"`)).join('')}<select id="origin" aria-label="问题来源"><option value="全部">全部来源</option><option value="recalled" ${origin==='recalled'?'selected':''}>面经回忆</option><option value="inferred" ${origin==='inferred'?'selected':''}>推测追问</option></select></div><div class="interview-layout"><div class="question-list">${filtered.map(item=>`<button data-action="interview-select" data-value="${item.id}" class="${item.id===interviewId?'active':''}"><small>${item.program} · ${item.origin==='recalled'?'面经回忆':'推测追问'}</small>${escape(item.translation)}</button>`).join('')}</div><div>${q?`<section class="call"><span class="label">${followup?'推测追问':q.origin==='recalled'?'面经回忆 · 转述':'推测追问'}</span><div class="orb" id="orb">♩</div><p id="call-state" class="status" role="status">准备好后，开始英文语音练习</p><h2>${escape(followup?q.followUp:q.question)}</h2><p class="muted">${followup?'结合刚才的回答，继续展开。':escape(q.translation)}</p><div id="clock" class="muted">00:00</div><div class="actions">${button('开始语音练习','call','primary')}${button('只朗读问题','speak')}${button('结束回答','stop-record','','disabled')}${button('结束练习','end-call','','disabled')}</div></section><div class="panel" style="margin-top:20px"><label class="check"><input type="checkbox" id="transcribe">启用英文语音转写。浏览器可能将音频发送到其语音服务；也可以仅录音并手动整理。</label><p class="source">内置题库轮流提问与预设追问。录音仅在当前页面保留，可下载。转写可用性取决于浏览器与网络。</p><audio id="playback" controls hidden></audio><a id="download-audio" hidden>下载本段录音</a><label for="transcript"><h3>我的回答</h3></label><textarea id="transcript" placeholder="语音转写会显示在这里，也可以直接输入英文回答。">${escape(saved.interview[q.id]?.text||'')}</textarea><p class="saved" id="saved-status">文字自动保存在当前浏览器</p><div class="actions">${button('回答复盘','feedback','primary')}${button('练一道追问','followup')}${button('下一问 →','next-interview')}</div><div id="reflection"></div><details><summary>查看回答思路</summary><ul>${q.outline.map(s=>`<li>${escape(s)}</li>`).join('')}</ul></details><p class="source">${escape(q.source)}</p></div>`:'<div class="empty">这个筛选条件下还没有问题。</div>'}</div></div>`,'interview');
 document.querySelector('#origin').addEventListener('change',e=>{stopMedia();origin=e.target.value;followup=false;interviewPage();});
 document.querySelector('#transcript')?.addEventListener('input',saveTranscript);
}
function saveTranscript(){const field=document.querySelector('#transcript');if(field){saved.interview[interviewId]={...saved.interview[interviewId],text:field.value};persist();}}
function setStatus(message){const el=document.querySelector('#call-state');if(el)el.textContent=message;}
function callControls(){const start=document.querySelector('[data-action="call"]');if(start){start.disabled=sessionActive;document.querySelector('[data-action="stop-record"]').disabled=!recording;document.querySelector('[data-action="end-call"]').disabled=!sessionActive;document.querySelector('#orb').classList.toggle('recording',recording);}}
function stopMedia(){readGeneration++;recordGeneration++;window.speechSynthesis?.cancel();recognition?.stop();recognition=null;if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());stream=null;clearInterval(timer);recording=false;sessionActive=false;callControls();}
function speak(done){
 const q=interviews.find(x=>x.id===interviewId);if(!q)return;
 if(!('speechSynthesis' in window)){setStatus('当前浏览器无法朗读，请直接阅读屏幕题目。');done?.();return;}
 window.speechSynthesis.cancel();const generation=++readGeneration;
 const utterance=new SpeechSynthesisUtterance(followup?q.followUp:q.question);utterance.lang='en-US';utterance.rate=.88;
 const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;
 setStatus('正在读题…');utterance.onend=()=>{if(generation===readGeneration){setStatus('现在轮到你回答。');done?.();}};
 utterance.onerror=()=>{if(generation===readGeneration){setStatus('朗读不可用，可以阅读题目后回答。');done?.();}};
 window.speechSynthesis.speak(utterance);
}
async function startCall(){
 stopMedia();if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}const generation=recordGeneration;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('当前环境不支持录音，请用浏览器打开 localhost 或 HTTPS 页面，也可输入回答。');return;}
 sessionActive=true;callControls();setStatus('正在请求麦克风权限…');
 try{const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(generation!==recordGeneration){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;speak(()=>beginRecord());}
 catch(error){sessionActive=false;callControls();setStatus(error.name==='NotAllowedError'?'麦克风权限未开启。可以允许麦克风后重试，或直接输入回答。':'麦克风暂时不可用，请检查设备后重试。');}
}
function beginRecord(){
 if(!stream||!sessionActive)return;
 const chunks=[];const generation=recordGeneration;const qid=interviewId;
 try{recorder=new MediaRecorder(stream);}catch{stopMedia();setStatus('浏览器无法启动录音，可以使用文字回答。');return;}
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{if(qid!==interviewId||route()[0]!=='interview')return;const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(blob);const audio=document.querySelector('#playback');if(audio){audio.src=audioURL;audio.hidden=false;const link=document.querySelector('#download-audio');link.href=audioURL;link.download=`interview-${qid}.${blob.type.includes('mp4')?'mp4':'webm'}`;link.hidden=false;}};
 recorder.start();recording=true;seconds=0;callControls();setStatus('正在录音 · 回答完成后点“结束回答”');
 timer=setInterval(()=>{seconds++;const el=document.querySelector('#clock');if(el)el.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;},1000);
 if(document.querySelector('#transcribe').checked){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){setStatus('正在录音 · 当前浏览器不支持转写，结束后可以回放。');return;}recognition=new Recognition();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{if(generation!==recordGeneration)return;const field=document.querySelector('#transcript');for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)field.value+=(field.value?' ':'')+e.results[i][0].transcript;}saveTranscript();};recognition.onerror=()=>setStatus('录音继续中 · 转写暂不可用，结束后可回放并整理文字。');try{recognition.start();}catch{setStatus('录音继续中 · 转写启动失败。');}}
}
function reflection(){saveTranscript();const q=interviews.find(q=>q.id===interviewId);const words=document.querySelector('#transcript').value.trim().split(/\s+/).filter(Boolean).length;document.querySelector('#reflection').innerHTML=`<div class="feedback"><h3>对照复盘</h3><p>当前文字约 ${words} 个词。逐项确认你实际回答的内容。</p>${q.outline.map((line,i)=>`<label class="check"><input type="checkbox" data-rubric="${i}" ${saved.interview[q.id]?.checks?.includes(i)?'checked':''}>${escape(line)}</label>`).join('')}<p class="source">这些是自评要点。此版本尚未接入语义评分或发音评分。</p></div>`;}
function progressPage(){const complete=topics.filter(t=>count(t)===4).length;const passed=topics.reduce((n,t)=>n+count(t),0);shell(`<div class="top"><div><h1>学习进度</h1><p class="muted">用独立作答，确认自己真的会了。</p></div>${button('导出学习记录','export')}</div><div class="summary"><div><strong>${complete}/${topics.length}</strong><small>完成题卡</small></div><div><strong>${passed}/${topics.length*4}</strong><small>独立答对</small></div><div><strong>${Object.keys(saved.interview).length}</strong><small>已练面试问题</small></div></div><section class="panel">${topics.map(t=>`<div class="progress-row"><div><a href="#topic/${t.id}">${escape(t.title)}</a><p class="source">${t.category}</p></div><span>${count(t)}/4 ${count(t)===4?'✓':''}</span></div>`).join('')}</section>`,'progress');}
function render(){const [page]=route();if(page==='topic')topicPage();else if(page==='interview')interviewPage();else if(page==='progress')progressPage();else library();}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action,value=el.dataset.value;
 const t=topics.find(t=>t.id===route()[1]);const q=t?.questions[stage===3?questionIndex:0];
 switch(action){
 case'category':category=value;library();break;
 case'review':reviewOnly=!reviewOnly;library();break;
 case'open-topic':location.hash=`topic/${value}`;break;
 case'stage':stage=Number(value);if(stage===3)questionIndex=1;resetQuestion();topicPage();break;
 case'next-stage':stage++;resetQuestion();topicPage();break;
 case'guide':guidedStep++;topicPage();break;
 case'answer':selected=Number(value);topicPage();break;
 case'hint':hints=Math.min(hints+1,t.steps.length);topicPage();break;
 case'solution':selected=null;hints=t.steps.length;
 case'submit':submitted=true;saved.answers[q.id]={passed:selected===q.answer&&hints===0,assisted:hints>0,attempts:(saved.answers[q.id]?.attempts||0)+1};persist();topicPage();break;
 case'retry':resetQuestion();topicPage();break;
 case'variants':stage=3;questionIndex=1;resetQuestion();topicPage();break;
 case'variant':questionIndex=Number(value);resetQuestion();topicPage();break;
 case'next-variant':if(questionIndex<3){questionIndex++;resetQuestion();topicPage();}else location.hash='progress';break;
 case'program':stopMedia();program=value;followup=false;interviewPage();break;
 case'interview-select':stopMedia();interviewId=value;followup=false;interviewPage();break;
 case'call':startCall();break;
 case'speak':if(recording){setStatus('请先结束回答，再朗读问题。');}else speak();break;
 case'stop-record':stopMedia();saveTranscript();setStatus('回答已结束，可以回放录音并复盘。');break;
 case'end-call':stopMedia();saveTranscript();setStatus('本轮练习已结束，文字已保存。');break;
 case'feedback':reflection();break;
 case'followup':stopMedia();followup=!followup;interviewPage();break;
 case'next-interview':{stopMedia();const pool=interviews.filter(q=>(program==='全部'||q.program===program||q.program==='通用')&&(origin==='全部'||q.origin===origin));interviewId=pool[(pool.findIndex(q=>q.id===interviewId)+1)%pool.length]?.id;followup=false;interviewPage();break;}
 case'export':{const url=URL.createObjectURL(new Blob([JSON.stringify({...saved,version:1},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='study-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
 }
});
document.addEventListener('change',e=>{if(e.target.matches('[data-rubric]')){const checks=[...document.querySelectorAll('[data-rubric]:checked')].map(el=>Number(el.dataset.rubric));saved.interview[interviewId]={...saved.interview[interviewId],checks};persist();}});
window.addEventListener('hashchange',()=>{stopMedia();stage=0;questionIndex=0;guidedStep=0;resetQuestion();render();window.scrollTo(0,0);});
window.addEventListener('beforeunload',()=>{stopMedia();if(audioURL)URL.revokeObjectURL(audioURL);});
render();
