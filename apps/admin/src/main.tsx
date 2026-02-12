import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import axios from 'axios';

 codex/create-mvp-for-adcontrol-web-service-zzf1po
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://176.106.144.117:51555' });

=======
 main
function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [tab, setTab] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [promoters, setPromoters] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get('/orders', { headers }),
      api.get('/addresses', { headers }),
      api.get('/users/promoters', { headers }),
      api.get('/work-types', { headers }),
    ]).then(([o, a, p, t]) => {
      setOrders(o.data);
      setAddresses(a.data);
      setPromoters(p.data);
      setTypes(t.data);
    });
  }, [token]);

  if (!token) return <Login onToken={setToken} />;

  return (
    <Container maxWidth="lg">
      <CssBaseline />
      <AppBar position="static" color="transparent">
        <Toolbar><Typography variant="h5">AdControl Admin</Typography></Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Dashboard" /><Tab label="Orders" /><Tab label="Addresses" /><Tab label="Employees" /><Tab label="Types & Pricing" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {tab === 0 && <Dashboard orders={orders} />}
        {tab === 1 && <Orders orders={orders} />}
        {tab === 2 && <Addresses addresses={addresses} />}
        {tab === 3 && <Employees users={promoters} />}
        {tab === 4 && <Types types={types} />}
      </Box>
    </Container>
  );
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [username, setUsername] = useState('operator');
  const [password, setPassword] = useState('operator123');
  return (
    <Container maxWidth="xs" sx={{ mt: 12 }}>
      <Typography variant="h4">Login</Typography>
      <TextField fullWidth margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} />
      <TextField fullWidth margin="normal" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="contained" onClick={async () => {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', data.access_token);
        onToken(data.access_token);
      }}>Login</Button>
    </Container>
  );
}

const Dashboard = ({ orders }: any) => <Box><Typography>Review: {orders.filter((o: any) => o.status === 'Review').length}</Typography><Typography>Payment: {orders.filter((o: any) => o.status === 'Payment').length}</Typography></Box>;
const Orders = ({ orders }: any) => <Box>{orders.map((o: any) => <Typography key={o.id}>#{o.id} {o.title} — {o.status}</Typography>)}</Box>;
const Addresses = ({ addresses }: any) => <Box>{addresses.map((a: any) => <Typography key={a.id}>{a.district} / {a.street} {a.building}</Typography>)}</Box>;
const Employees = ({ users }: any) => <Box>{users.map((u: any) => <Typography key={u.id}>{u.full_name} — {u.is_ready ? 'готов' : 'не готов'}</Typography>)}</Box>;
const Types = ({ types }: any) => <Box>{types.map((t: any) => <Typography key={t.id}>{t.name}: {t.price_per_unit} ₽</Typography>)}</Box>;

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AdminApp /></React.StrictMode>);
