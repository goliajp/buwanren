(function(){
  function draw(){
    if(!window.actorSprite) return setTimeout(draw,80)
    var host=document.getElementById('lieSheet'); if(!host) return
    var specs=[['sleepv',false,'仰卧 sleepv'],['sleepv2',false,'仰卧·帧2'],
               ['sleepside',false,'侧卧 sleepside'],['sleepside',true,'侧卧 · flip']]
    specs.forEach(function(sp){
      var wrap=document.createElement('div')
      wrap.style.cssText='text-align:center'
      var box=document.createElement('div')
      box.style.cssText='background:#8a9ab8;border:1px solid #d6d3d1;border-radius:2px;padding:10px 14px'
      var spr=window.actorSprite('ayun',sp[0],sp[1])
      var cv=document.createElement('canvas'); cv.width=spr.width; cv.height=spr.height
      cv.style.cssText='width:'+(spr.width*0.42)+'px;image-rendering:pixelated;display:block'
      cv.getContext('2d').drawImage(spr,0,0)
      box.appendChild(cv); wrap.appendChild(box)
      var cap=document.createElement('div')
      cap.style.cssText='font-family:var(--f-mono);font-size:9.5px;color:#78716c;letter-spacing:.06em;padding-top:6px'
      cap.textContent=sp[2]; wrap.appendChild(cap)
      host.appendChild(wrap)
    })
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',draw); else draw()
})()