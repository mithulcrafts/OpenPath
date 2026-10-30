import { Network } from 'lucide-react';

export function PathIllustration() {
  return <div className="path-illustration" aria-hidden="true">
    <div className="illustration-heading"><span><span className="status-pin" />Your product, from the other side</span><Network size={14} /></div>
    <svg className="path-art" viewBox="0 0 450 355" fill="none">
      <defs><pattern id="path-grid" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#466674" opacity=".6" /></pattern></defs>
      <rect width="450" height="355" fill="url(#path-grid)" />
      <path d="M130 106h53v63h32" stroke="#b3c9d7" strokeWidth="1.2"/><path d="m210 164 5 5-5 5" stroke="#b3c9d7" strokeWidth="1.2"/>
      <path d="M314 214v40h-63" stroke="#e7b66b" strokeWidth="1.2" strokeDasharray="4 4"/><path d="m256 249-5 5 5 5" stroke="#e7b66b" strokeWidth="1.2"/>
      <rect x="27" y="43" width="114" height="126" rx="6" fill="#1d2d38" stroke="#4c687a"/>
      <rect x="39" y="56" width="22" height="23" rx="3" fill="#14232d"/><text x="44" y="72" fill="#dce9f5" fontSize="11" fontWeight="700" fontFamily="Manrope, sans-serif">01</text>
      <text x="39" y="103" fill="#e3edf7" fontSize="12" fontWeight="650" fontFamily="Manrope, sans-serif">Your product</text>
      <text x="39" y="123" fill="#9db7c9" fontSize="10" fontFamily="Manrope, sans-serif">A human interface.</text>
      <path d="M39 143h70m-70 8h47" stroke="#4e6879" strokeWidth="3" strokeLinecap="round"/>
      <rect x="215" y="92" width="207" height="129" rx="6" fill="#1b2d37" stroke="#4c687a"/>
      <rect x="228" y="105" width="22" height="23" rx="3" fill="#14232d"/><text x="233" y="121" fill="#dce9f5" fontSize="11" fontWeight="700" fontFamily="Manrope, sans-serif">02</text>
      <text x="260" y="121" fill="#e3edf7" fontSize="12" fontWeight="650" fontFamily="Manrope, sans-serif">An agent's view</text>
      <path d="M228 141h180" stroke="#3c5363"/>
      <text x="229" y="160" fill="#9cb9ce" fontSize="10" fontFamily="Consolas, monospace">role</text><text x="291" y="160" fill="#9fe1e7" fontSize="10" fontFamily="Consolas, monospace">"button"</text>
      <text x="229" y="180" fill="#9cb9ce" fontSize="10" fontFamily="Consolas, monospace">name</text><text x="291" y="180" fill="#efc080" fontSize="10" fontFamily="Consolas, monospace">""</text>
      <text x="229" y="200" fill="#9cb9ce" fontSize="10" fontFamily="Consolas, monospace">intent</text><text x="291" y="200" fill="#efc080" fontSize="10" fontFamily="Consolas, monospace">unknown</text>
      <rect x="65" y="231" width="187" height="93" rx="6" fill="#19353a" stroke="#79dce6"/>
      <rect x="79" y="244" width="22" height="23" rx="3" fill="#21464b"/><text x="83" y="260" fill="#a1ecf1" fontSize="11" fontWeight="700" fontFamily="Manrope, sans-serif">03</text>
      <text x="110" y="260" fill="#e3edf7" fontSize="12" fontWeight="650" fontFamily="Manrope, sans-serif">A concrete change</text>
      <text x="79" y="285" fill="#accbd7" fontSize="10" fontFamily="Manrope, sans-serif">Give the control a meaningful name.</text>
      <text x="79" y="305" fill="#d6f36a" fontSize="10" fontFamily="Consolas, monospace">aria-label="Compare products"</text>
      <text x="319" y="290" fill="#a8bfce" fontSize="10" fontFamily="Manrope, sans-serif">Evidence first.</text><text x="319" y="308" fill="#d6f36a" fontSize="10" fontFamily="Manrope, sans-serif">Then a way forward.</text>
    </svg>
    <div className="illustration-caption"><span>Illustrative workflow</span><span>Observe · Improve · Verify</span></div>
  </div>;
}
