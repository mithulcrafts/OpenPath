// The installation gate is server-owned so protected hosting works independently
// of the report interface. The token is sent only to the same-origin auth route.
export const accessPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenPath — installation access</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f6f5;color:#18332e;font:16px/1.5 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,440px);background:white;padding:36px;border:1px solid #dce5e1;border-radius:20px}h1{font-size:28px;margin:12px 0}p{color:#52665f}label{display:block;font-weight:600;margin:24px 0 8px}input,button{width:100%;padding:13px;border:1px solid #8ca59b;border-radius:8px;font:inherit}button{margin-top:16px;background:#165d48;color:white;border:0;cursor:pointer}button:disabled{opacity:.65}input:focus-visible,button:focus-visible{outline:3px solid #82bca9;outline-offset:3px}#error{color:#9b2424;min-height:24px}small{color:#52665f}
</style></head><body><main><small>OPENPATH</small><h1>Open this installation</h1><p>Enter the access token supplied by the person hosting this demo.</p>
<form id="access"><label for="token">Installation access token</label><input id="token" name="token" type="password" autocomplete="current-password" required maxlength="500" aria-describedby="hint error"><p id="hint">This is the demo access token, not your Nebius API key.</p><button id="submit" type="submit">Continue to OpenPath</button><p id="error" role="alert"></p></form></main>
<script>
const form=document.getElementById('access');const button=document.getElementById('submit');const error=document.getElementById('error');
form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;error.textContent='';try{const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:document.getElementById('token').value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');document.getElementById('token').value='';window.location.assign('/');}catch(failure){error.textContent=failure instanceof Error?failure.message:'Sign-in failed.';button.disabled=false;}});
</script></body></html>`;
