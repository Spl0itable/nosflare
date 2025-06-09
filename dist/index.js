var Ne=Object.defineProperty;var i=(t,n)=>Ne(t,"name",{value:n,configurable:!0});var hn=(t,n)=>{for(var e in n)Ne(t,e,{get:n[e],enumerable:!0})};var Kt=class Kt{constructor(n,e){this.tokens=e,this.lastRefillTime=Date.now(),this.capacity=e,this.fillRate=n}removeToken(){return this.refill(),this.tokens<1?!1:(this.tokens-=1,!0)}refill(){let n=Date.now(),e=n-this.lastRefillTime,r=Math.floor(e*this.fillRate);this.tokens=Math.min(this.capacity,this.tokens+r),this.lastRefillTime=n}};i(Kt,"RateLimiter");var xt=Kt;var Z=!0,vt=2121,St={name:"Nosflare",description:"A serverless Nostr relay through Cloudflare Worker and D1 database",pubkey:"d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",contact:"lux@fed.wtf",supported_nips:[1,2,4,5,9,11,12,15,16,17,20,22,33,40],software:"https://github.com/Spl0itable/nosflare",version:"7.0.0",icon:"https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/flare.png",limitation:{payment_required:Z,restricted_writes:Z}},Ie={Luxas:"d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df"},Be=!1,Xt=!1,Ae=new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,40,41,42,43,44,64,818,1021,1022,1040,1059,1063,1311,1617,1621,1622,1630,1633,1971,1984,1985,1986,1987,2003,2004,2022,4550,5e3,5999,6e3,6999,7e3,9e3,9030,9041,9467,9734,9735,9802,1e4,10001,10002,10003,10004,10005,10006,10007,10009,10015,10030,10050,10063,10096,13194,21e3,22242,23194,23195,24133,24242,27235,3e4,30001,30002,30003,30004,30005,30007,30008,30009,30015,30017,30018,30019,30020,30023,30024,30030,30040,30041,30063,30078,30311,30315,30402,30403,30617,30618,30818,30819,31890,31922,31923,31924,31925,31989,31990,34235,34236,34237,34550,39e3,39001,39002,39003,39004,39005,39006,39007,39008,39009]),Oe=new Set(["3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f","fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058","e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18","05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01","53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"]),Yt=new Set([]),Re=new Set([1064]),Zt=new Set([]),_e=new Set(["~~ hello world! ~~"]),Le=new Set([]),Gt=new Set([]);var Jt={rate:100/6e4,capacity:100},Qt={rate:1e4/6e4,capacity:1e4};var Ft=class Ft{constructor(n,e){this.state=n;this.env=e;this.sessions=new Map,this.eventSubscriptions=new Map}async fetch(n){let e=n.headers.get("Upgrade");if(!e||e!=="websocket")return new Response("Expected Upgrade: websocket",{status:426});let r=new WebSocketPair,[s,o]=Object.values(r);return await this.handleSession(o),new Response(null,{status:101,webSocket:s})}async handleSession(n){n.accept();let e=crypto.randomUUID(),r={id:e,webSocket:n,subscriptions:new Map,pubkeyRateLimiter:new xt(Jt.rate,Jt.capacity),reqRateLimiter:new xt(Qt.rate,Qt.capacity),bookmark:"first-unconstrained"};this.sessions.set(e,r),n.addEventListener("message",async s=>{try{let o=JSON.parse(s.data);await this.handleMessage(r,o)}catch(o){console.error("Error handling message:",o),this.sendError(n,"Failed to process message")}}),n.addEventListener("close",()=>{this.handleClose(e)}),n.addEventListener("error",s=>{console.error("WebSocket error:",s),this.handleClose(e)})}async handleMessage(n,e){if(!Array.isArray(e)){this.sendError(n.webSocket,"Invalid message format: expected JSON array");return}let[r,...s]=e;switch(r){case"EVENT":await this.handleEvent(n,s[0]);break;case"REQ":await this.handleReq(n,e);break;case"CLOSE":this.handleCloseSubscription(n,s[0]);break;default:this.sendError(n.webSocket,`Unknown message type: ${r}`)}}async handleEvent(n,e){let s=await(await fetch(`https://${this.env.WORKER_HOST}/internal/process-event`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:e,sessionId:n.id})})).json();s.success&&await this.broadcastEvent(e),this.sendOK(n.webSocket,e.id,s.success,s.message)}async handleReq(n,e){let[r,s,...o]=e;if(!n.reqRateLimiter.removeToken()){this.sendClosed(n.webSocket,s,"rate-limited: slow down there chief");return}n.subscriptions.set(s,o);let a=await(await fetch(`https://${this.env.WORKER_HOST}/internal/query-events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filters:o,bookmark:n.bookmark})})).json();if(a.error){this.sendClosed(n.webSocket,s,a.error);return}a.bookmark&&(n.bookmark=a.bookmark);for(let c of a.events)n.webSocket.send(JSON.stringify(["EVENT",s,c]));this.sendEOSE(n.webSocket,s)}handleCloseSubscription(n,e){n.subscriptions.delete(e),n.webSocket.send(JSON.stringify(["CLOSED",e,"Subscription closed"]))}async broadcastEvent(n){for(let[e,r]of this.sessions)for(let[s,o]of r.subscriptions)if(this.matchesFilters(n,o))try{r.webSocket.send(JSON.stringify(["EVENT",s,n]))}catch(l){console.error(`Error broadcasting to session ${e}:`,l)}}matchesFilters(n,e){return e.some(r=>this.matchesFilter(n,r))}matchesFilter(n,e){if(e.ids&&!e.ids.includes(n.id)||e.authors&&!e.authors.includes(n.pubkey)||e.kinds&&!e.kinds.includes(n.kind)||e.since&&n.created_at<e.since||e.until&&n.created_at>e.until)return!1;for(let[r,s]of Object.entries(e))if(r.startsWith("#")&&Array.isArray(s)){let o=r.substring(1),l=n.tags.filter(a=>a[0]===o).map(a=>a[1]);if(!s.some(a=>l.includes(a)))return!1}return!0}handleClose(n){this.sessions.delete(n)}sendOK(n,e,r,s){n.send(JSON.stringify(["OK",e,r,s]))}sendError(n,e){n.send(JSON.stringify(["NOTICE",e]))}sendEOSE(n,e){n.send(JSON.stringify(["EOSE",e]))}sendClosed(n,e,r){n.send(JSON.stringify(["CLOSED",e,r]))}};i(Ft,"RelayWebSocket");var At=Ft;function Ce(t){if(!Number.isSafeInteger(t)||t<0)throw new Error(`positive integer expected, not ${t}`)}i(Ce,"number");function mn(t){return t instanceof Uint8Array||t!=null&&typeof t=="object"&&t.constructor.name==="Uint8Array"}i(mn,"isBytes");function gt(t,...n){if(!mn(t))throw new Error("Uint8Array expected");if(n.length>0&&!n.includes(t.length))throw new Error(`Uint8Array expected of length ${n}, not of length=${t.length}`)}i(gt,"bytes");function Ue(t){if(typeof t!="function"||typeof t.create!="function")throw new Error("Hash should be wrapped by utils.wrapConstructor");Ce(t.outputLen),Ce(t.blockLen)}i(Ue,"hash");function bt(t,n=!0){if(t.destroyed)throw new Error("Hash instance has been destroyed");if(n&&t.finished)throw new Error("Hash#digest() has already been called")}i(bt,"exists");function Pe(t,n){gt(t);let e=n.outputLen;if(t.length<e)throw new Error(`digestInto() expects output buffer of length at least ${e}`)}i(Pe,"output");var Ot=typeof globalThis=="object"&&"crypto"in globalThis?globalThis.crypto:void 0;var Rt=i(t=>new DataView(t.buffer,t.byteOffset,t.byteLength),"createView"),G=i((t,n)=>t<<32-n|t>>>n,"rotr");var Rr=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68;function gn(t){if(typeof t!="string")throw new Error(`utf8ToBytes expected string, got ${typeof t}`);return new Uint8Array(new TextEncoder().encode(t))}i(gn,"utf8ToBytes");function Tt(t){return typeof t=="string"&&(t=gn(t)),gt(t),t}i(Tt,"toBytes");function qe(...t){let n=0;for(let r=0;r<t.length;r++){let s=t[r];gt(s),n+=s.length}let e=new Uint8Array(n);for(let r=0,s=0;r<t.length;r++){let o=t[r];e.set(o,s),s+=o.length}return e}i(qe,"concatBytes");var te=class te{clone(){return this._cloneInto()}};i(te,"Hash");var yt=te,_r={}.toString;function De(t){let n=i(r=>t().update(Tt(r)).digest(),"hashC"),e=t();return n.outputLen=e.outputLen,n.blockLen=e.blockLen,n.create=()=>t(),n}i(De,"wrapConstructor");function _t(t=32){if(Ot&&typeof Ot.getRandomValues=="function")return Ot.getRandomValues(new Uint8Array(t));throw new Error("crypto.getRandomValues must be defined")}i(_t,"randomBytes");function bn(t,n,e,r){if(typeof t.setBigUint64=="function")return t.setBigUint64(n,e,r);let s=BigInt(32),o=BigInt(4294967295),l=Number(e>>s&o),a=Number(e&o),c=r?4:0,f=r?0:4;t.setUint32(n+c,l,r),t.setUint32(n+f,a,r)}i(bn,"setBigUint64");var He=i((t,n,e)=>t&n^~t&e,"Chi"),je=i((t,n,e)=>t&n^t&e^n&e,"Maj"),ee=class ee extends yt{constructor(n,e,r,s){super(),this.blockLen=n,this.outputLen=e,this.padOffset=r,this.isLE=s,this.finished=!1,this.length=0,this.pos=0,this.destroyed=!1,this.buffer=new Uint8Array(n),this.view=Rt(this.buffer)}update(n){bt(this);let{view:e,buffer:r,blockLen:s}=this;n=Tt(n);let o=n.length;for(let l=0;l<o;){let a=Math.min(s-this.pos,o-l);if(a===s){let c=Rt(n);for(;s<=o-l;l+=s)this.process(c,l);continue}r.set(n.subarray(l,l+a),this.pos),this.pos+=a,l+=a,this.pos===s&&(this.process(e,0),this.pos=0)}return this.length+=n.length,this.roundClean(),this}digestInto(n){bt(this),Pe(n,this),this.finished=!0;let{buffer:e,view:r,blockLen:s,isLE:o}=this,{pos:l}=this;e[l++]=128,this.buffer.subarray(l).fill(0),this.padOffset>s-l&&(this.process(r,0),l=0);for(let h=l;h<s;h++)e[h]=0;bn(r,s-8,BigInt(this.length*8),o),this.process(r,0);let a=Rt(n),c=this.outputLen;if(c%4)throw new Error("_sha2: outputLen should be aligned to 32bit");let f=c/4,p=this.get();if(f>p.length)throw new Error("_sha2: outputLen bigger than state");for(let h=0;h<f;h++)a.setUint32(4*h,p[h],o)}digest(){let{buffer:n,outputLen:e}=this;this.digestInto(n);let r=n.slice(0,e);return this.destroy(),r}_cloneInto(n){n||(n=new this.constructor),n.set(...this.get());let{blockLen:e,buffer:r,length:s,finished:o,destroyed:l,pos:a}=this;return n.length=s,n.pos=a,n.finished=o,n.destroyed=l,s%e&&n.buffer.set(r),n}};i(ee,"HashMD");var Lt=ee;var yn=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),ot=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),it=new Uint32Array(64),re=class re extends Lt{constructor(){super(64,32,8,!1),this.A=ot[0]|0,this.B=ot[1]|0,this.C=ot[2]|0,this.D=ot[3]|0,this.E=ot[4]|0,this.F=ot[5]|0,this.G=ot[6]|0,this.H=ot[7]|0}get(){let{A:n,B:e,C:r,D:s,E:o,F:l,G:a,H:c}=this;return[n,e,r,s,o,l,a,c]}set(n,e,r,s,o,l,a,c){this.A=n|0,this.B=e|0,this.C=r|0,this.D=s|0,this.E=o|0,this.F=l|0,this.G=a|0,this.H=c|0}process(n,e){for(let h=0;h<16;h++,e+=4)it[h]=n.getUint32(e,!1);for(let h=16;h<64;h++){let T=it[h-15],B=it[h-2],x=G(T,7)^G(T,18)^T>>>3,w=G(B,17)^G(B,19)^B>>>10;it[h]=w+it[h-7]+x+it[h-16]|0}let{A:r,B:s,C:o,D:l,E:a,F:c,G:f,H:p}=this;for(let h=0;h<64;h++){let T=G(a,6)^G(a,11)^G(a,25),B=p+T+He(a,c,f)+yn[h]+it[h]|0,w=(G(r,2)^G(r,13)^G(r,22))+je(r,s,o)|0;p=f,f=c,c=a,a=l+B|0,l=o,o=s,s=r,r=B+w|0}r=r+this.A|0,s=s+this.B|0,o=o+this.C|0,l=l+this.D|0,a=a+this.E|0,c=c+this.F|0,f=f+this.G|0,p=p+this.H|0,this.set(r,s,o,l,a,c,f,p)}roundClean(){it.fill(0)}destroy(){this.set(0,0,0,0,0,0,0,0),this.buffer.fill(0)}};i(re,"SHA256");var ne=re;var Ct=De(()=>new ne);var ae={};hn(ae,{abytes:()=>wt,bitGet:()=>kn,bitLen:()=>Tn,bitMask:()=>kt,bitSet:()=>Nn,bytesToHex:()=>ft,bytesToNumberBE:()=>H,bytesToNumberLE:()=>Pt,concatBytes:()=>tt,createHmacDrbg:()=>ie,ensureBytes:()=>U,equalBytes:()=>vn,hexToBytes:()=>ut,hexToNumber:()=>oe,isBytes:()=>at,numberToBytesBE:()=>J,numberToBytesLE:()=>qt,numberToHexUnpadded:()=>Ve,numberToVarBytesBE:()=>xn,utf8ToBytes:()=>Sn,validateObject:()=>ct});var ze=BigInt(0),Ut=BigInt(1),wn=BigInt(2);function at(t){return t instanceof Uint8Array||t!=null&&typeof t=="object"&&t.constructor.name==="Uint8Array"}i(at,"isBytes");function wt(t){if(!at(t))throw new Error("Uint8Array expected")}i(wt,"abytes");var En=Array.from({length:256},(t,n)=>n.toString(16).padStart(2,"0"));function ft(t){wt(t);let n="";for(let e=0;e<t.length;e++)n+=En[t[e]];return n}i(ft,"bytesToHex");function Ve(t){let n=t.toString(16);return n.length&1?`0${n}`:n}i(Ve,"numberToHexUnpadded");function oe(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);return BigInt(t===""?"0":`0x${t}`)}i(oe,"hexToNumber");var F={_0:48,_9:57,_A:65,_F:70,_a:97,_f:102};function $e(t){if(t>=F._0&&t<=F._9)return t-F._0;if(t>=F._A&&t<=F._F)return t-(F._A-10);if(t>=F._a&&t<=F._f)return t-(F._a-10)}i($e,"asciiToBase16");function ut(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);let n=t.length,e=n/2;if(n%2)throw new Error("padded hex string expected, got unpadded hex of length "+n);let r=new Uint8Array(e);for(let s=0,o=0;s<e;s++,o+=2){let l=$e(t.charCodeAt(o)),a=$e(t.charCodeAt(o+1));if(l===void 0||a===void 0){let c=t[o]+t[o+1];throw new Error('hex string expected, got non-hex character "'+c+'" at index '+o)}r[s]=l*16+a}return r}i(ut,"hexToBytes");function H(t){return oe(ft(t))}i(H,"bytesToNumberBE");function Pt(t){return wt(t),oe(ft(Uint8Array.from(t).reverse()))}i(Pt,"bytesToNumberLE");function J(t,n){return ut(t.toString(16).padStart(n*2,"0"))}i(J,"numberToBytesBE");function qt(t,n){return J(t,n).reverse()}i(qt,"numberToBytesLE");function xn(t){return ut(Ve(t))}i(xn,"numberToVarBytesBE");function U(t,n,e){let r;if(typeof n=="string")try{r=ut(n)}catch(o){throw new Error(`${t} must be valid hex string, got "${n}". Cause: ${o}`)}else if(at(n))r=Uint8Array.from(n);else throw new Error(`${t} must be hex string or Uint8Array`);let s=r.length;if(typeof e=="number"&&s!==e)throw new Error(`${t} expected ${e} bytes, got ${s}`);return r}i(U,"ensureBytes");function tt(...t){let n=0;for(let r=0;r<t.length;r++){let s=t[r];wt(s),n+=s.length}let e=new Uint8Array(n);for(let r=0,s=0;r<t.length;r++){let o=t[r];e.set(o,s),s+=o.length}return e}i(tt,"concatBytes");function vn(t,n){if(t.length!==n.length)return!1;let e=0;for(let r=0;r<t.length;r++)e|=t[r]^n[r];return e===0}i(vn,"equalBytes");function Sn(t){if(typeof t!="string")throw new Error(`utf8ToBytes expected string, got ${typeof t}`);return new Uint8Array(new TextEncoder().encode(t))}i(Sn,"utf8ToBytes");function Tn(t){let n;for(n=0;t>ze;t>>=Ut,n+=1);return n}i(Tn,"bitLen");function kn(t,n){return t>>BigInt(n)&Ut}i(kn,"bitGet");function Nn(t,n,e){return t|(e?Ut:ze)<<BigInt(n)}i(Nn,"bitSet");var kt=i(t=>(wn<<BigInt(t-1))-Ut,"bitMask"),se=i(t=>new Uint8Array(t),"u8n"),Me=i(t=>Uint8Array.from(t),"u8fr");function ie(t,n,e){if(typeof t!="number"||t<2)throw new Error("hashLen must be a number");if(typeof n!="number"||n<2)throw new Error("qByteLen must be a number");if(typeof e!="function")throw new Error("hmacFn must be a function");let r=se(t),s=se(t),o=0,l=i(()=>{r.fill(1),s.fill(0),o=0},"reset"),a=i((...h)=>e(s,r,...h),"h"),c=i((h=se())=>{s=a(Me([0]),h),r=a(),h.length!==0&&(s=a(Me([1]),h),r=a())},"reseed"),f=i(()=>{if(o++>=1e3)throw new Error("drbg: tried 1000 values");let h=0,T=[];for(;h<n;){r=a();let B=r.slice();T.push(B),h+=r.length}return tt(...T)},"gen");return i((h,T)=>{l(),c(h);let B;for(;!(B=T(f()));)c();return l(),B},"genUntil")}i(ie,"createHmacDrbg");var In={bigint:t=>typeof t=="bigint",function:t=>typeof t=="function",boolean:t=>typeof t=="boolean",string:t=>typeof t=="string",stringOrUint8Array:t=>typeof t=="string"||at(t),isSafeInteger:t=>Number.isSafeInteger(t),array:t=>Array.isArray(t),field:(t,n)=>n.Fp.isValid(t),hash:t=>typeof t=="function"&&Number.isSafeInteger(t.outputLen)};function ct(t,n,e={}){let r=i((s,o,l)=>{let a=In[o];if(typeof a!="function")throw new Error(`Invalid validator "${o}", expected function`);let c=t[s];if(!(l&&c===void 0)&&!a(c,t))throw new Error(`Invalid param ${String(s)}=${c} (${typeof c}), expected ${o}`)},"checkField");for(let[s,o]of Object.entries(n))r(s,o,!1);for(let[s,o]of Object.entries(e))r(s,o,!0);return t}i(ct,"validateObject");var q=BigInt(0),C=BigInt(1),dt=BigInt(2),Bn=BigInt(3),ce=BigInt(4),We=BigInt(5),Ke=BigInt(8),An=BigInt(9),On=BigInt(16);function P(t,n){let e=t%n;return e>=q?e:n+e}i(P,"mod");function Rn(t,n,e){if(e<=q||n<q)throw new Error("Expected power/modulo > 0");if(e===C)return q;let r=C;for(;n>q;)n&C&&(r=r*t%e),t=t*t%e,n>>=C;return r}i(Rn,"pow");function W(t,n,e){let r=t;for(;n-- >q;)r*=r,r%=e;return r}i(W,"pow2");function Dt(t,n){if(t===q||n<=q)throw new Error(`invert: expected positive integers, got n=${t} mod=${n}`);let e=P(t,n),r=n,s=q,o=C,l=C,a=q;for(;e!==q;){let f=r/e,p=r%e,h=s-l*f,T=o-a*f;r=e,e=p,s=l,o=a,l=h,a=T}if(r!==C)throw new Error("invert: does not exist");return P(s,n)}i(Dt,"invert");function _n(t){let n=(t-C)/dt,e,r,s;for(e=t-C,r=0;e%dt===q;e/=dt,r++);for(s=dt;s<t&&Rn(s,n,t)!==t-C;s++);if(r===1){let l=(t+C)/ce;return i(function(c,f){let p=c.pow(f,l);if(!c.eql(c.sqr(p),f))throw new Error("Cannot find square root");return p},"tonelliFast")}let o=(e+C)/dt;return i(function(a,c){if(a.pow(c,n)===a.neg(a.ONE))throw new Error("Cannot find square root");let f=r,p=a.pow(a.mul(a.ONE,s),e),h=a.pow(c,o),T=a.pow(c,e);for(;!a.eql(T,a.ONE);){if(a.eql(T,a.ZERO))return a.ZERO;let B=1;for(let w=a.sqr(T);B<f&&!a.eql(w,a.ONE);B++)w=a.sqr(w);let x=a.pow(p,C<<BigInt(f-B-1));p=a.sqr(x),h=a.mul(h,x),T=a.mul(T,p),f=B}return h},"tonelliSlow")}i(_n,"tonelliShanks");function Ln(t){if(t%ce===Bn){let n=(t+C)/ce;return i(function(r,s){let o=r.pow(s,n);if(!r.eql(r.sqr(o),s))throw new Error("Cannot find square root");return o},"sqrt3mod4")}if(t%Ke===We){let n=(t-We)/Ke;return i(function(r,s){let o=r.mul(s,dt),l=r.pow(o,n),a=r.mul(s,l),c=r.mul(r.mul(a,dt),l),f=r.mul(a,r.sub(c,r.ONE));if(!r.eql(r.sqr(f),s))throw new Error("Cannot find square root");return f},"sqrt5mod8")}return t%On,_n(t)}i(Ln,"FpSqrt");var Cn=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function le(t){let n={ORDER:"bigint",MASK:"bigint",BYTES:"isSafeInteger",BITS:"isSafeInteger"},e=Cn.reduce((r,s)=>(r[s]="function",r),n);return ct(t,e)}i(le,"validateField");function Un(t,n,e){if(e<q)throw new Error("Expected power > 0");if(e===q)return t.ONE;if(e===C)return n;let r=t.ONE,s=n;for(;e>q;)e&C&&(r=t.mul(r,s)),s=t.sqr(s),e>>=C;return r}i(Un,"FpPow");function Pn(t,n){let e=new Array(n.length),r=n.reduce((o,l,a)=>t.is0(l)?o:(e[a]=o,t.mul(o,l)),t.ONE),s=t.inv(r);return n.reduceRight((o,l,a)=>t.is0(l)?o:(e[a]=t.mul(o,e[a]),t.mul(o,l)),s),e}i(Pn,"FpInvertBatch");function fe(t,n){let e=n!==void 0?n:t.toString(2).length,r=Math.ceil(e/8);return{nBitLength:e,nByteLength:r}}i(fe,"nLength");function Xe(t,n,e=!1,r={}){if(t<=q)throw new Error(`Expected Field ORDER > 0, got ${t}`);let{nBitLength:s,nByteLength:o}=fe(t,n);if(o>2048)throw new Error("Field lengths over 2048 bytes are not supported");let l=Ln(t),a=Object.freeze({ORDER:t,BITS:s,BYTES:o,MASK:kt(s),ZERO:q,ONE:C,create:c=>P(c,t),isValid:c=>{if(typeof c!="bigint")throw new Error(`Invalid field element: expected bigint, got ${typeof c}`);return q<=c&&c<t},is0:c=>c===q,isOdd:c=>(c&C)===C,neg:c=>P(-c,t),eql:(c,f)=>c===f,sqr:c=>P(c*c,t),add:(c,f)=>P(c+f,t),sub:(c,f)=>P(c-f,t),mul:(c,f)=>P(c*f,t),pow:(c,f)=>Un(a,c,f),div:(c,f)=>P(c*Dt(f,t),t),sqrN:c=>c*c,addN:(c,f)=>c+f,subN:(c,f)=>c-f,mulN:(c,f)=>c*f,inv:c=>Dt(c,t),sqrt:r.sqrt||(c=>l(a,c)),invertBatch:c=>Pn(a,c),cmov:(c,f,p)=>p?f:c,toBytes:c=>e?qt(c,o):J(c,o),fromBytes:c=>{if(c.length!==o)throw new Error(`Fp.fromBytes: expected ${o}, got ${c.length}`);return e?Pt(c):H(c)}});return Object.freeze(a)}i(Xe,"Field");function Ye(t){if(typeof t!="bigint")throw new Error("field order must be bigint");let n=t.toString(2).length;return Math.ceil(n/8)}i(Ye,"getFieldBytesLength");function ue(t){let n=Ye(t);return n+Math.ceil(n/2)}i(ue,"getMinHashLength");function Ze(t,n,e=!1){let r=t.length,s=Ye(n),o=ue(n);if(r<16||r<o||r>1024)throw new Error(`expected ${o}-1024 bytes of input, got ${r}`);let l=e?H(t):Pt(t),a=P(l,n-C)+C;return e?qt(a,s):J(a,s)}i(Ze,"mapHashToField");var Dn=BigInt(0),de=BigInt(1);function Ge(t,n){let e=i((s,o)=>{let l=o.negate();return s?l:o},"constTimeNegate"),r=i(s=>{let o=Math.ceil(n/s)+1,l=2**(s-1);return{windows:o,windowSize:l}},"opts");return{constTimeNegate:e,unsafeLadder(s,o){let l=t.ZERO,a=s;for(;o>Dn;)o&de&&(l=l.add(a)),a=a.double(),o>>=de;return l},precomputeWindow(s,o){let{windows:l,windowSize:a}=r(o),c=[],f=s,p=f;for(let h=0;h<l;h++){p=f,c.push(p);for(let T=1;T<a;T++)p=p.add(f),c.push(p);f=p.double()}return c},wNAF(s,o,l){let{windows:a,windowSize:c}=r(s),f=t.ZERO,p=t.BASE,h=BigInt(2**s-1),T=2**s,B=BigInt(s);for(let x=0;x<a;x++){let w=x*c,u=Number(l&h);l>>=B,u>c&&(u-=T,l+=de);let m=w,b=w+Math.abs(u)-1,E=x%2!==0,v=u<0;u===0?p=p.add(e(E,o[m])):f=f.add(e(v,o[b]))}return{p:f,f:p}},wNAFCached(s,o,l,a){let c=s._WINDOW_SIZE||1,f=o.get(s);return f||(f=this.precomputeWindow(s,c),c!==1&&o.set(s,a(f))),this.wNAF(c,f,l)}}}i(Ge,"wNAF");function pe(t){return le(t.Fp),ct(t,{n:"bigint",h:"bigint",Gx:"field",Gy:"field"},{nBitLength:"isSafeInteger",nByteLength:"isSafeInteger"}),Object.freeze({...fe(t.n,t.nBitLength),...t,p:t.Fp.ORDER})}i(pe,"validateBasic");function Hn(t){let n=pe(t);ct(n,{a:"field",b:"field"},{allowedPrivateKeyLengths:"array",wrapPrivateKey:"boolean",isTorsionFree:"function",clearCofactor:"function",allowInfinityPoint:"boolean",fromBytes:"function",toBytes:"function"});let{endo:e,Fp:r,a:s}=n;if(e){if(!r.eql(s,r.ZERO))throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");if(typeof e!="object"||typeof e.beta!="bigint"||typeof e.splitScalar!="function")throw new Error("Expected endomorphism with beta: bigint and splitScalar: function")}return Object.freeze({...n})}i(Hn,"validatePointOpts");var{bytesToNumberBE:jn,hexToBytes:$n}=ae,Nt,pt={Err:(Nt=class extends Error{constructor(n=""){super(n)}},i(Nt,"DERErr"),Nt),_parseInt(t){let{Err:n}=pt;if(t.length<2||t[0]!==2)throw new n("Invalid signature integer tag");let e=t[1],r=t.subarray(2,e+2);if(!e||r.length!==e)throw new n("Invalid signature integer: wrong length");if(r[0]&128)throw new n("Invalid signature integer: negative");if(r[0]===0&&!(r[1]&128))throw new n("Invalid signature integer: unnecessary leading zero");return{d:jn(r),l:t.subarray(e+2)}},toSig(t){let{Err:n}=pt,e=typeof t=="string"?$n(t):t;wt(e);let r=e.length;if(r<2||e[0]!=48)throw new n("Invalid signature tag");if(e[1]!==r-2)throw new n("Invalid signature: incorrect length");let{d:s,l:o}=pt._parseInt(e.subarray(2)),{d:l,l:a}=pt._parseInt(o);if(a.length)throw new n("Invalid signature: left bytes after parsing");return{r:s,s:l}},hexFromSig(t){let n=i(f=>Number.parseInt(f[0],16)&8?"00"+f:f,"slice"),e=i(f=>{let p=f.toString(16);return p.length&1?`0${p}`:p},"h"),r=n(e(t.s)),s=n(e(t.r)),o=r.length/2,l=s.length/2,a=e(o),c=e(l);return`30${e(l+o+4)}02${c}${s}02${a}${r}`}},et=BigInt(0),K=BigInt(1),Qr=BigInt(2),Je=BigInt(3),Fr=BigInt(4);function Mn(t){let n=Hn(t),{Fp:e}=n,r=n.toBytes||((w,u,m)=>{let b=u.toAffine();return tt(Uint8Array.from([4]),e.toBytes(b.x),e.toBytes(b.y))}),s=n.fromBytes||(w=>{let u=w.subarray(1),m=e.fromBytes(u.subarray(0,e.BYTES)),b=e.fromBytes(u.subarray(e.BYTES,2*e.BYTES));return{x:m,y:b}});function o(w){let{a:u,b:m}=n,b=e.sqr(w),E=e.mul(b,w);return e.add(e.add(E,e.mul(w,u)),m)}if(i(o,"weierstrassEquation"),!e.eql(e.sqr(n.Gy),o(n.Gx)))throw new Error("bad generator point: equation left != right");function l(w){return typeof w=="bigint"&&et<w&&w<n.n}i(l,"isWithinCurveOrder");function a(w){if(!l(w))throw new Error("Expected valid bigint: 0 < bigint < curve.n")}i(a,"assertGE");function c(w){let{allowedPrivateKeyLengths:u,nByteLength:m,wrapPrivateKey:b,n:E}=n;if(u&&typeof w!="bigint"){if(at(w)&&(w=ft(w)),typeof w!="string"||!u.includes(w.length))throw new Error("Invalid key");w=w.padStart(m*2,"0")}let v;try{v=typeof w=="bigint"?w:H(U("private key",w,m))}catch{throw new Error(`private key must be ${m} bytes, hex or bigint, not ${typeof w}`)}return b&&(v=P(v,E)),a(v),v}i(c,"normPrivateKeyToScalar");let f=new Map;function p(w){if(!(w instanceof h))throw new Error("ProjectivePoint expected")}i(p,"assertPrjPoint");let x=class x{constructor(u,m,b){if(this.px=u,this.py=m,this.pz=b,u==null||!e.isValid(u))throw new Error("x required");if(m==null||!e.isValid(m))throw new Error("y required");if(b==null||!e.isValid(b))throw new Error("z required")}static fromAffine(u){let{x:m,y:b}=u||{};if(!u||!e.isValid(m)||!e.isValid(b))throw new Error("invalid affine point");if(u instanceof x)throw new Error("projective point not allowed");let E=i(v=>e.eql(v,e.ZERO),"is0");return E(m)&&E(b)?x.ZERO:new x(m,b,e.ONE)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}static normalizeZ(u){let m=e.invertBatch(u.map(b=>b.pz));return u.map((b,E)=>b.toAffine(m[E])).map(x.fromAffine)}static fromHex(u){let m=x.fromAffine(s(U("pointHex",u)));return m.assertValidity(),m}static fromPrivateKey(u){return x.BASE.multiply(c(u))}_setWindowSize(u){this._WINDOW_SIZE=u,f.delete(this)}assertValidity(){if(this.is0()){if(n.allowInfinityPoint&&!e.is0(this.py))return;throw new Error("bad point: ZERO")}let{x:u,y:m}=this.toAffine();if(!e.isValid(u)||!e.isValid(m))throw new Error("bad point: x or y not FE");let b=e.sqr(m),E=o(u);if(!e.eql(b,E))throw new Error("bad point: equation left != right");if(!this.isTorsionFree())throw new Error("bad point: not in prime-order subgroup")}hasEvenY(){let{y:u}=this.toAffine();if(e.isOdd)return!e.isOdd(u);throw new Error("Field doesn't support isOdd")}equals(u){p(u);let{px:m,py:b,pz:E}=this,{px:v,py:R,pz:I}=u,y=e.eql(e.mul(m,I),e.mul(v,E)),S=e.eql(e.mul(b,I),e.mul(R,E));return y&&S}negate(){return new x(this.px,e.neg(this.py),this.pz)}double(){let{a:u,b:m}=n,b=e.mul(m,Je),{px:E,py:v,pz:R}=this,I=e.ZERO,y=e.ZERO,S=e.ZERO,k=e.mul(E,E),X=e.mul(v,v),_=e.mul(R,R),A=e.mul(E,v);return A=e.add(A,A),S=e.mul(E,R),S=e.add(S,S),I=e.mul(u,S),y=e.mul(b,_),y=e.add(I,y),I=e.sub(X,y),y=e.add(X,y),y=e.mul(I,y),I=e.mul(A,I),S=e.mul(b,S),_=e.mul(u,_),A=e.sub(k,_),A=e.mul(u,A),A=e.add(A,S),S=e.add(k,k),k=e.add(S,k),k=e.add(k,_),k=e.mul(k,A),y=e.add(y,k),_=e.mul(v,R),_=e.add(_,_),k=e.mul(_,A),I=e.sub(I,k),S=e.mul(_,X),S=e.add(S,S),S=e.add(S,S),new x(I,y,S)}add(u){p(u);let{px:m,py:b,pz:E}=this,{px:v,py:R,pz:I}=u,y=e.ZERO,S=e.ZERO,k=e.ZERO,X=n.a,_=e.mul(n.b,Je),A=e.mul(m,v),z=e.mul(b,R),V=e.mul(E,I),j=e.add(m,b),d=e.add(v,R);j=e.mul(j,d),d=e.add(A,z),j=e.sub(j,d),d=e.add(m,E);let g=e.add(v,I);return d=e.mul(d,g),g=e.add(A,V),d=e.sub(d,g),g=e.add(b,E),y=e.add(R,I),g=e.mul(g,y),y=e.add(z,V),g=e.sub(g,y),k=e.mul(X,d),y=e.mul(_,V),k=e.add(y,k),y=e.sub(z,k),k=e.add(z,k),S=e.mul(y,k),z=e.add(A,A),z=e.add(z,A),V=e.mul(X,V),d=e.mul(_,d),z=e.add(z,V),V=e.sub(A,V),V=e.mul(X,V),d=e.add(d,V),A=e.mul(z,d),S=e.add(S,A),A=e.mul(g,d),y=e.mul(j,y),y=e.sub(y,A),A=e.mul(j,z),k=e.mul(g,k),k=e.add(k,A),new x(y,S,k)}subtract(u){return this.add(u.negate())}is0(){return this.equals(x.ZERO)}wNAF(u){return B.wNAFCached(this,f,u,m=>{let b=e.invertBatch(m.map(E=>E.pz));return m.map((E,v)=>E.toAffine(b[v])).map(x.fromAffine)})}multiplyUnsafe(u){let m=x.ZERO;if(u===et)return m;if(a(u),u===K)return this;let{endo:b}=n;if(!b)return B.unsafeLadder(this,u);let{k1neg:E,k1:v,k2neg:R,k2:I}=b.splitScalar(u),y=m,S=m,k=this;for(;v>et||I>et;)v&K&&(y=y.add(k)),I&K&&(S=S.add(k)),k=k.double(),v>>=K,I>>=K;return E&&(y=y.negate()),R&&(S=S.negate()),S=new x(e.mul(S.px,b.beta),S.py,S.pz),y.add(S)}multiply(u){a(u);let m=u,b,E,{endo:v}=n;if(v){let{k1neg:R,k1:I,k2neg:y,k2:S}=v.splitScalar(m),{p:k,f:X}=this.wNAF(I),{p:_,f:A}=this.wNAF(S);k=B.constTimeNegate(R,k),_=B.constTimeNegate(y,_),_=new x(e.mul(_.px,v.beta),_.py,_.pz),b=k.add(_),E=X.add(A)}else{let{p:R,f:I}=this.wNAF(m);b=R,E=I}return x.normalizeZ([b,E])[0]}multiplyAndAddUnsafe(u,m,b){let E=x.BASE,v=i((I,y)=>y===et||y===K||!I.equals(E)?I.multiplyUnsafe(y):I.multiply(y),"mul"),R=v(this,m).add(v(u,b));return R.is0()?void 0:R}toAffine(u){let{px:m,py:b,pz:E}=this,v=this.is0();u==null&&(u=v?e.ONE:e.inv(E));let R=e.mul(m,u),I=e.mul(b,u),y=e.mul(E,u);if(v)return{x:e.ZERO,y:e.ZERO};if(!e.eql(y,e.ONE))throw new Error("invZ was invalid");return{x:R,y:I}}isTorsionFree(){let{h:u,isTorsionFree:m}=n;if(u===K)return!0;if(m)return m(x,this);throw new Error("isTorsionFree() has not been declared for the elliptic curve")}clearCofactor(){let{h:u,clearCofactor:m}=n;return u===K?this:m?m(x,this):this.multiplyUnsafe(n.h)}toRawBytes(u=!0){return this.assertValidity(),r(x,this,u)}toHex(u=!0){return ft(this.toRawBytes(u))}};i(x,"Point");let h=x;h.BASE=new h(n.Gx,n.Gy,e.ONE),h.ZERO=new h(e.ZERO,e.ONE,e.ZERO);let T=n.nBitLength,B=Ge(h,n.endo?Math.ceil(T/2):T);return{CURVE:n,ProjectivePoint:h,normPrivateKeyToScalar:c,weierstrassEquation:o,isWithinCurveOrder:l}}i(Mn,"weierstrassPoints");function zn(t){let n=pe(t);return ct(n,{hash:"hash",hmac:"function",randomBytes:"function"},{bits2int:"function",bits2int_modN:"function",lowS:"boolean"}),Object.freeze({lowS:!0,...n})}i(zn,"validateOpts");function Qe(t){let n=zn(t),{Fp:e,n:r}=n,s=e.BYTES+1,o=2*e.BYTES+1;function l(d){return et<d&&d<e.ORDER}i(l,"isValidFieldElement");function a(d){return P(d,r)}i(a,"modN");function c(d){return Dt(d,r)}i(c,"invN");let{ProjectivePoint:f,normPrivateKeyToScalar:p,weierstrassEquation:h,isWithinCurveOrder:T}=Mn({...n,toBytes(d,g,N){let L=g.toAffine(),O=e.toBytes(L.x),D=tt;return N?D(Uint8Array.from([g.hasEvenY()?2:3]),O):D(Uint8Array.from([4]),O,e.toBytes(L.y))},fromBytes(d){let g=d.length,N=d[0],L=d.subarray(1);if(g===s&&(N===2||N===3)){let O=H(L);if(!l(O))throw new Error("Point is not on curve");let D=h(O),$;try{$=e.sqrt(D)}catch(Y){let rt=Y instanceof Error?": "+Y.message:"";throw new Error("Point is not on curve"+rt)}let M=($&K)===K;return(N&1)===1!==M&&($=e.neg($)),{x:O,y:$}}else if(g===o&&N===4){let O=e.fromBytes(L.subarray(0,e.BYTES)),D=e.fromBytes(L.subarray(e.BYTES,2*e.BYTES));return{x:O,y:D}}else throw new Error(`Point of length ${g} was invalid. Expected ${s} compressed bytes or ${o} uncompressed bytes`)}}),B=i(d=>ft(J(d,n.nByteLength)),"numToNByteStr");function x(d){let g=r>>K;return d>g}i(x,"isBiggerThanHalfOrder");function w(d){return x(d)?a(-d):d}i(w,"normalizeS");let u=i((d,g,N)=>H(d.slice(g,N)),"slcNum"),j=class j{constructor(g,N,L){this.r=g,this.s=N,this.recovery=L,this.assertValidity()}static fromCompact(g){let N=n.nByteLength;return g=U("compactSignature",g,N*2),new j(u(g,0,N),u(g,N,2*N))}static fromDER(g){let{r:N,s:L}=pt.toSig(U("DER",g));return new j(N,L)}assertValidity(){if(!T(this.r))throw new Error("r must be 0 < r < CURVE.n");if(!T(this.s))throw new Error("s must be 0 < s < CURVE.n")}addRecoveryBit(g){return new j(this.r,this.s,g)}recoverPublicKey(g){let{r:N,s:L,recovery:O}=this,D=y(U("msgHash",g));if(O==null||![0,1,2,3].includes(O))throw new Error("recovery id invalid");let $=O===2||O===3?N+n.n:N;if($>=e.ORDER)throw new Error("recovery id 2 or 3 invalid");let M=O&1?"03":"02",nt=f.fromHex(M+B($)),Y=c($),rt=a(-D*Y),Et=a(L*Y),st=f.BASE.multiplyAndAddUnsafe(nt,rt,Et);if(!st)throw new Error("point at infinify");return st.assertValidity(),st}hasHighS(){return x(this.s)}normalizeS(){return this.hasHighS()?new j(this.r,a(-this.s),this.recovery):this}toDERRawBytes(){return ut(this.toDERHex())}toDERHex(){return pt.hexFromSig({r:this.r,s:this.s})}toCompactRawBytes(){return ut(this.toCompactHex())}toCompactHex(){return B(this.r)+B(this.s)}};i(j,"Signature");let m=j,b={isValidPrivateKey(d){try{return p(d),!0}catch{return!1}},normPrivateKeyToScalar:p,randomPrivateKey:()=>{let d=ue(n.n);return Ze(n.randomBytes(d),n.n)},precompute(d=8,g=f.BASE){return g._setWindowSize(d),g.multiply(BigInt(3)),g}};function E(d,g=!0){return f.fromPrivateKey(d).toRawBytes(g)}i(E,"getPublicKey");function v(d){let g=at(d),N=typeof d=="string",L=(g||N)&&d.length;return g?L===s||L===o:N?L===2*s||L===2*o:d instanceof f}i(v,"isProbPub");function R(d,g,N=!0){if(v(d))throw new Error("first arg must be private key");if(!v(g))throw new Error("second arg must be public key");return f.fromHex(g).multiply(p(d)).toRawBytes(N)}i(R,"getSharedSecret");let I=n.bits2int||function(d){let g=H(d),N=d.length*8-n.nBitLength;return N>0?g>>BigInt(N):g},y=n.bits2int_modN||function(d){return a(I(d))},S=kt(n.nBitLength);function k(d){if(typeof d!="bigint")throw new Error("bigint expected");if(!(et<=d&&d<S))throw new Error(`bigint expected < 2^${n.nBitLength}`);return J(d,n.nByteLength)}i(k,"int2octets");function X(d,g,N=_){if(["recovered","canonical"].some(lt=>lt in N))throw new Error("sign() legacy options not supported");let{hash:L,randomBytes:O}=n,{lowS:D,prehash:$,extraEntropy:M}=N;D==null&&(D=!0),d=U("msgHash",d),$&&(d=U("prehashed msgHash",L(d)));let nt=y(d),Y=p(g),rt=[k(Y),k(nt)];if(M!=null&&M!==!1){let lt=M===!0?O(e.BYTES):M;rt.push(U("extraEntropy",lt))}let Et=tt(...rt),st=nt;function Wt(lt){let ht=I(lt);if(!T(ht))return;let Se=c(ht),Q=f.BASE.multiply(ht).toAffine(),mt=a(Q.x);if(mt===et)return;let Bt=a(Se*a(st+mt*Y));if(Bt===et)return;let Te=(Q.x===mt?0:2)|Number(Q.y&K),ke=Bt;return D&&x(Bt)&&(ke=w(Bt),Te^=1),new m(mt,ke,Te)}return i(Wt,"k2sig"),{seed:Et,k2sig:Wt}}i(X,"prepSig");let _={lowS:n.lowS,prehash:!1},A={lowS:n.lowS,prehash:!1};function z(d,g,N=_){let{seed:L,k2sig:O}=X(d,g,N),D=n;return ie(D.hash.outputLen,D.nByteLength,D.hmac)(L,O)}i(z,"sign"),f.BASE._setWindowSize(8);function V(d,g,N,L=A){let O=d;if(g=U("msgHash",g),N=U("publicKey",N),"strict"in L)throw new Error("options.strict was renamed to lowS");let{lowS:D,prehash:$}=L,M,nt;try{if(typeof O=="string"||at(O))try{M=m.fromDER(O)}catch(Q){if(!(Q instanceof pt.Err))throw Q;M=m.fromCompact(O)}else if(typeof O=="object"&&typeof O.r=="bigint"&&typeof O.s=="bigint"){let{r:Q,s:mt}=O;M=new m(Q,mt)}else throw new Error("PARSE");nt=f.fromHex(N)}catch(Q){if(Q.message==="PARSE")throw new Error("signature must be Signature instance, Uint8Array or hex string");return!1}if(D&&M.hasHighS())return!1;$&&(g=n.hash(g));let{r:Y,s:rt}=M,Et=y(g),st=c(rt),Wt=a(Et*st),lt=a(Y*st),ht=f.BASE.multiplyAndAddUnsafe(nt,Wt,lt)?.toAffine();return ht?a(ht.x)===Y:!1}return i(V,"verify"),{CURVE:n,getPublicKey:E,getSharedSecret:R,sign:z,verify:V,ProjectivePoint:f,Signature:m,utils:b}}i(Qe,"weierstrass");var me=class me extends yt{constructor(n,e){super(),this.finished=!1,this.destroyed=!1,Ue(n);let r=Tt(e);if(this.iHash=n.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;let s=this.blockLen,o=new Uint8Array(s);o.set(r.length>s?n.create().update(r).digest():r);for(let l=0;l<o.length;l++)o[l]^=54;this.iHash.update(o),this.oHash=n.create();for(let l=0;l<o.length;l++)o[l]^=106;this.oHash.update(o),o.fill(0)}update(n){return bt(this),this.iHash.update(n),this}digestInto(n){bt(this),gt(n,this.outputLen),this.finished=!0,this.iHash.digestInto(n),this.oHash.update(n),this.oHash.digestInto(n),this.destroy()}digest(){let n=new Uint8Array(this.oHash.outputLen);return this.digestInto(n),n}_cloneInto(n){n||(n=Object.create(Object.getPrototypeOf(this),{}));let{oHash:e,iHash:r,finished:s,destroyed:o,blockLen:l,outputLen:a}=this;return n=n,n.finished=s,n.destroyed=o,n.blockLen=l,n.outputLen=a,n.oHash=e._cloneInto(n.oHash),n.iHash=r._cloneInto(n.iHash),n}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}};i(me,"HMAC");var Ht=me,he=i((t,n,e)=>new Ht(t,n).update(e).digest(),"hmac");he.create=(t,n)=>new Ht(t,n);function Vn(t){return{hash:t,hmac:(n,...e)=>he(t,n,qe(...e)),randomBytes:_t}}i(Vn,"getHash");function Fe(t,n){let e=i(r=>Qe({...t,...Vn(r)}),"create");return Object.freeze({...e(n),create:e})}i(Fe,"createCurve");var zt=BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),jt=BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),nn=BigInt(1),$t=BigInt(2),tn=i((t,n)=>(t+n/$t)/n,"divNearest");function rn(t){let n=zt,e=BigInt(3),r=BigInt(6),s=BigInt(11),o=BigInt(22),l=BigInt(23),a=BigInt(44),c=BigInt(88),f=t*t*t%n,p=f*f*t%n,h=W(p,e,n)*p%n,T=W(h,e,n)*p%n,B=W(T,$t,n)*f%n,x=W(B,s,n)*B%n,w=W(x,o,n)*x%n,u=W(w,a,n)*w%n,m=W(u,c,n)*u%n,b=W(m,a,n)*w%n,E=W(b,e,n)*p%n,v=W(E,l,n)*x%n,R=W(v,r,n)*f%n,I=W(R,$t,n);if(!be.eql(be.sqr(I),t))throw new Error("Cannot find square root");return I}i(rn,"sqrtMod");var be=Xe(zt,void 0,void 0,{sqrt:rn}),Ee=Fe({a:BigInt(0),b:BigInt(7),Fp:be,n:jt,Gx:BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),Gy:BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),h:BigInt(1),lowS:!0,endo:{beta:BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),splitScalar:t=>{let n=jt,e=BigInt("0x3086d221a7d46bcde86c90e49284eb15"),r=-nn*BigInt("0xe4437ed6010e88286f547fa90abfe4c3"),s=BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"),o=e,l=BigInt("0x100000000000000000000000000000000"),a=tn(o*t,n),c=tn(-r*t,n),f=P(t-a*e-c*s,n),p=P(-a*r-c*o,n),h=f>l,T=p>l;if(h&&(f=n-f),T&&(p=n-p),f>l||p>l)throw new Error("splitScalar: Endomorphism failed, k="+t);return{k1neg:h,k1:f,k2neg:T,k2:p}}}},Ct),Vt=BigInt(0),sn=i(t=>typeof t=="bigint"&&Vt<t&&t<zt,"fe"),Wn=i(t=>typeof t=="bigint"&&Vt<t&&t<jt,"ge"),en={};function Mt(t,...n){let e=en[t];if(e===void 0){let r=Ct(Uint8Array.from(t,s=>s.charCodeAt(0)));e=tt(r,r),en[t]=e}return Ct(tt(e,...n))}i(Mt,"taggedHash");var xe=i(t=>t.toRawBytes(!0).slice(1),"pointToBytes"),ye=i(t=>J(t,32),"numTo32b"),ge=i(t=>P(t,zt),"modP"),It=i(t=>P(t,jt),"modN"),ve=Ee.ProjectivePoint,Kn=i((t,n,e)=>ve.BASE.multiplyAndAddUnsafe(t,n,e),"GmulAdd");function we(t){let n=Ee.utils.normPrivateKeyToScalar(t),e=ve.fromPrivateKey(n);return{scalar:e.hasEvenY()?n:It(-n),bytes:xe(e)}}i(we,"schnorrGetExtPubKey");function on(t){if(!sn(t))throw new Error("bad x: need 0 < x < p");let n=ge(t*t),e=ge(n*t+BigInt(7)),r=rn(e);r%$t!==Vt&&(r=ge(-r));let s=new ve(t,r,nn);return s.assertValidity(),s}i(on,"lift_x");function an(...t){return It(H(Mt("BIP0340/challenge",...t)))}i(an,"challenge");function Xn(t){return we(t).bytes}i(Xn,"schnorrGetPublicKey");function Yn(t,n,e=_t(32)){let r=U("message",t),{bytes:s,scalar:o}=we(n),l=U("auxRand",e,32),a=ye(o^H(Mt("BIP0340/aux",l))),c=Mt("BIP0340/nonce",a,s,r),f=It(H(c));if(f===Vt)throw new Error("sign failed: k is zero");let{bytes:p,scalar:h}=we(f),T=an(p,s,r),B=new Uint8Array(64);if(B.set(p,0),B.set(ye(It(h+T*o)),32),!cn(B,r,s))throw new Error("sign: Invalid signature produced");return B}i(Yn,"schnorrSign");function cn(t,n,e){let r=U("signature",t,64),s=U("message",n),o=U("publicKey",e,32);try{let l=on(H(o)),a=H(r.subarray(0,32));if(!sn(a))return!1;let c=H(r.subarray(32,64));if(!Wn(c))return!1;let f=an(ye(a),xe(l),s),p=Kn(l,c,It(-f));return!(!p||!p.hasEvenY()||p.toAffine().x!==a)}catch{return!1}}i(cn,"schnorrVerify");var ln={getPublicKey:Xn,sign:Yn,verify:cn,utils:{randomPrivateKey:Ee.utils.randomPrivateKey,lift_x:on,pointToBytes:xe,numberToBytesBE:J,bytesToNumberBE:H,taggedHash:Mt,mod:P}};async function Zn(t){try{let r=await t.withSession("first-unconstrained").prepare("SELECT value FROM system_config WHERE key = 'db_initialized' LIMIT 1").first().catch(()=>null);if(r&&r.value==="1"){console.log("Database already initialized");return}}catch{console.log("Database not initialized, creating schema...")}let n=t.withSession("first-primary");try{await n.prepare(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();let e=[`CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind INTEGER NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        sig TEXT NOT NULL,
        deleted INTEGER DEFAULT 0,
        created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )`,"CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey)","CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)","CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)","CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind)","CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted)","CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC)","CREATE INDEX IF NOT EXISTS idx_events_deleted_kind ON events(deleted, kind)",`CREATE TABLE IF NOT EXISTS tags (
        event_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        tag_value TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,"CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value)","CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id)",`CREATE TABLE IF NOT EXISTS paid_pubkeys (
        pubkey TEXT PRIMARY KEY,
        paid_at INTEGER NOT NULL,
        amount_sats INTEGER,
        created_timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )`,`CREATE TABLE IF NOT EXISTS content_hashes (
        hash TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,"CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)"];for(let r of e)await n.prepare(r).run();await n.prepare("PRAGMA foreign_keys = ON").run(),await n.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')").run(),await n.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '1')").run(),console.log("Database initialization completed!")}catch(e){throw console.error("Failed to initialize database:",e),e}}i(Zn,"initializeDatabase");function Gn(t){return Yt.size>0&&!Yt.has(t)?!1:!Oe.has(t)}i(Gn,"isPubkeyAllowed");function Jn(t){return Zt.size>0&&!Zt.has(t)?!1:!Re.has(t)}i(Jn,"isEventKindAllowed");function Qn(t){let n=(t.content||"").toLowerCase(),e=t.tags.map(r=>r.join("").toLowerCase());for(let r of _e){let s=r.toLowerCase();if(n.includes(s)||e.some(o=>o.includes(s)))return!0}return!1}i(Qn,"containsBlockedContent");function Fn(t){return Gt.size>0&&!Gt.has(t)?!1:!Le.has(t)}i(Fn,"isTagAllowed");async function tr(t){try{let n=fn(t.sig),e=er(t),r=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e)),s=new Uint8Array(r),o=fn(t.pubkey);return ln.verify(n,s,o)}catch(n){return console.error("Error verifying event signature:",n),!1}}i(tr,"verifyEventSignature");function er(t){return JSON.stringify([0,t.pubkey,t.created_at,t.kind,t.tags,t.content])}i(er,"serializeEventForSigning");function fn(t){if(t.length%2!==0)throw new Error("Invalid hex string");let n=new Uint8Array(t.length/2);for(let e=0;e<n.length;e++)n[e]=parseInt(t.substr(e*2,2),16);return n}i(fn,"hexToBytes");function nr(t){return Array.from(t).map(n=>n.toString(16).padStart(2,"0")).join("")}i(nr,"bytesToHex");async function un(t){let n=JSON.stringify(Xt?{kind:t.kind,tags:t.tags,content:t.content}:{pubkey:t.pubkey,kind:t.kind,tags:t.tags,content:t.content}),e=new TextEncoder().encode(n),r=await crypto.subtle.digest("SHA-256",e);return nr(new Uint8Array(r))}i(un,"hashContent");function dn(t){return Be&&Ae.has(t)}i(dn,"shouldCheckForDuplicates");async function pn(t,n){if(!Z)return!0;try{return await n.relayDb.withSession("first-unconstrained").prepare("SELECT pubkey FROM paid_pubkeys WHERE pubkey = ? LIMIT 1").bind(t).first()!==null}catch(e){return console.error(`Error checking paid status for ${t}:`,e),!1}}i(pn,"hasPaidForRelay");async function rr(t,n){try{return await n.relayDb.withSession("first-primary").prepare(`
      INSERT INTO paid_pubkeys (pubkey, paid_at, amount_sats)
      VALUES (?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        paid_at = excluded.paid_at,
        amount_sats = excluded.amount_sats
    `).bind(t,Math.floor(Date.now()/1e3),vt).run(),!0}catch(e){return console.error(`Error saving paid pubkey ${t}:`,e),!1}}i(rr,"savePaidPubkey");async function sr(t,n,e){try{if(!await tr(t))return{success:!1,message:"invalid: signature verification failed"};if(Z&&!await pn(t.pubkey,e))return{success:!1,message:"blocked: payment required"};if(!Gn(t.pubkey))return{success:!1,message:"blocked: pubkey not allowed"};if(!Jn(t.kind))return{success:!1,message:`blocked: event kind ${t.kind} not allowed`};if(Qn(t))return{success:!1,message:"blocked: content contains blocked phrases"};for(let o of t.tags)if(!Fn(o[0]))return{success:!1,message:`blocked: tag '${o[0]}' not allowed`};return t.kind===5?await ir(t,e):await or(t,e)}catch(r){return console.error(`Error processing event: ${r.message}`),{success:!1,message:`error: ${r.message}`}}}i(sr,"processEvent");async function or(t,n){try{let e=n.relayDb.withSession("first-primary");if(await e.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(t.id).first())return{success:!1,message:"duplicate: already have this event"};if(dn(t.kind)){let o=await un(t);if(Xt?await e.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(o).first():await e.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(o,t.pubkey).first())return{success:!1,message:"duplicate: content already exists"}}let s=[e.prepare(`
        INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(t.id,t.pubkey,t.created_at,t.kind,JSON.stringify(t.tags),t.content,t.sig)];for(let o of t.tags)o[0]&&o[1]&&s.push(e.prepare(`
            INSERT INTO tags (event_id, tag_name, tag_value)
            VALUES (?, ?, ?)
          `).bind(t.id,o[0],o[1]));if(dn(t.kind)){let o=await un(t);s.push(e.prepare(`
          INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(o,t.id,t.pubkey,t.created_at))}return await e.batch(s),{success:!0,message:"Event received successfully"}}catch(e){return console.error(`Error saving event: ${e.message}`),{success:!1,message:"error: could not save event"}}}i(or,"saveEventToD1");async function ir(t,n){let e=t.tags.filter(o=>o[0]==="e").map(o=>o[1]);if(e.length===0)return{success:!0,message:"No events to delete"};let r=n.relayDb.withSession("first-primary"),s=0;for(let o of e)try{let l=await r.prepare("SELECT pubkey FROM events WHERE id = ? LIMIT 1").bind(o).first();if(!l||l.pubkey!==t.pubkey)continue;(await r.prepare("UPDATE events SET deleted = 1 WHERE id = ?").bind(o).run()).meta.changes>0&&s++}catch(l){console.error(`Error deleting event ${o}:`,l)}return{success:!0,message:s>0?`Deleted ${s} events`:"No matching events found"}}i(ir,"processDeletionEvent");async function ar(t,n,e){try{let r=e.relayDb.withSession(n),s=new Map;for(let a of t){let c=cr(a),f=await r.prepare(c.sql).bind(...c.params).all();for(let p of f.results){let h={id:p.id,pubkey:p.pubkey,created_at:p.created_at,kind:p.kind,tags:JSON.parse(p.tags),content:p.content,sig:p.sig};s.set(h.id,h)}}let o=Array.from(s.values()).sort((a,c)=>c.created_at!==a.created_at?c.created_at-a.created_at:a.id.localeCompare(c.id)),l=r.getBookmark();return{events:o,bookmark:l}}catch(r){return console.error(`Error querying events: ${r.message}`),{events:[],bookmark:null}}}i(ar,"queryEvents");function cr(t){let n="SELECT * FROM events WHERE deleted = 0",e=[],r=[];t.ids&&t.ids.length>0&&(r.push(`id IN (${t.ids.map(()=>"?").join(",")})`),e.push(...t.ids)),t.authors&&t.authors.length>0&&(r.push(`pubkey IN (${t.authors.map(()=>"?").join(",")})`),e.push(...t.authors)),t.kinds&&t.kinds.length>0&&(r.push(`kind IN (${t.kinds.map(()=>"?").join(",")})`),e.push(...t.kinds)),t.since&&(r.push("created_at >= ?"),e.push(t.since)),t.until&&(r.push("created_at <= ?"),e.push(t.until));let s=[];for(let[o,l]of Object.entries(t))if(o.startsWith("#")&&Array.isArray(l)&&l.length>0){let a=o.substring(1);s.push(`
        id IN (
          SELECT event_id FROM tags 
          WHERE tag_name = ? AND tag_value IN (${l.map(()=>"?").join(",")})
        )
      `),e.push(a,...l)}return s.length>0&&r.push(`(${s.join(" OR ")})`),r.length>0&&(n+=" AND "+r.join(" AND ")),n+=" ORDER BY created_at DESC",n+=" LIMIT ?",e.push(Math.min(t.limit||1e4,1e4)),{sql:n,params:e}}i(cr,"buildQuery");function lr(t){let n={...St};if(Z){let e=new URL(t.url);n.payments_url=`${e.protocol}//${e.host}`,n.fees={admission:[{amount:vt*1e3,unit:"msats"}]}}return new Response(JSON.stringify(n),{status:200,headers:{"Content-Type":"application/nostr+json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Accept","Access-Control-Allow-Methods":"GET"}})}i(lr,"handleRelayInfoRequest");function fr(){let n=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A serverless Nostr relay through Cloudflare Worker and D1 database" />
    <title>Nosflare - Nostr Relay</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 20% 50%, rgba(255, 69, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 50%, rgba(255, 140, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 100%, rgba(255, 0, 0, 0.05) 0%, transparent 50%);
            animation: pulse 10s ease-in-out infinite;
            z-index: -1;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            z-index: 1;
        }
        
        .logo {
            width: 400px;
            height: auto;
            filter: drop-shadow(0 0 30px rgba(255, 69, 0, 0.5));
        }
        
        .tagline {
            font-size: 1.2rem;
            color: #999;
            margin-bottom: 3rem;
        }
        
        .info-box, .pay-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }
        
        .pay-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            margin: 1rem 0;
            transition: transform 0.3s ease;
        }
        
        .pay-button:hover {
            transform: scale(1.05);
        }
        
        .price-info {
            font-size: 1.2rem;
            color: #ff8c00;
            font-weight: 600;
        }
        
        .url-display {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 69, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: #ff8c00;
            margin: 1rem 0;
            word-break: break-all;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .url-display:hover {
            border-color: #ff4500;
            background: rgba(255, 69, 0, 0.1);
        }
        
        .copy-hint {
            font-size: 0.9rem;
            color: #666;
            margin-top: 0.5rem;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .stat-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1rem;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ff4500;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #999;
            margin-top: 0.25rem;
        }
        
        .links {
            margin-top: 3rem;
            display: flex;
            gap: 2rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .link {
            color: #ff8c00;
            text-decoration: none;
            font-size: 1rem;
            transition: color 0.3s ease;
        }
        
        .link:hover {
            color: #ff4500;
        }
        
        .toast {
            position: fixed;
            bottom: 2rem;
            background: #ff4500;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            transform: translateY(100px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }
        
        .toast.show {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/nosflare.png" alt="Nosflare Logo" class="logo">
        <p class="tagline">A serverless Nostr relay powered by Cloudflare</p>
        
        ${Z?`
    <div class="pay-section" id="paySection">
      <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
      <button id="payButton" class="pay-button" data-npub="${relayNpub}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${vt}">
        <img src="https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
      </button>
      <p class="price-info">${vt.toLocaleString()} sats</p>
    </div>
    <div class="info-box" id="accessSection" style="display: none;">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
        <!-- URL will be inserted by JavaScript -->
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  `:`
    <div class="info-box">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
        <!-- URL will be inserted by JavaScript -->
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  `}
        
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${St.supported_nips.length}</div>
                <div class="stat-label">Supported NIPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${St.version}</div>
                <div class="stat-label">Version</div>
            </div>
        </div>
        
        <div class="links">
            <a href="https://github.com/Spl0itable/nosflare" class="link" target="_blank">GitHub</a>
            <a href="https://nostr.info" class="link" target="_blank">Learn about Nostr</a>
        </div>
    </div>
    
    <div class="toast" id="toast">Copied to clipboard!</div>
    
    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const relayUrl = protocol + '//' + window.location.host;
        const relayUrlElement = document.getElementById('relay-url');
        if (relayUrlElement) {
            relayUrlElement.textContent = relayUrl;
        }
        
        function copyToClipboard() {
            const relayUrl = document.getElementById('relay-url').textContent;
            navigator.clipboard.writeText(relayUrl).then(() => {
                const toast = document.getElementById('toast');
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            });
        }
        
        ${Z?`
        // Payment handling code
        let paymentCheckInterval;

        async function checkPaymentStatus() {
            if (!window.nostr || !window.nostr.getPublicKey) return false;
            
            try {
                const pubkey = await window.nostr.getPublicKey();
                const response = await fetch('/api/check-payment?pubkey=' + pubkey);
                const data = await response.json();
                
                if (data.paid) {
                    showRelayAccess();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error checking payment status:', error);
                return false;
            }
        }

        function showRelayAccess() {
            const paySection = document.getElementById('paySection');
            const accessSection = document.getElementById('accessSection');
            
            if (paySection && accessSection) {
                paySection.style.transition = 'opacity 0.3s ease-out';
                paySection.style.opacity = '0';
                
                setTimeout(() => {
                    paySection.style.display = 'none';
                    accessSection.style.display = 'block';
                    accessSection.style.opacity = '0';
                    accessSection.style.transition = 'opacity 0.3s ease-in';
                    
                    void accessSection.offsetHeight;
                    
                    accessSection.style.opacity = '1';
                }, 300);
            }
            
            if (paymentCheckInterval) {
                clearInterval(paymentCheckInterval);
                paymentCheckInterval = null;
            }
        }

        window.addEventListener('payment-success', async (event) => {
            console.log('Payment success event received');
            setTimeout(() => {
                showRelayAccess();
            }, 500);
        });

        async function initPayment() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/Spl0itable/nosflare@main/nostr-zap.js';
            script.onload = () => {
                if (window.nostrZap) {
                    window.nostrZap.initTargets('#payButton');
                    
                    document.getElementById('payButton').addEventListener('click', () => {
                        if (!paymentCheckInterval) {
                            paymentCheckInterval = setInterval(async () => {
                                await checkPaymentStatus();
                            }, 3000);
                        }
                    });
                }
            };
            document.head.appendChild(script);
            
            await checkPaymentStatus();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPayment);
        } else {
            initPayment();
        }
        `:""}
    </script>
    ${Z?'<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>':""}
</body>
</html>
  `;return new Response(n,{status:200,headers:{"Content-Type":"text/html;charset=UTF-8","Cache-Control":"public, max-age=3600"}})}i(fr,"serveLandingPage");function ur(t){let n=t.searchParams.get("name");if(!n)return new Response(JSON.stringify({error:"Missing 'name' parameter"}),{status:400,headers:{"Content-Type":"application/json"}});let e=Ie[n.toLowerCase()];if(!e)return new Response(JSON.stringify({error:"User not found"}),{status:404,headers:{"Content-Type":"application/json"}});let r={names:{[n]:e},relays:{[e]:[]}};return new Response(JSON.stringify(r),{status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}i(ur,"handleNIP05Request");async function dr(t,n){let r=new URL(t.url).searchParams.get("pubkey");if(!r)return new Response(JSON.stringify({error:"Missing pubkey"}),{status:400,headers:{"Content-Type":"application/json"}});let s=await pn(r,n);return new Response(JSON.stringify({paid:s}),{status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}i(dr,"handleCheckPayment");async function pr(t,n){try{let r=new URL(t.url).searchParams.get("npub");if(!r)return new Response(JSON.stringify({error:"Missing pubkey"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});let s=await rr(r,n);return new Response(JSON.stringify({success:s,message:s?"Payment recorded successfully":"Failed to save payment"}),{status:s?200:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}catch{return new Response(JSON.stringify({error:"Invalid request"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}i(pr,"handlePaymentNotification");var hr={async fetch(t,n,e){try{let r=new URL(t.url);if(n.WORKER_HOST=r.host,r.pathname==="/internal/process-event"&&t.method==="POST"){let{event:s,sessionId:o}=await t.json(),l=await sr(s,o,n);return new Response(JSON.stringify(l),{headers:{"Content-Type":"application/json"}})}if(r.pathname==="/internal/query-events"&&t.method==="POST"){let{filters:s,bookmark:o}=await t.json(),l=await ar(s,o,n);return new Response(JSON.stringify(l),{headers:{"Content-Type":"application/json"}})}if(t.method==="POST"&&r.searchParams.has("notify-zap")&&Z)return await pr(t,n);if(r.pathname==="/api/check-payment"&&Z)return await dr(t,n);if(r.pathname==="/")if(t.headers.get("Upgrade")==="websocket"){let s=n.RELAY_WEBSOCKET.idFromName(r.hostname);return n.RELAY_WEBSOCKET.get(s).fetch(t)}else return t.headers.get("Accept")==="application/nostr+json"?lr(t):(e.waitUntil(Zn(n.relayDb)),fr());else{if(r.pathname==="/.well-known/nostr.json")return ur(r);if(r.pathname==="/favicon.ico"){let s=await fetch(St.icon);if(s.ok){let o=new Headers(s.headers);return o.set("Cache-Control","max-age=3600"),new Response(s.body,{status:s.status,headers:o})}return new Response(null,{status:404})}else return new Response("Invalid request",{status:400})}}catch(r){return console.error("Error in fetch handler:",r),new Response("Internal Server Error",{status:500})}}};export{At as RelayWebSocket,hr as default};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/modular.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/curve.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/weierstrass.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/_shortw_utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
