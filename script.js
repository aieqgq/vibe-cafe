/* ============================================================
   바이브 카페 주문서 - script.js
   기능: 금액 계산 / 주문 접수 / 탭 전환 / 주문 내역 관리
         Supabase 연동 (cafe_menu03 테이블에 주문 저장)
============================================================ */


/* ──────────────────────────────────────
   0. Supabase 설정
   ※ 아래 두 값은 Supabase 대시보드 → Project Settings → API에서 확인
      SUPABASE_URL  : "https://xxxx.supabase.co" 형태
      SUPABASE_KEY  : anon/public key (긴 JWT 문자열)
────────────────────────────────────── */

// Supabase 프로젝트 URL (직접 입력)
const SUPABASE_URL = 'https://mwsggpdswmdtzkqtuolb.supabase.co';

// Supabase anon(공개) API 키 (직접 입력)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13c2dncGRzd21kdHprcXR1b2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDU2MTMsImV4cCI6MjEwNjk4MTYxM30.L-VuUCuJOvCZ3q-VFYR1F6Qo6o1YB8zm5wDuyxrw444';

// supabase-js v2 CDN이 window.supabase 객체를 전역으로 노출함
// createClient()로 클라이언트 인스턴스를 생성해서 DB 호출에 사용
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* ──────────────────────────────────────
   1. 전역 상태 변수
────────────────────────────────────── */

// 접수된 주문을 담는 배열
// 형식: { id, name, phone, drink, drinkLabel, size, options, quantity, request, price, time }
let orders = [];

// 주문 번호 카운터 (주문마다 1씩 증가)
let nextOrderId = 1;



/* ──────────────────────────────────────
   2. DOM 요소 참조
   (자주 쓰는 요소를 변수에 미리 저장해두면 편리)
────────────────────────────────────── */

const form            = document.getElementById('order-form');
const drinkSelect     = document.getElementById('drink');
const sizeRadios      = document.querySelectorAll('input[name="size"]');
const optionChecks    = document.querySelectorAll('input[name="options"]');
const quantityInput   = document.getElementById('quantity');
const estimatedPrice  = document.getElementById('estimated-price');
const confirmation    = document.getElementById('order-confirmation');
const resetBtn        = document.getElementById('reset-btn');

// 탭 관련
const tabBtns         = document.querySelectorAll('.tab-btn');
const tabPanels       = document.querySelectorAll('.tab-panel'); // main#tab-order, section#tab-history
const badge           = document.getElementById('order-count-badge');

// 주문 내역 탭 관련
const historyEmpty    = document.getElementById('history-empty');
const orderList       = document.getElementById('order-list');
const historyFooter   = document.getElementById('history-footer');
const totalSummary    = document.getElementById('total-summary');
const clearAllBtn     = document.getElementById('clear-all-btn');


/* ──────────────────────────────────────
   3. 금액 계산 함수
   음료 + 사이즈 + 추가옵션의 가격을 합산해 예상 금액 업데이트
────────────────────────────────────── */

function calcPrice() {
  // ① 음료 가격: 선택된 option 요소의 data-price 읽기
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = parseInt(selectedOption.dataset.price || '0', 10);

  // ② 사이즈 가격: 체크된 라디오의 data-price 읽기
  let sizePrice = 0;
  sizeRadios.forEach(function(radio) {
    if (radio.checked) {
      sizePrice = parseInt(radio.dataset.price || '0', 10);
    }
  });

  // ③ 추가 옵션 가격: 체크된 항목들의 data-price 합산
  let optionPrice = 0;
  optionChecks.forEach(function(check) {
    if (check.checked) {
      optionPrice += parseInt(check.dataset.price || '0', 10);
    }
  });

  // ④ 수량 읽기 (최소 1, 최대 10 범위 제한)
  const qty = Math.max(1, Math.min(10, parseInt(quantityInput.value || '1', 10)));

  // ⑤ 총액 = (음료 + 사이즈 + 옵션) × 수량
  const total = (drinkPrice + sizePrice + optionPrice) * qty;

  // ⑥ 화면에 표시 (textContent: XSS 방지)
  estimatedPrice.textContent = '예상 금액: ' + total.toLocaleString() + '원';

  // 계산된 금액을 반환해서 주문 접수 시 재사용
  return total;
}


