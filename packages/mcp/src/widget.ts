export const HANDOUT_WIDGET_URI = "ui://handout/workspace-dashboard-v1.html";
export const HANDOUT_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export const HANDOUT_WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: transparent; color: CanvasText; }
    main { display: grid; gap: 10px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
    .mark { width: 18px; height: 20px; position: relative; }
    .mark i { position: absolute; display: block; width: 5px; border-radius: 2px; background: currentColor; transform: skewY(-29deg); }
    .mark i:nth-child(1) { left: 0; top: 5px; height: 11px; }
    .mark i:nth-child(2) { left: 7px; top: 0; height: 9px; }
    .mark i:nth-child(3) { left: 7px; top: 11px; height: 9px; }
    .mark i:nth-child(4) { right: 0; top: 6px; height: 11px; }
    .status { font-size: 11px; color: GrayText; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
    .card { border: 1px solid color-mix(in srgb, CanvasText 14%, transparent); border-radius: 12px; padding: 11px; background: color-mix(in srgb, Canvas 96%, CanvasText 4%); }
    .label { margin: 0 0 4px; color: GrayText; font-size: 11px; }
    .value { margin: 0; font-size: 15px; font-weight: 650; overflow-wrap: anywhere; }
    .list { display: grid; gap: 6px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent); }
    .row:first-child { border-top: 0; }
    .row strong { font-size: 13px; }
    .row span { color: GrayText; font-size: 11px; text-align: right; }
    .empty { padding: 18px 8px; text-align: center; color: GrayText; font-size: 13px; }
    .error { border-color: color-mix(in srgb, #dc2626 45%, transparent); color: #dc2626; }
    a { color: inherit; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <div class="header">
      <div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Handout</div>
      <span class="status" id="status">Ready</span>
    </div>
    <section id="content" class="card"><div class="empty">Ask Handout to build, personalize, publish, or analyze a site.</div></section>
  </main>
  <script type="module">
    const content = document.querySelector('#content');
    const status = document.querySelector('#status');
    let rpcId = 0;
    const pending = new Map();
    const request = (method, params) => new Promise((resolve, reject) => {
      const id = ++rpcId; pending.set(id, { resolve, reject });
      parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
    const notify = (method, params) => parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
    addEventListener('message', (event) => {
      if (event.source !== parent || !event.data || event.data.jsonrpc !== '2.0') return;
      const message = event.data;
      if (typeof message.id === 'number') {
        const item = pending.get(message.id); if (!item) return; pending.delete(message.id);
        return message.error ? item.reject(message.error) : item.resolve(message.result);
      }
      if (message.method === 'ui/notifications/tool-result') render(message.params);
    }, { passive: true });
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const label = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
    function metricCards(metrics) {
      return '<div class="grid">' + Object.entries(metrics).slice(0, 8).map(([key, value]) => '<div class="card"><p class="label">'+esc(label(key))+'</p><p class="value">'+esc(value)+'</p></div>').join('') + '</div>';
    }
    function rows(items) {
      return '<div class="list">' + items.slice(0, 8).map((item) => {
        const name = item.name || item.title || item.slug || 'Handout item';
        const detail = item.status || item.recipientCompany || item.slug || '';
        const url = item.url || item.editorUrl;
        const title = url ? '<a href="'+esc(url)+'" target="_blank" rel="noreferrer"><strong>'+esc(name)+'</strong></a>' : '<strong>'+esc(name)+'</strong>';
        return '<div class="row">'+title+'<span>'+esc(detail)+'</span></div>';
      }).join('') + '</div>';
    }
    function render(response) {
      const data = response?.structuredContent || response || {};
      status.textContent = data.error ? 'Needs attention' : 'Updated';
      content.className = 'card' + (data.error ? ' error' : '');
      if (data.error) return content.innerHTML = '<strong>'+esc(data.error.code || 'Handout error')+'</strong><p>'+esc(data.error.message || 'The request could not be completed.')+'</p>';
      if (data.metrics) return content.innerHTML = metricCards(data.metrics);
      if (Array.isArray(data.sites)) return content.innerHTML = rows(data.sites);
      if (Array.isArray(data.variants)) return content.innerHTML = rows(data.variants);
      if (Array.isArray(data.variantUrls)) return content.innerHTML = rows(data.variantUrls);
      if (data.site) return content.innerHTML = rows([{ ...data.site, editorUrl: data.editorUrl }]);
      if (data.valid !== undefined) return content.innerHTML = metricCards({ valid: data.valid ? 'Ready to publish' : 'Needs changes', issues: data.issues?.length || 0 });
      if (data.workflow) return content.innerHTML = rows(data.workflow.map((name, i) => ({ name: (i + 1) + '. ' + name })));
      content.innerHTML = metricCards(Object.fromEntries(Object.entries(data).filter(([,v]) => ['string','number','boolean'].includes(typeof v)).slice(0, 8)));
    }
    request('ui/initialize', { appInfo: { name: 'handout-dashboard', version: '1.0.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' })
      .then(() => notify('ui/notifications/initialized', {}))
      .catch(() => { status.textContent = 'Connected'; });
  </script>
</body>
</html>`;
