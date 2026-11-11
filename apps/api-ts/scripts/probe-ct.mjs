const BASE='http://127.0.0.1:8001'
const login = await fetch(`${BASE}/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'demo@4-craft.com',password:'demo1234'})})
const {access_token}=await login.json()
for (const [name, ct, body] of [['text-plain','text/plain','hello'],['no-ct',null,'{"plan_code":"x"}'],['form','application/x-www-form-urlencoded','plan_code=x']]) {
  const headers={Authorization:`Bearer ${access_token}`}
  if (ct) headers['Content-Type']=ct
  const res=await fetch(`${BASE}/billing/create-checkout-session`,{method:'POST',headers,body})
  console.log(name, res.status, (await res.text()).slice(0,250))
}
