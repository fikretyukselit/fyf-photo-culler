/** Build a single-file, offline tutorial from the captured UI chapters. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs",
);
const chapters = JSON.parse(
  await fs.readFile(path.join(docs, "demo/chapters.json"), "utf8"),
);
for (const chapter of chapters) {
  chapter.image =
    "data:image/jpeg;base64," +
    (await fs.readFile(path.join(docs, "demo", chapter.image))).toString(
      "base64",
    );
}
const payload = JSON.stringify(chapters).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>FYF Photo Culler · Interactive guide</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#edf0f2;background:#141617;font-synthesis:none;--muted:#a4a9ae;--accent:#edbd64;--border:#35393c}
*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer}button:disabled{cursor:default;opacity:.4}button:focus-visible{outline:2px solid var(--accent);outline-offset:4px}a{color:var(--accent)}
header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 36px;border-bottom:1px solid var(--border)}.brand{font-size:15px;font-weight:650;letter-spacing:-.02em}.brand span{color:var(--muted);font-weight:400;margin-left:10px}.tag{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
main{max-width:1600px;margin:auto;padding:36px;display:grid;grid-template-columns:260px minmax(0,1fr);gap:36px}.intro{margin-bottom:30px}.eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}h1{font-size:32px;line-height:1.12;letter-spacing:-.04em;margin:0 0 14px;font-weight:600}.intro p:last-child{font-size:14px;line-height:1.6;color:var(--muted);margin:0}
nav{display:grid;gap:7px}.chapter{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:transparent;color:var(--muted);border:1px solid transparent;border-radius:9px;padding:11px 12px;font-size:13px;line-height:1.45}.chapter:hover{background:#222629;color:#fff}.chapter[aria-current=step]{background:#2b2923;border-color:#5b4b30;color:#f6e1b6}.number{font-size:11px;opacity:.65;font-variant-numeric:tabular-nums}
.stage{min-width:0}.screen{background:#0b0d0e;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 16px 50px #0003;aspect-ratio:1280/900;position:relative}.screen img{display:block;width:100%;height:100%;object-fit:contain}.controls{display:flex;align-items:center;gap:10px;margin-top:18px}.control{min-height:40px;border:1px solid var(--border);border-radius:8px;color:#e4e6e8;background:#222629;padding:8px 15px;font-size:13px}.control:hover:not(:disabled){border-color:#777}.primary{background:var(--accent);border-color:var(--accent);color:#241c0f;font-weight:600;min-width:94px}.counter{margin-left:auto;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.timeline{display:flex;gap:6px;margin:18px 0 22px}.segment{height:3px;flex:1;background:#34383b;border-radius:4px}.segment.done{background:var(--accent)}.caption h2{font-size:18px;letter-spacing:-.02em;margin:0 0 8px;font-weight:550}.caption p{color:var(--muted);font-size:14px;line-height:1.6;margin:0}.hint{font-size:12px;color:#979da3;margin-top:22px;line-height:1.7}kbd{font-family:inherit;font-size:11px;padding:2px 6px;border:1px solid #454a4e;border-radius:4px;color:#c6cbd0}.note{margin-top:28px;padding-top:20px;border-top:1px solid var(--border);font-size:12px;line-height:1.7;color:#92999e}footer{max-width:1600px;margin:0 auto;padding:0 36px 26px;font-size:11px;color:#828a90}
@media(min-width:1500px){main{grid-template-columns:280px minmax(0,1fr);gap:48px}}
@media(max-width:900px){header{padding:20px}main{padding:24px 20px;grid-template-columns:1fr;gap:24px}h1{font-size:28px}.intro{margin-bottom:20px}nav{grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.chapter{padding:10px 0;justify-content:center}.chapter .label{display:none}.number{font-size:13px;opacity:1}.note{display:none}footer{padding:0 20px 24px}.screen{border-radius:8px}.tag{display:none}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<header><div class="brand">FYF <span>Photo Culler</span></div><div class="tag">A guided look at the workspace</div></header>
<main>
<aside>
<div class="intro"><p class="eyebrow">From camera card to selection</p><h1>Find the frames<br>worth keeping.</h1><p>Seven steps through a real competition photo session. Explore at your own pace.</p></div>
<nav aria-label="Tutorial chapters" id="chapters"></nav>
<p class="note">373 real FRC photographs.<br>Actual analysis scores and interface captures. Demo decisions and export are simulated; no source files are changed. This guide works entirely offline.</p>
</aside>
<section class="stage" aria-label="Interactive walkthrough">
<div class="screen"><img id="screen" alt="" width="1280" height="900"></div>
<div class="controls"><button class="control" id="previous" aria-label="Previous chapter">← Back</button><button class="control primary" id="play" aria-pressed="false">Play</button><button class="control" id="next" aria-label="Next chapter">Next →</button><span class="counter" id="counter"></span></div>
<div class="timeline" id="timeline" aria-hidden="true"></div>
<div class="caption" aria-live="polite" aria-atomic="true"><h2 id="title"></h2><p id="description"></p></div>
<p class="hint"><kbd>←</kbd> <kbd>→</kbd> Change chapter &nbsp; <kbd>Space</kbd> Play / pause &nbsp; · &nbsp; Playback stops at the last step.</p>
</section>
</main>
<footer>Fikret Yuksel Foundation · Photo Culler · Interactive guide</footer>
<script type="application/json" id="data">${payload}</script>
<script>
const chapters=JSON.parse(document.getElementById('data').textContent);
const $=id=>document.getElementById(id);
const labels=['Import your photos','Review the contact sheet','Inspect a frame','Open the large view','Compare similar shots','Check the export','Finish your selection'];
let index=0,playing=false,timer=null;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
chapters.forEach((chapter,i)=>{
 const button=document.createElement('button');button.className='chapter';button.setAttribute('aria-label',(i+1)+'. '+labels[i]);
 const number=document.createElement('span');number.className='number';number.textContent=String(i+1).padStart(2,'0');
 const label=document.createElement('span');label.className='label';label.textContent=labels[i];button.append(number,label);button.onclick=()=>go(i);$('chapters').append(button);
 const segment=document.createElement('span');segment.className='segment';$('timeline').append(segment);
 const image=new Image();image.src=chapter.image;
});
function stop(){playing=false;clearTimeout(timer);timer=null;$('play').textContent='Play';$('play').setAttribute('aria-pressed','false');}
function render(){
 const chapter=chapters[index];$('screen').src=chapter.image;$('screen').alt=chapter.title+'. '+chapter.description;
 $('title').textContent=chapter.title;$('description').textContent=chapter.description;$('counter').textContent=(index+1)+' / '+chapters.length;
 $('previous').disabled=index===0;$('next').disabled=index===chapters.length-1;
 [...$('chapters').children].forEach((el,i)=>{if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 [...$('timeline').children].forEach((el,i)=>el.classList.toggle('done',i<=index));
}
function go(i){stop();index=Math.max(0,Math.min(chapters.length-1,i));render();}
function advance(){timer=setTimeout(()=>{if(index<chapters.length-1){index++;render();}if(index===chapters.length-1)stop();else advance();},5000);}
function toggle(){if(playing){stop();return;}if(index===chapters.length-1){index=0;render();}playing=true;$('play').textContent='Pause';$('play').setAttribute('aria-pressed','true');advance();}
$('previous').onclick=()=>go(index-1);$('next').onclick=()=>go(index+1);$('play').onclick=toggle;
document.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey)return;if(e.key==='ArrowRight'){e.preventDefault();go(index+1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);}else if(e.key==='Home'){e.preventDefault();go(0);}else if(e.key==='End'){e.preventDefault();go(chapters.length-1);}else if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();toggle();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
motion.addEventListener('change',()=>{if(motion.matches)stop();});
render(); // Start paused, including when reduced motion is requested.
</script>
</body>
</html>`;
await fs.writeFile(path.join(docs, "tutorial.html"), html);
console.log("Built docs/tutorial.html — self-contained, no network requests.");
