const formatCount = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
};

const browserName = () => {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '알 수 없는 브라우저';
};

const platformName = () => {
  const platform = navigator.userAgentData?.platform || navigator.platform || '알 수 없음';
  const mobile = navigator.userAgentData?.mobile ? ' 모바일' : '';
  return `${platform}${mobile}`;
};

function gpuDetails(renderer) {
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
    vendor: debug
      ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR),
    webgl: gl.getParameter(gl.VERSION),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
}

/* The canvas is the entire experience, so nothing here reaches the document
 * until it is asked for: the overlay is built detached, F3 attaches it, and F3
 * again takes it back out along with its sampling timer. Once it is up the
 * header collapses it to the summary bar without hiding it. */
export class DebugOverlay {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.expanded = true;
    this.rows = new Map();
    this.gpu = gpuDetails(game.renderer);

    this.root = document.createElement('aside');
    this.root.id = 'debug-overlay';
    this.root.className = 'debug-overlay';
    this.root.setAttribute('aria-label', '성능 정보 패널');

    const header = document.createElement('button');
    header.className = 'debug-overlay__header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'true');
    header.title = '성능 정보 접기';

    const title = document.createElement('span');
    title.className = 'debug-overlay__title';
    title.textContent = '성능 정보';

    this.summary = document.createElement('span');
    this.summary.className = 'debug-overlay__summary';

    this.chevron = document.createElement('span');
    this.chevron.className = 'debug-overlay__chevron';
    this.chevron.setAttribute('aria-hidden', 'true');
    this.chevron.textContent = '−';

    header.append(title, this.summary, this.chevron);

    this.body = document.createElement('div');
    this.body.className = 'debug-overlay__body';
    this.addSection('성능', [
      ['fps', 'FPS'],
      ['frame', 'CPU 프레임'],
      ['draws', '장면 그리기'],
      ['triangles', '삼각형 수'],
    ]);
    this.addSection('렌더러', [
      ['tier', '품질'],
      ['resolution', '해상도'],
      ['resources', 'GPU 리소스'],
      ['gpu', 'GPU'],
      ['graphics', '그래픽 API'],
    ]);
    this.addSection('시스템', [
      ['platform', '플랫폼'],
      ['browser', '브라우저'],
      ['hardware', '하드웨어'],
    ]);

    this.root.append(header, this.body);

    this._timer = 0;
    this._toggle = () => this.setExpanded(!this.expanded);
    this._key = (event) => {
      if (event.code !== 'F3') return;
      event.preventDefault();
      this.setVisible(!this.visible);
    };
    header.addEventListener('click', this._toggle);
    window.addEventListener('keydown', this._key);
    this.header = header;
  }

  addSection(title, rows) {
    const section = document.createElement('section');
    section.className = 'debug-overlay__section';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.append(heading);

    for (const [key, label] of rows) {
      const row = document.createElement('div');
      row.className = 'debug-overlay__row';
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('output');
      value.textContent = '—';
      row.append(name, value);
      section.append(row);
      this.rows.set(key, value);
    }
    this.body.append(section);
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) {
      document.body.append(this.root);
      this.update();
      this._timer = window.setInterval(() => this.update(), 250);
      return;
    }
    clearInterval(this._timer);
    this._timer = 0;
    this.root.remove();
  }

  setExpanded(expanded) {
    this.expanded = expanded;
    this.root.classList.toggle('is-collapsed', !expanded);
    this.header.setAttribute('aria-expanded', String(expanded));
    this.header.title = `성능 정보 ${expanded ? '접기' : '펼치기'}`;
    this.chevron.textContent = expanded ? '−' : '+';
  }

  set(key, value, title = '') {
    const row = this.rows.get(key);
    if (!row) return;
    row.textContent = value;
    row.title = title || value;
  }

  update() {
    const { game } = this;
    const info = game.info();
    const renderer = game.renderer;
    const canvas = renderer.domElement;
    const fps = game.fps || 0;

    this.summary.textContent = `${fps.toFixed(0)} FPS`;
    this.set('fps', fps ? fps.toFixed(1) : '—');
    this.set('frame', game.frameMs ? `${game.frameMs.toFixed(2)} ms` : '—');
    this.set('draws', formatCount(info.calls));
    this.set('triangles', formatCount(info.triangles), `${info.triangles.toLocaleString()}개 삼각형`);
    this.set('tier', `${({ low: '낮음', medium: '보통', high: '높음', ultra: '최고' })[game.tier] || game.tier} · 최대 ${game.frameCap} FPS`);
    this.set(
      'resolution',
      `${canvas.width} × ${canvas.height} · ${renderer.getPixelRatio().toFixed(2)} dpr`,
    );
    this.set(
      'resources',
      `${info.geometries} 도형 · ${info.textures} 텍스처 · ${info.programs} 프로그램`,
    );
    this.set('gpu', this.gpu.renderer, `${this.gpu.vendor} · ${this.gpu.renderer}`);
    this.set(
      'graphics',
      `${this.gpu.webgl.replace('WebGL ', '')} · ${this.gpu.maxTexture}px 최대 텍스처`,
    );
    this.set('platform', platformName());
    this.set('browser', browserName(), navigator.userAgent);

    const cores = navigator.hardwareConcurrency
      ? `${navigator.hardwareConcurrency}개 논리 코어`
      : '코어 수 확인 불가';
    const memory = navigator.deviceMemory ? ` · ${navigator.deviceMemory} GB 메모리` : '';
    this.set('hardware', cores + memory);
  }

  dispose() {
    clearInterval(this._timer);
    window.removeEventListener('keydown', this._key);
    this.header.removeEventListener('click', this._toggle);
    this.root.remove();
  }
}
