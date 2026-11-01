import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';

const KEY_STORAGE = 'instabox_api_key';

const STATE_LABEL = {
  creating: '创建中', starting: '启动中', running: '运行中', stopping: '停止中',
  stopped: '已停止', suspending: '暂停中', suspended: '已暂停', resuming: '恢复中',
  deleting: '删除中', deleted: '已删除', error: '错误',
};

function badgeClass(state) {
  if (state === 'running') return 'badge badge-green';
  if (state === 'error') return 'badge badge-red';
  if (['stopped', 'suspended', 'deleted'].includes(state)) return 'badge badge-gray';
  return 'badge badge-orange';
}

function fmtDate(d) {
  try { return new Date(d).toLocaleString('zh-CN'); } catch { return d; }
}

function parseMetrics(data) {
  const arr = data.metrics || [];
  if (!arr.length) return null;
  const m = arr[arr.length - 1];
  return {
    cpu: m.cpuUsedPct,
    memPercent: m.memTotal ? (m.memUsed / m.memTotal) * 100 : 0,
    memUsedMiB: m.memUsed / 1048576,
    memTotalMiB: m.memTotal / 1048576,
  };
}

function pollOperation(opId, key, onDone) {
  let n = 0;
  const timer = setInterval(async () => {
    n += 1;
    try {
      const op = await api.getOperation(key, opId);
      if (op.state === 'succeeded') { clearInterval(timer); onDone(null); }
      else if (op.state === 'failed') { clearInterval(timer); onDone(new Error(op.message || '操作失败')); }
      else if (n >= 60) { clearInterval(timer); onDone(new Error('操作超时')); }
    } catch (e) { clearInterval(timer); onDone(e); }
  }, 2000);
}

