(function(){
  function render(){
    var A=window.ASSETS; if(!A){ return setTimeout(render,50) }
    var body=document.getElementById('asBody'); if(!body) return
    var ids=Object.keys(A), n=0
    ids.forEach(function(id){
      var a=A[id], inst=window.placeAsset(id,0,0)
      var tr=document.createElement('tr'); tr.className='rr'
      var scale=Math.min(1, 86/Math.max(a.w,a.h))
      var td1=document.createElement('td'); td1.className='c-num2'
      var box=document.createElement('div')
      box.style.cssText='width:92px;height:92px;display:flex;align-items:flex-end;justify-content:center;background:#efece5;border:1px solid #e7e5e4;border-radius:2px'
      var cv=document.createElement('canvas')
      cv.width=a.w; cv.height=a.h
      cv.style.width=(a.w*scale)+'px'; cv.style.height=(a.h*scale)+'px'
      cv.style.imageRendering='pixelated'
      cv.getContext('2d').drawImage(inst.cv,0,0)
      box.appendChild(cv); td1.appendChild(box)
      var td2=document.createElement('td'); td2.className='c-sn'
      td2.innerHTML='<b>'+a.name+'</b><br><code style="font-size:10px;color:#a8a29e">'+id+'</code>'
      var td3=document.createElement('td'); td3.className='c-sd'; td3.textContent=a.cat
      var td4=document.createElement('td'); td4.className='c-num'; td4.textContent=a.w+'×'+a.h
      var td5=document.createElement('td'); td5.className='c-line'
      var sc=(a.scope==='character')?'<b style="color:#96773a">character</b>':'<span style="color:#5a8f7b">generic</span>'
      td5.innerHTML=sc+' · <code style="font-size:10.5px">['+a.foot.join(', ')+']</code> · baseY '+a.base
        +'<br><span style="color:#78716c">'+a.tags.join(' · ')+(a.light?' · <b>自带光源</b>':'')+(a.sit?' · <b>可坐</b>':'')+(a.repeat?' · <b>可拼接</b>':'')+'</span>'
      ;[td1,td2,td3,td4,td5].forEach(function(t){tr.appendChild(t)})
      body.appendChild(tr); n++
    })
    var c=document.getElementById('asCount'); if(c) c.textContent=n+' 素材'
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render()
})()