/* ──────────────────────────────────────
   4. 금액 자동 계산 이벤트 등록
   음료·사이즈·옵션·수량이 바뀔 때마다 calcPrice() 호출
────────────────────────────────────── */

drinkSelect.addEventListener('change', calcPrice);

sizeRadios.forEach(function(radio) {
  radio.addEventListener('change', calcPrice);
});

optionChecks.forEach(function(check) {
  check.addEventListener('change', calcPrice);
});

quantityInput.addEventListener('input', calcPrice);


/* ──────────────────────────────────────
   5. 탭 전환 함수
   클릭한 탭을 활성화하고 나머지 탭 패널은 숨김
────────────────────────────────────── */

function switchTab(targetTabId) {
  // 모든 탭 버튼에서 active 클래스 제거
  tabBtns.forEach(function(btn) {
    btn.classList.remove('active');
  });

  // 모든 탭 패널을 hidden 처리
  tabPanels.forEach(function(panel) {
    panel.classList.add('hidden');
  });

  // 클릭한 탭 버튼에 active 추가
  const clickedBtn = document.querySelector('.tab-btn[data-tab="' + targetTabId + '"]');
  if (clickedBtn) {
    clickedBtn.classList.add('active');
  }

  // 해당 패널 보이기
  const targetPanel = document.getElementById('tab-' + targetTabId);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
  }
}

// 탭 버튼 클릭 이벤트 등록
tabBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchTab(btn.dataset.tab);
  });
});


/* ──────────────────────────────────────
   6. 주문 내역 렌더링 함수 (renderOrders)
   orders 배열을 읽어 화면의 주문 목록을 다시 그림
   → 주문 추가 / 삭제 / 전체 삭제 후 항상 이 함수를 호출
────────────────────────────────────── */

function renderOrders() {
  // 기존 카드 목록 초기화
  orderList.innerHTML = '';

  if (orders.length === 0) {
    // 주문이 없으면 안내 문구 표시, 하단 요약 숨김
    historyEmpty.classList.remove('hidden');
    historyFooter.classList.add('hidden');
    badge.classList.add('hidden');
    return;
  }

  // 주문이 있으면 안내 문구 숨기고 하단 요약 표시
  historyEmpty.classList.add('hidden');
  historyFooter.classList.remove('hidden');

  // 배지: 건수 업데이트 후 보이기
  badge.textContent = orders.length;
  badge.classList.remove('hidden');

  // 최신 주문이 맨 위에 오도록 역순으로 순회
  const reversed = orders.slice().reverse();

  reversed.forEach(function(order) {
    // ── li 카드 요소 생성 ──
    const li = document.createElement('li');
    li.className = 'order-card';

    // ── 1줄: 주문번호 · 이름 · 금액 ──
    const titleEl = document.createElement('p');
    titleEl.className = 'order-card-title';
    // textContent로 삽입: 손님이 입력한 이름이 HTML로 해석되지 않도록 보호
    titleEl.textContent =
      '#' + order.id + ' ' + order.name + '님  ·  ' +
      order.price.toLocaleString() + '원';

    // ── 2줄: 음료 + 사이즈 + 옵션 + 수량 ──
    const detailEl = document.createElement('p');
    detailEl.className = 'order-card-detail';
    // 옵션 목록 조합 (없으면 빈 문자열)
    const optionText = order.options.length > 0
      ? ' (' + order.options.join(', ') + ')'
      : '';
    detailEl.textContent =
      order.drinkLabel + ' ' + order.size + '사이즈' + optionText + ' ' + order.quantity + '잔';

    // ── 3줄: 요청사항(있을 때만) + 주문 시간 ──
    const metaEl = document.createElement('p');
    metaEl.className = 'order-card-meta';

    if (order.request) {
      // 요청사항 span (textContent로 삽입)
      const reqSpan = document.createElement('span');
      reqSpan.textContent = '요청: ' + order.request;
      metaEl.appendChild(reqSpan);

      // 구분점
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '·';
      metaEl.appendChild(dot);
    }

    // 주문 시간 span
    const timeSpan = document.createElement('span');
    timeSpan.textContent = order.time;
    metaEl.appendChild(timeSpan);

    // ── 취소 버튼 ──
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'order-cancel-btn';
    cancelBtn.textContent = '취소';

    // 취소 버튼 클릭: confirm으로 한 번 더 확인 후 삭제
    cancelBtn.addEventListener('click', function() {
      const confirmed = window.confirm(
        '#' + order.id + ' ' + order.name + '님의 주문을 취소하시겠습니까?'
      );
      if (confirmed) {
        // orders 배열에서 해당 주문 제거
        orders = orders.filter(function(o) { return o.id !== order.id; });
        renderOrders(); // 화면 다시 그리기
      }
    });

    // ── 카드에 자식 요소 조립 ──
    li.appendChild(cancelBtn);
    li.appendChild(titleEl);
    li.appendChild(detailEl);
    li.appendChild(metaEl);

    // ── 카드를 목록에 추가 ──
    orderList.appendChild(li);
  });

  // ── 총 주문 금액 계산 ──
  const totalPrice = orders.reduce(function(sum, o) { return sum + o.price; }, 0);
  // textContent로 삽입
  totalSummary.textContent =
    '총 주문 금액: ' + totalPrice.toLocaleString() + '원 (' + orders.length + '건)';
}


