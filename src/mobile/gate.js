/* The capability screen.
 *
 * Most of the traffic this project gets arrives on a phone, loads a scene
 * built for a desktop GPU, and leaves thinking the thing is broken. This is
 * the fix, and the shape of it matters: it is a door with a sign on it, not a
 * wall. Newer iPhones and iPads genuinely run this at full quality, there is
 * no reduced-fidelity tier for them to fall back to, and deciding on their
 * behalf from a user-agent string would be both wrong and unpleasant. So the
 * screen says plainly what is about to happen, shows a frame of it, lists the
 * controls, and then gets out of the way when asked.
 *
 * Nothing here is imported unless `gateRequired()` said so, which is why the
 * poster's forty kilobytes and this file's DOM never reach a desktop at all.
 */
import { POSTER } from './poster.js';
import { isTouchPrimary } from './detect.js';

const TOUCH_CONTROLS = [
  ['화면을 드래그', '시점 이동'],
  ['이동 패드 누르기', '걷기'],
];

const KEY_CONTROLS = [
  ['클릭', '마우스 고정'],
  ['마우스', '시점 이동'],
  ['W A S D', '이동'],
  ['Shift / Space', '달리기 / 점프'],
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/**
 * Show the screen and resolve once the player has asked to go in.
 *
 * Resolves *after* the browser has painted the "building" state, not on the
 * tap itself. The world build is one long synchronous block — a hundred
 * thousand plants and fifteen GPU bakes — so a caller that started it inside
 * the click handler would freeze the page with the button still lit, which on
 * a slow device is indistinguishable from having crashed it.
 *
 * @returns {Promise<() => void>} a dismiss function, to call once the first
 *   frame exists. It fades the screen out rather than cutting, which also
 *   covers the moment between the canvas appearing and it having anything on
 *   it.
 */
export function presentGate() {
  document.getElementById('boot')?.remove();

  const root = el('div', 'gate');
  root.id = 'gate';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'gate-title');

  const card = el('div', 'gate__card');

  const still = document.createElement('img');
  still.className = 'gate__still';
  still.src = POSTER;
  still.alt = '울창한 나무 아래 넓은 잎이 펼쳐지고 오솔길 위로 햇빛이 비치는 정글 풍경.';
  still.width = 720;
  still.height = 405;
  still.decoding = 'async';

  const body = el('div', 'gate__body');
  const kicker = el('p', 'gate__kicker', '실시간 3D 렌더링');
  const title = el('h1', 'gate__title', '정글 트레일');
  title.id = 'gate-title';

  const lede = el('p', 'gate__lede',
    '가로 180m, 세로 492m의 계곡, 약 10만 그루의 식물, 침식된 석재 536개, '
    + '합성 사운드 60개를 브라우저에서 직접 생성합니다. 사진이나 3D 모델 파일, '
    + '녹음된 소리는 사용하지 않습니다.');

  const warn = el('p', 'gate__lede',
    '데스크톱 GPU를 기준으로 제작되었으며, 휴대전화에서도 그래픽 품질을 낮추지 않습니다. '
    + '최근 iPhone과 iPad에서는 실행할 수 있지만, 오래된 휴대전화에서는 '
    + '발열과 속도 저하가 생기거나 실행되지 않을 수 있습니다.');

  const keys = el('dl', 'gate__keys');
  for (const [input, action] of isTouchPrimary() ? TOUCH_CONTROLS : KEY_CONTROLS) {
    const row = el('div', 'gate__key');
    row.append(el('dt', null, input), el('dd', null, action));
    keys.append(row);
  }

  const enter = el('button', 'gate__enter', '정글 탐험 시작');
  enter.type = 'button';

  const note = el('p', 'gate__note',
    '시작을 누르면 정글을 생성합니다. 기기에 따라 시간이 걸릴 수 있습니다.');

  body.append(kicker, title, lede, warn, keys, enter, note);
  card.append(still, body);
  root.append(card);
  document.body.append(root);

  return new Promise((resolve) => {
    const dismiss = () => {
      root.classList.add('is-leaving');
      setTimeout(() => root.remove(), 420);
    };

    enter.addEventListener('click', () => {
      enter.disabled = true;
      /* Everything below the still is replaced rather than hidden, so the
       * screen keeps its size and the frame stays on it. The player is
       * looking at the picture for the next several seconds either way. */
      body.replaceChildren(el('p', 'gate__building', '정글을 생성하고 있습니다'));
      root.classList.add('is-building');

      /* Two frames, not one. A single rAF fires before the paint it belongs
       * to, so resolving there hands the world build a screen that has been
       * described to the compositor and not yet drawn by it. */
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(dismiss)));
    }, { once: true });
  });
}
