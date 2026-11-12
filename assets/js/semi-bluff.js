"use strict";(()=>{var T={fr:{pot:"Pot au milieu",bet:"Ta mise",fe:"Chance qu'il se couche (fold equity, %)",eq:"Ton \xE9quit\xE9 si pay\xE9",eqPct:"En %",eqOuts:"Via mes outs",outs:"Outs",street:"Cartes \xE0 venir",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:s=>`\xC9quit\xE9 estim\xE9e \u2248 ${s} % (r\xE8gle du 4 et 2)`,evFold:"Gain s'il se couche",evCall:"EV s'il paie",evTotal:"EV du semi-bluff",feMin:"Fold equity minimale",evCheck:"Rep\xE8re : EV si tu checkes",good:"\u2705 Semi-bluff rentable, et meilleur que checker",okButCheck:"\u2696\uFE0F Rentable, mais checker rapporte un peu plus dans ce mod\xE8le",bad:s=>`\u274C Pas rentable : il faudrait qu'il se couche au moins ${s} % du temps`,enter:"Entre un pot, une mise et ta fold equity.",model:"Mod\xE8le simplifi\xE9 : un seul tour de mise, pas de relance, \xE9quit\xE9 r\xE9alis\xE9e s'il paie."},en:{pot:"Pot size",bet:"Your bet",fe:"Chance he folds (fold equity, %)",eq:"Your equity if called",eqPct:"As %",eqOuts:"From my outs",outs:"Outs",street:"Cards to come",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:s=>`Estimated equity \u2248 ${s}% (rule of 4 and 2)`,evFold:"Win when he folds",evCall:"EV when called",evTotal:"Semi-bluff EV",feMin:"Break-even fold equity",evCheck:"Benchmark: EV if you check",good:"\u2705 Profitable semi-bluff, and better than checking",okButCheck:"\u2696\uFE0F Profitable, but checking earns slightly more in this model",bad:s=>`\u274C Not profitable: he would need to fold at least ${s}% of the time`,enter:"Enter a pot, a bet and your fold equity.",model:"Simplified model: one betting round, no raise, equity realised when called."}};function L(s,p="fr"){var E;let t=(E=T[p])!=null?E:T.fr,l=e=>{let n=parseFloat(e.replace(",","."));return isFinite(n)?n:NaN};s.innerHTML=`
    <div class="pp-calc po">
      <div class="po-row">
        <label>${t.pot}<input type="number" min="0" step="any" id="sb-pot" inputmode="decimal"></label>
        <label>${t.bet}<input type="number" min="0" step="any" id="sb-bet" inputmode="decimal"></label>
      </div>
      <div class="po-row" style="margin-top:12px;">
        <label>${t.fe}<input type="number" min="0" max="100" step="any" id="sb-fe" inputmode="decimal"></label>
      </div>
      <fieldset class="po-eq">
        <legend>${t.eq}</legend>
        <div class="po-modes">
          <label><input type="radio" name="sb-mode" value="pct" checked> ${t.eqPct}</label>
          <label><input type="radio" name="sb-mode" value="outs"> ${t.eqOuts}</label>
        </div>
        <div class="po-row" id="sb-eq-pct"><label>%<input type="number" min="0" max="100" step="any" id="sb-eqv" inputmode="decimal"></label></div>
        <div class="po-row" id="sb-eq-outs" style="display:none;">
          <label>${t.outs}<input type="number" min="0" max="23" step="1" id="sb-outs" inputmode="numeric"></label>
          <label>${t.street}<select id="sb-street"><option value="4">${t.flop}</option><option value="2">${t.turn}</option></select></label>
        </div>
        <p class="sub" id="sb-est"></p>
      </fieldset>
      <div class="po-out" id="sb-out" aria-live="polite"></div>
      <p class="mode">${t.model}</p>
    </div>`;let i=e=>s.querySelector("#"+e),y=s.querySelector("#sb-out"),h=s.querySelector("#sb-est"),m=()=>{var e,n;return(n=(e=s.querySelector('input[name="sb-mode"]:checked'))==null?void 0:e.value)!=null?n:"pct"},b=(e,n=1)=>p==="fr"?e.toFixed(n).replace(".",","):e.toFixed(n),r=e=>(e>=0?"+":"")+b(e);function f(){i("sb-eq-pct").closest(".po-row").style.display=m()==="pct"?"":"none",s.querySelector("#sb-eq-outs").style.display=m()==="outs"?"":"none";let e=NaN;if(h.textContent="",m()==="pct")e=l(i("sb-eqv").value)/100;else{let c=l(i("sb-outs").value),g=parseFloat(i("sb-street").value);if(c>=0){let M=Math.min(c*g,100);e=M/100,h.textContent=t.estEq(M.toFixed(0))}}let n=l(i("sb-pot").value),v=l(i("sb-bet").value),u=l(i("sb-fe").value)/100;if(!(n>=0)||!(v>0)||!(u>=0&&u<=1)||!(e>=0&&e<=1)){y.innerHTML=`<p class="calc">${t.enter}</p>`;return}let o=e*(n+2*v)-v,d=u*n+(1-u)*o,k=o>=0?0:-o/(n-o)*100,$=e*n,a=(c,g)=>`<div class="po-big"><span>${c}</span><strong>${g}</strong></div>`,C=d<=0?t.bad(b(k)):d>=$?t.good:t.okButCheck;y.innerHTML=a(t.evTotal,r(d))+a(t.evFold,r(n))+a(t.evCall,r(o))+a(t.feMin,b(k)+(p==="fr"?" %":"%"))+a(t.evCheck,r($))+`<div class="po-decision ${d>0?"ok":"no"}">${C}</div>`}s.querySelectorAll("input,select").forEach(e=>{e.addEventListener("input",f),e.addEventListener("change",f)}),f()}var q=typeof document!="undefined"&&document.getElementById("semi-bluff");q&&L(q,q.dataset.lang==="en"?"en":"fr");})();
