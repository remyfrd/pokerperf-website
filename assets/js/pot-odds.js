"use strict";(()=>{var f={fr:{pot:"Pot au milieu",bet:"Mise \xE0 suivre",required:"\xC9quit\xE9 requise",odds:"Cote du pot",ratioSuffix:"contre 1",need:e=>`Tu dois gagner au moins ${e} % du temps pour que suivre soit rentable.`,compare:"Compare \xE0 ton \xE9quit\xE9 (optionnel)",eqPct:"En %",eqOuts:"Via mes outs",outs:"Outs",street:"Cartes \xE0 venir",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:e=>`\xC9quit\xE9 estim\xE9e \u2248 ${e} % (r\xE8gle du 4 et 2)`,verdictCall:"PAYER",verdictFold:"COUCHER",ev:"EV du call",enterNums:"Entre un pot et une mise."},en:{pot:"Pot size",bet:"Bet to call",required:"Required equity",odds:"Pot odds",ratioSuffix:"to 1",need:e=>`You need to win at least ${e}% of the time for a call to be profitable.`,compare:"Compare to your equity (optional)",eqPct:"As %",eqOuts:"From my outs",outs:"Outs",street:"Cards to come",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:e=>`Estimated equity \u2248 ${e}% (rule of 4 and 2)`,verdictCall:"CALL",verdictFold:"FOLD",ev:"Call EV",enterNums:"Enter a pot and a bet."},es:{pot:"Bote en el centro",bet:"Apuesta a pagar",required:"Equity necesaria",odds:"Pot odds",ratioSuffix:"a 1",need:e=>`Tienes que ganar al menos el ${e} % de las veces para que pagar sea rentable.`,compare:"Compara con tu equity (opcional)",eqPct:"En %",eqOuts:"Con mis outs",outs:"Outs",street:"Cartas por salir",flop:"Flop \u2192 river (2)",turn:"River (1)",estEq:e=>`Equity estimada \u2248 ${e} % (regla del 4 y 2)`,verdictCall:"PAGAR",verdictFold:"FOLDEAR",ev:"EV del call",enterNums:"Introduce un bote y una apuesta."}};function M(e,$="fr"){var q;let t=(q=f[$])!=null?q:f.fr,a=s=>{let n=parseFloat(s.replace(",","."));return isFinite(n)?n:NaN};e.innerHTML=`
    <div class="pp-calc po">
      <div class="po-row">
        <label>${t.pot}<input type="number" min="0" step="any" id="po-pot" inputmode="decimal"></label>
        <label>${t.bet}<input type="number" min="0" step="any" id="po-bet" inputmode="decimal"></label>
      </div>
      <div class="po-out" id="po-out"></div>
      <fieldset class="po-eq">
        <legend>${t.compare}</legend>
        <div class="po-modes">
          <label><input type="radio" name="po-mode" value="pct" checked> ${t.eqPct}</label>
          <label><input type="radio" name="po-mode" value="outs"> ${t.eqOuts}</label>
        </div>
        <div class="po-row" id="po-eq-pct">
          <label>${t.required.replace(/requise|equity/i,"").trim()||"\xC9quit\xE9"} %<input type="number" min="0" max="100" step="any" id="po-eqv" inputmode="decimal"></label>
        </div>
        <div class="po-row" id="po-eq-outs" style="display:none;">
          <label>${t.outs}<input type="number" min="0" max="23" step="1" id="po-outs" inputmode="numeric"></label>
          <label>${t.street}<select id="po-street"><option value="4">${t.flop}</option><option value="2">${t.turn}</option></select></label>
        </div>
        <div class="po-verdict" id="po-verdict"></div>
      </fieldset>
    </div>`;let i=s=>e.querySelector("#"+s),v=e.querySelector("#po-out"),d=e.querySelector("#po-verdict"),E=e.querySelector("#po-eq-pct"),L=e.querySelector("#po-eq-outs");function p(){let s=e.querySelector('input[name="po-mode"]:checked');return s?s.value:"pct"}function c(){let s=a(i("po-pot").value),n=a(i("po-bet").value);if(E.style.display=p()==="pct"?"":"none",L.style.display=p()==="outs"?"":"none",!(s>=0)||!(n>0)){v.innerHTML=`<p class="calc">${t.enterNums}</p>`,d.innerHTML="";return}let l=n/(s+n+n)*100,F=(s+n)/n;v.innerHTML=`<div class="po-big"><span>${t.odds}</span><strong>${F.toFixed(1)} ${t.ratioSuffix}</strong></div><div class="po-big"><span>${t.required}</span><strong>${l.toFixed(1)} %</strong></div><p class="sub">${t.need(l.toFixed(1))}</p>`;let o=NaN,r="";if(p()==="pct")o=a(i("po-eqv").value);else{let b=a(i("po-outs").value),T=parseFloat(i("po-street").value);b>=0&&(o=Math.min(b*T,100),r=t.estEq(o.toFixed(0)))}if(!(o>=0)){d.innerHTML=r?`<p class="sub">${r}</p>`:"";return}let m=o>=l,g=o/100*(s+n)-(1-o/100)*n;d.innerHTML=(r?`<p class="sub">${r}</p>`:"")+`<div class="po-decision ${m?"ok":"no"}">${m?"\u2705 "+t.verdictCall:"\u274C "+t.verdictFold} <span>(${o.toFixed(1)} % ${m?"\u2265":"<"} ${l.toFixed(1)} %)</span></div><p class="sub">${t.ev} = ${g>=0?"+":""}${g.toFixed(1)}</p>`}e.querySelectorAll("input,select").forEach(s=>{s.addEventListener("input",c),s.addEventListener("change",c)}),c()}var u=typeof document!="undefined"&&document.getElementById("pot-odds"),y;if(u){let e=["en","es"].includes((y=u.dataset.lang)!=null?y:"")?u.dataset.lang:"fr";M(u,e)}})();
