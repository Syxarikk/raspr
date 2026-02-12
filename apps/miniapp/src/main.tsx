import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' });

function App() {
  const [token, setToken] = useState(localStorage.getItem('mini_token') || '');
  const [tab, setTab] = useState<'orders'|'payouts'|'profile'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [me, setMe] = useState<any>();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) return;
    api.get('/orders', { headers }).then((r) => setOrders(r.data));
    api.get('/payouts', { headers }).then((r) => setPayouts(r.data));
    api.get('/users/me', { headers }).then((r) => setMe(r.data));
  }, [token]);

  if (!token) return <div style={{padding: 16}}><h2>Mini App login</h2><button onClick={async ()=>{
    const {data} = await api.post('/auth/telegram', {telegram_id: 123456789});
    localStorage.setItem('mini_token', data.access_token);setToken(data.access_token);
  }}>Войти как Telegram пользователь</button></div>

  return <div style={{fontFamily:'sans-serif', paddingBottom: 70, padding: 12}}>
    <h2>AdControl Mini App</h2>
    {tab==='orders' && <Orders orders={orders} />}
    {tab==='payouts' && <Payouts payouts={payouts} />}
    {tab==='profile' && <Profile me={me} />}
    <footer style={{position:'fixed',bottom:0,left:0,right:0,display:'flex',justifyContent:'space-around',padding:12,borderTop:'1px solid #ddd',background:'#fff'}}>
      <button onClick={()=>setTab('orders')}>Наряды</button>
      <button onClick={()=>setTab('payouts')}>Оплата</button>
      <button onClick={()=>setTab('profile')}>Профиль</button>
    </footer>
  </div>
}

const Orders = ({orders}:any)=><div><h3>Сделать / Ожидаем / Закрытые</h3>{orders.map((o:any)=><div key={o.id} style={{border:'1px solid #ddd',padding:8,marginBottom:8}}>#{o.id} {o.title} — {o.status}</div>)}</div>
const Payouts = ({payouts}:any)=><div><h3>Оплата</h3>{payouts.map((p:any)=><div key={p.order_id}>Наряд {p.order_id}: {p.amount_preliminary} / {p.amount_final} — {p.status}</div>)}</div>
const Profile = ({me}:any)=><div><h3>Профиль</h3><div>{me?.full_name}</div><div>{me?.username}</div><div>Готов брать наряды: {String(me?.is_ready)}</div></div>

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