/* ──────────────────────────────────────
   7. 주문 접수 (폼 submit 이벤트)
   async 함수: Supabase에 저장할 때 await를 쓰기 위해 비동기로 선언
────────────────────────────────────── */

// submit 버튼 참조 (저장 중 비활성화용)
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async function(event) {
  // 브라우저 기본 제출(페이지 새로고침) 막기
  event.preventDefault();

  // ── 이름 필수 검사 ──
  const nameInput = document.getElementById('customer-name');
  if (nameInput.value.trim() === '') {
    alert('이름을 입력해주세요.');
    nameInput.focus();
    return; // 여기서 함수 종료 (주문 접수 안 함)
  }

  // ── 음료 필수 검사 ──
  if (drinkSelect.value === '') {
    alert('음료를 선택해주세요.');
    drinkSelect.focus();
    return;
  }

  // ── 현재 선택된 값들 수집 ──

  // 음료 이름 (option 텍스트에서 가격 부분 제거)
  const drinkLabel = drinkSelect.options[drinkSelect.selectedIndex].text
    .replace(/\s*\d[\d,]+원$/, '')  // " 3,500원" 같은 부분 제거
    .trim();

  // 음료 단가 (data-price 읽기)
  const drinkPrice = parseInt(
    drinkSelect.options[drinkSelect.selectedIndex].dataset.price || '0', 10
  );

  // 사이즈
  let selectedSize = 'M'; // 기본값
  sizeRadios.forEach(function(radio) {
    if (radio.checked) selectedSize = radio.value;
  });

  // 체크된 추가 옵션 목록
  const selectedOptions = [];
  const optionLabels = { shot: '샷 추가', cream: '크림 추가', syrup: '시럽 추가', decaf: '디카페인' };
  optionChecks.forEach(function(check) {
    if (check.checked) {
      selectedOptions.push(optionLabels[check.value] || check.value);
    }
  });

  // 수량
  const qty = Math.max(1, Math.min(10, parseInt(quantityInput.value || '1', 10)));

  // 요청사항 (trim으로 앞뒤 공백 제거)
  const requestText = document.getElementById('request').value.trim();

  // 최종 금액
  const finalPrice = calcPrice();

  // 현재 시간 포맷: "오전 10:30"
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const timeStr = ampm + ' ' + displayHour + ':' + minutes;


  /* ──────────────────────────
     Supabase에 저장
  ────────────────────────── */

  // 저장 중에는 버튼을 비활성화해서 두 번 눌리는 것 방지
  submitBtn.disabled = true;
  submitBtn.textContent = '저장 중...';

  // cafe_menu03 테이블에 넣을 데이터 객체
  // 열 이름은 Supabase 테이블 컬럼명과 정확히 일치해야 함
  const rowData = {
    customer_name: nameInput.value.trim(),   // 이름
    phone:         document.getElementById('phone').value.trim(), // 전화번호
    drink:         drinkLabel,               // 음료 이름 (예: "카페라떼")
    drink_price:   drinkPrice,               // 음료 단가 (숫자)
    size:          selectedSize,             // 사이즈 (S / M / L)
    options:       selectedOptions,          // 추가 옵션 배열 (예: ["샷 추가"])
    quantity:      qty,                      // 수량 (숫자)
    request:       requestText,              // 요청사항 (문자열, 없으면 '')
    total_price:   finalPrice                // 최종 금액 (숫자)
  };

  // Supabase insert 호출 (await: 저장이 끝날 때까지 기다림)
  const { error } = await supabaseClient
    .from('cafe_menu03')   // 테이블 이름
    .insert([rowData]);    // 배열로 감싸서 전달 (여러 행도 가능)

  // 버튼 원래 상태로 복구
  submitBtn.disabled = false;
  submitBtn.textContent = '주문하기';

  // ── 저장 실패 시 ──
  if (error) {
    // 사용자에게 알림
    alert('주문 저장에 실패했어요. 다시 시도해주세요.');
    // 개발자 콘솔에 상세 에러 출력 (F12 → Console 탭에서 확인)
    console.error('Supabase 저장 오류:', error);
    return; // 이후 처리 중단
  }

  /* ──────────────────────────
     저장 성공 이후 처리
  ────────────────────────── */

  // ── 새 주문 객체 생성 (화면 내역용) ──
  const newOrder = {
    id:         nextOrderId++,          // 주문번호 (1부터 증가)
    name:       nameInput.value.trim(), // 이름
    phone:      document.getElementById('phone').value.trim(),
    drink:      drinkSelect.value,
    drinkLabel: drinkLabel,
    size:       selectedSize,
    options:    selectedOptions,
    quantity:   qty,
    request:    requestText,
    price:      finalPrice,
    time:       timeStr
  };

  // orders 배열 맨 뒤에 추가 (renderOrders에서 역순으로 표시)
  orders.push(newOrder);

  // ── 주문 확인 메시지 표시 ──
  // innerHTML 대신 textContent만 사용 (보안: XSS 방지)
  const optionSummary = selectedOptions.length > 0
    ? ' + ' + selectedOptions.join(', ')
    : '';

  // 확인 메시지를 여러 줄로 구성
  confirmation.textContent = '';  // 기존 내용 초기화

  const msgLine1 = document.createElement('p');
  msgLine1.textContent = '✅ 주문이 접수되었습니다!';

  const msgLine2 = document.createElement('p');
  msgLine2.textContent =
    newOrder.name + '님  ·  ' + drinkLabel + ' ' + selectedSize + '사이즈' + optionSummary;

  const msgLine3 = document.createElement('p');
  msgLine3.textContent = qty + '잔  ·  ' + finalPrice.toLocaleString() + '원';

  confirmation.appendChild(msgLine1);
  confirmation.appendChild(msgLine2);
  confirmation.appendChild(msgLine3);

  // hidden 속성 제거해서 메시지 보이기
  confirmation.removeAttribute('hidden');

  // ── 주문 내역 렌더링 업데이트 ──
  renderOrders();

  // ── 주문서 폼 초기화 ──
  // form.reset()은 input·select·textarea를 기본값으로 돌려놓음
  form.reset();
  // 예상 금액도 0원으로 초기화
  estimatedPrice.textContent = '예상 금액: 0원';
});


/* ──────────────────────────────────────
   8. 다시 작성 버튼
   폼만 초기화, 주문 내역은 건드리지 않음
────────────────────────────────────── */

resetBtn.addEventListener('click', function() {
  // form.reset()이 이미 type="reset" 버튼에 의해 자동 실행됨
  // 추가로 예상 금액 표시와 확인 메시지만 초기화

  // 예상 금액 0원으로 리셋
  estimatedPrice.textContent = '예상 금액: 0원';

  // 주문 확인 메시지 다시 숨기기
  confirmation.setAttribute('hidden', '');
});


/* ──────────────────────────────────────
   9. 내역 모두 지우기 버튼
────────────────────────────────────── */

clearAllBtn.addEventListener('click', function() {
  // 한 번 더 확인
  const confirmed = window.confirm('주문 내역을 모두 지우시겠습니까?');
  if (confirmed) {
    orders = [];           // 배열 비우기
    renderOrders();        // 화면 다시 그리기
  }
});


/* ──────────────────────────────────────
   10. 페이지 로드 시 초기화
────────────────────────────────────── */

// 초기 금액 계산 (M 사이즈가 기본 선택이므로 +500원 반영)
calcPrice();

// 주문 내역 초기 렌더링 (빈 상태)
renderOrders();