function KeyBar({ apiKey, onSave, onClear }) {
  const [editing, setEditing] = useState(!apiKey);
  const [val, setVal] = useState('');
  return (
    <div className="card pad">
      <div className="keyrow">
        <span className="muted keylabel">API Key</span>
        {editing ? (
          <div className="keyedit">
            <input
              type="password" placeholder="ibk_...（留空则用服务端环境变量）"
              value={val} onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (onSave(val.trim()), setEditing(false))}
            />
            <button className="btn primary" onClick={() => { onSave(val.trim()); setEditing(false); }}>保存</button>
            {apiKey && <button className="btn ghost" onClick={() => setEditing(false)}>取消</button>}
          </div>
        ) : (
          <div className="keyshow">
            <code>{apiKey ? apiKey.slice(0, 7) + '...' : '服务端环境变量'}</code>
            <button className="btn outline sm" onClick={() => { setVal(apiKey); setEditing(true); }}>更换</button>
            {apiKey && <button className="btn ghost sm" onClick={onClear}>清除</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function MachineList({ apiKey, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const alive = useRef(true);

  const load = async (silent) => {
    if (silent) setFetching(true); else setLoading(true);
    setError('');
    try {
      const d = await api.listMachines(apiKey);
      if (alive.current) setData(d);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) { setLoading(false); setFetching(false); }
    }
  };

  useEffect(() => {
    alive.current = true;
    load(false);
    return () => { alive.current = false; };
  }, []);

  const items = (data && data.items) || [];

  return (
    <div className="space">
      <div className="head">
        <h1>机器列表</h1>
        <button className="btn outline" onClick={() => load(true)} disabled={fetching}>
          {fetching ? '刷新中…' : '刷新'}
        </button>
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card pad skeleton" />)}
        </div>
      ) : error ? (
        <div className="alert red">{error}</div>
      ) : items.length === 0 ? (
        <div className="card pad center muted">暂无机器</div>
      ) : (
        <div className="grid">
          {items.map((m) => (
            <div key={m.id} className="card pad machine" onClick={() => onOpen(m.id)}>
              <div className="machine-head">
                <h3>{m.name}</h3>
                <span className={badgeClass(m.state)}>{STATE_LABEL[m.state] || m.state}</span>
              </div>
              <div className="line"><span className="muted w">ID</span><code className="tiny">{m.id}</code></div>
              <div className="line"><span className="muted w">规格</span>
                <span>{m.spec.vcpus} vCPU / {m.spec.memMiB} MiB</span></div>
              <div className="line"><span className="muted w">创建</span><span className="small">{fmtDate(m.createdAt)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MachineDetail({ apiKey, id, onBack }) {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [cmd, setCmd] = useState('');
  const [exec, setExec] = useState(null);
  const [execing, setExecing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const alive = useRef(true);

  const reload = async () => {
    try {
      const d = await api.getMachine(apiKey, id);
      if (alive.current) setM(d);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try { setMetrics(parseMetrics(await api.getMetrics(apiKey, id))); } catch { /* 指标可能暂无 */ }
  };

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (m && m.state === 'running') loadMetrics();
  }, [m?.state]);

  const doLifecycle = async (action, label) => {
    if (busy) return;
    setBusy(true); setBusyText(label); setError('');
    try {
      const op = await api.lifecycle(apiKey, id, action);
      pollOperation(op.id, apiKey, async (err) => {
        if (!alive.current) return;
        setBusy(false); setBusyText('');
        if (err) setError(err.message);
        await reload();
      });
    } catch (e) {
      setBusy(false); setBusyText(''); setError(e.message);
    }
  };

  const doDelete = async () => {
    if (busy) return;
    if (!window.confirm(`确定删除机器「${m.name}」？此操作不可撤销`)) return;
    setBusy(true); setBusyText('删除');
    try {
      const op = await api.deleteMachine(apiKey, id);
      pollOperation(op.id, apiKey, (err) => {
        if (err) { setBusy(false); setBusyText(''); setError(err.message); }
        else onBack();
      });
    } catch (e) {
      setBusy(false); setBusyText(''); setError(e.message);
    }
  };

  const doExec = async () => {
    if (!cmd.trim() || execing) return;
    setExecing(true); setExec(null);
    try {
      setExec(await api.execCommand(apiKey, id, cmd.trim()));
    } catch (e) { setError(e.message); }
    finally { setExecing(false); }
  };

  if (loading) return <div className="space"><div className="card pad skeleton tall" /></div>;
  if (!m) return <div className="space"><div className="alert red">{error || '加载失败'}</div></div>;

  const state = m.state;
  const canStart = ['stopped', 'suspended'].includes(state);
  const canStop = state === 'running';
  const canSuspend = state === 'running';
  const canResume = state === 'suspended';
  const canExec = state === 'running';

  return (
    <div className="space">
      <div className="head">
        <button className="btn ghost" onClick={onBack}>← 返回</button>
        <h1>{m.name}</h1>
        <span className={badgeClass(state)}>{STATE_LABEL[state] || state}</span>
      </div>

      {error && <div className="alert red">{error}</div>}
      {busy && <div className="alert orange">操作进行中：{busyText}…</div>}

      <div className="card">
        <div className="card-title">基础信息</div>
        <div className="info-grid">
          <div className="line"><span className="muted w">机器 ID</span><code className="tiny">{m.id}</code></div>
          <div className="line"><span className="muted w">规格</span><span>{m.spec.vcpus} vCPU / {m.spec.memMiB} MiB</span></div>
          <div className="line"><span className="muted w">创建时间</span><span className="small">{fmtDate(m.createdAt)}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">生命周期</div>
        <div className="btns">
          <button className="btn primary" disabled={!canStart || busy} onClick={() => doLifecycle('start', '启动')}>启动</button>
          <button className="btn outline" disabled={!canStop || busy} onClick={() => doLifecycle('stop', '停止')}>停止</button>
          <button className="btn outline" disabled={!canSuspend || busy} onClick={() => doLifecycle('suspend', '暂停')}>暂停</button>
          <button className="btn outline" disabled={!canResume || busy} onClick={() => doLifecycle('resume', '恢复')}>恢复</button>
          <button className="btn danger" disabled={busy} onClick={doDelete}>删除</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">执行命令</div>
        <textarea
          className="cmd" placeholder="输入命令，例如 ls -la /" value={cmd}
          onChange={(e) => setCmd(e.target.value)} disabled={!canExec}
        />
        <div className="right">
          <button className="btn primary" disabled={!canExec || execing || !cmd.trim()} onClick={doExec}>
            {execing ? '执行中…' : '执行'}
          </button>
        </div>
        {exec && (
          <div className="exec">
            <div className="line"><span className="muted">exitCode</span>
              <span className={exec.exitCode === 0 ? 'ok' : 'fail'}>{exec.exitCode}</span></div>
            {exec.stdout && <div><div className="muted small">stdout</div><pre className="pre ok-bg">{exec.stdout}</pre></div>}
            {exec.stderr && <div><div className="muted small">stderr</div><pre className="pre fail-bg">{exec.stderr}</pre></div>}
          </div>
        )}
      </div>

      {state === 'running' && (
        <div className="card">
          <div className="card-title">资源指标</div>
          {metrics ? (
            <div className="metric-grid">
              <div className="metric"><div className="muted small">CPU 使用率</div><div className="big">{metrics.cpu.toFixed(1)}%</div></div>
              <div className="metric"><div className="muted small">内存</div>
                <div className="big">{metrics.memPercent.toFixed(1)}%</div>
                <div className="muted small">{metrics.memUsedMiB.toFixed(0)} / {metrics.memTotalMiB.toFixed(0)} MiB</div>
              </div>
            </div>
          ) : <div className="muted small">指标采集中，稍后可刷新页面</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '');
  const [view, setView] = useState({ type: 'list' });

  const saveKey = (k) => {
    if (k) localStorage.setItem(KEY_STORAGE, k);
    setApiKey(k);
  };
  const clearKey = () => { localStorage.removeItem(KEY_STORAGE); setApiKey(''); };

  return (
    <div className="wrap">
      <header className="topbar">InstaBox 机器管理</header>
      <main className="main">
        <KeyBar apiKey={apiKey} onSave={saveKey} onClear={clearKey} />
        {view.type === 'list'
          ? <MachineList key={apiKey} apiKey={apiKey} onOpen={(id) => setView({ type: 'detail', id })} />
          : <MachineDetail key={apiKey} apiKey={apiKey} id={view.id} onBack={() => setView({ type: 'list' })} />}
      </main>
    </div>
  );
}
