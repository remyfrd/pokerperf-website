"use strict";(()=>{var f={fr:{pot:"Pot au milieu",bet:"Mise \xE0 suivre",required:"\xC9quit\xE9 requise",odds:"Cote du pot",ratioSuffix:"contre 1",need:t=>`Tu dois gagner au moins ${t} % du temps pour que suivre soit rentable.`,compare:"Compare \xE0 ton \xE9quit\xE9 (optionnel)",eqPct:"En %",eqOuts:"Via mes outs",outs:"Outs",street:"Cartes \xE0 venir",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:t=>`\xC9quit\xE9 estim\xE9e \u2248 ${t} % (r\xE8gle du 4 et 2)`,verdictCall:"PAYER",verdictFold:"COUCHER",ev:"EV du call",enterNums:"Entre un pot et une mise."},en:{pot:"Pot size",bet:"Bet to call",required:"Required equity",odds:"Pot odds",ratioSuffix:"to 1",need:t=>`You need to win at least ${t}% of the time for a call to be profitable.`,compare:"Compare to your equity (optional)",eqPct:"As %",eqOuts:"From my outs",outs:"Outs",street:"Cards to come",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:t=>`Estimated equity \u2248 ${t}% (rule of 4 and 2)`,verdictCall:"CALL",verdictFold:"FOLD",ev:"Call EV",enterNums:"Enter a pot and a bet."}};function M(t,$="fr"){var q;let e=(q=f[$])!=null?q:f.fr,l=n=>{let o=parseFloat(n.replace(",","."));return isFinite(o)?o:NaN};t.innerHTML=`
    <div class="pp-calc po">
      <div class="po-row">
        <label>${e.pot}<input type="number" min="0" step="any" id="po-pot" inputmode="decimal"></label>
        <label>${e.bet}<input type="number" min="0" step="any" id="po-bet" inputmode="decimal"></label>
      </div>
      <div class="po-out" id="po-out"></div>
      <fieldset class="po-eq">
        <legend>${e.compare}</legend>
        <div class="po-modes">
          <label><input type="radio" name="po-mode" value="pct" checked> ${e.eqPct}</label>
          <label><input type="radio" name="po-mode" value="outs"> ${e.eqOuts}</label>
        </div>
        <div class="po-row" id="po-eq-pct">
          <label>${e.required.replace(/requise|equity/i,"").trim()||"\xC9quit\xE9"} %<input type="number" min="0" max="100" step="any" id="po-eqv" inputmode="decimal"></label>
        </div>
        <div class="po-row" id="po-eq-outs" style="display:none;">
          <label>${e.outs}<input type="number" min="0" max="23" step="1" id="po-outs" inputmode="numeric"></label>
          <label>${e.street}<select id="po-street"><option value="4">${e.flop}</option><option value="2">${e.turn}</option></select></label>
        </div>
        <div class="po-verdict" id="po-verdict"></div>
      </fieldset>
    </div>`;let i=n=>t.querySelector("#"+n),v=t.querySelector("#po-out"),p=t.querySelector("#po-verdict"),y=t.querySelector("#po-eq-pct"),E=t.querySelector("#po-eq-outs");function u(){let n=t.querySelector('input[name="po-mode"]:checked');return n?n.value:"pct"}function d(){let n=l(i("po-pot").value),o=l(i("po-bet").value);if(y.style.display=u()==="pct"?"":"none",E.style.display=u()==="outs"?"":"none",!(n>=0)||!(o>0)){v.innerHTML=`<p class="calc">${e.enterNums}</p>`,p.innerHTML="";return}let a=o/(n+o+o)*100,L=(n+o)/o;v.innerHTML=`<div class="po-big"><span>${e.odds}</span><strong>${L.toFixed(1)} ${e.ratioSuffix}</strong></div><div class="po-big"><span>${e.required}</span><strong>${a.toFixed(1)} %</strong></div><p class="sub">${e.need(a.toFixed(1))}</p>`;let s=NaN,r="";if(u()==="pct")s=l(i("po-eqv").value);else{let b=l(i("po-outs").value),F=parseFloat(i("po-street").value);b>=0&&(s=Math.min(b*F,100),r=e.estEq(s.toFixed(0)))}if(!(s>=0)){p.innerHTML=r?`<p class="sub">${r}</p>`:"";return}let c=s>=a,g=s/100*(n+o)-(1-s/100)*o;p.innerHTML=(r?`<p class="sub">${r}</p>`:"")+`<div class="po-decision ${c?"ok":"no"}">${c?"\u2705 "+e.verdictCall:"\u274C "+e.verdictFold} <span>(${s.toFixed(1)} % ${c?"\u2265":"<"} ${a.toFixed(1)} %)</span></div><p class="sub">${e.ev} = ${g>=0?"+":""}${g.toFixed(1)}</p>`}t.querySelectorAll("input,select").forEach(n=>{n.addEventListener("input",d),n.addEventListener("change",d)}),d()}var m=typeof document!="undefined"&&document.getElementById("pot-odds");if(m){let t=m.dataset.lang==="en"?"en":"fr";M(m,t)}})();
