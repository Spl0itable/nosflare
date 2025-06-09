var rn=Object.defineProperty;var sn=(t,n)=>{for(var e in n)rn(t,e,{get:n[e],enumerable:!0})};function be(t){if(!Number.isSafeInteger(t)||t<0)throw new Error(`positive integer expected, not ${t}`)}function on(t){return t instanceof Uint8Array||t!=null&&typeof t=="object"&&t.constructor.name==="Uint8Array"}function ht(t,...n){if(!on(t))throw new Error("Uint8Array expected");if(n.length>0&&!n.includes(t.length))throw new Error(`Uint8Array expected of length ${n}, not of length=${t.length}`)}function ye(t){if(typeof t!="function"||typeof t.create!="function")throw new Error("Hash should be wrapped by utils.wrapConstructor");be(t.outputLen),be(t.blockLen)}function mt(t,n=!0){if(t.destroyed)throw new Error("Hash instance has been destroyed");if(n&&t.finished)throw new Error("Hash#digest() has already been called")}function we(t,n){ht(t);let e=n.outputLen;if(t.length<e)throw new Error(`digestInto() expects output buffer of length at least ${e}`)}var Nt=typeof globalThis=="object"&&"crypto"in globalThis?globalThis.crypto:void 0;var It=t=>new DataView(t.buffer,t.byteOffset,t.byteLength),K=(t,n)=>t<<32-n|t>>>n;var fr=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68;function an(t){if(typeof t!="string")throw new Error(`utf8ToBytes expected string, got ${typeof t}`);return new Uint8Array(new TextEncoder().encode(t))}function wt(t){return typeof t=="string"&&(t=an(t)),ht(t),t}function Ee(...t){let n=0;for(let r=0;r<t.length;r++){let s=t[r];ht(s),n+=s.length}let e=new Uint8Array(n);for(let r=0,s=0;r<t.length;r++){let o=t[r];e.set(o,s),s+=o.length}return e}var gt=class{clone(){return this._cloneInto()}},ur={}.toString;function xe(t){let n=r=>t().update(wt(r)).digest(),e=t();return n.outputLen=e.outputLen,n.blockLen=e.blockLen,n.create=()=>t(),n}function Bt(t=32){if(Nt&&typeof Nt.getRandomValues=="function")return Nt.getRandomValues(new Uint8Array(t));throw new Error("crypto.getRandomValues must be defined")}function cn(t,n,e,r){if(typeof t.setBigUint64=="function")return t.setBigUint64(n,e,r);let s=BigInt(32),o=BigInt(4294967295),c=Number(e>>s&o),i=Number(e&o),a=r?4:0,l=r?0:4;t.setUint32(n+a,c,r),t.setUint32(n+l,i,r)}var ve=(t,n,e)=>t&n^~t&e,Se=(t,n,e)=>t&n^t&e^n&e,At=class extends gt{constructor(n,e,r,s){super(),this.blockLen=n,this.outputLen=e,this.padOffset=r,this.isLE=s,this.finished=!1,this.length=0,this.pos=0,this.destroyed=!1,this.buffer=new Uint8Array(n),this.view=It(this.buffer)}update(n){mt(this);let{view:e,buffer:r,blockLen:s}=this;n=wt(n);let o=n.length;for(let c=0;c<o;){let i=Math.min(s-this.pos,o-c);if(i===s){let a=It(n);for(;s<=o-c;c+=s)this.process(a,c);continue}r.set(n.subarray(c,c+i),this.pos),this.pos+=i,c+=i,this.pos===s&&(this.process(e,0),this.pos=0)}return this.length+=n.length,this.roundClean(),this}digestInto(n){mt(this),we(n,this),this.finished=!0;let{buffer:e,view:r,blockLen:s,isLE:o}=this,{pos:c}=this;e[c++]=128,this.buffer.subarray(c).fill(0),this.padOffset>s-c&&(this.process(r,0),c=0);for(let f=c;f<s;f++)e[f]=0;cn(r,s-8,BigInt(this.length*8),o),this.process(r,0);let i=It(n),a=this.outputLen;if(a%4)throw new Error("_sha2: outputLen should be aligned to 32bit");let l=a/4,p=this.get();if(l>p.length)throw new Error("_sha2: outputLen bigger than state");for(let f=0;f<l;f++)i.setUint32(4*f,p[f],o)}digest(){let{buffer:n,outputLen:e}=this;this.digestInto(n);let r=n.slice(0,e);return this.destroy(),r}_cloneInto(n){n||(n=new this.constructor),n.set(...this.get());let{blockLen:e,buffer:r,length:s,finished:o,destroyed:c,pos:i}=this;return n.length=s,n.pos=i,n.finished=o,n.destroyed=c,s%e&&n.buffer.set(r),n}};var ln=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),rt=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),st=new Uint32Array(64),Mt=class extends At{constructor(){super(64,32,8,!1),this.A=rt[0]|0,this.B=rt[1]|0,this.C=rt[2]|0,this.D=rt[3]|0,this.E=rt[4]|0,this.F=rt[5]|0,this.G=rt[6]|0,this.H=rt[7]|0}get(){let{A:n,B:e,C:r,D:s,E:o,F:c,G:i,H:a}=this;return[n,e,r,s,o,c,i,a]}set(n,e,r,s,o,c,i,a){this.A=n|0,this.B=e|0,this.C=r|0,this.D=s|0,this.E=o|0,this.F=c|0,this.G=i|0,this.H=a|0}process(n,e){for(let f=0;f<16;f++,e+=4)st[f]=n.getUint32(e,!1);for(let f=16;f<64;f++){let v=st[f-15],k=st[f-2],y=K(v,7)^K(v,18)^v>>>3,u=K(k,17)^K(k,19)^k>>>10;st[f]=u+st[f-7]+y+st[f-16]|0}let{A:r,B:s,C:o,D:c,E:i,F:a,G:l,H:p}=this;for(let f=0;f<64;f++){let v=K(i,6)^K(i,11)^K(i,25),k=p+v+ve(i,a,l)+ln[f]+st[f]|0,u=(K(r,2)^K(r,13)^K(r,22))+Se(r,s,o)|0;p=l,l=a,a=i,i=c+k|0,c=o,o=s,s=r,r=k+u|0}r=r+this.A|0,s=s+this.B|0,o=o+this.C|0,c=c+this.D|0,i=i+this.E|0,a=a+this.F|0,l=l+this.G|0,p=p+this.H|0,this.set(r,s,o,c,i,a,l,p)}roundClean(){st.fill(0)}destroy(){this.set(0,0,0,0,0,0,0,0),this.buffer.fill(0)}};var _t=xe(()=>new Mt);var Kt={};sn(Kt,{abytes:()=>bt,bitGet:()=>gn,bitLen:()=>mn,bitMask:()=>Et,bitSet:()=>bn,bytesToHex:()=>ct,bytesToNumberBE:()=>q,bytesToNumberLE:()=>Ot,concatBytes:()=>J,createHmacDrbg:()=>Wt,ensureBytes:()=>L,equalBytes:()=>pn,hexToBytes:()=>lt,hexToNumber:()=>Vt,isBytes:()=>ot,numberToBytesBE:()=>X,numberToBytesLE:()=>Lt,numberToHexUnpadded:()=>Ie,numberToVarBytesBE:()=>dn,utf8ToBytes:()=>hn,validateObject:()=>it});var Ne=BigInt(0),Rt=BigInt(1),fn=BigInt(2);function ot(t){return t instanceof Uint8Array||t!=null&&typeof t=="object"&&t.constructor.name==="Uint8Array"}function bt(t){if(!ot(t))throw new Error("Uint8Array expected")}var un=Array.from({length:256},(t,n)=>n.toString(16).padStart(2,"0"));function ct(t){bt(t);let n="";for(let e=0;e<t.length;e++)n+=un[t[e]];return n}function Ie(t){let n=t.toString(16);return n.length&1?`0${n}`:n}function Vt(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);return BigInt(t===""?"0":`0x${t}`)}var G={_0:48,_9:57,_A:65,_F:70,_a:97,_f:102};function Te(t){if(t>=G._0&&t<=G._9)return t-G._0;if(t>=G._A&&t<=G._F)return t-(G._A-10);if(t>=G._a&&t<=G._f)return t-(G._a-10)}function lt(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);let n=t.length,e=n/2;if(n%2)throw new Error("padded hex string expected, got unpadded hex of length "+n);let r=new Uint8Array(e);for(let s=0,o=0;s<e;s++,o+=2){let c=Te(t.charCodeAt(o)),i=Te(t.charCodeAt(o+1));if(c===void 0||i===void 0){let a=t[o]+t[o+1];throw new Error('hex string expected, got non-hex character "'+a+'" at index '+o)}r[s]=c*16+i}return r}function q(t){return Vt(ct(t))}function Ot(t){return bt(t),Vt(ct(Uint8Array.from(t).reverse()))}function X(t,n){return lt(t.toString(16).padStart(n*2,"0"))}function Lt(t,n){return X(t,n).reverse()}function dn(t){return lt(Ie(t))}function L(t,n,e){let r;if(typeof n=="string")try{r=lt(n)}catch(o){throw new Error(`${t} must be valid hex string, got "${n}". Cause: ${o}`)}else if(ot(n))r=Uint8Array.from(n);else throw new Error(`${t} must be hex string or Uint8Array`);let s=r.length;if(typeof e=="number"&&s!==e)throw new Error(`${t} expected ${e} bytes, got ${s}`);return r}function J(...t){let n=0;for(let r=0;r<t.length;r++){let s=t[r];bt(s),n+=s.length}let e=new Uint8Array(n);for(let r=0,s=0;r<t.length;r++){let o=t[r];e.set(o,s),s+=o.length}return e}function pn(t,n){if(t.length!==n.length)return!1;let e=0;for(let r=0;r<t.length;r++)e|=t[r]^n[r];return e===0}function hn(t){if(typeof t!="string")throw new Error(`utf8ToBytes expected string, got ${typeof t}`);return new Uint8Array(new TextEncoder().encode(t))}function mn(t){let n;for(n=0;t>Ne;t>>=Rt,n+=1);return n}function gn(t,n){return t>>BigInt(n)&Rt}function bn(t,n,e){return t|(e?Rt:Ne)<<BigInt(n)}var Et=t=>(fn<<BigInt(t-1))-Rt,zt=t=>new Uint8Array(t),ke=t=>Uint8Array.from(t);function Wt(t,n,e){if(typeof t!="number"||t<2)throw new Error("hashLen must be a number");if(typeof n!="number"||n<2)throw new Error("qByteLen must be a number");if(typeof e!="function")throw new Error("hmacFn must be a function");let r=zt(t),s=zt(t),o=0,c=()=>{r.fill(1),s.fill(0),o=0},i=(...f)=>e(s,r,...f),a=(f=zt())=>{s=i(ke([0]),f),r=i(),f.length!==0&&(s=i(ke([1]),f),r=i())},l=()=>{if(o++>=1e3)throw new Error("drbg: tried 1000 values");let f=0,v=[];for(;f<n;){r=i();let k=r.slice();v.push(k),f+=r.length}return J(...v)};return(f,v)=>{c(),a(f);let k;for(;!(k=v(l()));)a();return c(),k}}var yn={bigint:t=>typeof t=="bigint",function:t=>typeof t=="function",boolean:t=>typeof t=="boolean",string:t=>typeof t=="string",stringOrUint8Array:t=>typeof t=="string"||ot(t),isSafeInteger:t=>Number.isSafeInteger(t),array:t=>Array.isArray(t),field:(t,n)=>n.Fp.isValid(t),hash:t=>typeof t=="function"&&Number.isSafeInteger(t.outputLen)};function it(t,n,e={}){let r=(s,o,c)=>{let i=yn[o];if(typeof i!="function")throw new Error(`Invalid validator "${o}", expected function`);let a=t[s];if(!(c&&a===void 0)&&!i(a,t))throw new Error(`Invalid param ${String(s)}=${a} (${typeof a}), expected ${o}`)};for(let[s,o]of Object.entries(n))r(s,o,!1);for(let[s,o]of Object.entries(e))r(s,o,!0);return t}var U=BigInt(0),O=BigInt(1),ft=BigInt(2),wn=BigInt(3),Xt=BigInt(4),Be=BigInt(5),Ae=BigInt(8),En=BigInt(9),xn=BigInt(16);function C(t,n){let e=t%n;return e>=U?e:n+e}function vn(t,n,e){if(e<=U||n<U)throw new Error("Expected power/modulo > 0");if(e===O)return U;let r=O;for(;n>U;)n&O&&(r=r*t%e),t=t*t%e,n>>=O;return r}function M(t,n,e){let r=t;for(;n-- >U;)r*=r,r%=e;return r}function Ct(t,n){if(t===U||n<=U)throw new Error(`invert: expected positive integers, got n=${t} mod=${n}`);let e=C(t,n),r=n,s=U,o=O,c=O,i=U;for(;e!==U;){let l=r/e,p=r%e,f=s-c*l,v=o-i*l;r=e,e=p,s=c,o=i,c=f,i=v}if(r!==O)throw new Error("invert: does not exist");return C(s,n)}function Sn(t){let n=(t-O)/ft,e,r,s;for(e=t-O,r=0;e%ft===U;e/=ft,r++);for(s=ft;s<t&&vn(s,n,t)!==t-O;s++);if(r===1){let c=(t+O)/Xt;return function(a,l){let p=a.pow(l,c);if(!a.eql(a.sqr(p),l))throw new Error("Cannot find square root");return p}}let o=(e+O)/ft;return function(i,a){if(i.pow(a,n)===i.neg(i.ONE))throw new Error("Cannot find square root");let l=r,p=i.pow(i.mul(i.ONE,s),e),f=i.pow(a,o),v=i.pow(a,e);for(;!i.eql(v,i.ONE);){if(i.eql(v,i.ZERO))return i.ZERO;let k=1;for(let u=i.sqr(v);k<l&&!i.eql(u,i.ONE);k++)u=i.sqr(u);let y=i.pow(p,O<<BigInt(l-k-1));p=i.sqr(y),f=i.mul(f,y),v=i.mul(v,p),l=k}return f}}function Tn(t){if(t%Xt===wn){let n=(t+O)/Xt;return function(r,s){let o=r.pow(s,n);if(!r.eql(r.sqr(o),s))throw new Error("Cannot find square root");return o}}if(t%Ae===Be){let n=(t-Be)/Ae;return function(r,s){let o=r.mul(s,ft),c=r.pow(o,n),i=r.mul(s,c),a=r.mul(r.mul(i,ft),c),l=r.mul(i,r.sub(a,r.ONE));if(!r.eql(r.sqr(l),s))throw new Error("Cannot find square root");return l}}return t%xn,Sn(t)}var kn=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function Yt(t){let n={ORDER:"bigint",MASK:"bigint",BYTES:"isSafeInteger",BITS:"isSafeInteger"},e=kn.reduce((r,s)=>(r[s]="function",r),n);return it(t,e)}function Nn(t,n,e){if(e<U)throw new Error("Expected power > 0");if(e===U)return t.ONE;if(e===O)return n;let r=t.ONE,s=n;for(;e>U;)e&O&&(r=t.mul(r,s)),s=t.sqr(s),e>>=O;return r}function In(t,n){let e=new Array(n.length),r=n.reduce((o,c,i)=>t.is0(c)?o:(e[i]=o,t.mul(o,c)),t.ONE),s=t.inv(r);return n.reduceRight((o,c,i)=>t.is0(c)?o:(e[i]=t.mul(o,e[i]),t.mul(o,c)),s),e}function Zt(t,n){let e=n!==void 0?n:t.toString(2).length,r=Math.ceil(e/8);return{nBitLength:e,nByteLength:r}}function _e(t,n,e=!1,r={}){if(t<=U)throw new Error(`Expected Field ORDER > 0, got ${t}`);let{nBitLength:s,nByteLength:o}=Zt(t,n);if(o>2048)throw new Error("Field lengths over 2048 bytes are not supported");let c=Tn(t),i=Object.freeze({ORDER:t,BITS:s,BYTES:o,MASK:Et(s),ZERO:U,ONE:O,create:a=>C(a,t),isValid:a=>{if(typeof a!="bigint")throw new Error(`Invalid field element: expected bigint, got ${typeof a}`);return U<=a&&a<t},is0:a=>a===U,isOdd:a=>(a&O)===O,neg:a=>C(-a,t),eql:(a,l)=>a===l,sqr:a=>C(a*a,t),add:(a,l)=>C(a+l,t),sub:(a,l)=>C(a-l,t),mul:(a,l)=>C(a*l,t),pow:(a,l)=>Nn(i,a,l),div:(a,l)=>C(a*Ct(l,t),t),sqrN:a=>a*a,addN:(a,l)=>a+l,subN:(a,l)=>a-l,mulN:(a,l)=>a*l,inv:a=>Ct(a,t),sqrt:r.sqrt||(a=>c(i,a)),invertBatch:a=>In(i,a),cmov:(a,l,p)=>p?l:a,toBytes:a=>e?Lt(a,o):X(a,o),fromBytes:a=>{if(a.length!==o)throw new Error(`Fp.fromBytes: expected ${o}, got ${a.length}`);return e?Ot(a):q(a)}});return Object.freeze(i)}function Re(t){if(typeof t!="bigint")throw new Error("field order must be bigint");let n=t.toString(2).length;return Math.ceil(n/8)}function Gt(t){let n=Re(t);return n+Math.ceil(n/2)}function Oe(t,n,e=!1){let r=t.length,s=Re(n),o=Gt(n);if(r<16||r<o||r>1024)throw new Error(`expected ${o}-1024 bytes of input, got ${r}`);let c=e?q(t):Ot(t),i=C(c,n-O)+O;return e?Lt(i,s):X(i,s)}var An=BigInt(0),Jt=BigInt(1);function Le(t,n){let e=(s,o)=>{let c=o.negate();return s?c:o},r=s=>{let o=Math.ceil(n/s)+1,c=2**(s-1);return{windows:o,windowSize:c}};return{constTimeNegate:e,unsafeLadder(s,o){let c=t.ZERO,i=s;for(;o>An;)o&Jt&&(c=c.add(i)),i=i.double(),o>>=Jt;return c},precomputeWindow(s,o){let{windows:c,windowSize:i}=r(o),a=[],l=s,p=l;for(let f=0;f<c;f++){p=l,a.push(p);for(let v=1;v<i;v++)p=p.add(l),a.push(p);l=p.double()}return a},wNAF(s,o,c){let{windows:i,windowSize:a}=r(s),l=t.ZERO,p=t.BASE,f=BigInt(2**s-1),v=2**s,k=BigInt(s);for(let y=0;y<i;y++){let u=y*a,h=Number(c&f);c>>=k,h>a&&(h-=v,c+=Jt);let m=u,w=u+Math.abs(h)-1,x=y%2!==0,I=h<0;h===0?p=p.add(e(x,o[m])):l=l.add(e(I,o[w]))}return{p:l,f:p}},wNAFCached(s,o,c,i){let a=s._WINDOW_SIZE||1,l=o.get(s);return l||(l=this.precomputeWindow(s,a),a!==1&&o.set(s,i(l))),this.wNAF(a,l,c)}}}function Qt(t){return Yt(t.Fp),it(t,{n:"bigint",h:"bigint",Gx:"field",Gy:"field"},{nBitLength:"isSafeInteger",nByteLength:"isSafeInteger"}),Object.freeze({...Zt(t.n,t.nBitLength),...t,p:t.Fp.ORDER})}function _n(t){let n=Qt(t);it(n,{a:"field",b:"field"},{allowedPrivateKeyLengths:"array",wrapPrivateKey:"boolean",isTorsionFree:"function",clearCofactor:"function",allowInfinityPoint:"boolean",fromBytes:"function",toBytes:"function"});let{endo:e,Fp:r,a:s}=n;if(e){if(!r.eql(s,r.ZERO))throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");if(typeof e!="object"||typeof e.beta!="bigint"||typeof e.splitScalar!="function")throw new Error("Expected endomorphism with beta: bigint and splitScalar: function")}return Object.freeze({...n})}var{bytesToNumberBE:Rn,hexToBytes:On}=Kt,ut={Err:class extends Error{constructor(n=""){super(n)}},_parseInt(t){let{Err:n}=ut;if(t.length<2||t[0]!==2)throw new n("Invalid signature integer tag");let e=t[1],r=t.subarray(2,e+2);if(!e||r.length!==e)throw new n("Invalid signature integer: wrong length");if(r[0]&128)throw new n("Invalid signature integer: negative");if(r[0]===0&&!(r[1]&128))throw new n("Invalid signature integer: unnecessary leading zero");return{d:Rn(r),l:t.subarray(e+2)}},toSig(t){let{Err:n}=ut,e=typeof t=="string"?On(t):t;bt(e);let r=e.length;if(r<2||e[0]!=48)throw new n("Invalid signature tag");if(e[1]!==r-2)throw new n("Invalid signature: incorrect length");let{d:s,l:o}=ut._parseInt(e.subarray(2)),{d:c,l:i}=ut._parseInt(o);if(i.length)throw new n("Invalid signature: left bytes after parsing");return{r:s,s:c}},hexFromSig(t){let n=l=>Number.parseInt(l[0],16)&8?"00"+l:l,e=l=>{let p=l.toString(16);return p.length&1?`0${p}`:p},r=n(e(t.s)),s=n(e(t.r)),o=r.length/2,c=s.length/2,i=e(o),a=e(c);return`30${e(c+o+4)}02${a}${s}02${i}${r}`}},Q=BigInt(0),V=BigInt(1),Nr=BigInt(2),Ce=BigInt(3),Ir=BigInt(4);function Ln(t){let n=_n(t),{Fp:e}=n,r=n.toBytes||((y,u,h)=>{let m=u.toAffine();return J(Uint8Array.from([4]),e.toBytes(m.x),e.toBytes(m.y))}),s=n.fromBytes||(y=>{let u=y.subarray(1),h=e.fromBytes(u.subarray(0,e.BYTES)),m=e.fromBytes(u.subarray(e.BYTES,2*e.BYTES));return{x:h,y:m}});function o(y){let{a:u,b:h}=n,m=e.sqr(y),w=e.mul(m,y);return e.add(e.add(w,e.mul(y,u)),h)}if(!e.eql(e.sqr(n.Gy),o(n.Gx)))throw new Error("bad generator point: equation left != right");function c(y){return typeof y=="bigint"&&Q<y&&y<n.n}function i(y){if(!c(y))throw new Error("Expected valid bigint: 0 < bigint < curve.n")}function a(y){let{allowedPrivateKeyLengths:u,nByteLength:h,wrapPrivateKey:m,n:w}=n;if(u&&typeof y!="bigint"){if(ot(y)&&(y=ct(y)),typeof y!="string"||!u.includes(y.length))throw new Error("Invalid key");y=y.padStart(h*2,"0")}let x;try{x=typeof y=="bigint"?y:q(L("private key",y,h))}catch{throw new Error(`private key must be ${h} bytes, hex or bigint, not ${typeof y}`)}return m&&(x=C(x,w)),i(x),x}let l=new Map;function p(y){if(!(y instanceof f))throw new Error("ProjectivePoint expected")}class f{constructor(u,h,m){if(this.px=u,this.py=h,this.pz=m,u==null||!e.isValid(u))throw new Error("x required");if(h==null||!e.isValid(h))throw new Error("y required");if(m==null||!e.isValid(m))throw new Error("z required")}static fromAffine(u){let{x:h,y:m}=u||{};if(!u||!e.isValid(h)||!e.isValid(m))throw new Error("invalid affine point");if(u instanceof f)throw new Error("projective point not allowed");let w=x=>e.eql(x,e.ZERO);return w(h)&&w(m)?f.ZERO:new f(h,m,e.ONE)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}static normalizeZ(u){let h=e.invertBatch(u.map(m=>m.pz));return u.map((m,w)=>m.toAffine(h[w])).map(f.fromAffine)}static fromHex(u){let h=f.fromAffine(s(L("pointHex",u)));return h.assertValidity(),h}static fromPrivateKey(u){return f.BASE.multiply(a(u))}_setWindowSize(u){this._WINDOW_SIZE=u,l.delete(this)}assertValidity(){if(this.is0()){if(n.allowInfinityPoint&&!e.is0(this.py))return;throw new Error("bad point: ZERO")}let{x:u,y:h}=this.toAffine();if(!e.isValid(u)||!e.isValid(h))throw new Error("bad point: x or y not FE");let m=e.sqr(h),w=o(u);if(!e.eql(m,w))throw new Error("bad point: equation left != right");if(!this.isTorsionFree())throw new Error("bad point: not in prime-order subgroup")}hasEvenY(){let{y:u}=this.toAffine();if(e.isOdd)return!e.isOdd(u);throw new Error("Field doesn't support isOdd")}equals(u){p(u);let{px:h,py:m,pz:w}=this,{px:x,py:I,pz:N}=u,b=e.eql(e.mul(h,N),e.mul(x,w)),E=e.eql(e.mul(m,N),e.mul(I,w));return b&&E}negate(){return new f(this.px,e.neg(this.py),this.pz)}double(){let{a:u,b:h}=n,m=e.mul(h,Ce),{px:w,py:x,pz:I}=this,N=e.ZERO,b=e.ZERO,E=e.ZERO,T=e.mul(w,w),z=e.mul(x,x),R=e.mul(I,I),B=e.mul(w,x);return B=e.add(B,B),E=e.mul(w,I),E=e.add(E,E),N=e.mul(u,E),b=e.mul(m,R),b=e.add(N,b),N=e.sub(z,b),b=e.add(z,b),b=e.mul(N,b),N=e.mul(B,N),E=e.mul(m,E),R=e.mul(u,R),B=e.sub(T,R),B=e.mul(u,B),B=e.add(B,E),E=e.add(T,T),T=e.add(E,T),T=e.add(T,R),T=e.mul(T,B),b=e.add(b,T),R=e.mul(x,I),R=e.add(R,R),T=e.mul(R,B),N=e.sub(N,T),E=e.mul(R,z),E=e.add(E,E),E=e.add(E,E),new f(N,b,E)}add(u){p(u);let{px:h,py:m,pz:w}=this,{px:x,py:I,pz:N}=u,b=e.ZERO,E=e.ZERO,T=e.ZERO,z=n.a,R=e.mul(n.b,Ce),B=e.mul(h,x),j=e.mul(m,I),$=e.mul(w,N),F=e.add(h,m),d=e.add(x,I);F=e.mul(F,d),d=e.add(B,j),F=e.sub(F,d),d=e.add(h,w);let g=e.add(x,N);return d=e.mul(d,g),g=e.add(B,$),d=e.sub(d,g),g=e.add(m,w),b=e.add(I,N),g=e.mul(g,b),b=e.add(j,$),g=e.sub(g,b),T=e.mul(z,d),b=e.mul(R,$),T=e.add(b,T),b=e.sub(j,T),T=e.add(j,T),E=e.mul(b,T),j=e.add(B,B),j=e.add(j,B),$=e.mul(z,$),d=e.mul(R,d),j=e.add(j,$),$=e.sub(B,$),$=e.mul(z,$),d=e.add(d,$),B=e.mul(j,d),E=e.add(E,B),B=e.mul(g,d),b=e.mul(F,b),b=e.sub(b,B),B=e.mul(F,j),T=e.mul(g,T),T=e.add(T,B),new f(b,E,T)}subtract(u){return this.add(u.negate())}is0(){return this.equals(f.ZERO)}wNAF(u){return k.wNAFCached(this,l,u,h=>{let m=e.invertBatch(h.map(w=>w.pz));return h.map((w,x)=>w.toAffine(m[x])).map(f.fromAffine)})}multiplyUnsafe(u){let h=f.ZERO;if(u===Q)return h;if(i(u),u===V)return this;let{endo:m}=n;if(!m)return k.unsafeLadder(this,u);let{k1neg:w,k1:x,k2neg:I,k2:N}=m.splitScalar(u),b=h,E=h,T=this;for(;x>Q||N>Q;)x&V&&(b=b.add(T)),N&V&&(E=E.add(T)),T=T.double(),x>>=V,N>>=V;return w&&(b=b.negate()),I&&(E=E.negate()),E=new f(e.mul(E.px,m.beta),E.py,E.pz),b.add(E)}multiply(u){i(u);let h=u,m,w,{endo:x}=n;if(x){let{k1neg:I,k1:N,k2neg:b,k2:E}=x.splitScalar(h),{p:T,f:z}=this.wNAF(N),{p:R,f:B}=this.wNAF(E);T=k.constTimeNegate(I,T),R=k.constTimeNegate(b,R),R=new f(e.mul(R.px,x.beta),R.py,R.pz),m=T.add(R),w=z.add(B)}else{let{p:I,f:N}=this.wNAF(h);m=I,w=N}return f.normalizeZ([m,w])[0]}multiplyAndAddUnsafe(u,h,m){let w=f.BASE,x=(N,b)=>b===Q||b===V||!N.equals(w)?N.multiplyUnsafe(b):N.multiply(b),I=x(this,h).add(x(u,m));return I.is0()?void 0:I}toAffine(u){let{px:h,py:m,pz:w}=this,x=this.is0();u==null&&(u=x?e.ONE:e.inv(w));let I=e.mul(h,u),N=e.mul(m,u),b=e.mul(w,u);if(x)return{x:e.ZERO,y:e.ZERO};if(!e.eql(b,e.ONE))throw new Error("invZ was invalid");return{x:I,y:N}}isTorsionFree(){let{h:u,isTorsionFree:h}=n;if(u===V)return!0;if(h)return h(f,this);throw new Error("isTorsionFree() has not been declared for the elliptic curve")}clearCofactor(){let{h:u,clearCofactor:h}=n;return u===V?this:h?h(f,this):this.multiplyUnsafe(n.h)}toRawBytes(u=!0){return this.assertValidity(),r(f,this,u)}toHex(u=!0){return ct(this.toRawBytes(u))}}f.BASE=new f(n.Gx,n.Gy,e.ONE),f.ZERO=new f(e.ZERO,e.ONE,e.ZERO);let v=n.nBitLength,k=Le(f,n.endo?Math.ceil(v/2):v);return{CURVE:n,ProjectivePoint:f,normPrivateKeyToScalar:a,weierstrassEquation:o,isWithinCurveOrder:c}}function Cn(t){let n=Qt(t);return it(n,{hash:"hash",hmac:"function",randomBytes:"function"},{bits2int:"function",bits2int_modN:"function",lowS:"boolean"}),Object.freeze({lowS:!0,...n})}function Ue(t){let n=Cn(t),{Fp:e,n:r}=n,s=e.BYTES+1,o=2*e.BYTES+1;function c(d){return Q<d&&d<e.ORDER}function i(d){return C(d,r)}function a(d){return Ct(d,r)}let{ProjectivePoint:l,normPrivateKeyToScalar:p,weierstrassEquation:f,isWithinCurveOrder:v}=Ln({...n,toBytes(d,g,S){let _=g.toAffine(),A=e.toBytes(_.x),P=J;return S?P(Uint8Array.from([g.hasEvenY()?2:3]),A):P(Uint8Array.from([4]),A,e.toBytes(_.y))},fromBytes(d){let g=d.length,S=d[0],_=d.subarray(1);if(g===s&&(S===2||S===3)){let A=q(_);if(!c(A))throw new Error("Point is not on curve");let P=f(A),D;try{D=e.sqrt(P)}catch(W){let et=W instanceof Error?": "+W.message:"";throw new Error("Point is not on curve"+et)}let H=(D&V)===V;return(S&1)===1!==H&&(D=e.neg(D)),{x:A,y:D}}else if(g===o&&S===4){let A=e.fromBytes(_.subarray(0,e.BYTES)),P=e.fromBytes(_.subarray(e.BYTES,2*e.BYTES));return{x:A,y:P}}else throw new Error(`Point of length ${g} was invalid. Expected ${s} compressed bytes or ${o} uncompressed bytes`)}}),k=d=>ct(X(d,n.nByteLength));function y(d){let g=r>>V;return d>g}function u(d){return y(d)?i(-d):d}let h=(d,g,S)=>q(d.slice(g,S));class m{constructor(g,S,_){this.r=g,this.s=S,this.recovery=_,this.assertValidity()}static fromCompact(g){let S=n.nByteLength;return g=L("compactSignature",g,S*2),new m(h(g,0,S),h(g,S,2*S))}static fromDER(g){let{r:S,s:_}=ut.toSig(L("DER",g));return new m(S,_)}assertValidity(){if(!v(this.r))throw new Error("r must be 0 < r < CURVE.n");if(!v(this.s))throw new Error("s must be 0 < s < CURVE.n")}addRecoveryBit(g){return new m(this.r,this.s,g)}recoverPublicKey(g){let{r:S,s:_,recovery:A}=this,P=E(L("msgHash",g));if(A==null||![0,1,2,3].includes(A))throw new Error("recovery id invalid");let D=A===2||A===3?S+n.n:S;if(D>=e.ORDER)throw new Error("recovery id 2 or 3 invalid");let H=A&1?"03":"02",tt=l.fromHex(H+k(D)),W=a(D),et=i(-P*W),yt=i(_*W),nt=l.BASE.multiplyAndAddUnsafe(tt,et,yt);if(!nt)throw new Error("point at infinify");return nt.assertValidity(),nt}hasHighS(){return y(this.s)}normalizeS(){return this.hasHighS()?new m(this.r,i(-this.s),this.recovery):this}toDERRawBytes(){return lt(this.toDERHex())}toDERHex(){return ut.hexFromSig({r:this.r,s:this.s})}toCompactRawBytes(){return lt(this.toCompactHex())}toCompactHex(){return k(this.r)+k(this.s)}}let w={isValidPrivateKey(d){try{return p(d),!0}catch{return!1}},normPrivateKeyToScalar:p,randomPrivateKey:()=>{let d=Gt(n.n);return Oe(n.randomBytes(d),n.n)},precompute(d=8,g=l.BASE){return g._setWindowSize(d),g.multiply(BigInt(3)),g}};function x(d,g=!0){return l.fromPrivateKey(d).toRawBytes(g)}function I(d){let g=ot(d),S=typeof d=="string",_=(g||S)&&d.length;return g?_===s||_===o:S?_===2*s||_===2*o:d instanceof l}function N(d,g,S=!0){if(I(d))throw new Error("first arg must be private key");if(!I(g))throw new Error("second arg must be public key");return l.fromHex(g).multiply(p(d)).toRawBytes(S)}let b=n.bits2int||function(d){let g=q(d),S=d.length*8-n.nBitLength;return S>0?g>>BigInt(S):g},E=n.bits2int_modN||function(d){return i(b(d))},T=Et(n.nBitLength);function z(d){if(typeof d!="bigint")throw new Error("bigint expected");if(!(Q<=d&&d<T))throw new Error(`bigint expected < 2^${n.nBitLength}`);return X(d,n.nByteLength)}function R(d,g,S=B){if(["recovered","canonical"].some(at=>at in S))throw new Error("sign() legacy options not supported");let{hash:_,randomBytes:A}=n,{lowS:P,prehash:D,extraEntropy:H}=S;P==null&&(P=!0),d=L("msgHash",d),D&&(d=L("prehashed msgHash",_(d)));let tt=E(d),W=p(g),et=[z(W),z(tt)];if(H!=null&&H!==!1){let at=H===!0?A(e.BYTES):H;et.push(L("extraEntropy",at))}let yt=J(...et),nt=tt;function $t(at){let dt=b(at);if(!v(dt))return;let he=a(dt),Z=l.BASE.multiply(dt).toAffine(),pt=i(Z.x);if(pt===Q)return;let kt=i(he*i(nt+pt*W));if(kt===Q)return;let me=(Z.x===pt?0:2)|Number(Z.y&V),ge=kt;return P&&y(kt)&&(ge=u(kt),me^=1),new m(pt,ge,me)}return{seed:yt,k2sig:$t}}let B={lowS:n.lowS,prehash:!1},j={lowS:n.lowS,prehash:!1};function $(d,g,S=B){let{seed:_,k2sig:A}=R(d,g,S),P=n;return Wt(P.hash.outputLen,P.nByteLength,P.hmac)(_,A)}l.BASE._setWindowSize(8);function F(d,g,S,_=j){let A=d;if(g=L("msgHash",g),S=L("publicKey",S),"strict"in _)throw new Error("options.strict was renamed to lowS");let{lowS:P,prehash:D}=_,H,tt;try{if(typeof A=="string"||ot(A))try{H=m.fromDER(A)}catch(Z){if(!(Z instanceof ut.Err))throw Z;H=m.fromCompact(A)}else if(typeof A=="object"&&typeof A.r=="bigint"&&typeof A.s=="bigint"){let{r:Z,s:pt}=A;H=new m(Z,pt)}else throw new Error("PARSE");tt=l.fromHex(S)}catch(Z){if(Z.message==="PARSE")throw new Error("signature must be Signature instance, Uint8Array or hex string");return!1}if(P&&H.hasHighS())return!1;D&&(g=n.hash(g));let{r:W,s:et}=H,yt=E(g),nt=a(et),$t=i(yt*nt),at=i(W*nt),dt=l.BASE.multiplyAndAddUnsafe(tt,$t,at)?.toAffine();return dt?i(dt.x)===W:!1}return{CURVE:n,getPublicKey:x,getSharedSecret:N,sign:$,verify:F,ProjectivePoint:l,Signature:m,utils:w}}var Ut=class extends gt{constructor(n,e){super(),this.finished=!1,this.destroyed=!1,ye(n);let r=wt(e);if(this.iHash=n.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;let s=this.blockLen,o=new Uint8Array(s);o.set(r.length>s?n.create().update(r).digest():r);for(let c=0;c<o.length;c++)o[c]^=54;this.iHash.update(o),this.oHash=n.create();for(let c=0;c<o.length;c++)o[c]^=106;this.oHash.update(o),o.fill(0)}update(n){return mt(this),this.iHash.update(n),this}digestInto(n){mt(this),ht(n,this.outputLen),this.finished=!0,this.iHash.digestInto(n),this.oHash.update(n),this.oHash.digestInto(n),this.destroy()}digest(){let n=new Uint8Array(this.oHash.outputLen);return this.digestInto(n),n}_cloneInto(n){n||(n=Object.create(Object.getPrototypeOf(this),{}));let{oHash:e,iHash:r,finished:s,destroyed:o,blockLen:c,outputLen:i}=this;return n=n,n.finished=s,n.destroyed=o,n.blockLen=c,n.outputLen=i,n.oHash=e._cloneInto(n.oHash),n.iHash=r._cloneInto(n.iHash),n}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}},Ft=(t,n,e)=>new Ut(t,n).update(e).digest();Ft.create=(t,n)=>new Ut(t,n);function Un(t){return{hash:t,hmac:(n,...e)=>Ft(t,n,Ee(...e)),randomBytes:Bt}}function Pe(t,n){let e=r=>Ue({...t,...Un(r)});return Object.freeze({...e(n),create:e})}var Ht=BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),Pt=BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),He=BigInt(1),qt=BigInt(2),qe=(t,n)=>(t+n/qt)/n;function je(t){let n=Ht,e=BigInt(3),r=BigInt(6),s=BigInt(11),o=BigInt(22),c=BigInt(23),i=BigInt(44),a=BigInt(88),l=t*t*t%n,p=l*l*t%n,f=M(p,e,n)*p%n,v=M(f,e,n)*p%n,k=M(v,qt,n)*l%n,y=M(k,s,n)*k%n,u=M(y,o,n)*y%n,h=M(u,i,n)*u%n,m=M(h,a,n)*h%n,w=M(m,i,n)*u%n,x=M(w,e,n)*p%n,I=M(x,c,n)*y%n,N=M(I,r,n)*l%n,b=M(N,qt,n);if(!ee.eql(ee.sqr(b),t))throw new Error("Cannot find square root");return b}var ee=_e(Ht,void 0,void 0,{sqrt:je}),se=Pe({a:BigInt(0),b:BigInt(7),Fp:ee,n:Pt,Gx:BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),Gy:BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),h:BigInt(1),lowS:!0,endo:{beta:BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),splitScalar:t=>{let n=Pt,e=BigInt("0x3086d221a7d46bcde86c90e49284eb15"),r=-He*BigInt("0xe4437ed6010e88286f547fa90abfe4c3"),s=BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"),o=e,c=BigInt("0x100000000000000000000000000000000"),i=qe(o*t,n),a=qe(-r*t,n),l=C(t-i*e-a*s,n),p=C(-i*r-a*o,n),f=l>c,v=p>c;if(f&&(l=n-l),v&&(p=n-p),l>c||p>c)throw new Error("splitScalar: Endomorphism failed, k="+t);return{k1neg:f,k1:l,k2neg:v,k2:p}}}},_t),jt=BigInt(0),$e=t=>typeof t=="bigint"&&jt<t&&t<Ht,Pn=t=>typeof t=="bigint"&&jt<t&&t<Pt,De={};function Dt(t,...n){let e=De[t];if(e===void 0){let r=_t(Uint8Array.from(t,s=>s.charCodeAt(0)));e=J(r,r),De[t]=e}return _t(J(e,...n))}var oe=t=>t.toRawBytes(!0).slice(1),ne=t=>X(t,32),te=t=>C(t,Ht),xt=t=>C(t,Pt),ie=se.ProjectivePoint,qn=(t,n,e)=>ie.BASE.multiplyAndAddUnsafe(t,n,e);function re(t){let n=se.utils.normPrivateKeyToScalar(t),e=ie.fromPrivateKey(n);return{scalar:e.hasEvenY()?n:xt(-n),bytes:oe(e)}}function Me(t){if(!$e(t))throw new Error("bad x: need 0 < x < p");let n=te(t*t),e=te(n*t+BigInt(7)),r=je(e);r%qt!==jt&&(r=te(-r));let s=new ie(t,r,He);return s.assertValidity(),s}function ze(...t){return xt(q(Dt("BIP0340/challenge",...t)))}function Dn(t){return re(t).bytes}function Hn(t,n,e=Bt(32)){let r=L("message",t),{bytes:s,scalar:o}=re(n),c=L("auxRand",e,32),i=ne(o^q(Dt("BIP0340/aux",c))),a=Dt("BIP0340/nonce",i,s,r),l=xt(q(a));if(l===jt)throw new Error("sign failed: k is zero");let{bytes:p,scalar:f}=re(l),v=ze(p,s,r),k=new Uint8Array(64);if(k.set(p,0),k.set(ne(xt(f+v*o)),32),!Ve(k,r,s))throw new Error("sign: Invalid signature produced");return k}function Ve(t,n,e){let r=L("signature",t,64),s=L("message",n),o=L("publicKey",e,32);try{let c=Me(q(o)),i=q(r.subarray(0,32));if(!$e(i))return!1;let a=q(r.subarray(32,64));if(!Pn(a))return!1;let l=ze(ne(i),oe(c),s),p=qn(c,a,xt(-l));return!(!p||!p.hasEvenY()||p.toAffine().x!==i)}catch{return!1}}var We={getPublicKey:Dn,sign:Hn,verify:Ve,utils:{randomPrivateKey:se.utils.randomPrivateKey,lift_x:Me,pointToBytes:oe,numberToBytesBE:X,bytesToNumberBE:q,taggedHash:Dt,mod:C}};var Y=!0,vt=2121,St={name:"Nosflare",description:"A serverless Nostr relay through Cloudflare Worker and D1 database",pubkey:"d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",contact:"lux@fed.wtf",supported_nips:[1,2,4,5,9,11,12,15,16,17,20,22,33,40],software:"https://github.com/Spl0itable/nosflare",version:"7.0.0",icon:"https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/flare.png",limitation:{payment_required:Y,restricted_writes:Y}},Ke={Luxas:"d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df"},Xe=!1,ae=!1,Ye=new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,40,41,42,43,44,64,818,1021,1022,1040,1059,1063,1311,1617,1621,1622,1630,1633,1971,1984,1985,1986,1987,2003,2004,2022,4550,5e3,5999,6e3,6999,7e3,9e3,9030,9041,9467,9734,9735,9802,1e4,10001,10002,10003,10004,10005,10006,10007,10009,10015,10030,10050,10063,10096,13194,21e3,22242,23194,23195,24133,24242,27235,3e4,30001,30002,30003,30004,30005,30007,30008,30009,30015,30017,30018,30019,30020,30023,30024,30030,30040,30041,30063,30078,30311,30315,30402,30403,30617,30618,30818,30819,31890,31922,31923,31924,31925,31989,31990,34235,34236,34237,34550,39e3,39001,39002,39003,39004,39005,39006,39007,39008,39009]),Ze=new Set(["3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f","fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058","e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18","05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01","53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"]),ce=new Set([]),Ge=new Set([1064]),le=new Set([]),Je=new Set(["~~ hello world! ~~"]),Qe=new Set([]),fe=new Set([]);var ue={rate:100/6e4,capacity:100},de={rate:1e4/6e4,capacity:1e4};var Tt=class{constructor(n,e){this.tokens=e,this.lastRefillTime=Date.now(),this.capacity=e,this.fillRate=n}removeToken(){return this.refill(),this.tokens<1?!1:(this.tokens-=1,!0)}refill(){let n=Date.now(),e=n-this.lastRefillTime,r=Math.floor(e*this.fillRate);this.tokens=Math.min(this.capacity,this.tokens+r),this.lastRefillTime=n}};var pe=class{constructor(n,e){this.state=n;this.env=e;this.sessions=new Map,this.eventSubscriptions=new Map}async fetch(n){let e=n.headers.get("Upgrade");if(!e||e!=="websocket")return new Response("Expected Upgrade: websocket",{status:426});let r=new WebSocketPair,[s,o]=Object.values(r);return await this.handleSession(o),new Response(null,{status:101,webSocket:s})}async handleSession(n){n.accept();let e=crypto.randomUUID(),r={id:e,webSocket:n,subscriptions:new Map,pubkeyRateLimiter:new Tt(ue.rate,ue.capacity),reqRateLimiter:new Tt(de.rate,de.capacity),bookmark:"first-unconstrained"};this.sessions.set(e,r),n.addEventListener("message",async s=>{try{let o=JSON.parse(s.data);await this.handleMessage(r,o)}catch(o){console.error("Error handling message:",o),this.sendError(n,"Failed to process message")}}),n.addEventListener("close",()=>{this.handleClose(e)}),n.addEventListener("error",s=>{console.error("WebSocket error:",s),this.handleClose(e)})}async handleMessage(n,e){if(!Array.isArray(e)){this.sendError(n.webSocket,"Invalid message format: expected JSON array");return}let[r,...s]=e;switch(r){case"EVENT":await this.handleEvent(n,s[0]);break;case"REQ":await this.handleReq(n,e);break;case"CLOSE":this.handleCloseSubscription(n,s[0]);break;default:this.sendError(n.webSocket,`Unknown message type: ${r}`)}}async handleEvent(n,e){let s=await(await fetch(`https://${this.env.WORKER_HOST}/internal/process-event`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:e,sessionId:n.id})})).json();s.success&&await this.broadcastEvent(e),this.sendOK(n.webSocket,e.id,s.success,s.message)}async handleReq(n,e){let[r,s,...o]=e;if(!n.reqRateLimiter.removeToken()){this.sendClosed(n.webSocket,s,"rate-limited: slow down there chief");return}n.subscriptions.set(s,o);let i=await(await fetch(`https://${this.env.WORKER_HOST}/internal/query-events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filters:o,bookmark:n.bookmark})})).json();if(i.error){this.sendClosed(n.webSocket,s,i.error);return}i.bookmark&&(n.bookmark=i.bookmark);for(let a of i.events)n.webSocket.send(JSON.stringify(["EVENT",s,a]));this.sendEOSE(n.webSocket,s)}handleCloseSubscription(n,e){n.subscriptions.delete(e),n.webSocket.send(JSON.stringify(["CLOSED",e,"Subscription closed"]))}async broadcastEvent(n){for(let[e,r]of this.sessions)for(let[s,o]of r.subscriptions)if(this.matchesFilters(n,o))try{r.webSocket.send(JSON.stringify(["EVENT",s,n]))}catch(c){console.error(`Error broadcasting to session ${e}:`,c)}}matchesFilters(n,e){return e.some(r=>this.matchesFilter(n,r))}matchesFilter(n,e){if(e.ids&&!e.ids.includes(n.id)||e.authors&&!e.authors.includes(n.pubkey)||e.kinds&&!e.kinds.includes(n.kind)||e.since&&n.created_at<e.since||e.until&&n.created_at>e.until)return!1;for(let[r,s]of Object.entries(e))if(r.startsWith("#")&&Array.isArray(s)){let o=r.substring(1),c=n.tags.filter(i=>i[0]===o).map(i=>i[1]);if(!s.some(i=>c.includes(i)))return!1}return!0}handleClose(n){this.sessions.delete(n)}sendOK(n,e,r,s){n.send(JSON.stringify(["OK",e,r,s]))}sendError(n,e){n.send(JSON.stringify(["NOTICE",e]))}sendEOSE(n,e){n.send(JSON.stringify(["EOSE",e]))}sendClosed(n,e,r){n.send(JSON.stringify(["CLOSED",e,r]))}};async function jn(t){try{let r=await t.withSession("first-unconstrained").prepare("SELECT value FROM system_config WHERE key = 'db_initialized' LIMIT 1").first().catch(()=>null);if(r&&r.value==="1"){console.log("Database already initialized");return}}catch{console.log("Database not initialized, creating schema...")}let n=t.withSession("first-primary");try{await n.prepare(`
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
      )`,"CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey)"];for(let r of e)await n.prepare(r).run();await n.prepare("PRAGMA foreign_keys = ON").run(),await n.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('db_initialized', '1')").run(),await n.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('schema_version', '1')").run(),console.log("Database initialization completed!")}catch(e){throw console.error("Failed to initialize database:",e),e}}function $n(t){return ce.size>0&&!ce.has(t)?!1:!Ze.has(t)}function Mn(t){return le.size>0&&!le.has(t)?!1:!Ge.has(t)}function zn(t){let n=(t.content||"").toLowerCase(),e=t.tags.map(r=>r.join("").toLowerCase());for(let r of Je){let s=r.toLowerCase();if(n.includes(s)||e.some(o=>o.includes(s)))return!0}return!1}function Vn(t){return fe.size>0&&!fe.has(t)?!1:!Qe.has(t)}async function Wn(t){try{let n=Fe(t.sig),e=Kn(t),r=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e)),s=new Uint8Array(r),o=Fe(t.pubkey);return We.verify(n,s,o)}catch(n){return console.error("Error verifying event signature:",n),!1}}function Kn(t){return JSON.stringify([0,t.pubkey,t.created_at,t.kind,t.tags,t.content])}function Fe(t){if(t.length%2!==0)throw new Error("Invalid hex string");let n=new Uint8Array(t.length/2);for(let e=0;e<n.length;e++)n[e]=parseInt(t.substr(e*2,2),16);return n}function Xn(t){return Array.from(t).map(n=>n.toString(16).padStart(2,"0")).join("")}async function tn(t){let n=JSON.stringify(ae?{kind:t.kind,tags:t.tags,content:t.content}:{pubkey:t.pubkey,kind:t.kind,tags:t.tags,content:t.content}),e=new TextEncoder().encode(n),r=await crypto.subtle.digest("SHA-256",e);return Xn(new Uint8Array(r))}function en(t){return Xe&&Ye.has(t)}async function nn(t,n){if(!Y)return!0;try{return await n.relayDb.withSession("first-unconstrained").prepare("SELECT pubkey FROM paid_pubkeys WHERE pubkey = ? LIMIT 1").bind(t).first()!==null}catch(e){return console.error(`Error checking paid status for ${t}:`,e),!1}}async function Yn(t,n){try{return await n.relayDb.withSession("first-primary").prepare(`
      INSERT INTO paid_pubkeys (pubkey, paid_at, amount_sats)
      VALUES (?, ?, ?)
      ON CONFLICT(pubkey) DO UPDATE SET
        paid_at = excluded.paid_at,
        amount_sats = excluded.amount_sats
    `).bind(t,Math.floor(Date.now()/1e3),vt).run(),!0}catch(e){return console.error(`Error saving paid pubkey ${t}:`,e),!1}}async function Zn(t,n,e){try{if(!await Wn(t))return{success:!1,message:"invalid: signature verification failed"};if(Y&&!await nn(t.pubkey,e))return{success:!1,message:"blocked: payment required"};if(!$n(t.pubkey))return{success:!1,message:"blocked: pubkey not allowed"};if(!Mn(t.kind))return{success:!1,message:`blocked: event kind ${t.kind} not allowed`};if(zn(t))return{success:!1,message:"blocked: content contains blocked phrases"};for(let o of t.tags)if(!Vn(o[0]))return{success:!1,message:`blocked: tag '${o[0]}' not allowed`};return t.kind===5?await Jn(t,e):await Gn(t,e)}catch(r){return console.error(`Error processing event: ${r.message}`),{success:!1,message:`error: ${r.message}`}}}async function Gn(t,n){try{let e=n.relayDb.withSession("first-primary");if(await e.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(t.id).first())return{success:!1,message:"duplicate: already have this event"};if(en(t.kind)){let o=await tn(t);if(ae?await e.prepare("SELECT event_id FROM content_hashes WHERE hash = ? LIMIT 1").bind(o).first():await e.prepare("SELECT event_id FROM content_hashes WHERE hash = ? AND pubkey = ? LIMIT 1").bind(o,t.pubkey).first())return{success:!1,message:"duplicate: content already exists"}}let s=[e.prepare(`
        INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(t.id,t.pubkey,t.created_at,t.kind,JSON.stringify(t.tags),t.content,t.sig)];for(let o of t.tags)o[0]&&o[1]&&s.push(e.prepare(`
            INSERT INTO tags (event_id, tag_name, tag_value)
            VALUES (?, ?, ?)
          `).bind(t.id,o[0],o[1]));if(en(t.kind)){let o=await tn(t);s.push(e.prepare(`
          INSERT INTO content_hashes (hash, event_id, pubkey, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(o,t.id,t.pubkey,t.created_at))}return await e.batch(s),{success:!0,message:"Event received successfully"}}catch(e){return console.error(`Error saving event: ${e.message}`),{success:!1,message:"error: could not save event"}}}async function Jn(t,n){let e=t.tags.filter(o=>o[0]==="e").map(o=>o[1]);if(e.length===0)return{success:!0,message:"No events to delete"};let r=n.relayDb.withSession("first-primary"),s=0;for(let o of e)try{let c=await r.prepare("SELECT pubkey FROM events WHERE id = ? LIMIT 1").bind(o).first();if(!c||c.pubkey!==t.pubkey)continue;(await r.prepare("UPDATE events SET deleted = 1 WHERE id = ?").bind(o).run()).meta.changes>0&&s++}catch(c){console.error(`Error deleting event ${o}:`,c)}return{success:!0,message:s>0?`Deleted ${s} events`:"No matching events found"}}async function Qn(t,n,e){try{let r=e.relayDb.withSession(n),s=new Map;for(let i of t){let a=Fn(i),l=await r.prepare(a.sql).bind(...a.params).all();for(let p of l.results){let f={id:p.id,pubkey:p.pubkey,created_at:p.created_at,kind:p.kind,tags:JSON.parse(p.tags),content:p.content,sig:p.sig};s.set(f.id,f)}}let o=Array.from(s.values()).sort((i,a)=>a.created_at!==i.created_at?a.created_at-i.created_at:i.id.localeCompare(a.id)),c=r.getBookmark();return{events:o,bookmark:c}}catch(r){return console.error(`Error querying events: ${r.message}`),{events:[],bookmark:null}}}function Fn(t){let n="SELECT * FROM events WHERE deleted = 0",e=[],r=[];t.ids&&t.ids.length>0&&(r.push(`id IN (${t.ids.map(()=>"?").join(",")})`),e.push(...t.ids)),t.authors&&t.authors.length>0&&(r.push(`pubkey IN (${t.authors.map(()=>"?").join(",")})`),e.push(...t.authors)),t.kinds&&t.kinds.length>0&&(r.push(`kind IN (${t.kinds.map(()=>"?").join(",")})`),e.push(...t.kinds)),t.since&&(r.push("created_at >= ?"),e.push(t.since)),t.until&&(r.push("created_at <= ?"),e.push(t.until));let s=[];for(let[o,c]of Object.entries(t))if(o.startsWith("#")&&Array.isArray(c)&&c.length>0){let i=o.substring(1);s.push(`
        id IN (
          SELECT event_id FROM tags 
          WHERE tag_name = ? AND tag_value IN (${c.map(()=>"?").join(",")})
        )
      `),e.push(i,...c)}return s.length>0&&r.push(`(${s.join(" OR ")})`),r.length>0&&(n+=" AND "+r.join(" AND ")),n+=" ORDER BY created_at DESC",n+=" LIMIT ?",e.push(Math.min(t.limit||1e4,1e4)),{sql:n,params:e}}function tr(t){let n={...St};if(Y){let e=new URL(t.url);n.payments_url=`${e.protocol}//${e.host}`,n.fees={admission:[{amount:vt*1e3,unit:"msats"}]}}return new Response(JSON.stringify(n),{status:200,headers:{"Content-Type":"application/nostr+json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Accept","Access-Control-Allow-Methods":"GET"}})}function er(){let n=`
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
        
        ${Y?`
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
        
        ${Y?`
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
    ${Y?'<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>':""}
</body>
</html>
  `;return new Response(n,{status:200,headers:{"Content-Type":"text/html;charset=UTF-8","Cache-Control":"public, max-age=3600"}})}function nr(t){let n=t.searchParams.get("name");if(!n)return new Response(JSON.stringify({error:"Missing 'name' parameter"}),{status:400,headers:{"Content-Type":"application/json"}});let e=Ke[n.toLowerCase()];if(!e)return new Response(JSON.stringify({error:"User not found"}),{status:404,headers:{"Content-Type":"application/json"}});let r={names:{[n]:e},relays:{[e]:[]}};return new Response(JSON.stringify(r),{status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}async function rr(t,n){let r=new URL(t.url).searchParams.get("pubkey");if(!r)return new Response(JSON.stringify({error:"Missing pubkey"}),{status:400,headers:{"Content-Type":"application/json"}});let s=await nn(r,n);return new Response(JSON.stringify({paid:s}),{status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}async function sr(t,n){try{let r=new URL(t.url).searchParams.get("npub");if(!r)return new Response(JSON.stringify({error:"Missing pubkey"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});let s=await Yn(r,n);return new Response(JSON.stringify({success:s,message:s?"Payment recorded successfully":"Failed to save payment"}),{status:s?200:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}catch{return new Response(JSON.stringify({error:"Invalid request"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}var rs={async fetch(t,n,e){try{let r=new URL(t.url);if(n.WORKER_HOST=r.host,r.pathname==="/internal/process-event"&&t.method==="POST"){let{event:s,sessionId:o}=await t.json(),c=await Zn(s,o,n);return new Response(JSON.stringify(c),{headers:{"Content-Type":"application/json"}})}if(r.pathname==="/internal/query-events"&&t.method==="POST"){let{filters:s,bookmark:o}=await t.json(),c=await Qn(s,o,n);return new Response(JSON.stringify(c),{headers:{"Content-Type":"application/json"}})}if(t.method==="POST"&&r.searchParams.has("notify-zap")&&Y)return await sr(t,n);if(r.pathname==="/api/check-payment"&&Y)return await rr(t,n);if(r.pathname==="/")if(t.headers.get("Upgrade")==="websocket"){let s=n.RELAY_WEBSOCKET.idFromName(r.hostname);return n.RELAY_WEBSOCKET.get(s).fetch(t)}else return t.headers.get("Accept")==="application/nostr+json"?tr(t):(e.waitUntil(jn(n.relayDb)),er());else{if(r.pathname==="/.well-known/nostr.json")return nr(r);if(r.pathname==="/favicon.ico"){let s=await fetch(St.icon);if(s.ok){let o=new Headers(s.headers);return o.set("Cache-Control","max-age=3600"),new Response(s.body,{status:s.status,headers:o})}return new Response(null,{status:404})}else return new Response("Invalid request",{status:400})}}catch(r){return console.error("Error in fetch handler:",r),new Response("Internal Server Error",{status:500})}}};export{pe as RelayWebSocket,rs as default};
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
