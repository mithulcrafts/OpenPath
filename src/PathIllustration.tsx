export function PathIllustration() {
  return <div className="path-illustration" aria-hidden="true">
    <div className="illustration-heading"><span className="illustration-dot" />A different point of view</div>
    <svg className="path-art" viewBox="0 0 440 420" fill="none">
      <defs>
        <pattern id="path-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#fff" opacity=".09" /></pattern>
        <filter id="path-shadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="16" stdDeviation="15" floodColor="#000" floodOpacity=".24" /></filter>
      </defs>
      <rect width="440" height="420" fill="url(#path-grid)" />
      <circle cx="225" cy="223" r="140" stroke="#4d4e49" strokeDasharray="3 8" />
      <circle cx="225" cy="223" r="102" stroke="#3b3d38" />
      <path d="M122 162v57c0 15 12 27 27 27h128c16 0 28 12 28 28v37" stroke="#54544b" strokeWidth="2" />
      <path className="signal-path" d="M122 162v57c0 15 12 27 27 27h128c16 0 28 12 28 28v37" stroke="#f49c72" strokeWidth="2.5" pathLength="1" />
      <path d="M244 246v-40c0-9 7-16 16-16h64" stroke="#777268" strokeDasharray="4 5" />
      <circle cx="333" cy="190" r="12" fill="#39332e" stroke="#7d5c49" />
      <path d="m329 186 8 8m0-8-8 8" stroke="#e1a287" strokeWidth="1.5" strokeLinecap="round" />
      <text x="320" y="165" fill="#c2bfb4" fontSize="10" fontFamily="Manrope, sans-serif">Find the friction</text>
      <g className="scene-site" filter="url(#path-shadow)" transform="rotate(-7 150 117)">
        <rect x="37" y="40" width="239" height="153" rx="12" fill="#fbfaf7" />
        <path d="M37 73h239" stroke="#e5e2d9" />
        <circle cx="53" cy="56" r="3" fill="#cfcbc1" /><circle cx="64" cy="56" r="3" fill="#cfcbc1" /><circle cx="75" cy="56" r="3" fill="#cfcbc1" />
        <text x="92" y="60" fill="#73736b" fontSize="9" fontFamily="Manrope, sans-serif">your-website.com</text>
        <rect x="55" y="91" width="72" height="83" rx="6" fill="#ece6d9" />
        <path d="M74 148v-30l17-10 18 10v30l-18 10-17-10Z" stroke="#b1a695" strokeWidth="1.5" /><path d="m74 118 17 10 18-10m-18 10v30" stroke="#b1a695" strokeWidth="1.5" />
        <text x="141" y="108" fill="#282b25" fontSize="13" fontWeight="650" fontFamily="Manrope, sans-serif">Your product.</text>
        <rect x="141" y="119" width="103" height="4" rx="2" fill="#d8d5cb" /><rect x="141" y="129" width="73" height="4" rx="2" fill="#e3e0d7" />
        <rect x="141" y="147" width="93" height="26" rx="5" fill="#282b25" /><text x="159" y="164" fill="#fff" fontSize="9" fontFamily="Manrope, sans-serif">Explore product</text>
      </g>
      <g className="scene-core"><rect x="183" y="213" width="66" height="66" rx="18" fill="#dd784e" stroke="#f7b996" strokeWidth="1.5" /><path d="M201 254v-19a6 6 0 0 1 6-6h23m-29 25h23a6 6 0 0 0 6-6v-19m-22 19 15-12m-12 0h12v12" stroke="#241f1a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="scene-agent" filter="url(#path-shadow)" transform="rotate(5 290 331)">
        <rect x="170" y="283" width="232" height="121" rx="11" fill="#f8f7f2" />
        <rect x="185" y="297" width="23" height="23" rx="6" fill="#e8eade" /><path d="m191 305 4 4-4 4m8 0h4" stroke="#61704e" strokeWidth="1.4" strokeLinecap="round" />
        <text x="217" y="313" fill="#282b25" fontSize="12" fontWeight="650" fontFamily="Manrope, sans-serif">The agent's perspective</text>
        <path d="M185 330h202" stroke="#e5e2d9" />
        <text x="185" y="350" fill="#807c70" fontSize="10" fontFamily="monospace">role</text><text x="252" y="350" fill="#586b43" fontSize="10" fontFamily="monospace">"link"</text>
        <text x="185" y="369" fill="#807c70" fontSize="10" fontFamily="monospace">name</text><text x="252" y="369" fill="#586b43" fontSize="10" fontFamily="monospace">"Explore product"</text>
        <text x="185" y="388" fill="#807c70" fontSize="10" fontFamily="monospace">action</text><text x="252" y="388" fill="#586b43" fontSize="10" fontFamily="monospace">"navigate"</text>
      </g>
      <text x="38" y="345" fill="#d1cec2" fontSize="12" fontFamily="Manrope, sans-serif">Same website.</text><text x="38" y="364" fill="#f1b18c" fontSize="12" fontFamily="Manrope, sans-serif">New perspective.</text>
    </svg>
    <div className="illustration-caption"><span>Inspect</span><i /><span>Understand</span><i /><span>Verify</span></div>
  </div>;
}
